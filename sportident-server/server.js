const WebSocket = require("ws");
const EventEmitter = require("events");

class SportIdentClient extends EventEmitter {
  constructor(apiKey, eventId) {
    super();
    this.apiKey = apiKey;
    this.eventId = eventId;
    this.ws = null;
    this.reconnectInterval = 5000;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    // Common websocket URLs for SportIdent based on their infrastructure patterns
    const wsUrls = [
      `wss://center.sportident.com/ws/events/${this.eventId}/live`,
      `wss://live.sportident.com/events/${this.eventId}`,
      `wss://center.sportident.com/api/v1/events/${this.eventId}/live`,
      `ws://center.sportident.com/ws/events/${this.eventId}/live`,
    ];

    // Try the first URL
    this.tryConnect(wsUrls[0]);
  }

  tryConnect(url) {
    console.log(`Attempting to connect to SportIdent Live Data at: ${url}`);

    try {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "X-API-Key": this.apiKey,
          Origin: "https://center.sportident.com",
        },
      });

      this.ws.on("open", () => {
        console.log("✅ Connected to SportIdent Live Data");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");

        // Send authentication/subscription message if needed
        const authMessage = {
          type: "auth",
          apiKey: this.apiKey,
          eventId: this.eventId,
        };
        this.ws.send(JSON.stringify(authMessage));

        // Alternative subscription format
        const subscribeMessage = {
          type: "subscribe",
          event: this.eventId,
          data: ["punches", "live"],
        };
        this.ws.send(JSON.stringify(subscribeMessage));

        console.log("Sent authentication and subscription messages");
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(
            "📡 Received SportIdent Event:",
            JSON.stringify(message, null, 2),
          );

          // Emit different event types
          if (message.type === "punch" || message.punch) {
            this.emit("punch", message);
          } else if (message.type === "status") {
            this.emit("status", message);
          } else {
            this.emit("data", message);
          }
        } catch (error) {
          // Handle non-JSON messages
          console.log("📡 Received raw message:", data.toString());
          this.emit("rawData", data.toString());
        }
      });

      this.ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error.message);
        this.emit("error", error);
      });

      this.ws.on("close", (code, reason) => {
        console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
        this.isConnected = false;
        this.emit("disconnected");

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(
            `Reconnecting in ${this.reconnectInterval / 1000} seconds... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
          );
          setTimeout(() => this.connect(), this.reconnectInterval);
        } else {
          console.error(
            "Max reconnection attempts reached. Please check your API key and event ID.",
          );
        }
      });

      this.ws.on("ping", () => {
        console.log("Received ping from server");
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.pong();
        }
      });
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.emit("error", error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }
}

// Correct HTTP polling approach for SportIdent API
class SportIdentHTTPClient extends EventEmitter {
  constructor(apiKey, eventId) {
    super();
    this.apiKey = apiKey;
    this.eventId = eventId;
    // Correct base URL for SportIdent Center API
    this.baseUrl = "https://center-origin.sportident.com";
    this.pollingInterval = null;
    this.lastPunchId = 0; // Start with 0 as recommended by SportIdent docs
  }

  async start() {
    console.log("Starting HTTP polling for SportIdent data...");

    // Initial fetch
    await this.fetchPunches();

    // Set up polling every 10 seconds (recommended by SportIdent)
    this.pollingInterval = setInterval(() => {
      this.fetchPunches();
    }, 10000);
  }

  async fetchPunches() {
    const axios = require("axios");

    try {
      // Correct endpoint structure as per SportIdent documentation
      const url = `${this.baseUrl}/api/rest/v1/public/events/${this.eventId}/punches`;

      console.log(`Fetching from: ${url} with afterId=${this.lastPunchId}`);

      const params = {
        afterId: this.lastPunchId,
        projection: "simple",
        limit: 1000, // Max limit per request
      };

      const response = await axios.get(url, {
        headers: {
          // Correct authentication header for SportIdent
          apikey: this.apiKey,
          Accept: "application/json",
          "Content-Type": "application/json;charset=UTF-8",
        },
        params: params,
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Received ${response.data.length} punches`);

        if (response.data.length > 0) {
          console.log(
            "Sample punch data:",
            JSON.stringify(response.data[0], null, 2),
          );

          // Process each punch
          response.data.forEach((punch) => {
            this.emit("punch", punch);
            // Update lastPunchId to the highest ID for next poll
            if (punch.id && punch.id > this.lastPunchId) {
              this.lastPunchId = punch.id;
            }
          });

          console.log(`Updated lastPunchId to: ${this.lastPunchId}`);
        }
      } else {
        console.log("No new punches received");
      }
    } catch (error) {
      console.error("Error fetching punches:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      this.emit("error", error);
    }
  }

  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

