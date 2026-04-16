require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { startBot } = require('./bot/discord');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CONNECT DATABASE ───
connectDB();

// ─── MIDDLEWARE ───
app.use(helmet());

const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, "");

app.use(cors({
  origin: [clientUrl, 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── RATE LIMITING ───
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts.' }
});

const faucetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2,
  message: { error: 'Faucet rate limit reached.' }
});

// ─── HEALTH CHECK (Keeps Render alive) ───
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root path for Render health checks (Render often checks / by default)
app.get('/', (req, res) => {
  res.send('FreeCash API is running.');
});

// ─── ROUTES ───
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/dashboard', apiLimiter, require('./routes/dashboard'));
app.use('/api/faucet', faucetLimiter, require('./routes/faucet'));
app.use('/api/postback', require('./routes/postback')); // No rate limit for server-to-server
app.use('/api/withdraw', apiLimiter, require('./routes/withdraw'));
app.use('/api/referrals', apiLimiter, require('./routes/referral'));
app.use('/api/admin', apiLimiter, require('./routes/admin'));
app.use('/api/tasks', apiLimiter, require('./routes/tasks'));

// ─── ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── START SERVER + BOT ───
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startBot(); // Discord bot starts alongside the Express server
});
