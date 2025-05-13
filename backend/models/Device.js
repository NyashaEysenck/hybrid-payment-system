const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceFingerprint: { type: String, required: true, unique: true },
  deviceName: { type: String, default: 'Unknown Device' },
  browser: { type: String },
  platform: { type: String },
  lastUsed: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
 
});

module.exports = mongoose.model('Device', deviceSchema);
