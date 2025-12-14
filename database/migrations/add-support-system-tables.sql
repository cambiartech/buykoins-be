-- Migration: Add Support & Communication System Tables
-- Run this to add support chat, onboarding codes, and call requests

-- Support Conversations Table
CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_id VARCHAR(100), -- For anonymous users (session-based)
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'general', -- 'general', 'onboarding', 'call_request'
  subject VARCHAR(255),
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'resolved'
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_conversations_user_id ON support_conversations(user_id);
CREATE INDEX idx_support_conversations_guest_id ON support_conversations(guest_id);
CREATE INDEX idx_support_conversations_admin_id ON support_conversations(admin_id);
CREATE INDEX idx_support_conversations_status ON support_conversations(status);
CREATE INDEX idx_support_conversations_type ON support_conversations(type);

-- Support Messages Table
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_id UUID, -- User or Admin ID (null for guest)
  sender_type VARCHAR(20) NOT NULL, -- 'user', 'admin', 'guest', 'system'
  guest_id VARCHAR(100), -- For anonymous users
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'file', 'system', 'auth_code'
  file_url TEXT, -- For attachments
  file_name VARCHAR(255),
  file_size INTEGER,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_messages_conversation_id ON support_messages(conversation_id);
CREATE INDEX idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX idx_support_messages_is_read ON support_messages(is_read);
CREATE INDEX idx_support_messages_sender_type ON support_messages(sender_type);

-- Onboarding Auth Codes Table
CREATE TABLE IF NOT EXISTS onboarding_auth_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_id VARCHAR(100), -- For anonymous users requesting codes
  admin_id UUID NOT NULL REFERENCES admins(id),
  code VARCHAR(10) NOT NULL UNIQUE, -- 6-8 digit code
  conversation_id UUID REFERENCES support_conversations(id),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'used', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP,
  device_info TEXT, -- JSON: device type, OS, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_onboarding_auth_codes_user_id ON onboarding_auth_codes(user_id);
CREATE INDEX idx_onboarding_auth_codes_guest_id ON onboarding_auth_codes(guest_id);
CREATE INDEX idx_onboarding_auth_codes_code ON onboarding_auth_codes(code);
CREATE INDEX idx_onboarding_auth_codes_status ON onboarding_auth_codes(status);

-- Call Requests Table
CREATE TABLE IF NOT EXISTS call_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_id VARCHAR(100), -- For anonymous users
  admin_id UUID REFERENCES admins(id),
  conversation_id UUID REFERENCES support_conversations(id),
  call_type VARCHAR(20) DEFAULT 'voice', -- 'voice', 'video'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'completed', 'cancelled'
  scheduled_at TIMESTAMP, -- Optional: for scheduled calls
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  reason TEXT, -- Why user needs the call
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_call_requests_user_id ON call_requests(user_id);
CREATE INDEX idx_call_requests_guest_id ON call_requests(guest_id);
CREATE INDEX idx_call_requests_admin_id ON call_requests(admin_id);
CREATE INDEX idx_call_requests_status ON call_requests(status);

-- Active Calls Table (WebRTC Signaling)
CREATE TABLE IF NOT EXISTS active_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_request_id UUID REFERENCES call_requests(id),
  user_id UUID REFERENCES users(id),
  guest_id VARCHAR(100), -- For anonymous users
  admin_id UUID NOT NULL REFERENCES admins(id),
  room_id VARCHAR(100) NOT NULL UNIQUE, -- WebRTC room identifier
  call_type VARCHAR(20) DEFAULT 'voice', -- 'voice', 'video'
  status VARCHAR(20) DEFAULT 'connecting', -- 'connecting', 'active', 'ended'
  user_socket_id VARCHAR(100),
  admin_socket_id VARCHAR(100),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE INDEX idx_active_calls_room_id ON active_calls(room_id);
CREATE INDEX idx_active_calls_user_id ON active_calls(user_id);
CREATE INDEX idx_active_calls_guest_id ON active_calls(guest_id);
CREATE INDEX idx_active_calls_admin_id ON active_calls(admin_id);

