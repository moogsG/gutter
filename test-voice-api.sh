#!/bin/bash
# Voice API Integration Test Script
# Tests transcription and processing endpoints

set -e

BASE_URL="${1:-http://localhost:3000}"
TEST_DATE="2026-04-15"

echo "🎤 Testing Gutter Voice API"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check whisper dependencies
echo "1️⃣  Checking voice dependencies..."
if command -v ffmpeg &> /dev/null; then
    echo -e "${GREEN}✓${NC} ffmpeg found: $(which ffmpeg)"
else
    echo -e "${RED}✗${NC} ffmpeg not found"
    exit 1
fi

if command -v whisper-cli &> /dev/null; then
    echo -e "${GREEN}✓${NC} whisper-cli found: $(which whisper-cli)"
else
    echo -e "${RED}✗${NC} whisper-cli not found"
    exit 1
fi

if [ -f "$HOME/.cache/whisper/ggml-base.en.bin" ]; then
    echo -e "${GREEN}✓${NC} Whisper model found"
else
    echo -e "${RED}✗${NC} Whisper model not found at ~/.cache/whisper/ggml-base.en.bin"
    exit 1
fi

echo ""

# Test 2: Process endpoint - Organize mode
echo "2️⃣  Testing transcript processing (organize mode)..."
ORGANIZE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/journal/transcript/process" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"Call mom at 3pm. Buy groceries. Remember project deadline Friday.\",
    \"mode\": \"organize\",
    \"date\": \"$TEST_DATE\"
  }")

if echo "$ORGANIZE_RESPONSE" | grep -q '"entries"'; then
    ENTRY_COUNT=$(echo "$ORGANIZE_RESPONSE" | grep -o '"signifier"' | wc -l | xargs)
    echo -e "${GREEN}✓${NC} Organize mode: $ENTRY_COUNT entries created"
else
    echo -e "${RED}✗${NC} Organize mode failed"
    echo "Response: $ORGANIZE_RESPONSE"
fi

echo ""

# Test 3: Process endpoint - Talk mode
echo "3️⃣  Testing transcript processing (talk mode)..."
TALK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/journal/transcript/process" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"Had a great meeting with the team today. Everyone was engaged and we made solid progress on the roadmap.\",
    \"mode\": \"talk\",
    \"date\": \"$TEST_DATE\"
  }")

if echo "$TALK_RESPONSE" | grep -q '"conversational"'; then
    echo -e "${GREEN}✓${NC} Talk mode: conversational entry created"
else
    echo -e "${RED}✗${NC} Talk mode failed"
    echo "Response: $TALK_RESPONSE"
fi

echo ""

# Test 4: Process endpoint - Both mode
echo "4️⃣  Testing transcript processing (both mode)..."
BOTH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/journal/transcript/process" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"Meeting at 2pm with Sarah. Need to prep slides. Also should follow up on that proposal.\",
    \"mode\": \"both\",
    \"date\": \"$TEST_DATE\"
  }")

if echo "$BOTH_RESPONSE" | grep -q '"entries"' && echo "$BOTH_RESPONSE" | grep -q '"conversational"'; then
    echo -e "${GREEN}✓${NC} Both mode: entries + conversational created"
else
    echo -e "${RED}✗${NC} Both mode failed"
    echo "Response: $BOTH_RESPONSE"
fi

echo ""

# Test 5: Server health check
echo "5️⃣  Checking server health..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200"; then
    echo -e "${GREEN}✓${NC} Server responding"
else
    echo -e "${YELLOW}⚠${NC}  Server health check returned non-200 (might be auth wall)"
fi

echo ""
echo "================================"
echo "✅ Voice API tests complete!"
echo ""
echo -e "${YELLOW}Note:${NC} Actual audio transcription requires:"
echo "  - Recording audio in browser"
echo "  - MediaRecorder API support"
echo "  - Microphone permissions granted"
echo ""
echo "Run this test with: ./test-voice-api.sh [base-url]"
echo "Example: ./test-voice-api.sh http://localhost:3000"
