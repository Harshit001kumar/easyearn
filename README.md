# FreeCash — Crypto Earning Platform

A full-stack crypto/INR earning platform with Faucet, Offerwalls, Shortlinks, and Discord-managed withdrawals.

## 🏗 Architecture

```
freecash/
├── client/          # React (Vite) + Tailwind CSS frontend
│   ├── src/
│   │   ├── pages/       # All page components
│   │   ├── components/  # Layout, shared components
│   │   ├── context/     # Auth context
│   │   └── api.js       # Axios client
│   └── ...
├── server/          # Express + MongoDB backend
│   ├── bot/             # Discord.js bot (runs inside Express)
│   ├── config/          # MongoDB connection
│   ├── middleware/       # JWT auth
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API endpoints
│   └── index.js         # Entry point
└── README.md
```

## 🚀 Deployment on Render

### Backend (Web Service)
1. Create a **Web Service** on Render
2. **Root Directory:** `server`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Add all environment variables from `.env.example`

### Frontend (Static Site)
1. Create a **Static Site** on Render
2. **Root Directory:** `client`
3. **Build Command:** `npm install && npm run build`
4. **Publish Directory:** `dist`
5. Add environment variable:
   - `VITE_API_URL` = `https://your-backend.onrender.com`

### Database
1. Create a **MongoDB Atlas** free cluster
2. Copy the connection string to `MONGODB_URI`

### Discord Bot Setup
1. Create a Discord Application at https://discord.com/developers
2. Create a Bot and copy the token → `DISCORD_BOT_TOKEN`
3. Enable OAuth2 redirect → `DISCORD_REDIRECT_URI`
4. Invite bot to your server with `applications.commands` + `bot` scopes
5. Get your admin channel ID → `DISCORD_ADMIN_CHANNEL_ID`

### Keep Server Alive
Use https://cron-job.org to ping `https://your-backend.onrender.com/health` every 10 minutes.

## 💰 Economics
- **1 Point = 0.00001 LTC**
- **Minimum withdrawal: $1.00 equivalent**
- **Offerwall share: 60% to users**
- **Referral commission: 10%**

## 🔐 Security
- JWT auth with bcrypt password hashing
- Token-based faucet verification (IP + time + one-use)
- Rate limiting on all API endpoints
- Discord OAuth2 for withdrawal verification
- IP tracking and multi-account prevention
