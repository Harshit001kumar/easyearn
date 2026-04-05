const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  method: {
    type: String,
    enum: ['LTC', 'UPI'],
    required: true
  },
  amountPoints: {
    type: Number,
    required: true,
    min: 1
  },
  destination: {
    type: String,
    required: true // Wallet address or UPI ID
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  discordMessageId: {
    type: String,
    default: null
  },
  processedBy: {
    type: String,
    default: null // Discord admin username who approved/rejected
  },
  txHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
