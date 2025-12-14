#!/bin/bash

# BuyKoins EC2 Instance Setup Script
# This creates and configures the EC2 instance for the API

set -e

REGION="us-east-1"
PROJECT_NAME="buytiktokcoins"
INSTANCE_TYPE="t2.micro"
AMI_ID="ami-0c55b159cbfafe1f0" # Ubuntu 22.04 LTS in us-east-1

echo "=========================================="
echo "BuyKoins EC2 Instance Setup"
echo "=========================================="
echo ""

# Load configuration
if [ ! -f "aws-config.env" ]; then
    echo "Error: aws-config.env not found. Run setup-aws-infrastructure.sh first."
    exit 1
fi

source aws-config.env

# Check for key pair
echo "Checking for EC2 key pair..."
read -p "Enter your EC2 key pair name (or press Enter to create one): " KEY_NAME

if [ -z "$KEY_NAME" ]; then
    KEY_NAME="${PROJECT_NAME}-key"
    echo "Creating key pair: $KEY_NAME"
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --region $REGION \
        --query 'KeyMaterial' \
        --output text > deploy/${KEY_NAME}.pem
    
    chmod 400 deploy/${KEY_NAME}.pem
    echo "Key pair saved to: deploy/${KEY_NAME}.pem"
    echo "KEEP THIS FILE SAFE - You'll need it to SSH into the server!"
fi

# Create user data script
cat > deploy/ec2-user-data.sh <<'USERDATA'
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
USERDATA

# Launch EC2 instance
echo ""
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $EC2_SECURITY_GROUP_ID \
    --subnet-id $SUBNET_ID \
    --user-data file://deploy/ec2-user-data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}-api},{Key=Project,Value=BuyKoins},{Key=Environment,Value=production}]" \
    --region $REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."

aws ec2 wait instance-running \
    --instance-ids $INSTANCE_ID \
    --region $REGION

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo ""
echo "=========================================="
echo "EC2 Instance Created!"
echo "=========================================="
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo ""
echo "SSH Command:"
echo "  ssh -i deploy/${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for instance setup to complete"
echo "2. SSH into the instance"
echo "3. Run: ./deploy/deploy-application.sh"
echo ""

# Save instance info
cat >> aws-config.env <<EOF

# EC2 Instance
EC2_INSTANCE_ID=$INSTANCE_ID
EC2_PUBLIC_IP=$PUBLIC_IP
EC2_KEY_NAME=$KEY_NAME
EOF

