const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction')
const User = require('../models/User');

const router = express.Router();

// Health check endpoint for online status detection
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// API Endpoint for Online Transfer
router.post('/transfer', async (req, res) => {
  try {
    const {sender, recipient, amount, note } = req.body;
    console.log("in transfer",sender, recipient, amount, note)

    // Validate the amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount specified' });
    }

    // Find the recipient user
    const recipientUser = await User.findOne({
      $or: [{ name: recipient }, { email: recipient }],
    });

    if (!recipientUser) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const senderUser = await User.findOne({ email: sender});
    
    if (!senderUser) {
      return res.status(404).json({ message: 'Sender not found' });
    }

    // Check balance
    if (senderUser.balance < amount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    // Create transaction
    const transaction = new Transaction({
      transaction_id: new mongoose.Types.ObjectId().toString(),
      sender_id: senderUser._id,
      receiver_id: recipientUser._id,
      amount,
      note: note || null,
      transaction_type: 'payment',
      status: 'pending',
    });

    // Update balances
    senderUser.balance -= amount;
    recipientUser.balance += amount;

    // Save all changes
    await senderUser.save();
    await recipientUser.save();
    await transaction.save();
    
    return res.status(200).json({
      message: 'Transfer successful',
      transaction: transaction,
      balance: senderUser.balance,
      reservedBalance: senderUser.reserved_Balance 
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// NEW ENDPOINT: Get all transactions for a user by email
router.get('/user', async (req, res) => {
  try {
    const { email } = req.query;  // FIXED

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email query parameter is required"
      });
    }

    // 1. Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        data: []  // Ensure an empty array is returned
      });
    }

    // 2. Find all related transactions
    const transactions = await Transaction.find({
      $or: [
        { sender_id: user._id },
        { receiver_id: user._id }
      ]
    })
    .sort({ created_at: -1 }) // Newest first
    .populate('sender_id', 'username email')
    .populate('receiver_id', 'username email') || [];

    console.log("DONE");

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions || []  // Always return an array
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      data: [], // Ensure an empty array is returned on error
      error: error.message 
    });
  }
});

// Check if a transaction exists
router.get('/check/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if transaction exists in the database
    const transaction = await Transaction.findOne({ transaction_id: id });
    
    if (transaction) {
      return res.status(200).json({
        exists: true,
        status: transaction.status,
        synced_at: transaction.synced_at
      });
    } else {
      return res.status(200).json({
        exists: false
      });
    }
  } catch (error) {
    console.error('Error checking transaction:', error);
    return res.status(500).json({ 
      error: 'Failed to check transaction',
      message: error.message
    });
  }
});

// Sync offline transactions to online database
router.post('/sync', async (req, res) => {
  try {
    const { id, sender, recipient, amount, note, timestamp, receiptId, type } = req.body;
    
    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({ transaction_id: id });
    
    if (existingTransaction) {
      return res.status(200).json({
        message: 'Transaction already exists',
        transaction: existingTransaction
      });
    }
    
    // Find the sender and recipient users
    const senderUser = await User.findOne({ email: sender });
    const recipientUser = await User.findOne({ email: recipient });
    
    if (!senderUser || !recipientUser) {
      return res.status(404).json({
        message: 'Sender or recipient not found',
        senderFound: !!senderUser,
        recipientFound: !!recipientUser
      });
    }
    
    // Create a new transaction record
    const transaction = new Transaction({
      transaction_id: id,
      sender_id: senderUser._id,
      receiver_id: recipientUser._id,
      amount: parseFloat(amount),
      note: note || null,
      transaction_type: 'payment',
      status: 'pending', // Initially set as pending
      created_at: new Date(timestamp),
      token_id: receiptId,
      sync_status: {
        sender_synced: false,
        receiver_synced: false
      },
      offline_method: 'QR'
    });
    
    // Save the transaction
    await transaction.save();
    
    return res.status(201).json({
      message: 'Transaction synced successfully',
      transaction: transaction
    });
  } catch (error) {
    console.error('Error syncing transaction:', error);
    return res.status(500).json({
      error: 'Failed to sync transaction',
      message: error.message
    });
  }
});

// Confirm transaction (mark as completed)
router.post('/confirm/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_email } = req.body;
    
    // Find the transaction
    const transaction = await Transaction.findOne({ transaction_id: id });
    
    if (!transaction) {
      return res.status(404).json({
        message: 'Transaction not found'
      });
    }
    
    // Find the user
    const user = await User.findOne({ email: user_email });
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }
    
    // Update sync status based on user role
    const senderUser = await User.findById(transaction.sender_id);
    const receiverUser = await User.findById(transaction.receiver_id);
    
    if (user_email === senderUser.email) {
      transaction.sync_status.sender_synced = true;
    } else if (user_email === receiverUser.email) {
      transaction.sync_status.receiver_synced = true;
    } else {
      return res.status(400).json({
        message: 'User is not part of this transaction'
      });
    }
    
    // If both parties have synced, mark as completed
    if (transaction.sync_status.sender_synced && transaction.sync_status.receiver_synced) {
      transaction.status = 'completed';
      transaction.synced_at = new Date();
      
      // Update balances if not already done
      if (transaction.status !== 'completed') {
        senderUser.balance -= transaction.amount;
        receiverUser.balance += transaction.amount;
        
        await senderUser.save();
        await receiverUser.save();
      }
    }
    
    // Save the transaction
    await transaction.save();
    
    return res.status(200).json({
      message: 'Transaction updated',
      transaction: transaction,
      is_completed: transaction.status === 'completed'
    });
  } catch (error) {
    console.error('Error confirming transaction:', error);
    return res.status(500).json({
      error: 'Failed to confirm transaction',
      message: error.message
    });
  }
});

module.exports = router;