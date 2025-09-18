# Deployment Guide

## Overview
This application consists of two parts:
1. **React Frontend** - Deployed on Netlify
2. **Proxy Server** - Deployed on Render.com (or similar service)

## Environment Separation
The app uses separate Firebase database prefixes for development and production:
- **Development**: Data stored under `/dev/` prefix
- **Production**: Data stored under `/prod/` prefix

## Proxy Server Deployment (Render.com)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com) and create a free account
2. Connect your GitHub account

### Step 2: Deploy Proxy Server
1. In Render dashboard, click "New +" → "Web Service"
2. Connect your repository
3. Configure the service:
   - **Name**: `orienteering-proxy` (or your preferred name)
   - **Root Directory**: `proxy-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free tier is sufficient
4. Click "Create Web Service"
5. Wait for deployment (takes 5-10 minutes)
6. Note your service URL (e.g., `https://orienteering-proxy.onrender.com`)

### Alternative: Deploy to Railway, Heroku, or DigitalOcean
The proxy server can be deployed to any Node.js hosting service. Key requirements:
- Node.js 18+ support
- Ability to install Puppeteer dependencies
- At least 512MB RAM (for Puppeteer)

## Frontend Deployment (Netlify)

### Step 1: Update Environment Variables
1. Go to your Netlify dashboard
2. Navigate to Site Settings → Environment Variables
3. Add these variables:
   ```
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
   REACT_APP_FIREBASE_DATABASE_URL=your-database-url
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id

   # Production specific
   REACT_APP_ENV=production
   REACT_APP_FIREBASE_DB_PREFIX=prod
   REACT_APP_PROXY_URL=https://your-proxy-server.onrender.com
   ```

### Step 2: Update Production Configuration
1. Edit `.env.production` with your proxy server URL:
   ```
   REACT_APP_PROXY_URL=https://your-actual-proxy-url.onrender.com
   ```
2. Commit and push changes

### Step 3: Deploy
1. Push to your main branch
2. Netlify will automatically rebuild and deploy

## Local Development Setup

### Running Development Environment
1. Start proxy server:
   ```bash
   cd proxy-server
   npm install
   npm start
   ```

2. Start React app:
   ```bash
   npm install
   npm start
   ```

The development environment will:
- Use `http://localhost:3001` for proxy server
- Store data under `/dev/` prefix in Firebase
- Not interfere with production data

## Troubleshooting

### Issue: "Failed to fetch data" in production
- **Cause**: Proxy server not deployed or URL incorrect
- **Solution**:
  1. Verify proxy server is running (visit the URL directly)
  2. Check `REACT_APP_PROXY_URL` in Netlify environment variables
  3. Ensure proxy server allows CORS from your Netlify domain

### Issue: Seeing development data in production
- **Cause**: Missing or incorrect environment variables
- **Solution**:
  1. Check `REACT_APP_FIREBASE_DB_PREFIX` is set to `prod` in Netlify
  2. Clear browser cache and reload

### Issue: Pagination not working (only showing 10 competitors)
- **Cause**: Proxy server not properly scraping paginated content
- **Solution**:
  1. Ensure proxy server has enough memory (512MB+)
  2. Check proxy server logs for Puppeteer errors
  3. Verify the proxy server is using latest code

### Issue: Start times showing UTC timezone
- **Cause**: Old cached data or proxy server not stripping timezone
- **Solution**:
  1. Clear Firebase data for the affected project
  2. Refetch the competition data
  3. Verify proxy server is running latest code

## Monitoring

### Check Service Health
- **Proxy Server**: Visit `https://your-proxy-server.onrender.com/health`
- **Firebase**: Check Firebase Console for database usage
- **Netlify**: Check Netlify dashboard for build status

### Logs
- **Proxy Server (Render)**: Dashboard → Logs tab
- **Frontend (Netlify)**: Browser console for client-side errors
- **Firebase**: Firebase Console → Database → Usage tab