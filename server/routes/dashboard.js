const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

const router = express.Router();

// ─── DASHBOARD DATA ───
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    // Total earned (all completed positive transactions)
    const totalEarnedResult = await Transaction.aggregate([
      { $match: { userId: user._id, status: 'completed', points: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);
    const totalEarned = totalEarnedResult[0]?.total || 0;

    // Referral earnings
    const referralEarningsResult = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'referral', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);
    const referralEarnings = referralEarningsResult[0]?.total || 0;

    // Recent transactions (last 10)
    const recentTransactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Referral count
    const referralCount = await Referral.countDocuments({ referrerId: user._id });

    // Daily streak info
    const now = new Date();
    const lastStreakClaim = user.dailyStreak?.lastClaimed;
    let canClaimDaily = true;
    if (lastStreakClaim) {
      const hoursSince = (now - lastStreakClaim) / (1000 * 60 * 60);
      canClaimDaily = hoursSince >= 24;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        points: user.points,
        ltcEquivalent: user.points * 0.00001,
        referralCode: user.referralCode,
        discord: user.discord,
        isAdmin: user.isAdmin
      },
      stats: {
        totalEarned,
        referralEarnings,
        referralCount,
        dailyStreak: user.dailyStreak?.count || 0,
        canClaimDaily
      },
      recentTransactions
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── DAILY BONUS ───
router.post('/daily-bonus', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const now = new Date();
    const lastClaim = user.dailyStreak?.lastClaimed;

    if (lastClaim) {
      const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
        return res.status(429).json({
          error: 'Already claimed today.',
          nextClaim
        });
      }
      // Check if streak is broken (more than 48 hours)
      if (hoursSince > 48) {
        user.dailyStreak.count = 0;
      }
    }

    // Calculate streak reward (Day 1: 2pts, Day 2: 4pts, ... Day 7: 14pts, then resets)
    const newStreak = (user.dailyStreak?.count || 0) + 1;
    const bonusPoints = Math.min(newStreak * 2, 14);

    user.dailyStreak = { count: newStreak > 7 ? 1 : newStreak, lastClaimed: now };
    user.points += bonusPoints;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'daily_bonus',
      points: bonusPoints,
      status: 'completed',
      details: `Day ${newStreak > 7 ? 1 : newStreak} streak bonus`
    });

    // Referral commission
    if (user.referredBy) {
      const commission = Math.floor(bonusPoints * 0.10);
      if (commission > 0) {
        await User.findByIdAndUpdate(user.referredBy, { $inc: { points: commission } });
        await Transaction.create({
          userId: user.referredBy,
          type: 'referral',
          points: commission,
          status: 'completed',
          details: `Referral commission from ${user.email}`
        });
        await Referral.findOneAndUpdate(
          { referrerId: user.referredBy, refereeId: user._id },
          { $inc: { totalPointsEarned: commission } }
        );
      }
    }

    res.json({
      message: `Claimed ${bonusPoints} points!`,
      streak: user.dailyStreak.count,
      pointsEarned: bonusPoints,
      newBalance: user.points
    });
  } catch (error) {
    console.error('Daily bonus error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
