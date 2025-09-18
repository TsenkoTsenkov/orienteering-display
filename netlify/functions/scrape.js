const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Main handler function for Netlify
exports.handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL parameter is required' })
    };
  }

  let browser = null;

  try {
    console.log('Launching browser for:', url);

    // Launch browser with optimized settings for serverless
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless || true,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigate to the page and wait for SPA to load
    await page.goto(url, {
      waitUntil: 'networkidle2', // Wait for network to settle (crucial for SPAs)
      timeout: 20000
    });

    // Give Angular more time to render the SPA content
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Wait for table content
    try {
      await page.waitForSelector(
        'mat-table, table.mat-mdc-table, table tbody tr, .mat-mdc-row, [role="grid"], tbody',
        {
          timeout: 8000,
          visible: true
        }
      );
      console.log('Table content found');
    } catch (e) {
      console.log('No table found, proceeding anyway...');
    }

    // Extract competitors with pagination support
    const allCompetitors = await extractAllCompetitors(page);

    // Get additional page info
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    const title = await page.evaluate(() => document.title);

    await browser.close();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        competitors: allCompetitors,
        html: html,
        title: title,
        rowCount: allCompetitors.length,
        hasTable: allCompetitors.length > 0
      })
    };

  } catch (error) {
    console.error('Scraping error:', error);

    if (browser) {
      await browser.close();
    }

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to scrape data',
        message: error.message,
        url: url
      })
    };
  }
};

// Helper function to extract all competitors with pagination
async function extractAllCompetitors(page) {
  let allCompetitors = [];
  let currentPage = 1;
  let hasMorePages = true;
  const maxPages = 20; // Increased limit to ensure we get all competitors

  while (hasMorePages && currentPage <= maxPages) {
    console.log(`Extracting page ${currentPage}...`);

    // Extract competitors from current page
    const pageCompetitors = await page.evaluate(() => {
      const competitors = [];
      const rows = document.querySelectorAll(
        'tbody tr, ' +
        'table.mat-mdc-table tbody tr, ' +
        'mat-table mat-row, ' +
        '.mat-mdc-row, ' +
        'table tr:has(td), ' +
        '[role="row"]:has([role="cell"]), ' +
        '.competitor-row, ' +
        '.start-list-row'
      );

      rows.forEach((row, index) => {
        // Skip header rows
        if (index === 0 && row.querySelector('th')) return;

        const cells = row.querySelectorAll(
          'td, ' +
          '[role="cell"], ' +
          '[role="gridcell"], ' +
          '.MuiTableCell-root, ' +
          '.MuiDataGrid-cell'
        );
        if (cells.length > 0) {
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

          // Extract structured data
          if (cells.length >= 2) {
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

          competitors.push(competitorData);
        }
      });

      return competitors;
    });

    allCompetitors = allCompetitors.concat(pageCompetitors);

    // Check for next page
    const paginationInfo = await page.evaluate(() => {
      // Look for next button
      const nextButton = document.querySelector(
        '[aria-label="Next"]:not(:disabled), ' +
        '.MuiTablePagination-actions button:last-child:not(:disabled), ' +
        '.pagination-next:not(:disabled)'
      );

      // Check MUI table pagination
      const muiPaginationText = document.querySelector('.MuiTablePagination-displayedRows')?.textContent || '';
      const muiRowsInfo = muiPaginationText.match(/(\d+)[–-](\d+) of (\d+)/);

      return {
        hasNext: !!nextButton,
        muiPagination: muiRowsInfo ? {
          from: parseInt(muiRowsInfo[1]),
          to: parseInt(muiRowsInfo[2]),
          total: parseInt(muiRowsInfo[3])
        } : null
      };
    });

    // Check if we should continue
    if (paginationInfo.muiPagination && paginationInfo.muiPagination.to >= paginationInfo.muiPagination.total) {
      hasMorePages = false;
    } else if (paginationInfo.hasNext) {
      // Try to click next
      const clicked = await page.evaluate(() => {
        const nextButton = document.querySelector(
          '[aria-label="Next"]:not(:disabled), ' +
          '.MuiTablePagination-actions button:last-child:not(:disabled), ' +
          '.pagination-next:not(:disabled)'
        );
        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        // Wait for new content to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentPage++;
      } else {
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

  console.log(`Total competitors: ${allCompetitors.length} from ${currentPage} page(s)`);
  return allCompetitors;
}