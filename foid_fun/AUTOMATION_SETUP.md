# Automated Epoch Finalization Setup

This guide shows you how to automatically finalize epochs and process refunds on a schedule.

## What Gets Automated

When `npm run auto:finalize` runs, it:
1. ✅ Checks for pending/expired proposals
2. ✅ Calls `Treasury.finalizeEpoch()` with accepted + rejected IDs
3. ✅ Triggers refunds automatically (push to wallet or credit to claimable)
4. ✅ Anchors manifest to ManifestStore
5. ✅ Syncs LoreboardLiveNFT (optional)

**Result**: Users get refunds automatically without manual intervention!

---

## Option 1: macOS Launchd (Recommended for Mac)

### Step 1: Create Launch Agent

```bash
mkdir -p ~/Library/LaunchAgents
```

Create file `~/Library/LaunchAgents/com.foid.finalize.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.foid.finalize</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npm</string>
        <string>run</string>
        <string>auto:finalize</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/YOURUSERNAME/foid_fun/foid_fun</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>OPERATOR_PK</key>
        <string>0xyourprivatekeyhere</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>StartInterval</key>
    <integer>21600</integer> <!-- Run every 6 hours -->

    <key>StandardOutPath</key>
    <string>/Users/YOURUSERNAME/foid_fun/foid_fun/logs/finalize.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/YOURUSERNAME/foid_fun/foid_fun/logs/finalize-error.log</string>

    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

**Replace:**
- `YOURUSERNAME` with your macOS username
- `0xyourprivatekeyhere` with your operator private key

### Step 2: Create logs directory

```bash
cd /Users/YOURUSERNAME/foid_fun/foid_fun
mkdir -p logs
```

### Step 3: Load and start

```bash
launchctl load ~/Library/LaunchAgents/com.foid.finalize.plist
launchctl start com.foid.finalize
```

### Check status

```bash
# Check if it's running
launchctl list | grep foid

# View logs
tail -f ~/foid_fun/foid_fun/logs/finalize.log
```

### Stop/restart

```bash
# Stop
launchctl stop com.foid.finalize

# Unload (disable)
launchctl unload ~/Library/LaunchAgents/com.foid.finalize.plist

# Reload after changes
launchctl unload ~/Library/LaunchAgents/com.foid.finalize.plist
launchctl load ~/Library/LaunchAgents/com.foid.finalize.plist
```

---

## Option 2: Linux Cron (Recommended for VPS)

### Step 1: Create wrapper script

```bash
cd /path/to/foid_fun/foid_fun
nano run-finalize.sh
```

Add:

```bash
#!/bin/bash
export OPERATOR_PK=0xyourprivatekeyhere
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH

cd /path/to/foid_fun/foid_fun
npm run auto:finalize
```

Make executable:

```bash
chmod +x run-finalize.sh
```

### Step 2: Add to cron

```bash
crontab -e
```

Add one of these:

```bash
# Every 6 hours
0 */6 * * * /path/to/foid_fun/foid_fun/run-finalize.sh >> /path/to/foid_fun/foid_fun/logs/finalize.log 2>&1

# Every 12 hours at midnight and noon
0 0,12 * * * /path/to/foid_fun/foid_fun/run-finalize.sh >> /path/to/foid_fun/foid_fun/logs/finalize.log 2>&1

# Daily at 3 AM
0 3 * * * /path/to/foid_fun/foid_fun/run-finalize.sh >> /path/to/foid_fun/foid_fun/logs/finalize.log 2>&1
```

### View cron logs

```bash
tail -f /path/to/foid_fun/foid_fun/logs/finalize.log
```

---

## Option 3: Render.com Cron Jobs

If you're hosting on Render.com, you can use their Cron Jobs feature.

### In Render Dashboard:

1. Go to your project
2. Click "New +" → "Cron Job"
3. Configure:
   - **Name**: `foid-finalize`
   - **Command**: `npm run auto:finalize`
   - **Schedule**: `0 */6 * * *` (every 6 hours)
   - **Environment**: Same as your web service
   - **Add Environment Variable**:
     - `OPERATOR_PK` = your private key
4. Click "Create Cron Job"

---

## Option 4: GitHub Actions (Free for public repos)

Create `.github/workflows/finalize.yml`:

```yaml
name: Auto Finalize Epochs

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  finalize:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd foid_fun
          npm install

      - name: Run finalization
        env:
          OPERATOR_PK: ${{ secrets.OPERATOR_PK }}
        run: |
          cd foid_fun
          npm run auto:finalize
```

Add `OPERATOR_PK` to GitHub Secrets:
1. Go to repo Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `OPERATOR_PK`
4. Value: Your private key

---

## Recommended Schedule

Based on your epoch length:

- **24-hour epochs**: Finalize every 12-24 hours
- **12-hour epochs**: Finalize every 6-12 hours
- **6-hour epochs**: Finalize every 3-6 hours

**Why not every epoch?**
- Gas costs (each finalization = transaction)
- Most proposals won't need immediate finalization
- Running every 6-12 hours is a good balance

---

## Monitoring

### Check if refunds are working

```bash
# Check pending proposals
npm run check:refunds

# View recent finalization logs
tail -f logs/finalize.log

# Check Treasury events
cast logs --rpc-url https://rpc.testnet.fluent.xyz \
  --address 0x4A777d8650b3FA2419377F4ffeF0EF8007151536 \
  --from-block -1000
```

### Set up alerts (optional)

Create `scripts/notify-on-failure.sh`:

```bash
#!/bin/bash
if ! npm run auto:finalize; then
    # Send alert (email, Slack, Discord, etc.)
    curl -X POST YOUR_WEBHOOK_URL \
      -d "Finalization failed at $(date)"
fi
```

---

## Troubleshooting

### "OPERATOR_PK not set"
- Make sure environment variable is exported
- Check plist file (macOS) or wrapper script (Linux)
- Verify secrets in GitHub Actions/Render

### "Insufficient funds"
- Operator wallet needs ETH for gas
- Top up at https://faucet.fluentlabs.xyz

### "No proposals found"
- This is normal! Script will skip if nothing to finalize
- Only pays gas when there are actual proposals to process

### Logs not appearing
```bash
# Create logs directory
mkdir -p logs

# Check permissions
chmod 755 logs
```

---

## Testing

Test the automation without waiting:

```bash
# Dry run (no transactions)
npm run check:refunds

# Full run (will execute transactions)
npm run auto:finalize

# Check logs
cat logs/finalize.log
```

---

## Security Notes

⚠️ **NEVER commit your OPERATOR_PK to git!**

✅ Use environment variables
✅ Use secrets managers (GitHub Secrets, Render env vars)
✅ Restrict file permissions on scripts with keys

```bash
# Secure your wrapper script
chmod 600 run-finalize.sh
```

---

## Next Steps

1. Choose a scheduling option (macOS launchd or Linux cron recommended)
2. Set up the automation
3. Test with `npm run auto:finalize`
4. Monitor logs to ensure it's working
5. Check your dashboard - refunds should appear automatically!

Users will now get refunds automatically without needing to ask! 🎉