// Main server setup
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.SPORTIDENT_PORT || 3002;

app.use(cors());
app.use(express.json());

// Your SportIdent credentials
const API_KEY =
  process.env.SPORTIDENT_API_KEY || "a1faa424-1379-794c-3963-b9bf47f2ed09";
const EVENT_ID = process.env.SPORTIDENT_EVENT_ID || "20636";

// Store received events
const receivedEvents = [];
let wsClient = null;
let httpClient = null;

// Initialize HTTP client (WebSocket not supported by SportIdent)
function initializeClients() {
  console.log(
    "⚠️  Note: SportIdent Center API does not support WebSocket connections.",
  );
  console.log(
    "🔄 Using HTTP polling approach as recommended by SportIdent documentation.",
  );

  // Use HTTP polling as the primary (and only) method
  httpClient = new SportIdentHTTPClient(API_KEY, EVENT_ID);

  httpClient.on("punch", (data) => {
    console.log("🎯 PUNCH EVENT (HTTP):", data);
    receivedEvents.push({
      type: "punch",
      source: "http",
      timestamp: new Date().toISOString(),
      data: data,
    });
  });

  httpClient.on("error", (error) => {
    console.error("❌ HTTP Client error:", error.message);
  });

  httpClient.start();
}

// REST API endpoints
app.get("/api/sportident/status", (req, res) => {
  res.json({
    status: "running",
    method: "HTTP Polling",
    wsSupported: false,
    httpPolling: httpClient ? true : false,
    eventId: EVENT_ID,
    apiEndpoint: `https://center-origin.sportident.com/api/rest/v1/public/events/${EVENT_ID}/punches`,
    eventsReceived: receivedEvents.length,
    lastPunchId: httpClient ? httpClient.lastPunchId : 0,
  });
});

app.get("/api/sportident/events", (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const since = parseInt(req.query.since) || 0;

  const events = receivedEvents.slice(-limit);
  res.json({
    events: events,
    total: receivedEvents.length,
  });
});

app.get("/api/sportident/punches", (req, res) => {
  const punches = receivedEvents.filter((e) => e.type === "punch");
  res.json({
    punches: punches,
    total: punches.length,
  });
});

// Clear events endpoint
app.delete("/api/sportident/events", (req, res) => {
  receivedEvents.length = 0;
  res.json({ message: "Events cleared" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "sportident-server",
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SportIdent Server running on http://localhost:${PORT}`);
  console.log(`📋 Event ID: ${EVENT_ID}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log("\nEndpoints:");
  console.log(`  Status: http://localhost:${PORT}/api/sportident/status`);
  console.log(`  Events: http://localhost:${PORT}/api/sportident/events`);
  console.log(`  Punches: http://localhost:${PORT}/api/sportident/punches`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log("\n🔄 Initializing SportIdent clients...\n");

  initializeClients();
});

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\nShutting down SportIdent server...");
  if (wsClient) {
    wsClient.disconnect();
  }
  if (httpClient) {
    httpClient.stop();
  }
  process.exit();
});
