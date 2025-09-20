const axios = require("axios");

// SportIdent API configuration (matching sportident-server)
const API_KEY =
  process.env.SPORTIDENT_API_KEY || "a1faa424-1379-794c-3963-b9bf47f2ed09";
const EVENT_ID = process.env.SPORTIDENT_EVENT_ID || "20646";
const BASE_URL = "https://center-origin.sportident.com";

// In-memory storage for punches (serverless limitation)
let lastPunchId = 0;

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
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

  try {
    switch (path) {
      case "/status":
        return handleStatus();

      case "/punches":
        return await handlePunches(event.queryStringParameters);

      case "/events":
        // For compatibility, redirect to punches
        return await handlePunches(event.queryStringParameters);

      case "/health":
        return handleHealth();

      default:
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
    console.error("Handler error:", error);
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
  try {
    // Extract query parameters
    const afterId = parseInt(queryParams.afterId) || lastPunchId || 0;
    const limit = parseInt(queryParams.limit) || 1000;
    const projection = queryParams.projection || "simple";

    // Correct endpoint structure as per SportIdent documentation
    const url = `${BASE_URL}/api/rest/v1/public/events/${EVENT_ID}/punches`;

    console.log(`Fetching from: ${url} with afterId=${afterId}`);

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

    let punches = [];

    if (response.data && Array.isArray(response.data)) {
      punches = response.data;
      console.log(`✅ Received ${punches.length} punches`);

      // Update lastPunchId for future requests
      if (punches.length > 0) {
        const maxId = Math.max(
          ...punches.map((p) => p.id || 0).filter((id) => id > 0),
        );
        if (maxId > lastPunchId) {
          lastPunchId = maxId;
          console.log(`Updated lastPunchId to: ${lastPunchId}`);
        }
      }
    } else {
      console.log("No new punches received");
    }

    // Format response to match sportident-server
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
    console.error("Error fetching punches:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
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
