# 💰 Fluent Mixer

A decentralized ETH mixer that allows users to deposit ETH with recipient addresses. Recipients can claim their deposits using their wallet address.

## Features

- 💼 **MetaMask Integration**: Connect wallet and send ETH directly from the browser
- 🤖 **Automatic Processing**: Deposits are automatically saved when transactions confirm
- 🎁 **Claim System**: Recipients can claim their deposits using their wallet address
- 💾 **SQLite Database**: Lightweight database to track all deposits and claims

## How It Works

1. **Deposit**: User enters amount and recipient address → ETH is sent → Transaction is verified → Deposit saved to database
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

# Blockchain Configuration
RPC_URL=https://eth.llamarpc.com
SERVER_ADDRESS=0xYourServerWalletAddress
CONTRACT_ADDRESS=0xYourContractAddress
```

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
└── messages.db            # SQLite database (auto-generated)
```

## API Endpoints

- `GET /api/server-address` - Get server's wallet address for deposits
- `POST /api/deposit` - Save deposit after transaction confirms
- `POST /api/claim` - Claim deposits for an address
- `GET /api/deposits` - Get all deposits (optionally filter by address)

## Security Considerations

- 💾 **Database**: Stores recipient addresses and transaction hashes
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
- **Blockchain**: ethers.js v6

## Troubleshooting

**Issue**: "Provider not configured"
- **Solution**: Check that `RPC_URL` and `SERVER_ADDRESS` are set in `.env`

**Issue**: "Transaction not found"
- **Solution**: Wait a few seconds for the transaction to be mined, then try again

**Issue**: "Claim functionality is disabled"
- **Solution**: Claim functionality requires wallet configuration which has been removed

**Issue**: "No unclaimed deposits found"
- **Solution**: Verify the address matches exactly (case-insensitive but double-check)

## License

ISC

## Contributing

Feel free to open issues or submit pull requests!

