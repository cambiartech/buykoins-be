#!/bin/bash

# Test Login Endpoint
# This script tests the login endpoint to help debug issues

echo "🧪 Testing Login Endpoint..."
echo ""

# Test with invalid credentials (should return 401)
echo "1. Testing with invalid credentials..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo ""

# Test with missing fields (should return 400)
echo "2. Testing with missing email..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"test123"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo ""

# Test with invalid JSON (should return 400)
echo "3. Testing with invalid JSON..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d 'invalid json' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo ""
echo "✅ Test complete!"
echo ""
echo "Note: If you see 500 errors, check the server logs for details."

