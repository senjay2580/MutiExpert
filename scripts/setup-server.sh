#!/bin/bash
set -e

echo "=== MutiExpert Server Setup ==="

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 2. Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 3. Install Git if not present
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    apt-get update && apt-get install -y git
fi

# 4. Clone or update repo
PROJECT_DIR="/opt/mutiexpert"
REPO_URL="https://github.com/senjay2580/MutiExpert.git"

if [ -d "$PROJECT_DIR" ]; then
    echo "Updating existing project..."
    cd "$PROJECT_DIR"
    git pull origin main
else
    echo "Cloning project..."
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# 5. Create .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env from example..."
    cp .env.example .env
    echo ""
    echo "!!! IMPORTANT: Edit /opt/mutiexpert/.env with your actual API keys !!!"
    echo ""
fi

# 6. Start services
echo "Starting services..."
docker compose up -d --build

# 7. Wait and check
echo "Waiting for services to start..."
sleep 10
docker compose ps

echo ""
echo "=== Setup Complete ==="
echo "Frontend: http://$(hostname -I | awk '{print $1}')"
echo "Backend API: http://$(hostname -I | awk '{print $1}')/api/v1"
echo "Health check: http://$(hostname -I | awk '{print $1}')/health"
echo ""
echo "Next steps:"
echo "1. Edit /opt/mutiexpert/.env with your API keys"
echo "2. Run: cd /opt/mutiexpert && docker compose restart"
