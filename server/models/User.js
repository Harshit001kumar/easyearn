const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  discord: {
    id: { type: String, default: null },
    username: { type: String, default: null },
    verified: { type: Boolean, default: false }
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  referralCode: {
    type: String,
    unique: true,
    required: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ip: {
    type: String,
    default: null
  },
  lastFaucetClaim: {
    type: Date,
    default: null
  },
  dailyStreak: {
    count: { type: Number, default: 0 },
    lastClaimed: { type: Date, default: null }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Virtual: LTC equivalent
userSchema.virtual('ltcEquivalent').get(function() {
  return this.points * 0.00001;
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
