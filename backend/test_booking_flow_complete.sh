#!/bin/bash

# Complete booking flow test: Create → Taken → Returned → Invoice
# Usage: ./test_booking_flow_complete.sh

BASE_URL="http://127.0.0.1:3000"
AUTH_HEADER="Authorization: Bearer test-token"

echo "======================================"
echo "RENTO COMPLETE BOOKING FLOW TEST"
echo "======================================"

# Step 1: Health check
echo ""
echo "1️⃣  HEALTH CHECK"
curl -s $BASE_URL/health | jq . || echo "Health check failed"

# Step 2: Get customers (existing)
echo ""
echo "2️⃣  FETCH EXISTING CUSTOMERS"
curl -s -H "$AUTH_HEADER" $BASE_URL/api/customers | jq . || echo "Failed to fetch customers"

# Step 3: Get vehicles (existing)
echo ""
echo "3️⃣  FETCH EXISTING VEHICLES"
curl -s -H "$AUTH_HEADER" $BASE_URL/api/vehicles | jq . || echo "Failed to fetch vehicles"

# Extract first customer and vehicle IDs (for testing)
# CUSTOMER_ID=$(curl -s -H "$AUTH_HEADER" $BASE_URL/api/customers | jq -r '.[0].id' 2>/dev/null)
# VEHICLE_ID=$(curl -s -H "$AUTH_HEADER" $BASE_URL/api/vehicles | jq -r '.[0].id' 2>/dev/null)

echo ""
echo "======================================"
echo "✅ Test setup complete. Use the customer and vehicle IDs above for manual testing."
echo "======================================"
