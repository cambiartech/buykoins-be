#!/bin/bash
set -e

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install PostgreSQL client
apt-get install -y postgresql-client

# Install Git
apt-get install -y git

# Install Nginx (for reverse proxy)
apt-get install -y nginx

# Install Certbot for SSL
apt-get install -y certbot python3-certbot-nginx

# Create application directory
mkdir -p /opt/buytiktokcoins
chown ubuntu:ubuntu /opt/buytiktokcoins

# Setup PM2 startup script
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Create nginx config
cat > /etc/nginx/sites-available/buytiktokcoins <<NGINX
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/buytiktokcoins /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

echo "EC2 setup complete!"
