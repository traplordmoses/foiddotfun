#!/usr/bin/env bash
# Copy the large media folders to a Cloudflare R2 bucket with long-lived
# cache headers. See docs/CDN_SETUP.md. Requires the AWS CLI.
set -euo pipefail
: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID}"
: "${R2_BUCKET:?set R2_BUCKET}"
: "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID (R2 token)}"
: "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY (R2 token)}"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
export AWS_DEFAULT_REGION=auto
sync() {
  aws s3 sync "$HERE/public/$1" "s3://${R2_BUCKET}/$1" \
    --endpoint-url "$ENDPOINT" \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude ".gitkeep" --exclude ".DS_Store"
}
sync media
sync sfx/music
echo "done. set NEXT_PUBLIC_MEDIA_BASE to the bucket's public domain."
