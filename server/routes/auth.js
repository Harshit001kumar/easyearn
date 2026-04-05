const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const Referral = require('../models/Referral');
const { auth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ─── REGISTER ───
router.post('/register', async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

    // Check for duplicate IPs (max 2 accounts per IP)
    const ipCount = await User.countDocuments({ ip });
    if (ipCount >= 2) {
      return res.status(403).json({ error: 'Maximum accounts per IP reached.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newRefCode = uuidv4().slice(0, 8).toUpperCase();

    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      referralCode: newRefCode,
      ip
    });

    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer && referrer._id.toString() !== user._id.toString()) {
        user.referredBy = referrer._id;
        await user.save();
        await Referral.create({
          referrerId: referrer._id,
          refereeId: user._id
        });
      } else {
        await user.save();
      }
    } else {
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        points: user.points,
        referralCode: user.referralCode,
        discord: user.discord
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // Update IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    user.ip = ip;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        points: user.points,
        referralCode: user.referralCode,
        discord: user.discord,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── DISCORD OAUTH2 ───
router.get('/discord', auth, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state: req.userId.toString()
  });
  res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
});

router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?discord=error`);
    }

    // Exchange code for token
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Get Discord user info
    const discordUser = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
    });

    const { id, username } = discordUser.data;

    // Check if Discord already linked to another account
    const existingLink = await User.findOne({ 'discord.id': id });
    if (existingLink && existingLink._id.toString() !== state) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?discord=already_linked`);
    }

    // Update user
    await User.findByIdAndUpdate(state, {
      discord: { id, username, verified: true }
    });

    res.redirect(`${process.env.CLIENT_URL}/dashboard?discord=success`);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL}/dashboard?discord=error`);
  }
});

// ─── GET CURRENT USER ───
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
