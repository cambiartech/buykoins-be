-- Quick Database Setup
-- Run: psql -U postgres -f database/quick-setup.sql

-- Create database
CREATE DATABASE buytiktokcoins;

-- Connect and setup (run this after connecting to buytiktokcoins)
\c buytiktokcoins;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: After running this, execute database/setup.sql to create all tables

