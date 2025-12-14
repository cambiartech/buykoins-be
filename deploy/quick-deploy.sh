#!/bin/bash

# Quick Deployment Script for BuyKoins
# This script quickly deploys changes to the EC2 instance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/aws-config.env" ]; then
    source "$SCRIPT_DIR/aws-config.env"
else
    echo -e "${RED}Error: aws-config.env not found${NC}"
    exit 1
fi

# Get EC2 IP from config or use default
EC2_IP="${EC2_PUBLIC_IP:-3.86.23.129}"
SSH_KEY="${SCRIPT_DIR}/buytiktokcoins-key.pem"

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}Error: SSH key not found at $SSH_KEY${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}BuyKoins Quick Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "EC2 Instance: $EC2_IP"
echo "SSH Key: $SSH_KEY"
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Warning: Not in a git repository. Will deploy current code.${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    DEPLOY_METHOD="scp"
else
    DEPLOY_METHOD="git"
    CURRENT_BRANCH=$(git branch --show-current)
    echo "Current branch: $CURRENT_BRANCH"
    echo ""
fi

# Function to deploy via Git
deploy_via_git() {
    echo -e "${GREEN}Deploying via Git...${NC}"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << ENDSSH
        set -e
        cd /opt/buytiktokcoins
        
        echo "📥 Pulling latest code..."
        git fetch origin
        git reset --hard origin/$CURRENT_BRANCH
        
        echo "📦 Installing dependencies..."
        npm ci --production
        
        echo "🔨 Building application..."
        npm run build
        
        echo "🔄 Restarting application..."
        pm2 restart buytiktokcoins-api || pm2 start dist/main.js --name buytiktokcoins-api
        pm2 save
        
        echo "✅ Deployment complete!"
        pm2 status
ENDSSH
}

# Function to deploy via SCP
deploy_via_scp() {
    echo -e "${GREEN}Deploying via SCP (current directory)...${NC}"
    
    # Build locally first
    echo "🔨 Building application locally..."
    npm run build
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    echo "📦 Preparing deployment package..."
    
    # Copy necessary files
    cp -r dist "$TEMP_DIR/"
    cp package.json "$TEMP_DIR/"
    cp package-lock.json "$TEMP_DIR/" 2>/dev/null || true
    
    # Create deployment script
    cat > "$TEMP_DIR/deploy.sh" << 'DEPLOYSCRIPT'
#!/bin/bash
set -e
cd /opt/buytiktokcoins

# Backup current version
if [ -d "dist" ]; then
    mv dist dist.backup.$(date +%s)
fi

# Copy new files
cp -r /tmp/deploy/dist .
cp package.json /tmp/deploy/package.json .

# Install dependencies
npm ci --production

# Restart application
pm2 restart buytiktokcoins-api || pm2 start dist/main.js --name buytiktokcoins-api
pm2 save

echo "✅ Deployment complete!"
pm2 status
DEPLOYSCRIPT
    chmod +x "$TEMP_DIR/deploy.sh"
    
    # Transfer files
    echo "📤 Transferring files to EC2..."
    scp -i "$SSH_KEY" -r "$TEMP_DIR"/* ubuntu@$EC2_IP:/tmp/deploy/
    
    # Run deployment on EC2
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << ENDSSH
        set -e
        chmod +x /tmp/deploy/deploy.sh
        /tmp/deploy/deploy.sh
        rm -rf /tmp/deploy
ENDSSH
    
    # Cleanup
    rm -rf "$TEMP_DIR"
}

# Main deployment
if [ "$DEPLOY_METHOD" = "git" ]; then
    deploy_via_git
else
    deploy_via_scp
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🌐 API URL: http://$EC2_IP/api"
echo "📊 Check logs: ssh -i $SSH_KEY ubuntu@$EC2_IP 'pm2 logs buytiktokcoins-api'"
echo "📈 Check status: ssh -i $SSH_KEY ubuntu@$EC2_IP 'pm2 status'"

