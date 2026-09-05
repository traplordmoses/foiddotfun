# CDN and media hosting

Measured 2026-09-04: `foid.fun` is a bare CNAME to `foid-fun.onrender.com`.
Render's edge answers `cf-cache-status: DYNAMIC` for every asset, including
hashed `/_next/static` chunks, the 35 MB videos under `/media`, and every
WAV and PNG. Everything under `/public` shipped with `Cache-Control:
public, max-age=0`. One Node process in Ohio served every byte.

The app now sends real `Cache-Control` headers (see `next.config.mjs`
`headers()`), which browsers honour. An edge cache still needs one of the
two setups below.

## Option A (recommended): Cloudflare zone in front of Render

1. Add `foid.fun` to a Cloudflare account (free plan is enough) and move the
   nameservers at Namecheap from `dns1/dns2.registrar-servers.com` to the
   two Cloudflare nameservers it gives you.
2. DNS: `CNAME foid.fun -> foid-fun.onrender.com` (Cloudflare flattens the
   apex), proxied (orange cloud). Keep `www` as a proxied CNAME to the apex.
3. SSL/TLS mode: **Full (strict)**. Render issues the origin certificate.
4. Cache Rules (Rules > Cache Rules), in this order:
   - `URI Path starts with /_next/static/` -> Eligible for cache, Edge TTL
     1 year, Browser TTL respect origin.
   - `URI Path starts with /media/` OR `/sfx/` OR `/fonts/` OR `/icons/`
     -> Eligible, Edge TTL 1 year.
   - `URI Path matches regex \.(png|webp|jpg|jpeg|gif|svg|ico)$` -> Eligible,
     Edge TTL 7 days.
   - `URI Path starts with /api/` -> Bypass cache.
   - Everything else (HTML, RSC payloads) -> Bypass cache. The app sets
     `Vary: RSC` headers that edge caches mishandle; do not cache HTML.
5. Verify: `curl -sI https://foid.fun/_next/static/chunks/main-app-*.js`
   should show `cf-cache-status: HIT` on the second request.

## Option B: Vercel for the Next app, Render for the cron

Vercel's CDN caches `/_next/static` and `/public` automatically and runs
`next/og` on the edge. Keep `render.yaml`'s cron services (they only curl
the app). Env vars move to the Vercel project. This is the cleaner path if
the team is fine with a second dashboard.

## Media off the app server: Cloudflare R2

`public/media` (131 MB of MP4) and `public/sfx/music` (167 MB) sit in git
and are served by the Node process. R2 has zero egress fees.

1. Create a bucket `foid-media`, enable the public custom domain
   `media.foid.fun` (Cloudflare zone required, Option A).
2. Copy the files with the script (needs the AWS CLI and an R2 API token):

   ```bash
   R2_ACCOUNT_ID=... R2_BUCKET=foid-media \
   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
   ./scripts/sync-media-r2.sh
   ```

3. Set `NEXT_PUBLIC_MEDIA_BASE=https://media.foid.fun` in the Render
   environment. The FILES.EXE archive, the music library and the CSP read
   it. Redeploy and confirm a video plays.
4. Only then remove `public/media/*.mp4` and `public/sfx/music` from git
   (`git rm`), commit, and optionally rewrite history with
   `git filter-repo --path foid_fun/public/media --path foid_fun/public/sfx/music --invert-paths`
   to shrink the 821 MB clone. History rewriting needs every collaborator
   to re-clone; do it deliberately.

Posters stay in git (they are small and part of first paint).

## CORS on the media bucket

The music player attaches `crossOrigin="anonymous"` to its `<audio>`
elements so the visualizer can read samples. A cross-origin media host must
answer with `Access-Control-Allow-Origin: https://foid.fun` (or `*`). On R2:
bucket > Settings > CORS policy:

```json
[{ "AllowedOrigins": ["https://foid.fun"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["Range"], "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"], "MaxAgeSeconds": 86400 }]
```
