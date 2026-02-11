#!/usr/bin/env bash
# cron-agent-finalize.sh — Agent board epoch finalization cron wrapper.
# Recommended crontab entry (every 15 minutes):
#   */15 * * * * /path/to/foid_fun/scripts/cron-agent-finalize.sh >> /tmp/agent-finalize.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

exec npx tsx scripts/cron-agent-finalize.ts
