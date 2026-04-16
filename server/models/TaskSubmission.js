const mongoose = require('mongoose');

const taskSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  proof: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TaskSubmission', taskSubmissionSchema);
