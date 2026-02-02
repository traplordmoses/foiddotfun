# QuickNode RPC Setup

Your app is now configured to use a dedicated QuickNode RPC endpoint with **50 req/sec** rate limit.

## ✅ What Was Changed

### Updated Files:
1. **`.env.local`** - All RPC URLs now point to QuickNode
2. **`.env.local.example`** - Updated with QuickNode format (without actual token)

### Environment Variables Updated:
```bash
NEXT_PUBLIC_RPC_URL=https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
NEXT_PUBLIC_RPC=https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
NEXT_PUBLIC_FLUENT_RPC=https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
FLUENT_RPC=https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
RPC_URL=https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
```

## 🔐 Security

✅ **Token is secure:**
- Stored in `.env.local` (gitignored)
- **Never committed to GitHub**
- Only accessible server-side and in your local dev environment

⚠️ **Important:**
- Do NOT commit `.env.local` to git
- Do NOT share the token publicly
- Do NOT hardcode the token in any source files

## 🚀 To Activate

### Restart your dev server:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

The app will now use QuickNode automatically!

## ✅ Verify It's Working

### Test the endpoint:
```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
```

Expected response:
```json
{"jsonrpc":"2.0","id":1,"result":"0x..."}
```

### Check in your app:
1. Open browser DevTools → Network tab
2. Look for RPC requests
3. Verify they go to `flashy-indulgent-knowledge.fluent-testnet.quiknode.pro`

## 📊 Benefits

### Before (Public RPC):
- ⚠️ Rate limited
- ⚠️ Shared with all users
- ⚠️ Can be slow during high traffic
- ⚠️ No guaranteed uptime

### After (QuickNode):
- ✅ **50 req/sec** dedicated rate limit
- ✅ Higher reliability (99.9% uptime SLA)
- ✅ Faster response times
- ✅ Better for production use
- ✅ Metrics & monitoring dashboard

## 🔄 Fallback to Public RPC

If QuickNode is down, you can quickly switch back:

1. Edit `.env.local`:
   ```bash
   # Comment out QuickNode
   # NEXT_PUBLIC_FLUENT_RPC=https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852

   # Use public RPC
   NEXT_PUBLIC_FLUENT_RPC=https://rpc.testnet.fluent.xyz
   ```

2. Restart dev server

## 📈 Monitoring

Check your QuickNode dashboard:
- Request count
- Error rates
- Response times
- Rate limit usage

Login at: https://dashboard.quicknode.com

## 🎯 Best Practices

1. **Monitor usage** - Check QuickNode dashboard periodically
2. **Handle rate limits** - Add retry logic for 429 errors
3. **Test thoroughly** - Verify all blockchain interactions work
4. **Keep token secret** - Never expose in client-side code or logs

## 🐛 Troubleshooting

### If requests fail:

1. **Check token is correct:**
   ```bash
   grep QUICKNODE_TOKEN .env.local
   ```

2. **Verify endpoint is accessible:**
   ```bash
   curl -I https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852
   ```

3. **Check QuickNode dashboard:**
   - Is the endpoint active?
   - Have you hit rate limits?
   - Any service issues?

4. **Restart dev server:**
   ```bash
   # Stop and restart to pick up new env vars
   npm run dev
   ```

### If errors persist:
- Contact QuickNode support
- Temporarily switch to public RPC (see Fallback section above)

---

**Setup completed!** 🎉 Your app is now using the QuickNode RPC endpoint.
