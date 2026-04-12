const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');
const { sendLiveEarningNotification } = require('../bot/discord');

const router = express.Router();

// ─── RevToo Postback ───
// Postback URL configured in RevToo dashboard:
// https://your-backend.com/api/postback/revtoo?subId={subId}&transId={transId}&payout={payout}&reward={reward}&status={status}&offer_name={offer_name}&signature={signature}
router.get('/revtoo', async (req, res) => {
  try {
    const { subId, transId, payout, reward, status, offer_name, signature, userIp } = req.query;

    // Validate required parameters
    if (!subId || !transId || !payout) {
      console.warn('RevToo: Missing required parameters');
      return res.status(400).send('0');
    }

    // Verify signature: MD5(subId + transId + reward + secret_key)
    const secretKey = process.env.REVTOO_SECRET_KEY;
    if (secretKey && signature) {
      const expectedSignature = crypto
        .createHash('md5')
        .update(subId + transId + (reward || '') + secretKey)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn(`RevToo: Invalid signature for transaction ${transId}`);
        return res.status(403).send('0');
      }
    } else if (secretKey && !signature) {
      console.warn(`RevToo: Missing signature for transaction ${transId}`);
      return res.status(403).send('0');
    }

    // Check for duplicate transaction
    const existingTx = await Transaction.findOne({
      details: { $regex: `txn:${transId}` }
    });
    if (existingTx) {
      console.log(`RevToo: Duplicate transaction ${transId}, skipping`);
      return res.send('1'); // Return success to prevent retries
    }

    // Handle reversals/chargebacks (status = 2)
    if (status === '2') {
      console.log(`RevToo: Reversal for transaction ${transId}, user ${subId}`);
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
          details: `RevToo - Reversal: ${offer_name || 'Offer reversed'} (txn:${transId})`
        });
        console.log(`RevToo: Reversed ${reversePoints} points from ${user.email}`);
      }
      return res.send('1');
    }

    // Status 1 = successful completion
    const user = await User.findById(subId);
    if (!user) {
      console.warn(`RevToo: User not found: ${subId}`);
      return res.status(404).send('0');
    }

    const payoutAmount = parseFloat(payout);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).send('0');
    }

    // Calculate 60% of the payout value as points
    const userPoints = Math.floor(payoutAmount * 0.60);

    if (userPoints <= 0) {
      return res.status(400).send('0');
    }

    user.points += userPoints;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'offerwall',
      points: userPoints,
      status: 'completed',
      details: `RevToo - ${offer_name || 'Offer completed'} ($${payoutAmount}) (txn:${transId})`
    });

    // Referral commission (10%)
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

    console.log(`RevToo: Credited ${userPoints} points to ${user.email} (txn: ${transId})`);

    // Post to #live-earnings if high-value offer (>1,000 points)
    if (userPoints >= 1000) {
      sendLiveEarningNotification(user, userPoints, offer_name || 'High-Value Offer').catch(() => {});
    }

    res.send('1'); // Success
  } catch (error) {
    console.error('RevToo postback error:', error);
    res.status(500).send('0');
  }
});

module.exports = router;
