#!/bin/bash

# AWS Resource Cleanup Script for 'cleyverse' Project
# This script will stop/delete resources to reduce AWS costs
# Run with caution - these actions are irreversible!

REGION="us-east-1"

echo "=========================================="
echo "AWS Resource Cleanup Script"
echo "=========================================="
echo ""
echo "This will clean up resources from 'cleyverse' project:"
echo "1. Stop EC2 instance: cleyverse-app-staging"
echo "2. Stop RDS database: cleyverse-db-staging"
echo "3. Delete NAT Gateways (2x)"
echo "4. Release Elastic IPs (2x)"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Starting cleanup..."

# 1. Stop EC2 Instance
echo ""
echo "1. Stopping EC2 instance..."
aws ec2 stop-instances --region $REGION --instance-ids i-0f515f4976fc362aa
echo "   EC2 instance stop initiated."

# 2. Stop RDS Database (creates final snapshot)
echo ""
echo "2. Stopping RDS database..."
echo "   Note: This will create a final snapshot before stopping."
read -p "   Create final snapshot? (yes/no): " snapshot_confirm

if [ "$snapshot_confirm" == "yes" ]; then
    aws rds stop-db-instance --region $REGION --db-instance-identifier cleyverse-db-staging --db-snapshot-identifier cleyverse-db-staging-final-snapshot-$(date +%Y%m%d)
    echo "   RDS database stop initiated with snapshot."
else
    aws rds stop-db-instance --region $REGION --db-instance-identifier cleyverse-db-staging --skip-final-snapshot
    echo "   RDS database stop initiated (no snapshot)."
fi

# 3. Delete NAT Gateways
echo ""
echo "3. Deleting NAT Gateways..."
aws ec2 delete-nat-gateway --region $REGION --nat-gateway-id nat-0033191b4237c20de
aws ec2 delete-nat-gateway --region $REGION --nat-gateway-id nat-0c8227e8afa5dbe1d
echo "   NAT Gateways deletion initiated."

# 4. Release Elastic IPs
echo ""
echo "4. Releasing Elastic IPs..."
aws ec2 release-address --region $REGION --allocation-id $(aws ec2 describe-addresses --region $REGION --public-ips 98.90.112.20 --query 'Addresses[0].AllocationId' --output text)
aws ec2 release-address --region $REGION --allocation-id $(aws ec2 describe-addresses --region $REGION --public-ips 98.90.45.95 --query 'Addresses[0].AllocationId' --output text)
echo "   Elastic IPs released."

echo ""
echo "=========================================="
echo "Cleanup initiated!"
echo "=========================================="
echo ""
echo "Note:"
echo "- EC2 instance will stop (can be terminated later if needed)"
echo "- RDS database will stop (can be deleted later if needed)"
echo "- NAT Gateways are being deleted (this takes a few minutes)"
echo "- Elastic IPs are released"
echo ""
echo "Expected savings: ~\$90-100/month"
echo ""
echo "To verify cleanup, run:"
echo "  aws ec2 describe-instances --region $REGION"
echo "  aws rds describe-db-instances --region $REGION"
echo "  aws ec2 describe-nat-gateways --region $REGION"
echo "  aws ec2 describe-addresses --region $REGION"

