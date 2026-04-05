const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

const router = express.Router();

// ─── CPAGrip Postback ───
// URL: /api/postback/cpagrip?user_id=XXX&amount=XXX&key=XXX&offer=XXX
router.get('/cpagrip', async (req, res) => {
  try {
    const { user_id, amount, key, offer } = req.query;

    // Validate secret key
    if (key !== process.env.CPAGRIP_POSTBACK_KEY) {
      console.warn('CPAGrip: Invalid postback key');
      return res.status(403).send('Invalid key');
    }

    if (!user_id || !amount) {
      return res.status(400).send('Missing parameters');
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Calculate 60% of the offer value, converted to points
    // Amount from CPAGrip is in USD
    const usdAmount = parseFloat(amount);
    if (isNaN(usdAmount) || usdAmount <= 0) {
      return res.status(400).send('Invalid amount');
    }

    // For now use a static LTC price estimate; in production, use CoinGecko API
    const ltcPrice = 100; // $100 per LTC as fallback
    const userShare = usdAmount * 0.60;
    const pointsEarned = Math.floor((userShare / ltcPrice) / 0.00001);

    if (pointsEarned <= 0) {
      return res.status(400).send('Amount too low');
    }

    user.points += pointsEarned;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'offerwall',
      points: pointsEarned,
      status: 'completed',
      details: `CPAGrip - ${offer || 'Offer completed'} ($${usdAmount})`
    });

    // Referral commission
    if (user.referredBy) {
      const commission = Math.floor(pointsEarned * 0.10);
      if (commission > 0) {
        await User.findByIdAndUpdate(user.referredBy, { $inc: { points: commission } });
        await Transaction.create({
          userId: user.referredBy,
          type: 'referral',
          points: commission,
          status: 'completed',
          details: `Referral commission from ${user.email} offerwall`
        });
        await Referral.findOneAndUpdate(
          { referrerId: user.referredBy, refereeId: user._id },
          { $inc: { totalPointsEarned: commission } }
        );
      }
    }

    console.log(`CPAGrip: Credited ${pointsEarned} points to ${user.email}`);
    res.send('1'); // Success response for CPAGrip
  } catch (error) {
    console.error('CPAGrip postback error:', error);
    res.status(500).send('Error');
  }
});

// ─── AdGate Media Postback ───
// URL: /api/postback/adgate?user_id=XXX&points=XXX&secret=XXX&offer_name=XXX
router.get('/adgate', async (req, res) => {
  try {
    const { user_id, points, secret, offer_name } = req.query;

    // Validate secret
    if (secret !== process.env.ADGATE_SECRET) {
      console.warn('AdGate: Invalid postback secret');
      return res.status(403).send('Invalid secret');
    }

    if (!user_id || !points) {
      return res.status(400).send('Missing parameters');
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const pointsAmount = parseInt(points);
    if (isNaN(pointsAmount) || pointsAmount <= 0) {
      return res.status(400).send('Invalid points');
    }

    // AdGate sends points directly (already calculated with 60% share)
    const userPoints = Math.floor(pointsAmount * 0.60);

    user.points += userPoints;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'offerwall',
      points: userPoints,
      status: 'completed',
      details: `AdGate Media - ${offer_name || 'Offer completed'}`
    });

    // Referral commission
    if (user.referredBy) {
      const commission = Math.floor(userPoints * 0.10);
      if (commission > 0) {
        await User.findByIdAndUpdate(user.referredBy, { $inc: { points: commission } });
        await Transaction.create({
          userId: user.referredBy,
          type: 'referral',
          points: commission,
          status: 'completed',
          details: `Referral commission from ${user.email} offerwall`
        });
        await Referral.findOneAndUpdate(
          { referrerId: user.referredBy, refereeId: user._id },
          { $inc: { totalPointsEarned: commission } }
        );
      }
    }

    console.log(`AdGate: Credited ${userPoints} points to ${user.email}`);
    res.send('1'); // Success
  } catch (error) {
    console.error('AdGate postback error:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;
