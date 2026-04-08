const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

const router = express.Router();

// ─── RevToo Postback ───
// URL: /api/postback/revtoo?subId=XXX&transactionId=XXX&offerId=XXX&offerName=XXX&payout=XXX&status=XXX&secret=XXX
router.get('/revtoo', async (req, res) => {
  try {
    const { subId, transactionId, offerId, offerName, payout, status, secret } = req.query;

    // Validate secret key
    if (secret !== process.env.REVTOO_SECRET_KEY) {
      console.warn('RevToo: Invalid postback secret');
      return res.status(403).send('Invalid secret');
    }

    if (!subId || !payout) {
      return res.status(400).send('Missing parameters');
    }

    // Handle reversals/chargebacks
    if (status === '2' || status === 'reversed') {
      console.log(`RevToo: Reversal for transaction ${transactionId}, user ${subId}`);
      // Optionally deduct points on reversal
      const user = await User.findById(subId);
      if (user) {
        const reversePoints = Math.floor(parseFloat(payout) * 0.60);
        user.points = Math.max(0, user.points - reversePoints);
        await user.save();
        await Transaction.create({
          userId: user._id,
          type: 'offerwall',
          points: -reversePoints,
          status: 'completed',
          details: `RevToo - Reversal: ${offerName || offerId || 'Offer reversed'}`
        });
        console.log(`RevToo: Reversed ${reversePoints} points from ${user.email}`);
      }
      return res.send('1');
    }

    const user = await User.findById(subId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const payoutAmount = parseFloat(payout);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).send('Invalid payout');
    }

    // Calculate 60% of the payout value as points
    const userPoints = Math.floor(payoutAmount * 0.60);

    if (userPoints <= 0) {
      return res.status(400).send('Payout too low');
    }

    user.points += userPoints;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'offerwall',
      points: userPoints,
      status: 'completed',
      details: `RevToo - ${offerName || offerId || 'Offer completed'} (${payoutAmount} pts)`
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

    console.log(`RevToo: Credited ${userPoints} points to ${user.email} (txn: ${transactionId})`);
    res.send('1'); // Success
  } catch (error) {
    console.error('RevToo postback error:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;
