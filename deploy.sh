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
firewall-cmd --permanent --add-port=8000/tcp 2>/dev/null || true
firewall-cmd --permanent --add-port=5433/tcp 2>/dev/null || true
firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
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
cat > .env << 'ENV'
POSTGRES_USER=mutiexpert
POSTGRES_PASSWORD=mutiexpert_secure_2024
POSTGRES_DB=mutiexpert
DATABASE_URL=postgresql+asyncpg://mutiexpert:mutiexpert_secure_2024@postgres:5432/mutiexpert
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_WEBHOOK_URL=
BACKEND_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000,http://120.76.158.129:8080
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=52428800
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DEVICE=cpu
SKILLS_DIR=/app/skills
ENV
echo ".env 已创建"

# 启动容器
docker compose up -d --build
echo "容器启动中..."
sleep 10
docker compose ps
echo ""
echo "=== 部署完成 ==="
echo "前端: http://120.76.158.129:8080"
echo "API:  http://120.76.158.129:8000/api/v1/system/health"
REMOTE
