require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let db;
let provider;
let wallet;
let contract;

// Initialize ethers provider and wallet for contract calls
function initializeProvider() {
  const rpcUrl = process.env.RPC_URL;
  const serverPrivateKey = process.env.SERVER_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl) {
    console.warn('⚠️  Missing RPC_URL in .env - blockchain features disabled');
    return;
  }

  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log(`✓ Provider initialized`);

    // Initialize wallet and contract for claims
    if (serverPrivateKey && contractAddress) {
      wallet = new ethers.Wallet(serverPrivateKey, provider);
      
      // Load contract ABI
      const abiPath = path.join(__dirname, 'Groyper.json');
      if (fs.existsSync(abiPath)) {
        const contractABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        contract = new ethers.Contract(contractAddress, contractABI, wallet);
        console.log(`✓ Wallet and contract initialized for claims`);
      } else {
        console.warn('⚠️  Groyper.json ABI file not found - claim features disabled');
      }
    } else {
      console.warn('⚠️  Missing SERVER_PRIVATE_KEY or CONTRACT_ADDRESS - claim features disabled');
    }
  } catch (error) {
    console.error('✗ Provider initialization failed:', error.message);
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

// Endpoint to save deposit after transaction is confirmed
app.post('/api/deposit', async (req, res) => {
  try {
    const { txHash, recipientAddress } = req.body;
    
    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }
    
    if (!recipientAddress) {
      return res.status(400).json({ error: 'recipientAddress is required' });
    }
    
    // Check if already processed
    const existing = db.prepare('SELECT id FROM deposits WHERE deposit_tx_hash = ?').get(txHash);
    if (existing) {
      return res.status(400).json({ error: 'This transaction has already been processed' });
    }
    
    // Basic address validation
    let normalizedAddress = recipientAddress.trim().toLowerCase();
    if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
      return res.status(400).json({ error: 'Invalid recipient address format' });
    }
    
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
    
    // Store deposit in database (keep encrypted_recipient_address column but set to empty string)
    const stmt = db.prepare(`
      INSERT INTO deposits (amount, encrypted_recipient_address, recipient_address, deposit_tx_hash, created_at) 
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(amount, '', normalizedAddress, txHash);
    const depositId = stmt.lastInsertRowid;
    
    console.log(`✓ Deposit saved: ${amount} ETH to ${normalizedAddress} (TX: ${txHash}, ID: ${depositId})`);
    
    res.json({
      success: true,
      depositId,
      amount,
      recipientAddress: normalizedAddress,
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
    
    // Find all unclaimed deposits for this address (case-insensitive comparison)
    const recipientAddressLower = recipientAddress.toLowerCase();
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
    
    // Check if wallet and contract are configured
    if (!wallet || !contract || !provider) {
      return res.json({
        success: false,
        message: 'Claim functionality is disabled - wallet not configured. Please set SERVER_PRIVATE_KEY and CONTRACT_ADDRESS in .env',
        deposits: unclaimed,
        totalAmount: totalAmount.toFixed(18),
        depositCount: unclaimed.length
      });
    }
    
    // Convert to decimal string without scientific notation
    const totalAmountString = totalAmount.toFixed(18);
    const totalAmountWei = ethers.parseEther(totalAmountString);
    
    try {
      // Check contract balance
      const contractBalance = await provider.getBalance(contract.target);
      if (contractBalance < totalAmountWei) {
        return res.status(400).json({ 
          success: false,
          error: `Insufficient contract balance. Contract has ${ethers.formatEther(contractBalance)} ETH, need ${totalAmount} ETH`,
          deposits: unclaimed,
          totalAmount: totalAmount.toFixed(18),
          depositCount: unclaimed.length
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
      
      return res.json({
        success: true,
        message: `Successfully claimed ${totalAmount} ETH`,
        totalAmount,
        depositCount: unclaimed.length,
        deposits: unclaimed,
        txHash: receipt.hash
      });
      
    } catch (error) {
      console.error('Transaction error:', error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to send ETH: ' + error.message,
        deposits: unclaimed,
        totalAmount: totalAmount.toFixed(18),
        depositCount: unclaimed.length
      });
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
app.get('/api/contract-address', (req, res) => {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    return res.status(500).json({ error: 'Contract address not configured' });
  }
  res.json({ contractAddress });
});

// Endpoint to get server address (legacy, keeping for compatibility)
app.get('/api/server-address', (req, res) => {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    return res.status(500).json({ error: 'Contract address not configured' });
  }
  res.json({ serverAddress: contractAddress }); // Return contract address for backward compatibility
});

const PORT = process.env.PORT || 3000;
initializeDatabase();
initializeProvider();

app.listen(PORT, () => {
  console.log(`\n🚀 Mixer Server running on http://localhost:${PORT}`);
  console.log(`📍 Server address endpoint: http://localhost:${PORT}/api/server-address`);
  console.log(`💰 Deposit endpoint: http://localhost:${PORT}/api/deposit`);
  console.log(`🎁 Claim endpoint: http://localhost:${PORT}/api/claim`);
  console.log(`📋 Deposits endpoint: http://localhost:${PORT}/api/deposits\n`);
});

