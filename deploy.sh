#!/bin/bash
set -e

SERVER="deployer@47.236.90.150"
REMOTE_DIR="/opt/apps/i3oy507-aipp"
TARBALL="/tmp/aipp-deploy.tar.gz"

echo "📦 打包项目文件..."
tar czf "$TARBALL" \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='data' --exclude='*.log' --exclude='.env*' \
  --exclude='public/generated' \
  package.json next.config.js next-env.d.ts tsconfig.json postcss.config.js tailwind.config.js Dockerfile \
  public/ src/

echo "📤 上传到服务器..."
scp -o StrictHostKeyChecking=no "$TARBALL" "$SERVER:$REMOTE_DIR/"

echo "🔨 重建并重启..."
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=10 "$SERVER" "
  cd $REMOTE_DIR
  rm -rf src public package.json next.config.js next-env.d.ts tsconfig.json postcss.config.js tailwind.config.js Dockerfile
  tar xzf aipp-deploy.tar.gz
  rm aipp-deploy.tar.gz

  mkdir -p $REMOTE_DIR/data/images || true

  docker rm -f aipp 2>/dev/null || true
  docker build --no-cache -t aipp .
  docker rm -f aipp 2>/dev/null || true
  docker run -d --name aipp -p 3001:3001 --env-file $REMOTE_DIR/.env \
    -v $REMOTE_DIR/data:/app/data \
    -v $REMOTE_DIR/generated:/app/public/generated \
    --restart unless-stopped aipp

  sleep 2
  docker exec -u root aipp chmod 777 /app/data/images 2>/dev/null || true

  # ── nginx 关键配置（幂等）──────────────────────────────────────
  # 之前的 sed 只能替换已有的 client_max_body_size，原配置里没这行就 no-op，
  # 导致云端上传图片走 nginx 默认 1m 限制被拒。这里改成：
  #   - 已有 client_max_body_size：替换数值
  #   - 没有：在 server { 后面追加一行
  # 同时设置 proxy_read/send_timeout 避免 AI 长连接被 nginx 60s 默认 timeout 切断
  docker run --rm -v /etc/nginx/conf.d:/nginx_conf alpine sh -c '
    CONF=/nginx_conf/aipp.conf
    if [ ! -f \"\$CONF\" ]; then
      echo \"[deploy] nginx config \$CONF 不存在，跳过修改\"
      exit 0
    fi
    cp \"\$CONF\" \"\$CONF.bak.\$(date +%s)\"
    # client_max_body_size 200m
    if grep -q \"client_max_body_size\" \"\$CONF\"; then
      sed -i \"s/client_max_body_size [0-9]*[mMkKgG];/client_max_body_size 200m;/\" \"\$CONF\"
    else
      sed -i \"/server {/a\\    client_max_body_size 200m;\" \"\$CONF\"
    fi
    # proxy_read_timeout 300s (AI calls can run 30-60s)
    if grep -q \"proxy_read_timeout\" \"\$CONF\"; then
      sed -i \"s/proxy_read_timeout [0-9]*s\\?;/proxy_read_timeout 300s;/\" \"\$CONF\"
    else
      sed -i \"/server {/a\\    proxy_read_timeout 300s;\" \"\$CONF\"
    fi
    if grep -q \"proxy_send_timeout\" \"\$CONF\"; then
      sed -i \"s/proxy_send_timeout [0-9]*s\\?;/proxy_send_timeout 300s;/\" \"\$CONF\"
    else
      sed -i \"/server {/a\\    proxy_send_timeout 300s;\" \"\$CONF\"
    fi
    echo \"[deploy] nginx config updated:\"
    grep -E \"client_max_body_size|proxy_(read|send)_timeout\" \"\$CONF\" || true
  '
  # validate config and reload
  docker run --rm --privileged --pid=host alpine \
    nsenter -t 1 -m -u -i -n -- sh -c \"nginx -t && nginx -s reload\" 2>&1 | tail -5 || true

  docker logs aipp 2>&1 | tail -5
"

rm -f "$TARBALL"
echo "✅ 部署完成"
