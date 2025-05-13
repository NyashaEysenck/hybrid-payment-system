const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the transaction schema
const transactionSchema = new Schema(
  {
    transaction_id: {
      type: String,
      required: true,
      unique: true, // Ensure the transaction ID is unique
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model (sender)
      required: function() {
        return this.transaction_type === 'payment'; // Only required for payments
      },
      default: null,
    },
    receiver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model (receiver)
      required: function() {
        return this.transaction_type === 'payment'; // Only required for payments
      },
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    token_id: {
      type: String,
      default: null, // Only used for offline payments
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'conflict'],
      default: 'pending',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    synced_at: {
      type: Date,
      default: null, // Set after syncing the transaction
    },
    sync_status: {
      sender_synced: {
        type: Boolean,
        default: false,
      },
      receiver_synced: {
        type: Boolean,
        default: false,
      },
    },
    offline_method: {
      type: String,
      enum: ['QR', 'Bluetooth'],
      default: null, // For offline payments only
    },
    transaction_type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'payment'],
      required: true,
    },
    note: {
      type: String,
      default: null, // Optional field for additional information about the transaction
      maxlength: 500, // Limit the length of the note (optional)
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Create and export the Transaction model
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
