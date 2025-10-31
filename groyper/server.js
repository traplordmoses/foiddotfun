require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let publicKey, privateKey;
let db;
let provider, wallet, contract;

// Initialize ethers provider, wallet, and contract
function initializeWallet() {
  const rpcUrl = process.env.RPC_URL;
  const serverPrivateKey = process.env.SERVER_PRIVATE_KEY;
  const serverAddress = process.env.SERVER_ADDRESS;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !serverPrivateKey || !serverAddress) {
    console.warn('⚠️  Missing RPC_URL, SERVER_PRIVATE_KEY, or SERVER_ADDRESS in .env - blockchain features disabled');
    return;
  }

  if (!contractAddress) {
    console.warn('⚠️  Missing CONTRACT_ADDRESS in .env - contract features disabled');
  }

  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(serverPrivateKey, provider);
    
    // Verify server address matches wallet
    if (wallet.address.toLowerCase() !== serverAddress.toLowerCase()) {
      throw new Error('SERVER_ADDRESS does not match SERVER_PRIVATE_KEY');
    }
    
    console.log(`✓ Wallet initialized: ${wallet.address}`);

    // Initialize contract if address is provided
    if (contractAddress) {
      const abiPath = path.join(__dirname, 'Groyper.json');
      if (fs.existsSync(abiPath)) {
        const contractABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        contract = new ethers.Contract(contractAddress, contractABI, wallet);
        console.log(`✓ Contract initialized: ${contractAddress}`);
      } else {
        console.warn('⚠️  Groyper.json ABI file not found - contract features disabled');
      }
    }
  } catch (error) {
    console.error('✗ Wallet initialization failed:', error.message);
    provider = null;
    wallet = null;
    contract = null;
  }
}

// Initialize database
function initializeDatabase() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'messages.db');
  db = new Database(dbPath);
  
  // Create deposits table for mixer
  db.exec(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      encrypted_recipient_address TEXT NOT NULL,
      recipient_address TEXT NOT NULL,
      deposit_tx_hash TEXT NOT NULL,
      claimed BOOLEAN DEFAULT 0,
      claim_tx_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      claimed_at DATETIME
    )
  `);
  
  console.log('✓ Database initialized');
}

// Generate or load RSA key pair
function initializeKeys() {
  const keysPath = process.env.KEYS_PATH || path.join(__dirname, 'keys.json');
  
  if (fs.existsSync(keysPath)) {
    // Load existing keys
    const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    console.log('✓ Loaded existing keys');
  } else {
    // Generate new key pair (2048-bit RSA)
    const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    publicKey = pub;
    privateKey = priv;
    
    // Save keys
    fs.writeFileSync(keysPath, JSON.stringify({ publicKey, privateKey }, null, 2));
    console.log('✓ Generated new RSA key pair');
  }
}

// Endpoint to get the public key
app.get('/api/public-key', (req, res) => {
  res.json({ publicKey });
});

// Endpoint to save deposit after transaction is confirmed
app.post('/api/deposit', async (req, res) => {
  try {
    const { txHash, encryptedRecipientAddress } = req.body;
    
    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }
    
    if (!encryptedRecipientAddress) {
      return res.status(400).json({ error: 'encryptedRecipientAddress is required' });
    }
    
    // Check if already processed
    const existing = db.prepare('SELECT id FROM deposits WHERE deposit_tx_hash = ?').get(txHash);
    if (existing) {
      return res.status(400).json({ error: 'This transaction has already been processed' });
    }
    
    // Decrypt the recipient address
    const buffer = Buffer.from(encryptedRecipientAddress, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );
    
    let recipientAddress = decrypted.toString('utf8');
    
    // Basic address validation
    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      return res.status(400).json({ error: 'Invalid recipient address format' });
    }
    
    // Normalize address to lowercase
    recipientAddress = recipientAddress.toLowerCase();
    
    // Get transaction details to get amount
    if (!provider) {
      return res.status(500).json({ error: 'Provider not configured' });
    }
    
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return res.status(400).json({ error: 'Transaction not found' });
    }
    
    // Wait for transaction confirmation
    const receipt = await provider.waitForTransaction(txHash);
    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({ error: 'Transaction failed or not confirmed' });
    }
    
    // Verify transaction is sent to the contract address
    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress) {
      return res.status(500).json({ error: 'Contract address not configured' });
    }
    
    if (!tx.to || tx.to.toLowerCase() !== contractAddress.toLowerCase()) {
      return res.status(400).json({ 
        error: `Transaction must be sent to contract address ${contractAddress}` 
      });
    }
    
    const amount = parseFloat(ethers.formatEther(tx.value));
    
    // Store deposit in database
    const stmt = db.prepare(`
      INSERT INTO deposits (amount, encrypted_recipient_address, recipient_address, deposit_tx_hash, created_at) 
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(amount, encryptedRecipientAddress, recipientAddress, txHash);
    const depositId = stmt.lastInsertRowid;
    
    console.log(`✓ Deposit saved: ${amount} ETH to ${recipientAddress} (TX: ${txHash}, ID: ${depositId})`);
    
    res.json({
      success: true,
      depositId,
      amount,
      recipientAddress,
      message: 'Deposit saved successfully'
    });
    
  } catch (error) {
    console.error('Deposit error:', error.message);
    res.status(500).json({ error: 'Failed to process deposit', details: error.message });
  }
});

