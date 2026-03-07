#!/bin/bash
set -e

echo "=== NovaCaisse — Server Setup ==="
echo "This script prepares a fresh Ubuntu/Debian server for NovaCaisse."

# Update system
echo "Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in for group changes."
else
  echo "Docker already installed."
fi

# Install Docker Compose plugin
echo "Verifying Docker Compose..."
if ! docker compose version &> /dev/null; then
  sudo apt-get install -y docker-compose-plugin
fi

# Configure firewall (ufw)
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw --force enable
  echo "Firewall configured (ports 22, 80, 443)."
else
  echo "ufw not found — install it or configure your firewall manually."
fi

# Create app directory
APP_DIR="/opt/novacaisse"
echo "Setting up application directory at ${APP_DIR}..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

# Clone repository
if [ ! -d "${APP_DIR}/.git" ]; then
  echo "Cloning NovaCaisse repository..."
  git clone https://github.com/klibato/NovaCaisse.git "$APP_DIR"
else
  echo "Repository already cloned."
fi

cd "$APP_DIR"

# Setup environment
if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  echo ""
  echo "IMPORTANT: Edit .env.production and fill in your secrets:"
  echo "  nano ${APP_DIR}/.env.production"
  echo ""
  echo "Required values to change:"
  echo "  - DB_PASSWORD"
  echo "  - JWT_SECRET (generate with: openssl rand -hex 32)"
  echo "  - OVH_APPLICATION_KEY"
  echo "  - OVH_APPLICATION_SECRET"
  echo "  - OVH_CONSUMER_KEY"
  echo "  - LETSENCRYPT_EMAIL"
fi

echo ""
echo "=== Server setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env.production with your secrets"
echo "  2. Run: cd ${APP_DIR} && bash deploy.sh"
