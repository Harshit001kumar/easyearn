const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  rewardAmount: {
    type: Number,
    required: true,
    min: 0
  },
  reqProof: {
    type: Boolean,
    default: true
  },
  link: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);