// Endpoint to claim deposits for an address
app.post('/api/claim', async (req, res) => {
  try {
    let { recipientAddress } = req.body;
    
    if (!recipientAddress) {
      return res.status(400).json({ error: 'recipientAddress is required' });
    }
    
    // Normalize address: trim whitespace and convert to lowercase
    recipientAddress = recipientAddress.trim().toLowerCase();
    
    // Basic address validation
    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    if (!wallet || !provider) {
      return res.status(500).json({ error: 'Server wallet not configured' });
    }
    
    // Validate server address from .env
    const serverAddress = process.env.SERVER_ADDRESS;
    if (!serverAddress || !serverAddress.startsWith('0x') || serverAddress.length !== 42) {
      return res.status(500).json({ error: 'Invalid SERVER_ADDRESS in configuration' });
    }
    
    // Find all unclaimed deposits for this address (case-insensitive comparison)
    const recipientAddressLower = recipientAddress;
    const unclaimed = db.prepare(`
      SELECT id, amount, recipient_address, created_at 
      FROM deposits 
      WHERE LOWER(recipient_address) = ? AND claimed = 0
      ORDER BY created_at ASC
    `).all(recipientAddressLower);
    
    if (unclaimed.length === 0) {
      return res.json({
        success: false,
        message: 'No unclaimed deposits found for this address',
        deposits: []
      });
    }
    
    // Calculate total amount
    const totalAmount = unclaimed.reduce((sum, deposit) => sum + deposit.amount, 0);
    // Convert to decimal string without scientific notation (ethers.parseEther doesn't accept scientific notation)
    // Use toFixed(18) to ensure proper decimal format with up to 18 decimal places
    const totalAmountString = totalAmount.toFixed(18);
    const totalAmountWei = ethers.parseEther(totalAmountString);
    
    if (!contract) {
      return res.status(500).json({ error: 'Contract not initialized' });
    }
    
    try {
      // Check contract balance
      const contractBalance = await provider.getBalance(contract.target);
      if (contractBalance < totalAmountWei) {
        return res.status(400).json({ 
          error: `Insufficient contract balance. Contract has ${ethers.formatEther(contractBalance)} ETH, need ${totalAmount} ETH` 
        });
      }
      
      // Call contract's claim function
      const tx = await contract.claim(totalAmountWei, recipientAddress);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        return res.status(500).json({ error: 'Transaction failed' });
      }
      
      // Mark all deposits as claimed (case-insensitive)
      const updateStmt = db.prepare(`
        UPDATE deposits 
        SET claimed = 1, claimed_at = CURRENT_TIMESTAMP, claim_tx_hash = ?
        WHERE LOWER(recipient_address) = ? AND claimed = 0
      `);
      
      updateStmt.run(receipt.hash, recipientAddressLower);
      
      console.log(`✓ Claimed ${unclaimed.length} deposit(s) for ${recipientAddress}: ${totalAmount} ETH (TX: ${receipt.hash})`);
      
      res.json({
        success: true,
        message: `Successfully claimed ${totalAmount} ETH`,
        totalAmount,
        depositCount: unclaimed.length,
        deposits: unclaimed,
        txHash: receipt.hash
      });
      
    } catch (error) {
      console.error('Transaction error:', error.message);
      res.status(500).json({ error: 'Failed to send ETH: ' + error.message });
    }
  } catch (error) {
    console.error('Claim error:', error.message);
    res.status(500).json({ error: 'Failed to process claim', details: error.message });
  }
});

// Endpoint to get all deposits (or filter by address)
app.get('/api/deposits', (req, res) => {
  try {
    const { address } = req.query;
    
    let deposits;
    if (address) {
      const addressLower = address.toLowerCase();
      deposits = db.prepare(`
        SELECT id, amount, recipient_address, claimed, claim_tx_hash, created_at, claimed_at
        FROM deposits 
        WHERE LOWER(recipient_address) = ?
        ORDER BY created_at DESC
      `).all(addressLower);
    } else {
      deposits = db.prepare(`
        SELECT id, amount, recipient_address, claimed, claim_tx_hash, created_at, claimed_at
        FROM deposits 
        ORDER BY created_at DESC
      `).all();
    }
    
    res.json({ success: true, deposits });
  } catch (error) {
    console.error('Database error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve deposits', details: error.message });
  }
});

// Endpoint to get contract address for deposits
app.get('/api/server-address', (req, res) => {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    return res.status(500).json({ error: 'Contract address not configured' });
  }
  res.json({ serverAddress: contractAddress });
});

const PORT = process.env.PORT || 3000;
initializeKeys();
initializeDatabase();
initializeWallet();

app.listen(PORT, () => {
  console.log(`\n🚀 Mixer Server running on http://localhost:${PORT}`);
  console.log(`📝 Public key endpoint: http://localhost:${PORT}/api/public-key`);
  console.log(`📍 Server address endpoint: http://localhost:${PORT}/api/server-address`);
  console.log(`💰 Deposit endpoint: http://localhost:${PORT}/api/deposit`);
  console.log(`🎁 Claim endpoint: http://localhost:${PORT}/api/claim`);
  console.log(`📋 Deposits endpoint: http://localhost:${PORT}/api/deposits\n`);
});

