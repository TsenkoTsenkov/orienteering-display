const axios = require('axios');

// Lightweight scraping function that doesn't use Puppeteer
// Falls back to this when main scrape times out
exports.handler = async (event) => {
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

  try {
    console.log('Lite scraping:', url);

    // Multiple attempts with different strategies
    let response;

    try {
      // First attempt: direct fetch
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        },
        timeout: 10000,
        maxRedirects: 5
      });
    } catch (err) {
      console.log('First attempt failed, trying with simplified headers');

      // Second attempt: simplified headers
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OrienteeringBot/1.0)'
        },
        timeout: 8000
      });
    }

    const html = response.data.toString();
    const competitors = [];

    // Look for Angular app data in the HTML
    if (html.includes('app-root') || html.includes('mat-table')) {
      console.log('Detected Angular app, extracting initial data');

      // Try to find inline data
      const scriptMatch = html.match(/<script[^>]*>window\.__DATA__\s*=\s*({[^<]+})<\/script>/);
      if (scriptMatch) {
        try {
          const data = JSON.parse(scriptMatch[1]);
          if (data.competitors) {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                competitors: data.competitors,
                rowCount: data.competitors.length,
                hasTable: true,
                source: 'inline-data'
              })
            };
          }
        } catch (e) {
          console.log('Failed to parse inline data');
        }
      }
    }

    // Standard HTML table extraction
    const tableRows = [...(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [])];

    for (const match of tableRows) {
      const rowHtml = match[1];

      // Skip headers
      if (rowHtml.includes('<th') || rowHtml.includes('Start Time') || rowHtml.includes('Rank')) {
        continue;
      }

      const cells = [...(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])]
        .map(m => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

      if (cells.length >= 2 && cells.some(c => c)) {
        // Detect if this is results (starts with number) or start list
        const isResults = /^\d+$/.test(cells[0]);

        competitors.push({
          cells,
          structured: isResults ? {
            rank: parseInt(cells[0]) || null,
            bib: cells[1],
            name: cells[2],
            country: cells[3],
            finalTime: cells[cells.length - 1]
          } : {
            startTime: cells[0]?.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim(),
            name: cells[1],
            club: cells[2],
            country: cells[3],
            bib: cells[4],
            card: cells[5]
          }
        });
      }
    }

    // If no competitors found, return mock data hint
    if (competitors.length === 0) {
      console.log('No competitors found in HTML, may need full scraping');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30'
      },
      body: JSON.stringify({
        competitors: competitors,
        html: html.substring(0, 1000), // First 1KB for debugging
        title: html.match(/<title>(.*?)<\/title>/i)?.[1] || '',
        rowCount: competitors.length,
        hasTable: competitors.length > 0,
        isLiteScrape: true
      })
    };

  } catch (error) {
    console.error('Lite scrape error:', error.message);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to scrape data',
        message: error.message,
        url: url,
        isLiteScrape: true
      })
    };
  }
};