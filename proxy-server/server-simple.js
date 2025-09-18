const axios = require('axios');

// For Lambda deployment
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle different endpoints based on path
  const path = event.rawPath || event.path || '/';

  if (path.includes('/api/scrape')) {
    return handleScrape(event, headers);
  } else {
    return handleProxy(event, headers);
  }
};

async function handleProxy(event, headers) {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter is required' })
      };
    }

    console.log('Fetching URL:', url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 25000
    });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': response.headers['content-type'] || 'text/html'
      },
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Proxy error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch data',
        message: error.message
      })
    };
  }
}

async function handleScrape(event, headers) {
  console.log('Scraping not available in simple mode');
  return {
    statusCode: 503,
    headers,
    body: JSON.stringify({
      error: 'Scraping service unavailable',
      message: 'This Lambda is running in simple mode without Puppeteer. Only basic proxy is available.',
      note: 'Shows only first 10 competitors without pagination support'
    })
  };
}

// For local Express server (when not in Lambda)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const express = require('express');
  const cors = require('cors');
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

// Simple proxy without Puppeteer - for basic API calls
app.get('/api/liveresults/*', async (req, res) => {
  try {
    const targetUrl = req.params[0];
    console.log('Proxying request to:', targetUrl);

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    });

    res.send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch data',
      message: error.message,
      url: req.params[0]
    });
  }
});

app.get('/api/fetch', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Fetching URL:', url);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    });

    res.send(response.data);
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch data',
      message: error.message,
      url: req.query.url
    });
  }
});

// Scrape endpoint returns error message explaining limitation
app.get('/api/scrape', async (req, res) => {
  console.log('Scraping not available in simple mode');
  res.status(503).json({
    error: 'Scraping service unavailable',
    message: 'This proxy server is running in simple mode without Puppeteer. JavaScript-rendered content and pagination are not available. Please use a full proxy server with Puppeteer support for complete functionality.',
    fallback: 'You can still fetch static HTML content using the /api/fetch endpoint'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Proxy server is running (simple mode without Puppeteer)',
    features: {
      cors_proxy: true,
      puppeteer_scraping: false,
      pagination_support: false
    }
  });
});

app.listen(PORT, () => {
  console.log(`Simple proxy server running on port ${PORT} (without Puppeteer)`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/fetch?url=<URL>`);
  console.log('Note: JavaScript rendering and pagination not available in simple mode');
});