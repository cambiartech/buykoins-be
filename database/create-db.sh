#!/bin/bash

# BuyTikTokCoins Database Creation Script
# This script creates the PostgreSQL database

echo "🚀 Setting up BuyTikTokCoins database..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

# Database configuration (update these if needed)
DB_NAME="buytiktokcoins"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "📝 Database Configuration:"
echo "   Name: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo ""

# Check if database already exists
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "⚠️  Database '$DB_NAME' already exists."
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping existing database..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
    else
        echo "✅ Using existing database."
        exit 0
    fi
fi

# Create database
echo "📦 Creating database '$DB_NAME'..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully!"
    
    # Run setup script
    if [ -f "database/setup.sql" ]; then
        echo "📋 Running setup script..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/setup.sql
        if [ $? -eq 0 ]; then
            echo "✅ Database setup completed successfully!"
        else
            echo "❌ Error running setup script."
            exit 1
        fi
    else
        echo "⚠️  Setup script not found. Please run database/setup.sql manually."
    fi
else
    echo "❌ Failed to create database."
    exit 1
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with database credentials"
echo "2. Run: npm run start:dev"

