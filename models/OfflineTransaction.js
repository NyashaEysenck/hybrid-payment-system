const mongoose = require('mongoose');

const offlineTransactionSchema = new mongoose.Schema({
  tokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'OfflineToken', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'failed', 'expired'], 
    default: 'pending' 
  },
  uniqueIdentifier: { type: String, required: true, unique: true },
  payerConfirmed: { type: Boolean, default: false },
  payeeConfirmed: { type: Boolean, default: false },
  payerDeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  payeeDeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('OfflineTransaction', offlineTransactionSchema);
