#!/usr/bin/env bash
set -euo pipefail

# Load env from groyper/.env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "Missing $ENV_FILE. Create it with RPC_URL." >&2
  exit 1
fi

if [[ -z "${RPC_URL:-}" ]]; then
  echo "RPC_URL must be set in $ENV_FILE" >&2
  exit 1
fi

cd "$SCRIPT_DIR/.."

echo "⚠️  Deploy script requires private key to be provided via --private-key flag or foundry config" >&2
forge script script/Counter.s.sol:GroyperScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvv


