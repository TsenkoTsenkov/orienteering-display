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
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for content to load
      }

      // Function to extract competitors from current page
      const extractCompetitors = async () => {
        return await page.evaluate(() => {
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

          return competitors;
        });
      };

      // Collect all competitors across all pages
      let allCompetitors = [];
      let currentPage = 1;
      let hasMorePages = true;
      const maxPages = 20; // Safety limit to prevent infinite loops

      while (hasMorePages && currentPage <= maxPages) {
        console.log(`Scraping page ${currentPage}...`);

        // Extract competitors from current page
        const pageCompetitors = await extractCompetitors();
        allCompetitors = allCompetitors.concat(pageCompetitors);

        // Check for pagination controls
        const paginationInfo = await page.evaluate(() => {
          // Look for next button or pagination controls - includes common LiveResults.it selectors
          let nextButton = document.querySelector(
            '[aria-label="Next"], ' +
            '.pagination-next, ' +
            '[class*="next"]:not(:disabled), ' +
            '.MuiPagination-ul button[aria-label*="next"], ' +
            '.MuiTablePagination-actions button:last-child:not(:disabled), ' +
            'button[title="Next page"], ' +
            '.pagination button:last-child:not(:disabled)'
          );

          // If not found, look for buttons with "Next" text
          if (!nextButton) {
            const allButtons = document.querySelectorAll('button, a');
            for (const btn of allButtons) {
              if (btn.textContent && btn.textContent.includes('Next') && !btn.disabled) {
                nextButton = btn;
                break;
              }
            }
          }

          const disabledNext = document.querySelector(
            '[aria-label="Next"][disabled], ' +
            '.pagination-next[disabled], ' +
            '.MuiPagination-ul button[aria-label*="next"][disabled], ' +
            '.MuiTablePagination-actions button:last-child[disabled]'
          );

          const pageButtons = document.querySelectorAll(
            '.pagination-item, ' +
            '[role="navigation"] button, ' +
            '.page-link, ' +
            '.MuiPagination-ul button, ' +
            '.MuiTablePagination-displayedRows'
          );

          // Check if we have more pages
          const hasNext = nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled') && !nextButton.classList.contains('Mui-disabled');
          const isLastPage = disabledNext !== null;

          // Check for Material-UI table pagination
          const muiPaginationText = document.querySelector('.MuiTablePagination-displayedRows')?.textContent || '';
          const muiRowsInfo = muiPaginationText.match(/(\d+)[–-](\d+) of (\d+)/);

          return {
            hasNextButton: !!nextButton,
            canGoNext: hasNext,
            isLastPage: isLastPage,
            totalPageButtons: pageButtons.length,
            muiPagination: muiRowsInfo ? {
              from: parseInt(muiRowsInfo[1]),
              to: parseInt(muiRowsInfo[2]),
              total: parseInt(muiRowsInfo[3])
            } : null
          };
        });

        console.log('Pagination info:', paginationInfo);

        // Check if we should continue based on MUI pagination
        if (paginationInfo.muiPagination && paginationInfo.muiPagination.to >= paginationInfo.muiPagination.total) {
          console.log('Reached last page based on MUI pagination');
          hasMorePages = false;
          break;
        }

        // Try to navigate to next page
        if (paginationInfo.canGoNext || (paginationInfo.muiPagination && paginationInfo.muiPagination.to < paginationInfo.muiPagination.total)) {
          try {
            // Click next button
            const clicked = await page.evaluate(() => {
              // Try various selectors for next button
              const selectors = [
                '[aria-label="Next"]',
                '.MuiTablePagination-actions button:last-child:not(:disabled)',
                '.MuiPagination-ul button[aria-label*="next"]:not(.Mui-disabled)',
                '.pagination-next:not(:disabled)',
                'button[title="Next page"]:not(:disabled)',
                '[class*="next"]:not(:disabled)'
              ];

              for (const selector of selectors) {
                try {
                  const nextButton = document.querySelector(selector);
                  if (nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled') && !nextButton.classList.contains('Mui-disabled')) {
                    nextButton.click();
                    return true;
                  }
                } catch (e) {
                  // Continue to next selector
                }
              }

              // Also try to find buttons/links with "Next" text
              const allButtons = document.querySelectorAll('button, a');
              for (const btn of allButtons) {
                if (btn.textContent && btn.textContent.includes('Next') && !btn.disabled) {
                  btn.click();
                  return true;
                }
              }

              return false;
            });

            if (!clicked) {
              console.log('Could not find or click next button');
              hasMorePages = false;
              break;
            }

            // Wait for new content to load
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page transition

            // Wait for table to reload
            try {
              await page.waitForSelector('table, .competitor-row, .start-list-row', { timeout: 5000 });
            } catch (e) {
              console.log('No new content loaded after pagination');
              hasMorePages = false;
            }

            currentPage++;
          } catch (error) {
            console.log('Error navigating to next page:', error.message);
            hasMorePages = false;
          }
        } else if (paginationInfo.totalPageButtons > 1 && currentPage === 1) {
          // Try numbered pagination
          try {
            const clicked = await page.evaluate((pageNum) => {
              const pageButton = document.querySelector(`[aria-label="Page ${pageNum}"], button:has-text("${pageNum}"), a:has-text("${pageNum}")`);
              if (pageButton) {
                pageButton.click();
                return true;
              }
              return false;
            }, currentPage + 1);

            if (clicked) {
              await page.waitForTimeout(2000);
              currentPage++;
            } else {
              hasMorePages = false;
            }
          } catch (error) {
            console.log('Error with numbered pagination:', error.message);
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }

        // Additional check: if we got no new competitors, stop
        if (pageCompetitors.length === 0 && currentPage > 1) {
          hasMorePages = false;
        }
      }

      console.log(`Total competitors collected: ${allCompetitors.length} from ${currentPage} page(s)`);

      // Get the page HTML for fallback parsing
      const html = await page.evaluate(() => document.documentElement.outerHTML);
      const title = await page.evaluate(() => document.title);
      const hasTable = await page.evaluate(() => !!document.querySelector('table'));

      const data = {
        competitors: allCompetitors,
        html,
        title,
        hasTable,
        rowCount: allCompetitors.length,
        totalPages: currentPage
      };

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