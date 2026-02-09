#!/bin/bash
# Loreboard epoch finalization cron wrapper
# Runs every 2 hours via crontab

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR"

export PATH="/usr/local/bin:$PATH"

echo "--- $(date -u '+%Y-%m-%dT%H:%M:%SZ') cron-finalize starting ---"

npx tsx scripts/cron-finalize.ts 2>&1

echo "--- $(date -u '+%Y-%m-%dT%H:%M:%SZ') cron-finalize finished ---"
echo ""
