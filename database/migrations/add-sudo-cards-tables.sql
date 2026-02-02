-- Sudo Africa Cards Integration - Database Migration
-- Run this migration to add tables for Sudo cards integration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sudo Customers Table
-- Links our users to Sudo customers
CREATE TABLE IF NOT EXISTS sudo_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sudo_customer_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sudo_customers_user_id ON sudo_customers(user_id);
CREATE INDEX idx_sudo_customers_sudo_customer_id ON sudo_customers(sudo_customer_id);
CREATE INDEX idx_sudo_customers_status ON sudo_customers(status);

-- Cards Table
-- Stores virtual cards issued to users
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sudo_customer_id UUID NOT NULL REFERENCES sudo_customers(id) ON DELETE CASCADE,
  sudo_card_id VARCHAR(255) NOT NULL UNIQUE,
  card_number VARCHAR(20),
  card_type VARCHAR(20) DEFAULT 'virtual',
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  status VARCHAR(20) DEFAULT 'active',
  balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  expiry_month VARCHAR(2),
  expiry_year VARCHAR(4),
  is_default BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_sudo_customer_id ON cards(sudo_customer_id);
CREATE INDEX idx_cards_sudo_card_id ON cards(sudo_card_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_is_default ON cards(user_id, is_default) WHERE is_default = true;

-- Card Transactions Table
-- Tracks card usage and transactions
CREATE TABLE IF NOT EXISTS card_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sudo_transaction_id VARCHAR(255) UNIQUE,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  merchant_name VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reference VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_card_transactions_card_id ON card_transactions(card_id);
CREATE INDEX idx_card_transactions_user_id ON card_transactions(user_id);
CREATE INDEX idx_card_transactions_sudo_transaction_id ON card_transactions(sudo_transaction_id);
CREATE INDEX idx_card_transactions_type ON card_transactions(type);
CREATE INDEX idx_card_transactions_status ON card_transactions(status);
CREATE INDEX idx_card_transactions_created_at ON card_transactions(created_at DESC);

-- Funding Sources Table
-- Stores funding source information
CREATE TABLE IF NOT EXISTS funding_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sudo_funding_source_id VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_funding_sources_sudo_funding_source_id ON funding_sources(sudo_funding_source_id);
CREATE INDEX idx_funding_sources_status ON funding_sources(status);

