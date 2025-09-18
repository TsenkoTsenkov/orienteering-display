const axios = require('axios');

// Lightweight fetch function for quick data retrieval
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
    console.log('Quick fetching:', url);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 5000 // 5 second timeout for quick response
    });

    // Try to extract basic data from HTML without Puppeteer
    const html = response.data;

    // Quick extraction for table rows
    const rows = [];
    const tableMatches = html.match(/<tr[^>]*>(.*?)<\/tr>/gs) || [];

    for (const row of tableMatches) {
      const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/gs) || [];
      if (cellMatches.length > 0) {
        const cells = cellMatches.map(cell =>
          cell.replace(/<[^>]*>/g, '').trim()
        );
        if (cells.some(c => c)) { // At least one non-empty cell
          rows.push({
            cells,
            structured: {
              startTime: cells[0] || '',
              name: cells[1] || '',
              club: cells[2] || '',
              country: cells[3] || '',
              bib: cells[4] || '',
              card: cells[5] || ''
            }
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30' // 30 second cache
      },
      body: JSON.stringify({
        competitors: rows,
        html: html.substring(0, 5000), // First 5KB for parsing
        rowCount: rows.length,
        hasTable: rows.length > 0,
        isQuickFetch: true
      })
    };

  } catch (error) {
    console.error('Quick fetch error:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to fetch data',
        message: error.message,
        url: url
      })
    };
  }
};