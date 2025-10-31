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
  echo "Missing $ENV_FILE. Create it with RPC_URL and SERVER_PRIVATE_KEY." >&2
  exit 1
fi

if [[ -z "${RPC_URL:-}" || -z "${SERVER_PRIVATE_KEY:-}" ]]; then
  echo "RPC_URL and SERVER_PRIVATE_KEY must be set in $ENV_FILE" >&2
  exit 1
fi

cd "$SCRIPT_DIR/.."

forge script script/Counter.s.sol:GroyperScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$SERVER_PRIVATE_KEY" \
  -vvv


