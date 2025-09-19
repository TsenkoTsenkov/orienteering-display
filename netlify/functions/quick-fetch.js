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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 8000 // 8 second timeout for quick response
    });

    // Try to extract basic data from HTML without Puppeteer
    const html = response.data.toString();

    // Quick extraction for table rows - improved regex
    const rows = [];
    const tableMatches = [...(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [])];

    for (const match of tableMatches) {
      const rowHtml = match[1];
      // Skip header rows
      if (rowHtml.includes('<th') || rowHtml.includes('Start Time')) continue;

      const cellMatches = [...(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])];
      if (cellMatches.length > 0) {
        const cells = cellMatches.map(cellMatch => {
          return cellMatch[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
        });

        if (cells[0] || cells[1]) { // Has meaningful data
          // Check if results or start list by first cell
          const isResults = /^\d+$/.test(cells[0]);

          rows.push({
            cells,
            structured: isResults ? {
              rank: parseInt(cells[0]) || null,
              bib: cells[1] || '',
              name: cells[2] || '',
              country: cells[3] || '',
              finalTime: cells[cells.length - 1] || ''
            } : {
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