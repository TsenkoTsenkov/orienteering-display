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
  try {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    // Use executable path if provided (for deployment)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);
    console.log('Puppeteer browser launched successfully');
  } catch (error) {
    console.error('Failed to launch Puppeteer:', error.message);
    console.log('Proxy server will run without Puppeteer scraping support');
  }
})();

// Simple fetch proxy endpoint
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

// Puppeteer scraping endpoint for SPA content
app.get('/api/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!browser) {
      console.error('Puppeteer browser not available');
      return res.status(503).json({
        error: 'Scraping service unavailable',
        message: 'Puppeteer browser not initialized'
      });
    }

    console.log('Scraping SPA URL:', url);

    // Create a new page
    const page = await browser.newPage();

    try {
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Navigate to the URL and wait for network to settle (important for SPAs)
      await page.goto(url, {
        waitUntil: 'networkidle2', // Wait for network to be idle (important for SPAs)
        timeout: 20000
      });

      // Wait longer for Angular to render the SPA content
      await new Promise(resolve => setTimeout(resolve, 7000));

      // Wait for specific content to load
      try {
        // More specific selectors for the actual table structure
        await page.waitForSelector('mat-table, table.mat-mdc-table, table tbody tr, .mat-mdc-row, [role="grid"]', {
          timeout: 10000,
          visible: true
        });
        console.log('Table content detected');
      } catch (e) {
        console.log('Primary selectors not found, waiting for any table...');
        // Try broader selectors
        try {
          await page.waitForSelector('table, tbody, [role="table"], .table-container', {
            timeout: 5000,
            visible: true
          });
        } catch (e2) {
          console.log('No table structure found, proceeding anyway...');
        }
      }

      // Extract all competitors with pagination
      const allCompetitors = await extractAllCompetitors(page);

      // Get the page HTML for fallback parsing
      const html = await page.evaluate(() => document.documentElement.outerHTML);
      const title = await page.evaluate(() => document.title);

      const data = {
        competitors: allCompetitors,
        html: html,
        title: title,
        hasTable: allCompetitors.length > 0,
        rowCount: allCompetitors.length
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

// Helper function to extract competitors with pagination
async function extractAllCompetitors(page) {
  let allCompetitors = [];
  let currentPage = 1;
  let hasMorePages = true;
  const maxPages = 20;

  while (hasMorePages && currentPage <= maxPages) {
    console.log(`Extracting page ${currentPage}...`);

    // Extract competitors from current page
    const pageCompetitors = await page.evaluate(() => {
      const competitors = [];
      // More specific selectors for MUI/React tables
      const rows = document.querySelectorAll(
        'tbody tr, ' +
        'table.mat-mdc-table tbody tr, ' +
        'mat-table mat-row, ' +
        '.mat-mdc-row, ' +
        'table tr:has(td), ' +
        '[role="row"]:has([role="cell"]), ' +
        '.table-row, ' +
        '.competitor-row, ' +
        '.start-list-row'
      );

      rows.forEach((row) => {
        // Skip header rows and empty rows
        if (row.querySelector('th')) return;

        const cells = row.querySelectorAll(
          'td, ' +
          '[role="cell"], ' +
          '[role="gridcell"], ' +
          '.mat-mdc-cell, ' +
          'mat-cell, ' +
          '.table-cell'
        );
        if (cells.length > 0 && cells[0].textContent.trim()) {
          const competitorData = {
            cells: Array.from(cells).map((cell, idx) => {
              let text = cell.textContent.trim();
              // Clean timezone from start time (first cell)
              if (idx === 0 && text) {
                text = text.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
              }
              return text;
            })
          };

          // Extract structured data - handle both start list and results formats
          if (cells.length >= 2) {
            // Check if this is a results page (first cell is rank number)
            const firstCellText = cells[0]?.textContent.trim();
            const isResultsPage = /^\d+$/.test(firstCellText);

            if (isResultsPage) {
              // Results page format
              competitorData.structured = {
                rank: parseInt(firstCellText) || null,
                bib: cells[1]?.textContent.trim(),
                name: cells[2]?.textContent.trim(),
                country: cells[3]?.textContent.trim() || cells[2]?.textContent.match(/[A-Z]{3}/)?.[0],
                birthYear: cells[4]?.textContent.trim(),
                startTime: cells[5]?.textContent.trim()?.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim(),
                // Final time is in the last visible cell with time format
                finalTime: null
              };

              // Find the final time - look for time format in later cells
              for (let i = cells.length - 1; i >= 6; i--) {
                const cellText = cells[i]?.textContent.trim();
                // Check for time format (MM:SS or HH:MM:SS)
                if (cellText && /^\d+:\d{2}(:\d{2})?/.test(cellText)) {
                  competitorData.structured.finalTime = cellText;
                  break;
                }
              }
            } else {
              // Start list format
              let startTime = cells[0]?.textContent.trim();
              if (startTime) {
                startTime = startTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
              }

              competitorData.structured = {
                startTime: startTime,
                name: cells[1]?.textContent.trim(),
                club: cells[2]?.textContent.trim(),
                country: cells[3]?.textContent.trim() || cells[2]?.textContent.match(/[A-Z]{3}/)?.[0],
                bib: cells[4]?.textContent.trim(),
                card: cells[5]?.textContent.trim(),
              };
            }
          }

          competitors.push(competitorData);
        }
      });

      return competitors;
    });

    allCompetitors = allCompetitors.concat(pageCompetitors);

    // Check for pagination controls
    const paginationInfo = await page.evaluate(() => {
      // Look for next button
      const nextButton = document.querySelector(
        '[aria-label="Next"]:not(:disabled):not(.Mui-disabled), ' +
        '.MuiTablePagination-actions button:last-child:not(:disabled):not(.Mui-disabled), ' +
        '.pagination-next:not(:disabled)'
      );

      // Check MUI table pagination text
      const muiPaginationText = document.querySelector('.MuiTablePagination-displayedRows')?.textContent || '';
      const muiRowsInfo = muiPaginationText.match(/(\d+)[–-](\d+) of (\d+)/);

      return {
        canGoNext: !!nextButton,
        muiPagination: muiRowsInfo ? {
          from: parseInt(muiRowsInfo[1]),
          to: parseInt(muiRowsInfo[2]),
          total: parseInt(muiRowsInfo[3])
        } : null
      };
    });

    console.log('Pagination info:', paginationInfo);

    // Check if we should continue
    if (paginationInfo.muiPagination && paginationInfo.muiPagination.to >= paginationInfo.muiPagination.total) {
      console.log('Reached last page based on MUI pagination');
      hasMorePages = false;
    } else if (paginationInfo.canGoNext) {
      try {
        // Click next button
        const clicked = await page.evaluate(() => {
          const selectors = [
            '[aria-label="Next"]:not(:disabled):not(.Mui-disabled)',
            '.MuiTablePagination-actions button:last-child:not(:disabled):not(.Mui-disabled)',
            '.pagination-next:not(:disabled)'
          ];

          for (const selector of selectors) {
            const nextButton = document.querySelector(selector);
            if (nextButton) {
              nextButton.click();
              return true;
            }
          }
          return false;
        });

        if (clicked) {
          // Wait for new content to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          currentPage++;
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.log('Error navigating to next page:', error.message);
        hasMorePages = false;
      }
    } else {
      hasMorePages = false;
    }

    // Stop if no new competitors found
    if (pageCompetitors.length === 0 && currentPage > 1) {
      hasMorePages = false;
    }
  }

  console.log(`Total competitors collected: ${allCompetitors.length} from ${currentPage} page(s)`);
  return allCompetitors;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Proxy server is running',
    puppeteer: !!browser
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Fetch endpoint: http://localhost:${PORT}/api/fetch?url=<URL>`);
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