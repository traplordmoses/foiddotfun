# Monero Transaction Validation Server

A Rust-based HTTP server that provides endpoints for generating and validating Monero transaction proofs using real Monero RPC calls.

## Features

- 🔐 Generate transaction proofs using Monero wallet RPC
- ✅ Validate transactions using Monero daemon RPC
- 📊 Get transaction details and amounts
- 🚀 Fast async HTTP server with Warp
- 🔄 In-memory proof storage for demo purposes

## Prerequisites

1. **Install Monero CLI tools:**
   ```bash
   # macOS
   brew install monero
   
   # Or download from https://www.getmonero.org/downloads/
   ```

2. **Start Monero daemon:**
   ```bash
   monerod --testnet --rpc-bind-ip 127.0.0.1 --rpc-bind-port 18081
   ```

3. **Start Monero wallet RPC (optional):**
   ```bash
   monero-wallet-rpc --testnet --rpc-bind-ip 127.0.0.1 --rpc-bind-port 18083 --wallet-file your_wallet
   ```

## Installation & Usage

1. **Build the project:**
   ```bash
   cargo build
   ```

2. **Run the server:**
   ```bash
   cargo run
   ```

3. **Test the API:**
   ```bash
   ./test_api.sh
   ```

## API Endpoints

### Health Check
```bash
GET /health
```

### Generate Transaction Proof
```bash
POST /proof
Content-Type: application/json

{
  "tx_id": "abc123def456",
  "recipient_address": "9wviCeWe2D8XS82k2ovp5EUYLzBt9pYNW2LXUFsZiv8S3Mt21FZ5qQaAroko1enzw3eGr9qC7X1D7Geoo2RrAotYPw2Rts"
}
```

### Validate Transaction
```bash
POST /validate
Content-Type: application/json

{
  "tx_id": "abc123def456",
  "tx_key": "real_tx_key_abc123def456",
  "recipient_address": "9wviCeWe2D8XS82k2ovp5EUYLzBt9pYNW2LXUFsZiv8S3Mt21FZ5qQaAroko1enzw3eGr9qC7X1D7Geoo2RrAotYPw2Rts"
}
```

### Get All Proofs
```bash
GET /proofs
```

### Get Specific Proof
```bash
GET /proof/{proof_id}
```

## Configuration

The server connects to:
- **Monero Daemon:** `http://127.0.0.1:18081` (default)
- **Monero Wallet RPC:** `http://127.0.0.1:18083` (optional)

You can modify these URLs in `src/main.rs`:

```rust
let daemon_url = "http://127.0.0.1:18081";
let wallet_url = Some("http://127.0.0.1:18083");
```

## How It Works

1. **Proof Generation:** Uses `get_tx_key` RPC call to retrieve the transaction private key
2. **Transaction Validation:** Uses `check_tx_key` RPC call to verify transaction details
3. **Transaction Details:** Uses `get_transactions` RPC call to get transaction metadata

## Development Notes

- The server runs in simulation mode if Monero RPC is not available
- All proofs are stored in memory (not persistent)
- CORS is enabled for all origins
- Error handling includes proper HTTP status codes

## Next Steps

- Add persistent storage (database)
- Implement authentication
- Add more Monero RPC methods
- Add transaction broadcasting
- Add wallet management features
