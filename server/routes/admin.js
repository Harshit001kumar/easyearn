const express = require('express');
const { adminAuth } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

const router = express.Router();

// ─── ADMIN STATS ───
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });

    const totalPointsResult = await Transaction.aggregate([
      { $match: { type: { $ne: 'withdrawal' }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);
    const totalPointsDistributed = totalPointsResult[0]?.total || 0;

    const totalWithdrawnResult = await Withdrawal.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amountPoints' } } }
    ]);
    const totalWithdrawn = totalWithdrawnResult[0]?.total || 0;

    res.json({
      totalUsers,
      pendingWithdrawals,
      totalPointsDistributed,
      totalWithdrawn
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── LIST ALL USERS ───
router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── LIST PENDING WITHDRAWALS ───
router.get('/withdrawals', adminAuth, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const withdrawals = await Withdrawal.find({ status })
      .populate('userId', 'email discord points')
      .sort({ createdAt: -1 });
    res.json({ withdrawals });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── APPROVE/REJECT WITHDRAWAL (Web Admin) ───
router.patch('/withdrawals/:id', adminAuth, async (req, res) => {
  try {
    const { status, txHash } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found.' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'Withdrawal already processed.' });
    }

    withdrawal.status = status;
    withdrawal.processedBy = req.user.email;
    if (txHash) withdrawal.txHash = txHash;
    await withdrawal.save();

    // If rejected, refund points
    if (status === 'rejected') {
      await User.findByIdAndUpdate(withdrawal.userId, {
        $inc: { points: withdrawal.amountPoints }
      });
      await Transaction.create({
        userId: withdrawal.userId,
        type: 'admin_adjust',
        points: withdrawal.amountPoints,
        status: 'completed',
        details: 'Withdrawal rejected — points refunded'
      });
    }

    // Update the transaction record status
    await Transaction.findOneAndUpdate(
      { userId: withdrawal.userId, type: 'withdrawal', status: 'pending' },
      { status: status === 'approved' ? 'completed' : 'rejected' }
    );

    res.json({ message: `Withdrawal ${status}.`, withdrawal });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── ADJUST USER BALANCE ───
router.post('/adjust-balance', adminAuth, async (req, res) => {
  try {
    const { userId, points, reason } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.points += parseInt(points);
    if (user.points < 0) user.points = 0;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'admin_adjust',
      points: parseInt(points),
      status: 'completed',
      details: reason || 'Admin balance adjustment'
    });

    res.json({ message: 'Balance adjusted.', newBalance: user.points });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── BAN/UNBAN USER ───
router.patch('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'}.`, isBanned: user.isBanned });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── TRANSACTION LOGS ───
router.get('/transactions', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find()
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments();

    res.json({ transactions, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
