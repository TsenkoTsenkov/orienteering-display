const axios = require('axios');

// SportIdent API configuration (matching sportident-server)
const API_KEY = process.env.SPORTIDENT_API_KEY || 'a1faa424-1379-794c-3963-b9bf47f2ed09';
const EVENT_ID = process.env.SPORTIDENT_EVENT_ID || '20636';
const BASE_URL = 'https://center-origin.sportident.com';

// Cache for storing punches with timestamps
const punchCache = new Map();
const CACHE_DURATION = 10000; // 10 seconds cache, matching server polling interval

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const afterId = parseInt(queryParams.afterId) || 0;
    const includeAll = queryParams.includeAll === 'true';
    const limit = parseInt(queryParams.limit) || 1000;

    // Check cache first
    const cacheKey = `punches_${EVENT_ID}_${afterId}`;
    const cachedData = punchCache.get(cacheKey);

    if (cachedData && !includeAll) {
      const age = Date.now() - cachedData.timestamp;
      if (age < CACHE_DURATION) {
        console.log('Returning cached data, age:', age);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'max-age=10'
          },
          body: JSON.stringify({
            ...cachedData.data,
            cached: true,
            cacheAge: age
          })
        };
      }
    }

    // Fetch fresh data from SportIdent API
    const url = `${BASE_URL}/api/rest/v1/public/events/${EVENT_ID}/punches`;

    console.log(`Fetching from: ${url} with afterId=${afterId}`);

    const params = {
      afterId: afterId,
      projection: 'simple',
      limit: limit
    };

    const response = await axios.get(url, {
      headers: {
        'apikey': API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8'
      },
      params: params,
      timeout: 8000 // 8 second timeout to stay within Netlify limits
    });

    let punches = [];
    let maxPunchId = afterId;

    if (response.data && Array.isArray(response.data)) {
      punches = response.data;
      console.log(`✅ Received ${punches.length} punches`);

      // Find max punch ID for next polling
      if (punches.length > 0) {
        maxPunchId = Math.max(...punches.map(p => p.id || 0).filter(id => id > 0), afterId);
        console.log(`Max punch ID: ${maxPunchId}`);
      }
    }

    // If includeAll is true, fetch all historical punches
    let allPunches = punches;
    if (includeAll && afterId === 0 && punches.length === limit) {
      // There might be more punches, fetch them
      let currentAfterId = maxPunchId;
      let fetchCount = 1;
      const MAX_FETCHES = 5; // Limit to prevent timeout

      while (fetchCount < MAX_FETCHES) {
        const additionalResponse = await axios.get(url, {
          headers: {
            'apikey': API_KEY,
            'Accept': 'application/json'
          },
          params: {
            afterId: currentAfterId,
            projection: 'simple',
            limit: limit
          },
          timeout: 5000
        });

        if (additionalResponse.data && Array.isArray(additionalResponse.data) && additionalResponse.data.length > 0) {
          allPunches = allPunches.concat(additionalResponse.data);
          currentAfterId = Math.max(...additionalResponse.data.map(p => p.id || 0).filter(id => id > 0));
          fetchCount++;

          if (additionalResponse.data.length < limit) {
            break; // No more data
          }
        } else {
          break;
        }
      }
    }

    // Prepare response data
    const responseData = {
      punches: allPunches.map(punch => ({
        type: 'punch',
        source: 'http-poll',
        timestamp: new Date().toISOString(),
        data: punch
      })),
      total: allPunches.length,
      lastPunchId: maxPunchId,
      afterId: afterId,
      eventId: EVENT_ID,
      polling: {
        recommended: true,
        interval: 10000,
        nextAfterId: maxPunchId
      }
    };

    // Cache the response
    punchCache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData
    });

    // Clean old cache entries
    for (const [key, value] of punchCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_DURATION * 2) {
        punchCache.delete(key);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=10'
      },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Error fetching punches:', error.message);

    return {
      statusCode: error.response?.status || 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to fetch punches',
        message: error.message,
        details: error.response?.data || null,
        eventId: EVENT_ID
      })
    };
  }
};