# EasyEarn — Complete Codebase Roadmap

> **Project Name:** EasyEarn (internally "FreeCash")
> **Stack:** React 18 + Vite (client) · Express + MongoDB (server) · Discord.js Bot (embedded in server)
> **Deployment Target:** Render (backend Web Service + frontend Static Site) + MongoDB Atlas

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Directory Structure](#2-directory-structure)
3. [Frontend (Client)](#3-frontend-client)
   - [Tech Stack](#31-tech-stack)
   - [Pages & Routes](#32-pages--routes)
   - [Components & Context](#33-components--context)
   - [API Client](#34-api-client)
4. [Backend (Server)](#4-backend-server)
   - [Tech Stack](#41-tech-stack)
   - [Entry Point](#42-entry-point)
   - [Middleware](#43-middleware)
   - [API Routes](#44-api-routes)
   - [Rate Limiting Policy](#45-rate-limiting-policy)
5. [Database Layer](#5-database-layer)
   - [MongoDB Models](#51-mongodb-models)
   - [Model Relationships](#52-model-relationships)
6. [Discord Bot](#6-discord-bot)
7. [External Integrations](#7-external-integrations)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
   - [User Registration & Login](#81-user-registration--login)
   - [Faucet Claim Flow](#82-faucet-claim-flow)
   - [Offerwall Postback Flow](#83-offerwall-postback-flow)
   - [Withdrawal Flow](#84-withdrawal-flow)
   - [Referral Commission Flow](#85-referral-commission-flow)
9. [Economics & Business Rules](#9-economics--business-rules)
10. [Security Model](#10-security-model)
11. [Environment Variables](#11-environment-variables)
12. [Developer Onboarding](#12-developer-onboarding)
13. [Deployment Guide](#13-deployment-guide)
14. [Feature Roadmap & Known Gaps](#14-feature-roadmap--known-gaps)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (User)                              │
│                   React SPA (Vite + Tailwind CSS)                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  HTTPS  (VITE_API_URL/api/*)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER  (Node.js)                         │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  /auth   │  │ /faucet  │  │/withdraw │  │   /postback      │   │
│  │ /dashboard│  │/referrals│  │  /admin  │  │   (RevToo)       │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│           JWT Auth Middleware  ·  Rate Limiters  · Helmet           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  Discord.js Bot (embedded)                  │    │
│  │  Withdrawal notifications · Approve/Reject buttons          │    │
│  │  Live earnings channel · Payment proof generator            │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  Mongoose ODM
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MongoDB Atlas Cluster                           │
│                                                                     │
│  Users · Transactions · Withdrawals · Referrals · Tokens            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
easyearn/
├── README.md                  # Deployment & setup guide
├── ROADMAP.md                 # ← This file
│
├── client/                    # React (Vite) frontend
│   ├── index.html             # HTML entry point
│   ├── vite.config.js         # Vite configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── postcss.config.js      # PostCSS config
│   ├── package.json           # Frontend dependencies
│   └── src/
│       ├── main.jsx           # React root — mounts <App> inside BrowserRouter + AuthProvider
│       ├── App.jsx            # Route definitions, protected route guards
│       ├── api.js             # Axios instance with JWT interceptors
│       ├── index.css          # Tailwind base styles
│       ├── context/
│       │   └── AuthContext.jsx  # Global auth state (login/logout/register/refreshUser)
│       ├── components/
│       │   └── Layout.jsx       # Shared layout with sidebar/navbar for authenticated pages
│       └── pages/
│           ├── Landing.jsx      # Public marketing/landing page
│           ├── Login.jsx        # Login form
│           ├── Register.jsx     # Registration form (accepts ?ref= referral code)
│           ├── Dashboard.jsx    # Authenticated home with stats & daily bonus
│           ├── Faucet.jsx       # Faucet claim UI
│           ├── Offerwalls.jsx   # RevToo offerwall embed
│           ├── Withdraw.jsx     # Withdrawal request form + history
│           ├── Referrals.jsx    # Referral link, stats, and list
│           ├── AdminPanel.jsx   # Admin-only management panel
│           └── Verify.jsx       # Shortlink verification callback page
│
└── server/                    # Express + MongoDB backend
    ├── index.js               # Server entry point
    ├── package.json           # Backend dependencies
    ├── .env.example           # All required environment variables
    │
    ├── config/
    │   └── db.js              # MongoDB connection (Mongoose)
    │
    ├── middleware/
    │   └── auth.js            # JWT auth middleware (auth, adminAuth)
    │
    ├── models/
    │   ├── User.js            # User schema (email, password, discord, points, streak…)
    │   ├── Transaction.js     # Transaction log (faucet, offerwall, referral, withdrawal…)
    │   ├── Withdrawal.js      # Withdrawal request (method, status, txHash…)
    │   ├── Referral.js        # Referral relationship (referrer → referee)
    │   └── Token.js           # One-use faucet verification tokens (TTL index)
    │
    ├── routes/
    │   ├── auth.js            # POST /register, POST /login, GET /me, Discord OAuth2
    │   ├── dashboard.js       # GET / (stats), POST /daily-bonus
    │   ├── faucet.js          # POST /claim, GET /verify, GET /status
    │   ├── postback.js        # GET /revtoo (offerwall server-to-server callback)
    │   ├── withdraw.js        # POST / (request), GET /history
    │   ├── referral.js        # GET / (referral info)
    │   └── admin.js           # Admin stats, users, withdrawals, transactions
    │
    ├── bot/
    │   └── discord.js         # Discord.js client — notifications, approve/reject buttons
    │
    └── utils/
        └── paymentProof.js    # Canvas-based payment proof image generator
```

---

## 3. Frontend (Client)

### 3.1 Tech Stack

| Package | Version | Purpose |
|---|---|---|
| React | 18.2 | UI library |
| React Router DOM | 6.22 | Client-side routing |
| Vite | 5.0 | Dev server & bundler |
| Tailwind CSS | 3.4 | Utility-first styling |
| Axios | 1.6 | HTTP requests |
| Framer Motion | 11.0 | Animations |
| react-hot-toast | 2.4 | Toast notifications |
| react-icons | 5.0 | Icon library |

### 3.2 Pages & Routes

| Route | Component | Auth Required | Admin Only |
|---|---|---|---|
| `/` | `Landing.jsx` | No | No |
| `/login` | `Login.jsx` | No | No |
| `/register` | `Register.jsx` | No | No |
| `/verify` | `Verify.jsx` | ✅ | No |
| `/dashboard` | `Dashboard.jsx` | ✅ | No |
| `/faucet` | `Faucet.jsx` | ✅ | No |
| `/offerwalls` | `Offerwalls.jsx` | ✅ | No |
| `/withdraw` | `Withdraw.jsx` | ✅ | No |
| `/referrals` | `Referrals.jsx` | ✅ | No |
| `/admin` | `AdminPanel.jsx` | ✅ | ✅ |

**Route Guards (`App.jsx`):**
- `<ProtectedRoute>` — redirects to `/login` if not authenticated (checks `AuthContext`)
- `<AdminRoute>` — redirects to `/dashboard` if user is not an admin

### 3.3 Components & Context

**`context/AuthContext.jsx`**

Provides global auth state across the entire app via React Context.

| Export | Type | Description |
|---|---|---|
| `AuthProvider` | Component | Wraps the app; restores session from `localStorage` on mount |
| `useAuth()` | Hook | Returns `{ user, loading, login, register, logout, refreshUser }` |

**`components/Layout.jsx`**

Shared wrapper for all authenticated pages. Provides the sidebar navigation and top navbar.

### 3.4 API Client

`src/api.js` exports a pre-configured Axios instance:

- **Base URL:** `VITE_API_URL/api` (defaults to `/api` for same-origin)
- **Request interceptor:** Reads JWT from `localStorage.getItem('token')` and injects `Authorization: Bearer <token>` header
- **Response interceptor:** On `401` errors — clears `localStorage` and redirects to `/login`

---

## 4. Backend (Server)

### 4.1 Tech Stack

| Package | Version | Purpose |
|---|---|---|
| Express | 4.18 | HTTP framework |
| Mongoose | 8.23 | MongoDB ODM |
| bcryptjs | 2.4 | Password hashing (salt rounds: 12) |
| jsonwebtoken | 9.0 | JWT signing/verification (7-day expiry) |
| discord.js | 14.14 | Discord bot SDK |
| express-rate-limit | 7.1 | Request rate limiting |
| helmet | 7.1 | HTTP security headers |
| cors | 2.8 | Cross-origin resource sharing |
| axios | 1.6 | HTTP client (captcha, ShrinkMe calls) |
| uuid | 9.0 | Unique token generation |
| canvas | 2.11 | Payment proof image generation |
| dotenv | 16.6 | `.env` loading |

### 4.2 Entry Point

`server/index.js` bootstraps the application in this order:

1. Load `.env` via `dotenv`
2. Connect to MongoDB (`config/db.js`)
3. Apply security middleware: `helmet`, `cors`, `express.json`
4. Register rate limiters
5. Mount all route modules under `/api/*`
6. Register global error handler
7. Start HTTP server on `PORT` (default `5000`)
8. Start Discord bot (`bot/discord.js`)

**Special endpoints:**
- `GET /health` — returns `{ status: 'ok', timestamp }` for uptime monitoring (cron-job.org)
- `GET /` — returns plain text "FreeCash API is running."

### 4.3 Middleware

**`middleware/auth.js`**

| Export | Checks | Sets on `req` |
|---|---|---|
| `auth` | Valid JWT + user exists + not banned | `req.user`, `req.userId` |
| `adminAuth` | Valid JWT + user exists + `isAdmin: true` | `req.user`, `req.userId` |

### 4.4 API Routes

#### Auth — `/api/auth` (authLimiter: 10 req / 15 min)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | No | Register new user (optional `referralCode`) |
| `POST` | `/login` | No | Login, returns JWT |
| `GET` | `/me` | ✅ | Return current user (no password) |
| `GET` | `/discord` | ✅ | Get Discord OAuth2 authorization URL |
| `GET` | `/discord/callback` | No | Handle Discord OAuth2 redirect, link account |

#### Dashboard — `/api/dashboard` (apiLimiter: 100 req / 15 min)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | ✅ | User stats, recent transactions, streak info |
| `POST` | `/daily-bonus` | ✅ | Claim daily streak bonus (24h cooldown) |

#### Faucet — `/api/faucet` (faucetLimiter: 2 req / 5 min)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/claim` | ✅ | Verify hCaptcha, generate token, return ShrinkMe shortlink |
| `GET` | `/verify` | ✅ | Validate one-use token, credit reward points |
| `GET` | `/status` | ✅ | Cooldown status, today's claim count, total earnings |

#### Postback — `/api/postback` (no rate limit — server-to-server)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/revtoo` | No (HMAC sig) | RevToo offerwall completion callback |

#### Withdraw — `/api/withdraw` (apiLimiter)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | ✅ | Submit withdrawal request (LTC or UPI) |
| `GET` | `/history` | ✅ | Last 20 withdrawals for the user |

#### Referrals — `/api/referrals` (apiLimiter)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | ✅ | Referral code, link, list, and commission totals |

#### Admin — `/api/admin` (apiLimiter + adminAuth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/stats` | Platform-wide stats |
| `GET` | `/users` | Paginated user list |
| `GET` | `/withdrawals` | Withdrawals filtered by status |
| `PATCH` | `/withdrawals/:id` | Approve or reject a withdrawal |
| `POST` | `/adjust-balance` | Manually adjust a user's point balance |
| `PATCH` | `/users/:id/ban` | Toggle ban/unban on a user |
| `GET` | `/transactions` | Paginated global transaction log |

### 4.5 Rate Limiting Policy

| Limiter | Window | Max Requests | Applied To |
|---|---|---|---|
| `authLimiter` | 15 min | 10 | `/api/auth` |
| `faucetLimiter` | 5 min | 2 | `/api/faucet` |
| `apiLimiter` | 15 min | 100 | All other `/api/*` routes |
| None | — | — | `/api/postback` (server-to-server) |

---

## 5. Database Layer

### 5.1 MongoDB Models

#### `User`

| Field | Type | Notes |
|---|---|---|
| `email` | String | Unique, lowercase, trimmed |
| `password` | String | bcrypt hash (12 salt rounds) |
| `discord.id` | String | Discord user snowflake |
| `discord.username` | String | Discord display name |
| `discord.verified` | Boolean | Required before withdrawal |
| `points` | Number | Current balance (min: 0) |
| `referralCode` | String | Unique 8-char uppercase code (UUID slice) |
| `referredBy` | ObjectId → User | Referrer's user ID |
| `ip` | String | Last known IP (for multi-account detection) |
| `lastFaucetClaim` | Date | Cooldown tracking |
| `dailyStreak.count` | Number | Current streak day (1–7, resets) |
| `dailyStreak.lastClaimed` | Date | Last claim timestamp |
| `isAdmin` | Boolean | Admin flag |
| `isBanned` | Boolean | Banned flag (blocks login + API) |
| Virtual: `ltcEquivalent` | Number | `points × 0.00001` |

#### `Transaction`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId → User | Indexed |
| `type` | Enum | `faucet`, `offerwall`, `shortlink`, `referral`, `withdrawal`, `daily_bonus`, `admin_adjust` |
| `points` | Number | Positive = credit, Negative = debit |
| `status` | Enum | `pending`, `completed`, `failed`, `rejected` |
| `details` | String | Human-readable description |

#### `Withdrawal`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId → User | Indexed |
| `method` | Enum | `LTC` or `UPI` |
| `amountPoints` | Number | Points deducted (min: 1) |
| `destination` | String | LTC wallet address or UPI ID |
| `status` | Enum | `pending`, `approved`, `rejected` |
| `discordMessageId` | String | Bot message ID for button reference |
| `processedBy` | String | Discord admin username |
| `txHash` | String | Blockchain transaction hash (LTC) |

#### `Referral`

| Field | Type | Notes |
|---|---|---|
| `referrerId` | ObjectId → User | Indexed |
| `refereeId` | ObjectId → User | The referred user |
| `totalPointsEarned` | Number | Cumulative commission from this referee |

#### `Token`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId → User | |
| `token` | String | UUID v4, unique, indexed |
| `ip` | String | Requester IP (verified on redemption) |
| `isUsed` | Boolean | One-time use flag |
| `expiresAt` | Date | 10 minutes after creation |

> **TTL Index:** `expiresAt` field has `expireAfterSeconds: 0` — MongoDB automatically deletes expired tokens.

### 5.2 Model Relationships

```
User ─────────────────────────────────────────────────────────────────
 │  referredBy → User (self-referential)                              │
 │                                                                    │
 ├── Transaction (userId) ← all financial events                      │
 ├── Withdrawal  (userId) ← withdrawal requests                       │
 ├── Token       (userId) ← faucet verification tokens               │
 └── Referral    (referrerId or refereeId) ← referral relationships   │
```

---

## 6. Discord Bot

**File:** `server/bot/discord.js`

The bot is started inside the Express process via `startBot()` called in `index.js`.

**Intents:** `Guilds`, `GuildMessages`, `MessageContent`

### Bot Capabilities

| Feature | Trigger | Description |
|---|---|---|
| Withdrawal notification | `sendWithdrawalNotification()` | Posts embed with Approve/Reject buttons to `DISCORD_ADMIN_CHANNEL_ID` |
| Approve withdrawal | Button click `approve_<id>` | Opens modal asking for txHash, marks withdrawal approved, notifies user |
| Reject withdrawal | Button click `reject_<id>` | Rejects withdrawal, refunds points, notifies user |
| Live earnings notification | `sendLiveEarningNotification()` | Posts to `DISCORD_LIVE_EARNINGS_CHANNEL_ID` when a user earns ≥1,000 points from an offer |
| Payment proof | Auto on approval | Generates a PNG proof image using `utils/paymentProof.js` (Canvas) and posts to `DISCORD_PAYMENT_PROOFS_CHANNEL_ID` |

### Bot Flow for Withdrawals

```
User requests withdrawal (POST /api/withdraw)
        │
        ▼
Withdrawal record created in DB (status: pending)
Points deducted from user immediately
        │
        ▼
Bot posts embed + [Approve] [Reject] buttons → DISCORD_ADMIN_CHANNEL_ID
        │
   ┌────┴────┐
   ▼         ▼
Admin     Admin
Approves  Rejects
   │         │
   │         └─ Points refunded to user
   │           Transaction updated: rejected
   │
   └─ Modal: enter txHash
         │
         ▼
      Withdrawal approved, txHash saved
      Transaction updated: completed
      Payment proof PNG posted to proofs channel
      User notified via DM (if configured)
```

---

## 7. External Integrations

| Service | Purpose | Config Keys |
|---|---|---|
| **MongoDB Atlas** | Primary database | `MONGODB_URI` |
| **Discord API** | OAuth2 login + Bot | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_BOT_TOKEN`, `DISCORD_ADMIN_CHANNEL_ID`, `DISCORD_LIVE_EARNINGS_CHANNEL_ID`, `DISCORD_PAYMENT_PROOFS_CHANNEL_ID`, `DISCORD_GUILD_ID` |
| **hCaptcha** | Faucet bot protection | `HCAPTCHA_SECRET` (server-side verify) |
| **ShrinkMe** | Monetised shortlinks for faucet | `SHRINKME_API_KEY` |
| **RevToo** | Offerwall network (server-to-server postback) | `REVTOO_API_KEY`, `REVTOO_SECRET_KEY` |
| **cron-job.org** | Keep Render free tier alive | Pings `GET /health` every 10 min |

---

## 8. Data Flow Diagrams

### 8.1 User Registration & Login

```
Browser                     Server                     MongoDB
  │                            │                           │
  │── POST /api/auth/register ─▶│                           │
  │   { email, password,        │── User.findOne(email) ──▶│
  │     referralCode? }         │◀─ null (email free)       │
  │                            │── User.countDocuments(ip)─▶│
  │                            │◀─ count < 2               │
  │                            │── bcrypt.hash(password)   │
  │                            │── new User.save() ────────▶│
  │                            │── Referral.create()? ─────▶│
  │                            │── jwt.sign()              │
  │◀── { token, user } ────────│                           │
  │  [store token in localStorage]                         │
```

### 8.2 Faucet Claim Flow

```
Browser          Server           hCaptcha        ShrinkMe         MongoDB
  │                │                  │               │                │
  │─POST /faucet/claim─▶│             │               │                │
  │  { captchaToken }   │─verify ─────▶│              │                │
  │                     │◀─ success   │               │                │
  │                     │─ check cooldown ─────────────────────────────▶│
  │                     │◀─ OK                                         │
  │                     │─ Token.create() ────────────────────────────▶│
  │                     │─ GET shrinkme.io/api ──────▶│               │
  │                     │◀─ { shortenedUrl }          │               │
  │◀─ { shortlink }─────│                             │               │
  │                                                                    │
  │ [User visits shortlink, completes ad, redirected to /verify?token=…]
  │                                                                    │
  │─GET /api/faucet/verify?token=…─▶│                                 │
  │                     │─ Token.findOne() ───────────────────────────▶│
  │                     │  verify: owner, !used, !expired, ip match,   │
  │                     │         elapsed ≥ 10s                         │
  │                     │─ User.points += reward                        │
  │                     │─ token.isUsed = true ───────────────────────▶│
  │                     │─ Transaction.create() ──────────────────────▶│
  │                     │─ referral commission? ──────────────────────▶│
  │◀─ { pointsEarned, newBalance, nextClaim }                          │
```

### 8.3 Offerwall Postback Flow

```
RevToo Server          Our Server                    MongoDB
     │                     │                            │
     │─GET /api/postback/revtoo?subId=…&transId=…─▶│   │
     │                     │─ verify HMAC MD5 sig      │
     │                     │─ check duplicate txn ─────▶│
     │                     │─ User.findById(subId)─────▶│
     │                     │─ userPoints = payout×0.6  │
     │                     │─ User.points += points ───▶│
     │                     │─ Transaction.create() ────▶│
     │                     │─ referral commission? ────▶│
     │                     │─ if points≥1000:           │
     │                     │   sendLiveEarningNotification()
     │◀─────────────── "1" (success) ─────────────────  │
```

### 8.4 Withdrawal Flow

```
Browser         Server              Discord Bot          MongoDB
  │               │                     │                   │
  │─POST /withdraw─▶│                   │                   │
  │  { method,      │─ validate inputs  │                   │
  │    amount,      │─ check discord.verified               │
  │    destination }│─ check min 1000pts│                   │
  │                 │─ check no pending │                   │
  │                 │─ user.points-=pts─────────────────────▶│
  │                 │─ Withdrawal.create() ─────────────────▶│
  │                 │─ Transaction.create() ────────────────▶│
  │                 │─ sendWithdrawalNotification() ──────▶  │
  │◀─ { withdrawal }│                   │                   │
  │                 │           [Admin sees embed in Discord]│
  │                 │           [Admin clicks Approve/Reject]│
  │                 │                   │─ update Withdrawal ▶│
  │                 │                   │─ if rejected:       │
  │                 │                   │   refund points ───▶│
  │                 │                   │─ post proof PNG ───  │
```

### 8.5 Referral Commission Flow

Every earning event (faucet, daily bonus, offerwall) triggers a 10% commission:

```
User earns N points
       │
       ▼
user.referredBy exists?
       │ Yes
       ▼
commission = floor(N × 0.10)
       │
       ├─ User.findByIdAndUpdate(referredBy, $inc: { points: commission })
       ├─ Transaction.create({ userId: referredBy, type: 'referral', points: commission })
       └─ Referral.findOneAndUpdate({ referrerId, refereeId }, $inc: { totalPointsEarned: commission })
```

---

## 9. Economics & Business Rules

| Rule | Value |
|---|---|
| Point → LTC conversion | 1 point = 0.00001 LTC |
| Minimum withdrawal | 1,000 points (~0.01 LTC, ≈ $1) |
| Offerwall user share | 60% of RevToo payout value |
| Referral commission | 10% of referee's every earning |
| Faucet reward | Random `[FAUCET_MIN_REWARD, FAUCET_MAX_REWARD]` points (default 1–5) |
| Faucet cooldown | `FAUCET_COOLDOWN_MINUTES` (default 5 min) |
| Daily streak reward | Day N × 2 points (capped at Day 7 = 14 pts); resets if >48h gap |
| Daily streak reset | Streak count resets to 0 if >48h between claims |
| Max accounts per IP | 2 |
| Discord verification | Required before any withdrawal can be submitted |
| Pending withdrawal limit | Only 1 pending withdrawal allowed at a time |

---

## 10. Security Model

| Layer | Mechanism |
|---|---|
| **Passwords** | bcrypt with salt rounds: 12 |
| **Sessions** | Stateless JWT (`HS256`, 7-day expiry, stored in `localStorage`) |
| **Admin access** | `isAdmin` boolean on `User` model, verified on every admin request |
| **HTTP headers** | `helmet` sets CSP, HSTS, X-Frame-Options, etc. |
| **Rate limiting** | Auth: 10/15min · Faucet: 2/5min · API: 100/15min |
| **Faucet anti-abuse** | One-use token, IP match, ≥10s elapsed, 5-min cooldown per user |
| **Offerwall postback** | HMAC-MD5 signature verification (`REVTOO_SECRET_KEY`) |
| **Multi-account** | Max 2 accounts per IP on registration |
| **Withdrawal gate** | Discord OAuth2 verified account required |
| **Bot injection** | CORS restricted to `CLIENT_URL` only |
| **Account suspension** | `isBanned` flag blocks login and all authenticated requests |

---

## 11. Environment Variables

All variables live in `server/.env` (see `server/.env.example`):

```
# Server
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-frontend.onrender.com

# MongoDB
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=<strong-random-secret>

# Discord OAuth2
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://your-backend.onrender.com/api/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=
DISCORD_ADMIN_CHANNEL_ID=
DISCORD_LIVE_EARNINGS_CHANNEL_ID=
DISCORD_PAYMENT_PROOFS_CHANNEL_ID=
DISCORD_GUILD_ID=

# ShrinkMe shortlink monetization
SHRINKME_API_KEY=

# RevToo offerwall
REVTOO_API_KEY=
REVTOO_SECRET_KEY=

# hCaptcha (bot protection on faucet)
HCAPTCHA_SECRET=

# Faucet configuration
FAUCET_COOLDOWN_MINUTES=5
FAUCET_MIN_REWARD=1
FAUCET_MAX_REWARD=5

# Admin (comma-separated admin email list for reference)
ADMIN_EMAILS=admin@example.com
```

> **Note:** The frontend only needs `VITE_API_URL` set to the backend URL in `client/.env`.

---

## 12. Developer Onboarding

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A MongoDB Atlas cluster (free tier works)
- A Discord Application with a Bot created

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/Harshit001kumar/easyearn.git
cd easyearn

# 2. Set up the backend
cd server
cp .env.example .env
# Fill in .env with your values (see §11)
npm install
npm run dev          # starts nodemon on port 5000

# 3. Set up the frontend (in a new terminal)
cd ../client
echo "VITE_API_URL=http://localhost:5000" > .env
npm install
npm run dev          # starts Vite on port 5173
```

### Making a User an Admin

Connect to MongoDB and run:

```js
db.users.updateOne({ email: "you@example.com" }, { $set: { isAdmin: true } })
```

### Key Development Scripts

| Directory | Command | Description |
|---|---|---|
| `server/` | `npm run dev` | nodemon (hot reload) |
| `server/` | `npm start` | production start |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | Production build → `dist/` |
| `client/` | `npm run preview` | Preview production build |

---

## 13. Deployment Guide

### Backend — Render Web Service

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment | All variables from §11 |

### Frontend — Render Static Site

| Setting | Value |
|---|---|
| Root Directory | `client` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |
| Environment | `VITE_API_URL=https://your-backend.onrender.com` |

### Keep Backend Alive (Render Free Tier)

Use https://cron-job.org to send a `GET` request to `https://your-backend.onrender.com/health` every **10 minutes**.

---

## 14. Feature Roadmap & Known Gaps

### Currently Implemented ✅

- [x] Email/password registration & login with JWT
- [x] Discord OAuth2 account linking
- [x] Faucet with hCaptcha + ShrinkMe shortlinks + one-use token verification
- [x] Daily streak bonus (7-day cycle)
- [x] RevToo offerwall postback + HMAC verification
- [x] Referral system with 10% commission on all earnings
- [x] LTC and UPI withdrawal requests
- [x] Discord bot: withdrawal notifications + approve/reject buttons + payment proofs
- [x] Admin panel: user management, balance adjustment, ban/unban, transaction logs
- [x] IP-based multi-account detection
- [x] Rate limiting and security headers

### Potential Future Enhancements 🔮

- [ ] **Email verification** — send OTP/link on registration to prevent fake accounts
- [ ] **Password reset** — forgot-password flow via email
- [ ] **More offerwalls** — integrate CPAGrip, Lootably, AdGate, Notik alongside RevToo
- [ ] **Shortlinks earnings** — dedicated shortlink task section (separate from faucet)
- [ ] **Live LTC price** — fetch real-time LTC/USD price to show accurate dollar values
- [ ] **User notifications** — in-app notification feed (withdrawal approved, bonus earned)
- [ ] **2FA / TOTP** — optional two-factor authentication for added security
- [ ] **Leaderboard** — top earners by week/month for gamification
- [ ] **Referral tiers** — multi-level referral commissions (Level 1: 10%, Level 2: 5%)
- [ ] **Automated payouts** — integrate LitecoinCore / Blockcypher API for auto LTC sends
- [ ] **KYC / identity checks** — prevent large-scale fraud on high withdrawals
- [ ] **Test coverage** — add Jest/Supertest unit and integration tests for API routes
- [ ] **TypeScript migration** — type-safe server codebase
- [ ] **Docker / docker-compose** — containerise for consistent local + production environments
- [ ] **WebSockets** — real-time balance updates and live earnings feed on dashboard
