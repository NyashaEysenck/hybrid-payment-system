const mongoose = require('mongoose');

const tokenReservationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Assuming the users are in a 'User' collection
  },
  amount_reserved: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  reservation_time: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'released'],
    default: 'active',
  },
});

const TokenReservation = mongoose.model('TokenReservation', tokenReservationSchema);

module.exports = TokenReservation;
