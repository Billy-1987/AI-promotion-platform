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

  docker stop aipp 2>/dev/null; docker rm aipp 2>/dev/null
  docker build --no-cache -t aipp .
  docker run -d --name aipp -p 3001:3001 --env-file $REMOTE_DIR/.env \
    -v $REMOTE_DIR/data:/app/data \
    -v $REMOTE_DIR/generated:/app/public/generated \
    --restart unless-stopped aipp

  docker logs aipp 2>&1 | tail -5
"

rm -f "$TARBALL"
echo "✅ 部署完成"
