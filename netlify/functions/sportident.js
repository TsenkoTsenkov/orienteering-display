const axios = require("axios");

// SportIdent API configuration (matching sportident-server)
const API_KEY =
  process.env.SPORTIDENT_API_KEY || "a1faa424-1379-794c-3963-b9bf47f2ed09";
const EVENT_ID = process.env.SPORTIDENT_EVENT_ID || "20646";
const BASE_URL = "https://center-origin.sportident.com";

// In-memory storage for punches (serverless limitation)
let lastPunchId = 0;

exports.handler = async (event) => {
  // Log function invocation immediately
  console.log(`[SPORTIDENT] Function invoked at ${new Date().toISOString()}`);
  console.log(`[SPORTIDENT] Method: ${event.httpMethod}, Path: ${event.path}`);
  console.log(`[SPORTIDENT] Event ID: ${EVENT_ID}, API Key present: ${!!API_KEY}`);

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    console.log(`[SPORTIDENT] Handling CORS preflight`);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: "",
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    console.log(`[SPORTIDENT] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Parse path for different endpoints
  const path = event.path.replace("/.netlify/functions/sportident", "") || "/";
  console.log(`[SPORTIDENT] Parsed path: '${path}'`);

  try {
    switch (path) {
      case "/status":
        console.log(`[SPORTIDENT] Handling /status endpoint`);
        return handleStatus();

      case "/punches":
        console.log(`[SPORTIDENT] Handling /punches endpoint`);
        console.log(`[SPORTIDENT] Query params:`, event.queryStringParameters);
        return await handlePunches(event.queryStringParameters);

      case "/events":
        // For compatibility, redirect to punches
        return await handlePunches(event.queryStringParameters);

      case "/health":
        console.log(`[SPORTIDENT] Handling /health endpoint`);
        return handleHealth();

      default:
        console.log(`[SPORTIDENT] Default endpoint handler for path: '${path}'`);
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            message: "SportIdent API Proxy",
            endpoints: [
              "/status - Get API status",
              "/punches - Fetch punch data",
              "/events - Alias for punches",
              "/health - Health check",
            ],
          }),
        };
    }
  } catch (error) {
    console.error(`[SPORTIDENT] Handler error at ${new Date().toISOString()}:`, error.message);
    console.error(`[SPORTIDENT] Full error:`, error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};

// Handle status endpoint
function handleStatus() {
  console.log(`[SPORTIDENT] Returning status: eventId=${EVENT_ID}, lastPunchId=${lastPunchId}`);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      status: "running",
      method: "HTTP API",
      wsSupported: false,
      httpPolling: true,
      eventId: EVENT_ID,
      apiEndpoint: `${BASE_URL}/api/rest/v1/public/events/${EVENT_ID}/punches`,
      lastPunchId: lastPunchId,
      environment: "netlify-function",
    }),
  };
}

// Handle health check
function handleHealth() {
  console.log(`[SPORTIDENT] Health check OK at ${new Date().toISOString()}`);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      status: "ok",
      service: "sportident-netlify-function",
      timestamp: new Date().toISOString(),
    }),
  };
}

// Handle punches endpoint - main SportIdent API integration
async function handlePunches(queryParams = {}) {
  console.log(`[SPORTIDENT-PUNCHES] Starting punch fetch at ${new Date().toISOString()}`);

  try {
    // Extract query parameters
    const afterId = parseInt(queryParams.afterId) || lastPunchId || 0;
    const limit = parseInt(queryParams.limit) || 1000;
    const projection = queryParams.projection || "simple";

    console.log(`[SPORTIDENT-PUNCHES] Parameters: afterId=${afterId}, limit=${limit}, projection=${projection}`);

    // Correct endpoint structure as per SportIdent documentation
    const url = `${BASE_URL}/api/rest/v1/public/events/${EVENT_ID}/punches`;

    console.log(`[SPORTIDENT-PUNCHES] Fetching from: ${url}`);
    console.log(`[SPORTIDENT-PUNCHES] Request params:`, params);
    console.log(`[SPORTIDENT-PUNCHES] Using API key: ${API_KEY.substring(0, 8)}...`);

    const params = {
      afterId: afterId,
      projection: projection,
      limit: limit,
    };

    const response = await axios.get(url, {
      headers: {
        // Correct authentication header for SportIdent
        apikey: API_KEY,
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
      },
      params: params,
    });

    console.log(`[SPORTIDENT-PUNCHES] Response status: ${response.status}`);
    console.log(`[SPORTIDENT-PUNCHES] Response data type: ${typeof response.data}, isArray: ${Array.isArray(response.data)}`);

    let punches = [];

    if (response.data && Array.isArray(response.data)) {
      punches = response.data;
      console.log(`[SPORTIDENT-PUNCHES] ✅ Received ${punches.length} punches`);

      // Update lastPunchId for future requests
      if (punches.length > 0) {
        const maxId = Math.max(
          ...punches.map((p) => p.id || 0).filter((id) => id > 0),
        );
        if (maxId > lastPunchId) {
          lastPunchId = maxId;
          console.log(`[SPORTIDENT-PUNCHES] Updated lastPunchId to: ${lastPunchId}`);
        }
      }
    } else {
      console.log(`[SPORTIDENT-PUNCHES] No new punches received`);
    }

    // Format response to match sportident-server
    console.log(`[SPORTIDENT-PUNCHES] SUCCESS: Returning ${punches.length} punches, lastPunchId=${lastPunchId}`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        punches: punches.map((punch) => ({
          type: "punch",
          source: "http",
          timestamp: new Date().toISOString(),
          data: punch,
        })),
        total: punches.length,
        lastPunchId: lastPunchId,
        afterId: afterId,
      }),
    };
  } catch (error) {
    console.error(`[SPORTIDENT-PUNCHES] Error fetching punches at ${new Date().toISOString()}:`, error.message);
    console.error(`[SPORTIDENT-PUNCHES] Full error:`, error);
    if (error.response) {
      console.error(`[SPORTIDENT-PUNCHES] Response status:`, error.response.status);
      console.error(`[SPORTIDENT-PUNCHES] Response data:`, error.response.data);
    }

    return {
      statusCode: error.response?.status || 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch punches",
        message: error.message,
        details: error.response?.data || null,
      }),
    };
  }
}
