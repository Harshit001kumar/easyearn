const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['faucet', 'offerwall', 'shortlink', 'referral', 'withdrawal', 'daily_bonus', 'admin_adjust', 'custom_task'],
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'rejected'],
    default: 'completed'
  },
  details: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
