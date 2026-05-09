#!/bin/bash
set -e

SERVER="deployer@47.95.109.68"
REMOTE_DIR="/opt/apps/aipp"
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
  docker builder prune -af 2>/dev/null || true
  docker build --no-cache -t aipp .
  docker rm -f aipp 2>/dev/null || true
  docker run -d --name aipp -p 3001:3001 --env-file $REMOTE_DIR/.env \
    -v $REMOTE_DIR/data:/app/data \
    -v $REMOTE_DIR/generated:/app/public/generated \
    --restart unless-stopped aipp

  sleep 2
  docker exec -u root aipp chmod 777 /app/data/images 2>/dev/null || true

  # 确保 nginx 允许大文件上传（200m），并 reload 配置
  docker run --rm -v /etc/nginx/conf.d:/nginx_conf alpine \
    sed -i 's/client_max_body_size [0-9]*m/client_max_body_size 200m/' /nginx_conf/aipp.conf
  docker run --rm --privileged --pid=host alpine \
    nsenter -t 1 -m -u -i -n -- nginx -s reload 2>/dev/null || true

  docker logs aipp 2>&1 | tail -5
"

rm -f "$TARBALL"
echo "✅ 部署完成"
