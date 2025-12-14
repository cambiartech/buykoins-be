#!/bin/bash

# BuyKoins Application Deployment Script
# Run this on the EC2 instance to deploy the application

set -e

echo "=========================================="
echo "BuyKoins Application Deployment"
echo "=========================================="
echo ""

# Check if running on EC2
if [ ! -f "/opt/buytiktokcoins" ]; then
    echo "This script should be run on the EC2 instance."
    echo "SSH into your EC2 instance first, then run this script."
    exit 1
fi

cd /opt/buytiktokcoins

# Clone repository (or use your deployment method)
echo "Step 1: Cloning repository..."
read -p "Enter your Git repository URL: " GIT_REPO
read -p "Enter branch name (default: main): " BRANCH
BRANCH=${BRANCH:-main}

if [ ! -d ".git" ]; then
    git clone -b $BRANCH $GIT_REPO .
else
    git pull origin $BRANCH
fi

# Install dependencies
echo ""
echo "Step 2: Installing dependencies..."
npm install --production

# Build application
echo ""
echo "Step 3: Building application..."
npm run build

# Setup environment variables
echo ""
echo "Step 4: Setting up environment variables..."
echo "You'll need to provide the following:"
echo ""

read -p "DB_HOST (from AWS RDS endpoint): " DB_HOST
read -p "DB_PASSWORD: " DB_PASSWORD
read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
read -p "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY
read -p "AWS_S3_BUCKET_NAME: " AWS_S3_BUCKET_NAME
read -p "JWT_SECRET (generate a secure random string): " JWT_SECRET
read -p "JWT_REFRESH_SECRET (generate a secure random string): " JWT_REFRESH_SECRET
read -p "CORS_ORIGIN (your frontend URL): " CORS_ORIGIN

# Generate secrets if not provided
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
fi
if [ -z "$JWT_REFRESH_SECRET" ]; then
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
fi

# Create .env file
cat > .env <<ENV
# Application
NODE_ENV=production
PORT=3001
API_PREFIX=api

# Database
DB_HOST=$DB_HOST
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=$DB_PASSWORD
DB_NAME=buytiktokcoins
DB_SSL=true

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME
AWS_SES_FROM_EMAIL=noreply@buytiktokcoins.com

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=$CORS_ORIGIN

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
ENV

echo ".env file created"

# Run database migrations
echo ""
echo "Step 5: Running database migrations..."
# You may need to run your migration scripts here
# For now, we'll assume the database is set up via setup.sql

# Start application with PM2
echo ""
echo "Step 6: Starting application..."
pm2 delete buytiktokcoins-api 2>/dev/null || true
pm2 start dist/main.js --name buytiktokcoins-api
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Application is running on: http://$(curl -s ifconfig.me):3001"
echo ""
echo "Check status:"
echo "  pm2 status"
echo "  pm2 logs buytiktokcoins-api"
echo ""
echo "Setup SSL certificate (optional):"
echo "  sudo certbot --nginx -d your-domain.com"

