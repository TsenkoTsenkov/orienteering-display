import type { APIGatewayProxyHandler } from 'aws-lambda';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

// Full scraping with pagination support
export const handler: APIGatewayProxyHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  let browser = null;

  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter required' })
      };
    }

    console.log('Scraping URL with full pagination:', url);

    // Launch Puppeteer with Chrome
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for content to load
    try {
      await page.waitForSelector('table, .competitor-row, .start-list-row', { timeout: 10000 });
    } catch (e) {
      console.log('Waiting for dynamic content...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Extract ALL competitors with pagination
    let allCompetitors: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const maxPages = 50; // Support up to 50 pages

    while (hasMorePages && currentPage <= maxPages) {
      console.log(`Extracting page ${currentPage}...`);

      // Extract competitors from current page
      const pageCompetitors = await page.evaluate(() => {
        const competitors: any[] = [];
        const rows = document.querySelectorAll('table tr, .competitor-row, .start-list-row, [role="row"]');

        rows.forEach((row, index) => {
          // Skip header rows
          if (index === 0 && row.querySelector('th')) return;

          const cells = row.querySelectorAll('td, [role="cell"]');
          if (cells.length > 0) {
            const competitorData: any = {
              cells: Array.from(cells).map((cell, idx) => {
                let text = (cell as HTMLElement).textContent?.trim() || '';
                // Clean timezone from start time (first column)
                if (idx === 0 && text) {
                  text = text.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
                }
                return text;
              })
            };

            // Structure the data
            if (cells.length >= 2) {
              let startTime = (cells[0] as HTMLElement).textContent?.trim() || '';
              startTime = startTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();

              competitorData.structured = {
                startTime,
                name: (cells[1] as HTMLElement).textContent?.trim(),
                club: (cells[2] as HTMLElement).textContent?.trim(),
                country: (cells[3] as HTMLElement).textContent?.trim() ||
                         (cells[2] as HTMLElement).textContent?.match(/[A-Z]{3}/)?.[0],
                bib: (cells[4] as HTMLElement).textContent?.trim(),
                rank: (cells[0] as HTMLElement).textContent?.trim(),
                finalTime: (cells[3] as HTMLElement).textContent?.trim()
              };
            }

            competitors.push(competitorData);
          }
        });

        return competitors;
      });

      allCompetitors = allCompetitors.concat(pageCompetitors);

      // Try to navigate to next page
      const canGoNext = await page.evaluate(() => {
        // Look for next button - multiple selectors for different sites
        const selectors = [
          '[aria-label="Next"]:not(:disabled)',
          '.MuiTablePagination-actions button:last-child:not(:disabled)',
          '.pagination-next:not(:disabled)',
          'button[title="Next page"]:not(:disabled)',
          '.MuiPagination-ul button[aria-label*="next"]:not(.Mui-disabled)',
          '[class*="next"]:not(:disabled):not(.disabled)'
        ];

        for (const selector of selectors) {
          const nextBtn = document.querySelector(selector) as HTMLElement;
          if (nextBtn && !nextBtn.classList.contains('disabled')) {
            nextBtn.click();
            return true;
          }
        }

        // Also check for numbered pagination
        const pageButtons = document.querySelectorAll('button, a');
        for (const btn of pageButtons) {
          if (btn.textContent && btn.textContent.includes('Next') &&
              !(btn as HTMLElement).classList.contains('disabled')) {
            (btn as HTMLElement).click();
            return true;
          }
        }

        return false;
      });

      if (canGoNext) {
        // Wait for new content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if content changed
        const newCompetitors = await page.evaluate(() => {
          const rows = document.querySelectorAll('table tr, .competitor-row, .start-list-row');
          return rows.length;
        });

        if (newCompetitors === 0 || (pageCompetitors.length === 0 && currentPage > 1)) {
          hasMorePages = false;
        }

        currentPage++;
      } else {
        hasMorePages = false;
      }
    }

    console.log(`Total competitors extracted: ${allCompetitors.length} from ${currentPage} pages`);

    // Get page HTML and title for additional context
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    const title = await page.evaluate(() => document.title);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        competitors: allCompetitors,
        html,
        title,
        rowCount: allCompetitors.length,
        totalPages: currentPage,
        hasTable: allCompetitors.length > 0,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error: any) {
    console.error('Scraping error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to scrape data',
        message: error.message,
        stack: error.stack
      })
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};