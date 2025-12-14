#!/bin/bash

# BuyKoins AWS Infrastructure Setup Script
# This script sets up all AWS resources needed for BuyKoins
# Cost: ~$0-5/month (free tier) or ~$20/month (after free tier)

set -e

REGION="us-east-1"
PROJECT_NAME="buytiktokcoins"
ENVIRONMENT="production"

echo "=========================================="
echo "BuyKoins AWS Infrastructure Setup"
echo "=========================================="
echo ""
echo "This will create:"
echo "1. RDS PostgreSQL database (db.t3.micro)"
echo "2. S3 bucket for file storage"
echo "3. Security groups"
echo "4. EC2 instance (t2.micro)"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Starting infrastructure setup..."

# Generate secure password for RDS
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "Generated DB password: $DB_PASSWORD"
echo "SAVE THIS PASSWORD - You'll need it for .env file!"

# Step 1: Create VPC Security Group for RDS
echo ""
echo "Step 1: Creating security groups..."
RDS_SG_ID=$(aws ec2 create-security-group \
    --group-name ${PROJECT_NAME}-rds-sg \
    --description "Security group for BuyKoins RDS database" \
    --region $REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-rds-sg" \
    --region $REGION \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo "RDS Security Group ID: $RDS_SG_ID"

# Step 2: Create Security Group for EC2
EC2_SG_ID=$(aws ec2 create-security-group \
    --group-name ${PROJECT_NAME}-api-sg \
    --description "Security group for BuyKoins API server" \
    --region $REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-api-sg" \
    --region $REGION \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo "EC2 Security Group ID: $EC2_SG_ID"

# Step 3: Get default VPC and subnets
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=isDefault,Values=true" \
    --region $REGION \
    --query 'Vpcs[0].VpcId' \
    --output text)

SUBNET_IDS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --region $REGION \
    --query 'Subnets[*].SubnetId' \
    --output text | awk '{print $1}')

echo "Using VPC: $VPC_ID"
echo "Using Subnet: $SUBNET_IDS"

# Step 4: Create DB Subnet Group
echo ""
echo "Step 2: Creating DB subnet group..."
aws rds create-db-subnet-group \
    --db-subnet-group-name ${PROJECT_NAME}-subnet-group \
    --db-subnet-group-description "Subnet group for BuyKoins RDS" \
    --subnet-ids $SUBNET_IDS \
    --region $REGION 2>/dev/null || echo "DB subnet group already exists"

# Step 5: Add security group rules
echo ""
echo "Step 3: Configuring security group rules..."

# Allow PostgreSQL from EC2 security group
aws ec2 authorize-security-group-ingress \
    --group-id $RDS_SG_ID \
    --protocol tcp \
    --port 5432 \
    --source-group $EC2_SG_ID \
    --region $REGION 2>/dev/null || echo "RDS rule already exists"

# Allow HTTP/HTTPS to EC2
aws ec2 authorize-security-group-ingress \
    --group-id $EC2_SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region $REGION 2>/dev/null || echo "HTTP rule already exists"

aws ec2 authorize-security-group-ingress \
    --group-id $EC2_SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $REGION 2>/dev/null || echo "HTTPS rule already exists"

# Allow SSH (restrict to your IP later)
echo ""
read -p "Enter your IP address for SSH access (or press Enter for 0.0.0.0/0): " YOUR_IP
YOUR_IP=${YOUR_IP:-0.0.0.0/0}

aws ec2 authorize-security-group-ingress \
    --group-id $EC2_SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr $YOUR_IP/32 \
    --region $REGION 2>/dev/null || echo "SSH rule already exists"

# Step 6: Create RDS Database
echo ""
echo "Step 4: Creating RDS PostgreSQL database..."
echo "This may take 5-10 minutes..."

DB_INSTANCE=$(aws rds describe-db-instances \
    --db-instance-identifier ${PROJECT_NAME}-db \
    --region $REGION \
    --query 'DBInstances[0].DBInstanceIdentifier' \
    --output text 2>/dev/null || echo "")

if [ -z "$DB_INSTANCE" ]; then
    aws rds create-db-instance \
        --db-instance-identifier ${PROJECT_NAME}-db \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version 15.4 \
        --master-username postgres \
        --master-user-password "$DB_PASSWORD" \
        --allocated-storage 20 \
        --storage-type gp3 \
        --vpc-security-group-ids $RDS_SG_ID \
        --db-subnet-group-name ${PROJECT_NAME}-subnet-group \
        --backup-retention-period 7 \
        --no-multi-az \
        --no-publicly-accessible \
        --region $REGION \
        --tags Key=Project,Value=BuyKoins Key=Environment,Value=$ENVIRONMENT

    echo "RDS database creation initiated. Waiting for it to be available..."
    aws rds wait db-instance-available \
        --db-instance-identifier ${PROJECT_NAME}-db \
        --region $REGION
else
    echo "RDS database already exists: $DB_INSTANCE"
    DB_PASSWORD=$(echo "Please check your existing password or reset it in AWS Console")
fi

# Get RDS endpoint
DB_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier ${PROJECT_NAME}-db \
    --region $REGION \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo "RDS Endpoint: $DB_ENDPOINT"

# Step 7: Create S3 Bucket
echo ""
echo "Step 5: Creating S3 bucket..."
BUCKET_NAME="${PROJECT_NAME}-proofs-$(date +%s)"

aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null || {
    # Try with different name if bucket exists
    BUCKET_NAME="${PROJECT_NAME}-proofs-$(openssl rand -hex 4)"
    aws s3 mb s3://$BUCKET_NAME --region $REGION
}

echo "S3 Bucket: $BUCKET_NAME"

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled \
    --region $REGION

# Block public access
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --region $REGION

# Step 8: Create IAM Role for EC2 (optional, for better security)
echo ""
echo "Step 6: Creating IAM role for EC2..."
# This allows EC2 to access S3 and SES without storing credentials

# Step 9: Save configuration
echo ""
echo "Step 7: Saving configuration..."
cat > deploy/aws-config.env <<EOF
# AWS Infrastructure Configuration
# Generated on: $(date)

# Database
DB_HOST=$DB_ENDPOINT
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=$DB_PASSWORD
DB_NAME=buytiktokcoins
DB_SSL=true

# AWS
AWS_REGION=$REGION
AWS_S3_BUCKET_NAME=$BUCKET_NAME
AWS_SES_FROM_EMAIL=noreply@buytiktokcoins.com

# Security Groups
RDS_SECURITY_GROUP_ID=$RDS_SG_ID
EC2_SECURITY_GROUP_ID=$EC2_SG_ID

# VPC
VPC_ID=$VPC_ID
SUBNET_ID=$SUBNET_IDS
EOF

echo ""
echo "=========================================="
echo "Infrastructure Setup Complete!"
echo "=========================================="
echo ""
echo "Configuration saved to: deploy/aws-config.env"
echo ""
echo "Next steps:"
echo "1. Review deploy/aws-config.env"
echo "2. Run: ./deploy/setup-ec2-instance.sh"
echo "3. Update your .env file with the values"
echo ""
echo "IMPORTANT: Save the DB password: $DB_PASSWORD"

