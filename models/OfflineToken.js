const mongoose = require('mongoose');

const offlineTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  amount: { type: Number, required: true },
  remainingAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['active', 'partially_used', 'fully_used', 'expired'], 
    default: 'active' 
  },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OfflineToken', offlineTokenSchema);
