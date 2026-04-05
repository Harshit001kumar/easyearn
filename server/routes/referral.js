const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Referral = require('../models/Referral');

const router = express.Router();

// ─── GET REFERRAL INFO ───
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    const referrals = await Referral.find({ referrerId: user._id })
      .populate('refereeId', 'email createdAt points')
      .sort({ createdAt: -1 });

    const totalCommission = referrals.reduce((sum, r) => sum + r.totalPointsEarned, 0);
    const activeReferrals = referrals.filter(r => {
      const daysSince = (Date.now() - r.refereeId.createdAt) / (1000 * 60 * 60 * 24);
      return daysSince < 30; // Active if joined within last 30 days
    }).length;

    res.json({
      referralCode: user.referralCode,
      referralLink: `${process.env.CLIENT_URL}/register?ref=${user.referralCode}`,
      totalReferrals: referrals.length,
      activeReferrals,
      totalCommission,
      referrals: referrals.map(r => ({
        email: r.refereeId.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        joinedAt: r.refereeId.createdAt,
        commissionEarned: r.totalPointsEarned,
        isActive: (Date.now() - r.refereeId.createdAt) / (1000 * 60 * 60 * 24) < 30
      }))
    });
  } catch (error) {
    console.error('Referral error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
