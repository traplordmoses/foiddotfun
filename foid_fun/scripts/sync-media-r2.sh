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
CACHE="public, max-age=31536000, immutable"

sync() {
  aws s3 sync "$HERE/public/$1" "s3://${R2_BUCKET}/$1" \
    --endpoint-url "$ENDPOINT" \
    --cache-control "$CACHE" \
    --exclude ".gitkeep" --exclude ".DS_Store"
}

# The AWS CLI guesses Content-Type from the extension via Python's mimetypes,
# which maps .m4a to audio/mp4a-latm. Chrome answers "" to
# canPlayType("audio/mp4a-latm"), and MusicPanel falls back to .m4a exactly
# when the browser cannot do Ogg/Opus — i.e. Safari and iOS, the strictest
# clients about media Content-Type. Rewrite the header server-side after the
# sync; this copies metadata only, it does not re-upload the bytes.
retype() {
  aws s3 cp "s3://${R2_BUCKET}/$1" "s3://${R2_BUCKET}/$1" \
    --endpoint-url "$ENDPOINT" \
    --recursive --exclude "*" --include "$2" \
    --content-type "$3" \
    --cache-control "$CACHE" \
    --metadata-directive REPLACE
}

sync media
sync sfx/music

retype sfx/music "*.m4a" "audio/mp4"

echo
echo "done. two things left:"
echo "  1. purge the Cloudflare cache for media.foid.fun — the edge holds the"
echo "     old headers for a year otherwise"
echo "  2. set NEXT_PUBLIC_MEDIA_BASE to the bucket's public domain"
