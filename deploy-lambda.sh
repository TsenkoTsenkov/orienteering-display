#!/bin/bash

# Lambda deployment script for orienteering scraper
# This script packages and deploys the Lambda function to AWS

set -e

echo "Building Lambda function..."

# Create deployment directory
rm -rf lambda-deploy
mkdir -p lambda-deploy

# Create the Lambda handler
cat > lambda-deploy/scrape.js << 'EOF'
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

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

    console.log('Scraping URL:', url);

    // Launch browser
    browser = await puppeteer.launch({
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

    // Wait for content
    try {
      await page.waitForSelector('table, .competitor-row, .start-list-row', { timeout: 10000 });
    } catch (e) {
      console.log('Waiting for dynamic content...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Extract competitors with pagination
    let allCompetitors = [];
    let currentPage = 1;
    let hasMorePages = true;
    const maxPages = 50;

    while (hasMorePages && currentPage <= maxPages) {
      console.log(`Extracting page ${currentPage}...`);

      const pageCompetitors = await page.evaluate(() => {
        const competitors = [];
        const rows = document.querySelectorAll('table tr, .competitor-row, .start-list-row, [role="row"]');

        rows.forEach((row, index) => {
          if (index === 0 && row.querySelector('th')) return;

          const cells = row.querySelectorAll('td, [role="cell"]');
          if (cells.length > 0) {
            const competitorData = {
              cells: Array.from(cells).map((cell, idx) => {
                let text = cell.textContent?.trim() || '';
                if (idx === 0 && text) {
                  text = text.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
                }
                return text;
              })
            };

            if (cells.length >= 2) {
              let startTime = cells[0].textContent?.trim() || '';
              startTime = startTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();

              competitorData.structured = {
                startTime,
                name: cells[1].textContent?.trim(),
                club: cells[2]?.textContent?.trim(),
                country: cells[3]?.textContent?.trim() || cells[2]?.textContent?.match(/[A-Z]{3}/)?.[0],
                bib: cells[4]?.textContent?.trim(),
                rank: cells[0].textContent?.trim(),
                finalTime: cells[3]?.textContent?.trim()
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
        const selectors = [
          '[aria-label="Next"]:not(:disabled)',
          '.MuiTablePagination-actions button:last-child:not(:disabled)',
          '.pagination-next:not(:disabled)',
          'button[title="Next page"]:not(:disabled)'
        ];

        for (const selector of selectors) {
          const nextBtn = document.querySelector(selector);
          if (nextBtn && !nextBtn.classList.contains('disabled')) {
            nextBtn.click();
            return true;
          }
        }
        return false;
      });

      if (canGoNext) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentPage++;
      } else {
        hasMorePages = false;
      }
    }

    console.log(`Total competitors extracted: ${allCompetitors.length}`);

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

  } catch (error) {
    console.error('Scraping error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to scrape data',
        message: error.message
      })
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
EOF

# Create package.json
cat > lambda-deploy/package.json << 'EOF'
{
  "name": "orienteering-scraper",
  "version": "1.0.0",
  "description": "Lambda function for scraping orienteering results",
  "main": "scrape.js",
  "dependencies": {
    "@sparticuz/chromium": "^131.0.1",
    "puppeteer-core": "^23.11.1"
  }
}
EOF

# Install dependencies
echo "Installing dependencies..."
cd lambda-deploy
npm install --production

# Create deployment package
echo "Creating deployment package..."
zip -r ../scrape.zip .

cd ..

echo "Deployment package created: scrape.zip"
echo ""
echo "To deploy to AWS Lambda:"
echo "1. Create/update the Lambda function with Node.js 20.x runtime"
echo "2. Set memory to at least 2048 MB and timeout to 60 seconds"
echo "3. Upload scrape.zip as the function code"
echo ""
echo "Or use AWS CLI:"
echo "aws lambda create-function --function-name orienteering-scrape --runtime nodejs20.x --role <YOUR_ROLE_ARN> --handler scrape.handler --timeout 60 --memory-size 2048 --zip-file fileb://scrape.zip"