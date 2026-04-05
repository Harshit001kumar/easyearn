const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');

const router = express.Router();

// ─── REQUEST WITHDRAWAL ───
router.post('/', auth, async (req, res) => {
  try {
    const { method, amountPoints, destination } = req.body;
    const user = await User.findById(req.userId);

    // Validate method
    if (!['LTC', 'UPI'].includes(method)) {
      return res.status(400).json({ error: 'Invalid withdrawal method. Use LTC or UPI.' });
    }

    // Validate destination
    if (!destination || destination.trim().length < 3) {
      return res.status(400).json({ error: 'Invalid destination address.' });
    }

    // Validate UPI format
    if (method === 'UPI' && !destination.includes('@')) {
      return res.status(400).json({ error: 'Invalid UPI ID format.' });
    }

    // Validate amount
    const points = parseInt(amountPoints);
    if (isNaN(points) || points <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    // Check balance
    if (user.points < points) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    // Check Discord verification
    if (!user.discord?.verified) {
      return res.status(400).json({ error: 'Please verify your Discord account before withdrawing.' });
    }

    // Check minimum withdrawal ($1.00 equivalent)
    // 1 Point = 0.00001 LTC; $1 worth = 1 / LTC_PRICE / 0.00001
    // Using a conservative estimate; frontend should fetch live price
    const ltcValue = points * 0.00001;
    // Minimum 0.01 LTC (~$1 at most LTC prices)
    if (ltcValue < 0.01) {
      return res.status(400).json({
        error: 'Minimum withdrawal is $1.00 equivalent (approximately 1,000 points).',
        minimumPoints: 1000
      });
    }

    // Check for pending withdrawals
    const pendingCount = await Withdrawal.countDocuments({
      userId: user._id,
      status: 'pending'
    });
    if (pendingCount > 0) {
      return res.status(400).json({ error: 'You already have a pending withdrawal.' });
    }

    // Deduct points
    user.points -= points;
    await user.save();

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      userId: user._id,
      method,
      amountPoints: points,
      destination: destination.trim(),
      status: 'pending'
    });

    // Log transaction
    await Transaction.create({
      userId: user._id,
      type: 'withdrawal',
      points: -points,
      status: 'pending',
      details: `Withdrawal ${method}: ${destination}`
    });

    // Send Discord notification (handled in bot module)
    const bot = require('../bot/discord');
    if (bot.sendWithdrawalNotification) {
      await bot.sendWithdrawalNotification(withdrawal, user);
    }

    res.json({
      message: 'Withdrawal request submitted! An admin will process it shortly.',
      withdrawal: {
        id: withdrawal._id,
        method,
        points,
        ltcAmount: ltcValue,
        destination,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET WITHDRAWAL HISTORY ───
router.get('/history', auth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ withdrawals });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
