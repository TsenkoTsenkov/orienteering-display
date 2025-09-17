const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Puppeteer browser instance
let browser;
(async () => {
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('Puppeteer browser launched');
})();

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

// New endpoint for scraping SPA content with Puppeteer
app.get('/api/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Scraping SPA URL:', url);

    // Create a new page
    const page = await browser.newPage();

    try {
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Navigate to the URL
      await page.goto(url, {
        waitUntil: 'networkidle0', // Wait until network is idle
        timeout: 30000
      });

      // Wait for specific content to load (tables or competitor data)
      try {
        await page.waitForSelector('table, .competitor-row, .start-list-row', { timeout: 10000 });
      } catch (e) {
        console.log('No table found, trying to wait for any content...');
        await page.waitForTimeout(5000); // Wait 5 seconds for content to load
      }

      // Extract data from the page
      const data = await page.evaluate(() => {
        const competitors = [];

        // Try to find table rows
        const rows = document.querySelectorAll('table tr, .competitor-row, .start-list-row, [role="row"]');

        rows.forEach((row, index) => {
          // Skip header rows
          if (index === 0 && row.querySelector('th')) return;

          const cells = row.querySelectorAll('td, [role="cell"]');
          if (cells.length > 0) {
            const competitorData = {
              cells: Array.from(cells).map(cell => cell.textContent.trim())
            };

            // Try to extract structured data
            if (cells.length >= 2) {
              competitorData.structured = {
                startTime: cells[0]?.textContent.trim(),
                name: cells[1]?.textContent.trim(),
                club: cells[2]?.textContent.trim(),
                country: cells[3]?.textContent.trim() || cells[2]?.textContent.match(/[A-Z]{3}/)?.[0],
                bib: cells[4]?.textContent.trim(),
                card: cells[5]?.textContent.trim(),
              };
            }

            competitors.push(competitorData);
          }
        });

        // Also get the page HTML for fallback parsing
        const html = document.documentElement.outerHTML;

        return {
          competitors,
          html,
          title: document.title,
          hasTable: !!document.querySelector('table'),
          rowCount: rows.length
        };
      });

      await page.close();

      res.json(data);
    } catch (error) {
      await page.close();
      throw error;
    }
  } catch (error) {
    console.error('Scraping error:', error.message);
    res.status(500).json({
      error: 'Failed to scrape data',
      message: error.message,
      url: req.query.url
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running with Puppeteer support' });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/fetch?url=<URL>`);
  console.log(`Scrape endpoint: http://localhost:${PORT}/api/scrape?url=<URL>`);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
    console.log('Browser closed');
  }
  process.exit();
});