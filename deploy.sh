#!/bin/bash
# MutiExpert 一键部署脚本
# 用法: bash deploy.sh

set -e

SERVER_HOST="120.76.158.129"
SERVER_USER="root"

echo "=== Step 1: 配置 GitHub Secrets ==="
echo "请确保已安装 gh CLI 并登录"
gh secret set SERVER_HOST --repo senjay2580/MutiExpert --body "$SERVER_HOST"
gh secret set SERVER_USER --repo senjay2580/MutiExpert --body "$SERVER_USER"
read -sp "输入服务器密码: " SERVER_PASS
echo
gh secret set SERVER_PASSWORD --repo senjay2580/MutiExpert --body "$SERVER_PASS"
echo "GitHub Secrets 配置完成"

echo ""
echo "=== Step 2: 部署到服务器 ==="
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} << 'REMOTE'
# 开放防火墙端口
firewall-cmd --permanent --add-port=8080/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
echo "防火墙端口已开放"

# 克隆/更新代码
mkdir -p /opt/mutiexpert
cd /opt/mutiexpert
if [ -d .git ]; then
  git pull origin main
else
  git clone https://github.com/senjay2580/MutiExpert.git .
fi
echo "代码已更新"

# 创建 .env
POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || echo "change_me_in_production")
API_KEY=$(openssl rand -hex 24 2>/dev/null || echo "")

cat > .env << ENV
POSTGRES_USER=mutiexpert
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=mutiexpert
DATABASE_URL=postgresql+asyncpg://mutiexpert:$POSTGRES_PASSWORD@postgres:5432/mutiexpert
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_WEBHOOK_URL=
BACKEND_URL=http://localhost:8000
CORS_ORIGINS=http://120.76.158.129:8080
API_KEY=$API_KEY
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=52428800
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DEVICE=cpu
SKILLS_DIR=/app/skills
ENV
echo ".env 已创建"

# 启动容器
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
echo "容器启动中..."
sleep 10
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 入口健康检查（可选）
echo ""
echo "=== Health Check ==="
for i in $(seq 1 10); do
  if command -v curl >/dev/null 2>&1; then
    curl -fsS http://localhost:8080/health >/dev/null 2>&1 && curl -fsS http://localhost:8080/api/v1/health >/dev/null 2>&1 && break
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- http://localhost:8080/health >/dev/null 2>&1 && wget -qO- http://localhost:8080/api/v1/health >/dev/null 2>&1 && break
  else
    echo "未发现 curl/wget，跳过健康检查"
    break
  fi
  echo "Health check retry... ($i/10)"
  sleep 3
done
echo ""
echo "=== 部署完成 ==="
echo "前端: http://120.76.158.129:8080"
echo "API:  http://120.76.158.129:8080/api/v1/health"
REMOTE
