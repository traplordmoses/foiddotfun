#!/bin/bash

echo "🧪 Testing Monero Transaction Validation API"
echo "=========================================="

BASE_URL="http://localhost:3031"

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq .
echo ""

# Generate a proof
echo "2. Generating transaction proof..."
PROOF_RESPONSE=$(curl -s -X POST "$BASE_URL/proof" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "abc123def456",
    "recipient_address": "9wviCeWe2D8XS82k2ovp5EUYLzBt9pYNW2LXUFsZiv8S3Mt21FZ5qQaAroko1enzw3eGr9qC7X1D7Geoo2RrAotYPw2Rts"
  }')

echo "$PROOF_RESPONSE" | jq .

# Extract proof_id and tx_key from response
PROOF_ID=$(echo "$PROOF_RESPONSE" | jq -r '.proof_id')
TX_KEY=$(echo "$PROOF_RESPONSE" | jq -r '.tx_key')

echo ""
echo "3. Validating transaction..."
curl -s -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"tx_id\": \"abc123def456\",
    \"tx_key\": \"$TX_KEY\",
    \"recipient_address\": \"9wviCeWe2D8XS82k2ovp5EUYLzBt9pYNW2LXUFsZiv8S3Mt21FZ5qQaAroko1enzw3eGr9qC7X1D7Geoo2RrAotYPw2Rts\"
  }" | jq .

echo ""
echo "4. Getting all proofs..."
curl -s "$BASE_URL/proofs" | jq .

echo ""
echo "5. Getting specific proof..."
curl -s "$BASE_URL/proof/$PROOF_ID" | jq .

echo ""
echo "✅ API testing complete!"
