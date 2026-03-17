#!/bin/bash

# Gutter Health Check Script
# Checks if the app is responding on the configured port

set -e

# Configuration
PORT="${PORT:-3000}"
TIMEOUT=5

# Colors for output (if terminal supports it)
if [ -t 1 ]; then
	RED='\033[0;31m'
	GREEN='\033[0;32m'
	YELLOW='\033[1;33m'
	NC='\033[0m' # No Color
else
	RED=''
	GREEN=''
	YELLOW=''
	NC=''
fi

echo "=== Gutter Health Check ==="
echo "Checking http://localhost:${PORT}"
echo ""

# Check if curl is available
if ! command -v curl &>/dev/null; then
	echo "${RED}ERROR: curl is not installed${NC}"
	exit 1
fi

# Perform health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "http://localhost:${PORT}" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
	echo "${GREEN}✓ Health check passed${NC}"
	echo "  HTTP Status: $HTTP_CODE"
	echo "  Status: Healthy"
	exit 0
elif [ "$HTTP_CODE" = "000" ]; then
	echo "${RED}✗ Health check failed${NC}"
	echo "  Error: Connection refused or timeout"
	echo "  Status: Unreachable"

	# Additional diagnostics
	echo ""
	echo "Diagnostics:"

	# Check if port is listening
	if command -v lsof &>/dev/null; then
		if lsof -i ":${PORT}" &>/dev/null; then
			echo "  ${YELLOW}Port ${PORT} is listening, but not responding${NC}"
		else
			echo "  ${RED}Port ${PORT} is not listening${NC}"
		fi
	elif command -v netstat &>/dev/null; then
		if netstat -an | grep -q ":${PORT}.*LISTEN"; then
			echo "  ${YELLOW}Port ${PORT} is listening, but not responding${NC}"
		else
			echo "  ${RED}Port ${PORT} is not listening${NC}"
		fi
	fi

	# Suggest checking logs
	echo ""
	echo "Suggestions:"
	echo "  - Check application logs: tail -f gutter.log gutter-error.log"
	echo "  - Verify service is running: systemctl status gutter (Linux) or launchctl list | grep gutter (macOS)"
	echo "  - Check .env configuration"

	exit 1
else
	echo "${YELLOW}⚠ Health check warning${NC}"
	echo "  HTTP Status: $HTTP_CODE"
	echo "  Status: Responding, but unexpected status code"
	exit 1
fi
