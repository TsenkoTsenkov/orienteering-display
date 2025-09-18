# Proxy Server Deployment Options

## Problem
Puppeteer requires Chrome browser which is difficult to install on some hosting platforms like Render's free tier.

## Option 1: Simple Mode (Works on Render Free Tier) ⚡
**Limitations**: No pagination support, only shows first 10 competitors

### Deploy to Render:
1. Use `npm run start:simple` as start command
2. This runs without Puppeteer
3. Works immediately but with limited functionality

### What works:
- ✅ CORS bypass
- ✅ Basic API calls
- ✅ Static HTML fetching

### What doesn't work:
- ❌ JavaScript-rendered content
- ❌ Pagination (only first 10 competitors)
- ❌ Dynamic SPA content

## Option 2: Docker Deployment (Full Features) 🐳
**Best for**: DigitalOcean, AWS, Google Cloud, Railway

### Deploy with Docker:
```bash
docker build -t orienteering-proxy .
docker run -p 3001:3001 orienteering-proxy
```

### Platforms that support Docker:
- **Railway.app** ($5/month) - Easy Docker deployment
- **Fly.io** (Free tier available) - Great Docker support
- **DigitalOcean App Platform** ($5/month)
- **Google Cloud Run** (Free tier available)

## Option 3: Local Proxy Server (Development) 💻
Run the full proxy locally and use ngrok to expose it:

```bash
# Terminal 1: Run proxy
cd proxy-server
npm start

# Terminal 2: Expose with ngrok
ngrok http 3001
```

Then update your production environment to use the ngrok URL.

## Option 4: Dedicated VPS (Full Control) 🖥️
Deploy to a VPS with full Chrome installation:

### Providers:
- **Hetzner** (€4.51/month)
- **Vultr** ($6/month)
- **Linode** ($5/month)

### Setup:
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome dependencies
sudo apt-get update
sudo apt-get install -y chromium-browser

# Clone and run
git clone your-repo
cd your-repo/proxy-server
npm install
npm start
```

## Recommendation

### For Quick Testing:
Use **Option 1** (Simple Mode on Render) - it works immediately but shows only 10 competitors.

### For Production:
Use **Option 2** (Docker on Railway/Fly.io) - full features with pagination.

### For Development:
Use **Option 3** (Local + ngrok) - full control and easy debugging.

## Current Status
The proxy is configured to run in **simple mode** on Render, which will work but won't support pagination. To get full functionality with all 20+ competitors, you'll need to use Docker deployment on a platform like Railway or Fly.io.