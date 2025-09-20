// SportIdent API Configuration
// Matches the configuration from sportident-server

const config = {
  // API credentials (same as sportident-server)
  apiKey:
    process.env.REACT_APP_SPORTIDENT_API_KEY ||
    "a1faa424-1379-794c-3963-b9bf47f2ed09",
  eventId: process.env.REACT_APP_SPORTIDENT_EVENT_ID || "20646",

  // Endpoint configurations
  endpoints: {
    // When deployed to Netlify
    production: {
      status: "/.netlify/functions/sportident/status",
      punches: "/.netlify/functions/sportident/punches",
      events: "/.netlify/functions/sportident/events",
      health: "/.netlify/functions/sportident/health",
      poll: "/.netlify/functions/sportident-poll",
    },
    // For local development with Netlify CLI
    development: {
      status: "http://localhost:9999/.netlify/functions/sportident/status",
      punches: "http://localhost:9999/.netlify/functions/sportident/punches",
      events: "http://localhost:9999/.netlify/functions/sportident/events",
      health: "http://localhost:9999/.netlify/functions/sportident/health",
      poll: "http://localhost:9999/.netlify/functions/sportident-poll",
    },
    // For standalone sportident-server
    server: {
      status: "http://localhost:3002/api/sportident/status",
      punches: "http://localhost:3002/api/sportident/punches",
      events: "http://localhost:3002/api/sportident/events",
      health: "http://localhost:3002/health",
    },
  },

  // Polling configuration (matching server settings)
  polling: {
    enabled: true,
    interval: 10000, // 10 seconds, as recommended by SportIdent
    maxReconnectAttempts: 10,
    reconnectInterval: 5000,
  },

  // Request configuration
  request: {
    limit: 1000, // Max punches per request
    projection: "simple",
    timeout: 8000, // 8 seconds
  },
};

// Helper to get the appropriate endpoint based on environment
export const getSportIdentEndpoints = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const useNetlifyFunctions =
    process.env.REACT_APP_USE_NETLIFY_FUNCTIONS !== "false";
  const useServer = process.env.REACT_APP_USE_SPORTIDENT_SERVER === "true";

  if (useServer) {
    return config.endpoints.server;
  }

  if (isProduction || useNetlifyFunctions) {
    return isProduction
      ? config.endpoints.production
      : config.endpoints.development;
  }

  return config.endpoints.server;
};

// SportIdent API client class
export class SportIdentClient {
  constructor() {
    this.endpoints = getSportIdentEndpoints();
    this.lastPunchId = 0;
    this.pollingTimer = null;
    this.listeners = {
      punch: [],
      error: [],
      status: [],
    };
  }

  // Add event listener
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }
  }

  // Emit event
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  // Start polling for punches
  async startPolling() {
    if (this.pollingTimer) {
      return; // Already polling
    }

    console.log("Starting SportIdent polling...");

    // Initial fetch
    await this.fetchPunches();

    // Set up polling interval
    this.pollingTimer = setInterval(() => {
      this.fetchPunches();
    }, config.polling.interval);
  }

  // Stop polling
  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log("Stopped SportIdent polling");
    }
  }

  // Fetch punches from API
  async fetchPunches() {
    try {
      const url = this.endpoints.poll || this.endpoints.punches;
      const params = new URLSearchParams({
        afterId: this.lastPunchId,
        limit: config.request.limit,
        projection: config.request.projection,
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.punches && data.punches.length > 0) {
        console.log(`Received ${data.punches.length} punches`);

        // Emit each punch
        data.punches.forEach((punch) => {
          this.emit("punch", punch);
        });

        // Update lastPunchId
        if (data.lastPunchId && data.lastPunchId > this.lastPunchId) {
          this.lastPunchId = data.lastPunchId;
          console.log(`Updated lastPunchId to: ${this.lastPunchId}`);
        }
      }

      // Emit status
      this.emit("status", {
        connected: true,
        punchesReceived: data.total || 0,
        lastPunchId: this.lastPunchId,
      });
    } catch (error) {
      console.error("Error fetching punches:", error);
      this.emit("error", error);
      this.emit("status", {
        connected: false,
        error: error.message,
      });
    }
  }

  // Get current status
  async getStatus() {
    try {
      const response = await fetch(this.endpoints.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching status:", error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(this.endpoints.health);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }
}

// Export configuration
export default config;
