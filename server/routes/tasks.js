const express = require('express');
const { auth } = require('../middleware/auth');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');

const router = express.Router();

// ─── GET ALL ACTIVE TASKS ───
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET MY SUBMISSIONS ───
router.get('/my-submissions', auth, async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({ userId: req.userId })
      .populate('taskId', 'title rewardAmount')
      .sort({ createdAt: -1 });
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── SUBMIT PROOF FOR A TASK ───
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !task.isActive) {
      return res.status(404).json({ error: 'Task not found or inactive.' });
    }

    // Check if user already submitted for this task
    const existingSubmission = await TaskSubmission.findOne({
      userId: req.userId,
      taskId: task._id,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already submitted for this task.' });
    }

    const { proof } = req.body;

    if (task.reqProof && !proof) {
      return res.status(400).json({ error: 'Proof is required for this task.' });
    }

    const submission = await TaskSubmission.create({
      userId: req.userId,
      taskId: task._id,
      proof: proof || ''
    });

    res.json({ message: 'Submission received! Awaiting admin review.', submission });
  } catch (error) {
    console.error('Error submitting task:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
