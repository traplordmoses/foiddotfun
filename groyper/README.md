# 💰 Fluent Mixer

A decentralized ETH mixer that uses public-key encryption to protect recipient addresses. Users can deposit ETH with an encrypted recipient address, and only the intended recipient can claim their funds.

## Features

- 🔐 **Public-Key Encryption**: Recipient addresses are encrypted using RSA-OAEP encryption
- 💼 **MetaMask Integration**: Connect wallet and send ETH directly from the browser
- 🤖 **Automatic Processing**: Deposits are automatically saved when transactions confirm
- 🎁 **Claim System**: Recipients can claim their deposits using their wallet address
- 💾 **SQLite Database**: Lightweight database to track all deposits and claims
- 🔒 **Secure Storage**: Encrypted recipient addresses stored in database

## How It Works

1. **Deposit**: User enters amount and recipient address → Address is encrypted → ETH is sent → Transaction is verified → Deposit saved to database
2. **Claim**: Recipient enters their address → Server finds unclaimed deposits → Sends ETH to recipient → Marks deposits as claimed

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension
- A wallet with ETH for deposits
- An RPC endpoint (for blockchain interactions)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mixer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Configure your `.env` file (see Configuration section below)

## Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000

# Database Configuration
DB_PATH=messages.db

# Keys Configuration
KEYS_PATH=keys.json

# Blockchain Configuration
RPC_URL=https://eth.llamarpc.com
SERVER_PRIVATE_KEY=0xYourServerWalletPrivateKey
SERVER_ADDRESS=0xYourServerWalletAddress
```

### Setting Up Server Wallet

1. Create a new wallet or use an existing one
2. Copy the private key (starting with `0x`)
3. Copy the address (must match the private key)
4. Fund the wallet with ETH (for sending claims back to users)
5. Add both to your `.env` file

**⚠️ Security Warning**: Never commit your `.env` file or share your private keys. The `.gitignore` file is configured to exclude sensitive files.

## Running the Application

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Connect MetaMask to the application

## Usage Guide

### Making a Deposit

1. **Connect MetaMask**: Click "Connect MetaMask" and approve the connection
2. **Enter Deposit Details**:
   - Amount: Enter the amount of ETH you want to deposit (e.g., `0.1`)
   - Recipient Address: Enter the Ethereum address where funds should be sent (must be different from your connected address)
3. **Send ETH**: Click "Send ETH" button
   - This will encrypt the recipient address
   - Send the ETH transaction via MetaMask
   - Wait for transaction confirmation
   - Deposit is automatically saved to the database
4. **View Confirmation**: You'll see a success message with the transaction hash

### Claiming Deposits

1. **Enter Your Address**: In the "Claim Deposits" section, paste your recipient address
2. **Click "Check & Claim"**: 
   - Server finds all unclaimed deposits for that address
   - Sends ETH to your address
   - Marks deposits as claimed
3. **View Result**: You'll see the total amount claimed and transaction hash

### Viewing All Deposits

- Scroll to the "All Deposits" section to see all deposits
- Green border = Claimed
- Yellow border = Pending/Unclaimed
- Click "Refresh" to update the list

## Project Structure

```
mixer/
├── server.js              # Express server with API endpoints
├── public/
│   └── index.html         # Frontend client interface
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not in repo)
├── .env.example           # Example environment file
├── .gitignore             # Git ignore rules
├── keys.json              # RSA key pair (auto-generated)
└── messages.db            # SQLite database (auto-generated)
```

## API Endpoints

- `GET /api/public-key` - Get server's public key for encryption
- `GET /api/server-address` - Get server's wallet address for deposits
- `POST /api/deposit` - Save deposit after transaction confirms
- `POST /api/claim` - Claim deposits for an address
- `GET /api/deposits` - Get all deposits (optionally filter by address)

## Security Considerations

- 🔐 **Encryption**: Recipient addresses are encrypted using RSA 2048-bit keys
- 🔑 **Key Management**: Private keys are stored locally in `keys.json` (keep secure!)
- 💾 **Database**: Stores encrypted recipient addresses and transaction hashes
- ⚠️ **Private Keys**: Server private key must be kept secure - anyone with access can drain funds
- 🌐 **Network**: Consider using HTTPS in production
- 🔍 **Validation**: All addresses are validated before processing

## Development

### Database Schema

The `deposits` table contains:
- `id`: Primary key
- `amount`: ETH amount (REAL)
- `encrypted_recipient_address`: Base64 encrypted address
- `recipient_address`: Decrypted address (for verification)
- `deposit_tx_hash`: Transaction hash of the deposit
- `claimed`: Boolean (0 = unclaimed, 1 = claimed)
- `claim_tx_hash`: Transaction hash of the claim (if claimed)
- `created_at`: Timestamp
- `claimed_at`: Timestamp (if claimed)

### Technology Stack

- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Frontend**: Vanilla JavaScript, MetaMask API
- **Encryption**: Node.js crypto (RSA-OAEP), Forge.js (client-side)
- **Blockchain**: ethers.js v6

## Troubleshooting

**Issue**: "Provider not configured"
- **Solution**: Check that `RPC_URL`, `SERVER_PRIVATE_KEY`, and `SERVER_ADDRESS` are set in `.env`

**Issue**: "Transaction not found"
- **Solution**: Wait a few seconds for the transaction to be mined, then try again

**Issue**: "Insufficient balance"
- **Solution**: Ensure your server wallet has enough ETH to cover claim payouts

**Issue**: "No unclaimed deposits found"
- **Solution**: Verify the address matches exactly (case-insensitive but double-check)

## License

ISC

## Contributing

Feel free to open issues or submit pull requests!

