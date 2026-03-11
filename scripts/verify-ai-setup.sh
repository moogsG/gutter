#!/bin/bash
# Verify AI features setup for Gutter Phase 2

set -e

echo "🔍 Verifying Gutter AI Features Setup..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

ERRORS=0
WARNINGS=0

# 1. Check Ollama
echo "1. Checking Ollama..."
if command -v ollama &> /dev/null; then
  check_pass "Ollama CLI installed"
  
  # Check if server is running
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    check_pass "Ollama server is running"
    
    # Check if model is pulled
    if curl -s http://localhost:11434/api/tags | grep -q "qwen2.5-coder:7b"; then
      check_pass "qwen2.5-coder:7b model is pulled"
    else
      check_warn "qwen2.5-coder:7b model not found. Run: ollama pull qwen2.5-coder:7b"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    check_warn "Ollama server not running. Start it with: ollama serve"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  check_fail "Ollama not installed. Install from: https://ollama.com"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 2. Check Whisper
echo "2. Checking Whisper..."
if command -v whisper-cli &> /dev/null; then
  check_pass "whisper-cli installed"
  
  # Check model file
  MODEL_PATH="$HOME/.cache/whisper/ggml-base.en.bin"
  if [ -f "$MODEL_PATH" ]; then
    check_pass "Whisper model found at $MODEL_PATH"
    SIZE=$(du -h "$MODEL_PATH" | cut -f1)
    echo "   Model size: $SIZE"
  else
    check_fail "Whisper model not found. Download with:"
    echo "   mkdir -p ~/.cache/whisper"
    echo "   curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \\"
    echo "     -o ~/.cache/whisper/ggml-base.en.bin"
    ERRORS=$((ERRORS + 1))
  fi
else
  check_fail "whisper-cli not installed. Install with: brew install whisper-cpp"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 3. Check FFmpeg
echo "3. Checking FFmpeg..."
if command -v ffmpeg &> /dev/null; then
  check_pass "FFmpeg installed"
  VERSION=$(ffmpeg -version 2>&1 | head -n1 | cut -d' ' -f3)
  echo "   Version: $VERSION"
else
  check_fail "FFmpeg not installed. Install with: brew install ffmpeg"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 4. Check Apple Calendar CLI (macOS only)
echo "4. Checking Apple Calendar CLI (macOS only)..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  if command -v npx &> /dev/null; then
    check_pass "npx available (for @joargp/accli)"
    
    # Try to run accli
    if npx @joargp/accli calendars list > /dev/null 2>&1; then
      check_pass "accli can access Apple Calendar"
      COUNT=$(npx @joargp/accli calendars list --json 2>/dev/null | grep -c '"name"' || echo "0")
      echo "   Found $COUNT calendar(s)"
    else
      check_warn "accli cannot access calendars (permissions may be needed)"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    check_fail "npx not found. Install Node.js/bun first."
    ERRORS=$((ERRORS + 1))
  fi
else
  check_warn "Not macOS — calendar integration unavailable"
fi

echo ""

# 5. Check .env file
echo "5. Checking environment configuration..."
if [ -f .env ]; then
  check_pass ".env file exists"
  
  # Check for AI variables
  if grep -q "OLLAMA_URL" .env 2>/dev/null; then
    check_pass "OLLAMA_URL configured"
  else
    check_warn "OLLAMA_URL not in .env (will use default: http://localhost:11434)"
  fi
  
  if grep -q "JOURNAL_COMMAND_MODEL" .env 2>/dev/null; then
    check_pass "JOURNAL_COMMAND_MODEL configured"
  else
    check_warn "JOURNAL_COMMAND_MODEL not in .env (will use default: qwen2.5-coder:7b)"
  fi
else
  check_warn ".env file not found. Copy from .env.example"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# 6. Run tests
echo "6. Running AI feature tests..."
if bun test __tests__/command-parser.test.ts __tests__/transcribe.test.ts > /dev/null 2>&1; then
  check_pass "All AI feature tests passing"
else
  check_fail "Some tests failed. Run: bun test"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! AI features ready.${NC}"
  echo ""
  echo "Start the app with: bun run dev"
  echo "Test command mode: Click 'Command' button, type 'buy milk'"
  echo "Test voice: Click mic button, speak, click again to stop"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ Setup complete with $WARNINGS warning(s).${NC}"
  echo "AI features will work, but some functionality may be limited."
else
  echo -e "${RED}✗ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s).${NC}"
  echo "Fix the errors above before using AI features."
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
