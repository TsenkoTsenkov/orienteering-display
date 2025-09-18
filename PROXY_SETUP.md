# Proxy Setup for Orienteering Display

## Overview

This application uses proxy servers to fetch data from orienteering websites that don't support CORS. We have two proxy implementations:

1. **Local Proxy Server** - For local development (runs on port 3001)
2. **Netlify Functions** - For production deployment

## Local Development

### Option 1: Run with local proxy server (Recommended for development)

```bash
# In one terminal, start the proxy server
npm run proxy

# In another terminal, start the React app
npm start

# Or run both together
npm run dev
```

The local proxy server will run on `http://localhost:3001` and includes Puppeteer for scraping SPA content.

### Option 2: Test Netlify Functions locally

```bash
# This will run both the React app and Netlify Functions locally
npm run netlify:dev
```

## Production Deployment (Netlify)

When deployed to Netlify, the app automatically uses Netlify Functions:

- `/.netlify/functions/fetch` - Simple HTTP proxy for static content
- `/.netlify/functions/scrape` - Puppeteer-based scraper for SPA content

The app automatically detects if it's running on Netlify and uses the appropriate endpoints.

## Environment Variables

### Local Development (.env.local)
```
REACT_APP_PROXY_URL=http://localhost:3001
```

### Production (Netlify)
No environment variables needed - the app automatically uses Netlify Functions.

## Troubleshooting

### Local proxy server not working
1. Make sure port 3001 is free
2. Check that Puppeteer dependencies are installed: `cd proxy-server && npm install`
3. On Linux/WSL, you might need to install Chrome dependencies

### Netlify Functions not working
1. Make sure dependencies are installed: `cd netlify/functions && npm install`
2. Check Netlify logs in the deployment dashboard
3. Verify the functions are being deployed (check Functions tab in Netlify)

## API Endpoints

### Local Proxy Server
- Fetch: `http://localhost:3001/api/fetch?url={encoded_url}`
- Scrape: `http://localhost:3001/api/scrape?url={encoded_url}`

### Netlify Functions (Production)
- Fetch: `/.netlify/functions/fetch?url={encoded_url}`
- Scrape: `/.netlify/functions/scrape?url={encoded_url}`

## How It Works

1. The React app detects its environment (local vs production)
2. Based on the environment, it configures the appropriate proxy URLs
3. When fetching data, requests go through the proxy to bypass CORS
4. For SPA websites, the scrape endpoint uses Puppeteer to render JavaScript content
5. The proxy returns the scraped/fetched data to the React app