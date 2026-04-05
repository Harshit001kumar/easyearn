const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Token = require('../models/Token');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

const router = express.Router();

const COOLDOWN_MS = (parseInt(process.env.FAUCET_COOLDOWN_MINUTES) || 5) * 60 * 1000;
const MIN_REWARD = parseInt(process.env.FAUCET_MIN_REWARD) || 1;
const MAX_REWARD = parseInt(process.env.FAUCET_MAX_REWARD) || 5;

// ─── CLAIM: Generate token + redirect to ShrinkMe ───
router.post('/claim', auth, async (req, res) => {
  try {
    const { captchaToken } = req.body;
    const user = await User.findById(req.userId);
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

    // Check cooldown
    if (user.lastFaucetClaim) {
      const elapsed = Date.now() - user.lastFaucetClaim.getTime();
      if (elapsed < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - elapsed;
        return res.status(429).json({
          error: 'Faucet is on cooldown.',
          remainingMs: remaining,
          nextClaim: new Date(user.lastFaucetClaim.getTime() + COOLDOWN_MS)
        });
      }
    }

    // Verify hCaptcha
    if (process.env.HCAPTCHA_SECRET && process.env.HCAPTCHA_SECRET !== 'your_hcaptcha_secret_key') {
      try {
        const captchaRes = await axios.post('https://hcaptcha.com/siteverify', null, {
          params: {
            secret: process.env.HCAPTCHA_SECRET,
            response: captchaToken
          }
        });
        if (!captchaRes.data.success) {
          return res.status(400).json({ error: 'Captcha verification failed.' });
        }
      } catch (err) {
        console.error('Captcha error:', err.message);
      }
    }

    // Generate verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Token.create({
      userId: user._id,
      token: verificationToken,
      ip,
      expiresAt
    });

    // Generate ShrinkMe shortlink
    const callbackUrl = `${process.env.CLIENT_URL}/verify?token=${verificationToken}`;
    let shortlink = callbackUrl;

    if (process.env.SHRINKME_API_KEY && process.env.SHRINKME_API_KEY !== 'your_shrinkme_api_key') {
      try {
        const shrinkRes = await axios.get('https://shrinkme.io/api', {
          params: {
            api: process.env.SHRINKME_API_KEY,
            url: callbackUrl
          }
        });
        if (shrinkRes.data.status === 'success') {
          shortlink = shrinkRes.data.shortenedUrl;
        }
      } catch (err) {
        console.error('ShrinkMe error:', err.message);
        // Fall through to use direct link
      }
    }

    res.json({
      message: 'Complete the shortlink to claim your reward.',
      shortlink,
      token: verificationToken
    });
  } catch (error) {
    console.error('Faucet claim error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── VERIFY: Validate token and reward user ───
router.get('/verify', auth, async (req, res) => {
  try {
    const { token: tokenStr } = req.query;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

    if (!tokenStr) {
      return res.status(400).json({ error: 'Token is required.' });
    }

    const token = await Token.findOne({ token: tokenStr });

    if (!token) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    // Check 1: Token belongs to this user
    if (token.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Token does not belong to you.' });
    }

    // Check 2: Token not already used
    if (token.isUsed) {
      return res.status(400).json({ error: 'Token already used.' });
    }

    // Check 3: Token not expired
    if (new Date() > token.expiresAt) {
      return res.status(400).json({ error: 'Token expired.' });
    }

    // Check 4: IP match
    if (token.ip !== ip) {
      return res.status(403).json({ error: 'IP mismatch detected.' });
    }

    // Check 5: Minimum 10 seconds elapsed (anti-speed-bot)
    const elapsed = Date.now() - token.createdAt.getTime();
    if (elapsed < 10000) {
      return res.status(400).json({ error: 'Verification too fast. Please complete the shortlink.' });
    }

    // All checks passed — reward user
    const reward = Math.floor(Math.random() * (MAX_REWARD - MIN_REWARD + 1)) + MIN_REWARD;

    const user = await User.findById(req.userId);
    user.points += reward;
    user.lastFaucetClaim = new Date();
    await user.save();

    // Mark token as used
    token.isUsed = true;
    await token.save();

    // Log transaction
    await Transaction.create({
      userId: user._id,
      type: 'faucet',
      points: reward,
      status: 'completed',
      details: 'Faucet claim'
    });

    // Referral commission (10%)
    if (user.referredBy) {
      const commission = Math.floor(reward * 0.10);
      if (commission > 0) {
        await User.findByIdAndUpdate(user.referredBy, { $inc: { points: commission } });
        await Transaction.create({
          userId: user.referredBy,
          type: 'referral',
          points: commission,
          status: 'completed',
          details: `Referral commission from ${user.email} faucet`
        });
        await Referral.findOneAndUpdate(
          { referrerId: user.referredBy, refereeId: user._id },
          { $inc: { totalPointsEarned: commission } }
        );
      }
    }

    res.json({
      message: `You earned ${reward} points!`,
      pointsEarned: reward,
      newBalance: user.points,
      nextClaim: new Date(Date.now() + COOLDOWN_MS)
    });
  } catch (error) {
    console.error('Faucet verify error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── FAUCET STATUS ───
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const now = Date.now();
    let canClaim = true;
    let remainingMs = 0;
    let nextClaim = null;

    if (user.lastFaucetClaim) {
      const elapsed = now - user.lastFaucetClaim.getTime();
      if (elapsed < COOLDOWN_MS) {
        canClaim = false;
        remainingMs = COOLDOWN_MS - elapsed;
        nextClaim = new Date(user.lastFaucetClaim.getTime() + COOLDOWN_MS);
      }
    }

    const todayClaims = await Transaction.countDocuments({
      userId: user._id,
      type: 'faucet',
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    const totalFaucetEarnings = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'faucet', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);

    res.json({
      canClaim,
      remainingMs,
      nextClaim,
      todayClaims,
      totalFaucetEarnings: totalFaucetEarnings[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
