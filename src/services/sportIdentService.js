import axios from 'axios';
import { getSportIdentEndpoints } from '../config/sportident';

class SportIdentService {
  constructor() {
    // Use Netlify functions endpoints instead of direct API
    const endpoints = getSportIdentEndpoints();
    this.pollEndpoint = endpoints.poll;
    this.punchesEndpoint = endpoints.punches;

    // For backward compatibility, keep baseUrl but use it only as fallback
    this.baseUrl = 'https://center-origin.sportident.com/api/rest/v1/public';
    this.pollingIntervals = new Map();
    this.lastPunchIds = new Map();
    this.globalLastPunchId = 0; // Track global last punch ID for API
    this.punchCache = new Map();
    this.listeners = new Map();
    this.pollCounts = new Map();
    this.lastHeartbeat = Date.now();

    console.log('[SportIdent] Service initialized with endpoints:', { poll: this.pollEndpoint, punches: this.punchesEndpoint });

    // For development/demo mode
    this.demoMode = false;
    this.demoServer = null;
  }

  // Parse SportIdent event ID from URL or direct ID
  parseEventId(input) {
    if (typeof input === 'number') return input;
    if (typeof input === 'string' && /^\d+$/.test(input)) return parseInt(input);

    // Try to extract from URL
    const match = input.match(/events\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // Fetch punches from SportIdent API
  async fetchPunches(eventId, afterId = null) {
    try {
      // Always use demo mode if eventId is demo or empty
      const isDemoMode = !eventId || eventId === 'demo';

      console.log(`[SportIdent] fetchPunches called for event ${eventId}, isDemoMode: ${isDemoMode}, hasDemoServer: ${!!this.demoServer}`);

      // In demo mode, use mock server
      if (isDemoMode || (this.demoMode && this.demoServer)) {
        if (this.demoServer) {
          console.log('[SportIdent] Using mock server for fetching');
          return await this.demoServer.fetchPunches(afterId);
        }
        console.warn('[SportIdent] Demo mode but no mock server initialized');
        return [];
      }

      // Use Netlify function endpoint if available
      const useNetlifyFunction = this.pollEndpoint && !this.pollEndpoint.includes('localhost');
      let url;
      let params;

      if (useNetlifyFunction) {
        // Use Netlify function
        url = this.pollEndpoint;
        params = {
          afterId: afterId || 0,
          limit: 1000,
          includeAll: false
        };
        console.log('[SportIdent] Using Netlify function:', url);
      } else {
        // Fallback to direct API
        url = `${this.baseUrl}/events/${eventId}/punches`;
        params = afterId ? { afterId } : {};
        console.log('[SportIdent] Using direct API:', url);
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });

      // Handle Netlify function response format
      if (useNetlifyFunction && response.data) {
        console.log('[SportIdent] Netlify function response received');

        // Update global lastPunchId if provided
        if (response.data.lastPunchId && response.data.lastPunchId > this.globalLastPunchId) {
          this.globalLastPunchId = response.data.lastPunchId;
          console.log(`[SportIdent] Updated global lastPunchId to: ${this.globalLastPunchId}`);
        }

        // Extract punches from the response
        if (response.data.punches && Array.isArray(response.data.punches)) {
          // Return just the punch data (not the wrapper)
          return response.data.punches.map(p => p.data || p);
        }
        return [];
      }

      return response.data || [];
    } catch (error) {
      console.error('Error fetching punches:', error);
      return [];
    }
  }

  // Start polling for a specific control point
  startPolling(eventId, controlCode, onPunchReceived, interval = 5000) {
    // Use demo mode if no eventId
    const effectiveEventId = eventId || 'demo';
    const pollingKey = `${effectiveEventId}-${controlCode}`;

    // Stop any existing polling for this control
    this.stopPolling(effectiveEventId, controlCode);

    // Initialize global last punch ID if needed
    const isDemoMode = !eventId || eventId === 'demo';
    if (isDemoMode && this.globalLastPunchId === 0) {
      // For demo mode, set initial ID to current timestamp to only get new punches
      this.globalLastPunchId = Date.now() - 1;
      console.log(`[SportIdent] Initializing global lastPunchId for demo mode to ${this.globalLastPunchId}`);
    }

    // Store the listener
    if (!this.listeners.has(pollingKey)) {
      this.listeners.set(pollingKey, []);
    }
    this.listeners.get(pollingKey).push(onPunchReceived);

    const poll = async () => {
      try {
        // Increment poll count
        const currentCount = (this.pollCounts.get(pollingKey) || 0) + 1;
        this.pollCounts.set(pollingKey, currentCount);

        // Log heartbeat every 6 polls (30 seconds at 5-second intervals)
        const now = Date.now();
        if (currentCount % 6 === 0 || now - this.lastHeartbeat > 30000) {
          console.log(`[HEARTBEAT] SportIdent Service Active - ${new Date().toISOString()}`);
          console.log(`[HEARTBEAT] Active polls: ${this.pollingIntervals.size}, Event: ${effectiveEventId}, Control: ${controlCode}`);
          console.log(`[HEARTBEAT] Poll count for ${pollingKey}: ${currentCount}, Listeners: ${(this.listeners.get(pollingKey) || []).length}`);
          this.lastHeartbeat = now;
        }

        // Use global lastPunchId for API, not per-control
        const lastId = this.globalLastPunchId;
        console.log(`[SportIdent] Polling #${currentCount} for control ${controlCode}, global lastId: ${lastId}, time: ${new Date().toISOString()}`);
        const punches = await this.fetchPunches(effectiveEventId, lastId);
        console.log(`[SportIdent] Poll #${currentCount} returned ${punches ? punches.length : 0} punches`);

        if (punches && punches.length > 0) {
          console.log(`[SportIdent] NEW DATA: Received ${punches.length} punches for event ${effectiveEventId} at ${new Date().toISOString()}`);

          // Always update global last punch ID from all punches received
          const punchIds = punches.map(p => p.id).filter(id => id > 0);
          if (punchIds.length > 0) {
            const maxId = Math.max(...punchIds);
            if (maxId > this.globalLastPunchId) {
              this.globalLastPunchId = maxId;
              console.log(`[SportIdent] Updated global lastPunchId to ${this.globalLastPunchId} after receiving ${punches.length} punches`);
            }
          }

          // Filter punches for the specific control code
          const relevantPunches = punches.filter(p =>
            p.code === controlCode ||
            (controlCode === 'all' || controlCode === null)
          );

          console.log(`[SportIdent] FILTERED: ${relevantPunches.length} relevant punches for control ${controlCode}`);

          if (relevantPunches.length > 0) {

            // Cache punches
            if (!this.punchCache.has(pollingKey)) {
              this.punchCache.set(pollingKey, []);
            }
            const cache = this.punchCache.get(pollingKey);
            cache.push(...relevantPunches);

            // Keep cache size reasonable (last 100 punches)
            if (cache.length > 100) {
              cache.splice(0, cache.length - 100);
            }

            // Notify all listeners for this control
            const listeners = this.listeners.get(pollingKey) || [];
            console.log(`[SportIdent] NOTIFY: Broadcasting to ${listeners.length} listeners for ${pollingKey}`);
            listeners.forEach(listener => {
              relevantPunches.forEach(punch => {
                console.log(`[SportIdent] PUNCH: Card ${punch.card} at control ${punch.code}`);
                listener(punch);
              });
            });
          }
        }
      } catch (error) {
        console.error(`[ERROR] Polling failed for control ${controlCode} at ${new Date().toISOString()}:`, error.message);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, interval);
    this.pollingIntervals.set(pollingKey, intervalId);

    console.log(`[SportIdent] ✅ Started polling for control ${controlCode} on event ${effectiveEventId} at ${new Date().toISOString()}`);
    console.log(`[SportIdent] Polling interval: ${interval}ms, Initial lastId: ${this.lastPunchIds.get(pollingKey)}`);
    return intervalId;
  }

  // Stop polling for a specific control point
  stopPolling(eventId, controlCode) {
    const effectiveEventId = eventId || 'demo';
    const pollingKey = `${effectiveEventId}-${controlCode}`;
    const intervalId = this.pollingIntervals.get(pollingKey);

    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(pollingKey);
      const pollCount = this.pollCounts.get(pollingKey) || 0;
      console.log(`[SportIdent] ⛔ Stopped polling for ${pollingKey} after ${pollCount} polls at ${new Date().toISOString()}`);
      this.pollCounts.delete(pollingKey);
    }

    // Clear listeners
    const listenerCount = (this.listeners.get(pollingKey) || []).length;
    this.listeners.delete(pollingKey);
    if (listenerCount > 0) {
      console.log(`[SportIdent] Cleared ${listenerCount} listeners for ${pollingKey}`);
    }
  }

  // Stop all polling
  stopAllPolling() {
    this.pollingIntervals.forEach(intervalId => clearInterval(intervalId));
    this.pollingIntervals.clear();
    this.listeners.clear();
  }

  // Get cached punches for a control
  getCachedPunches(eventId, controlCode) {
    const pollingKey = `${eventId}-${controlCode}`;
    return this.punchCache.get(pollingKey) || [];
  }

  // Calculate split time from start
  calculateSplitTime(startTime, punchTime) {
    if (!startTime || !punchTime) return null;

    // Convert times to milliseconds if needed
    const start = typeof startTime === 'string' ? this.parseTime(startTime) : startTime;
    const punch = typeof punchTime === 'number' ? punchTime : this.parseTime(punchTime);

    if (!start || !punch) return null;

    const diff = punch - start;
    return this.formatTime(diff);
  }

  // Parse time string to milliseconds
  parseTime(timeStr) {
    if (!timeStr) return null;

    // Handle HH:MM:SS format
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseInt(parts[2]);

      const date = new Date();
      date.setHours(hours, minutes, seconds, 0);
      return date.getTime();
    }

    // Handle timestamp
    if (/^\d+$/.test(timeStr)) {
      return parseInt(timeStr);
    }

    return null;
  }

  // Format milliseconds to MM:SS or HH:MM:SS
  formatTime(ms) {
    if (!ms || ms < 0) return '--:--';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  // Set demo mode
  setDemoMode(enabled, mockServer = null) {
    this.demoMode = enabled;

    // Create a new mock server if needed
    if (enabled && !mockServer && !this.demoServer) {
      console.log('[SportIdent] Creating internal mock server');
      this.demoServer = new SportIdentMockServer();
    } else if (mockServer) {
      this.demoServer = mockServer;
    }

    if (enabled) {
      console.log('[SportIdent] Demo mode enabled with server:', !!this.demoServer);
    }
  }

  // Initialize demo with competitors
  initializeDemo(competitors, controlCode) {
    if (!this.demoMode) {
      this.setDemoMode(true);
    }

    // Only initialize if not already running for this control
    if (!this.demoServer || !this.demoServer.simulationInterval || this.lastControlCode !== controlCode) {
      console.log('[SportIdent] Initializing demo with', competitors.length, 'competitors for control', controlCode);

      // Reset for new control
      if (this.demoServer) {
        this.demoServer.reset();
      } else {
        this.demoServer = new SportIdentMockServer();
      }

      // Clear cached punch IDs for demo
      this.lastPunchIds.clear();
      this.punchCache.clear();

      // Add consistent card numbers
      const competitorsWithCards = competitors.map((comp, index) => ({
        ...comp,
        card: comp.card || (8000000 + index * 100)
      }));

      this.demoServer.initializeDemoEvent(competitorsWithCards, [controlCode]);
      this.demoServer.startSimulation(5); // Slower speed for more realistic timing
      this.lastControlCode = controlCode;
    }
  }

  // Clear all data
  clearCache() {
    this.punchCache.clear();
    this.lastPunchIds.clear();
  }
}

// Create mock/demo server for testing
export class SportIdentMockServer {
  constructor() {
    this.punches = [];
    this.currentId = Date.now(); // Use timestamp to avoid ID conflicts
    this.runners = [];
    this.startTime = null;
    this.simulationInterval = null;
    this.eventCallbacks = [];
  }

  // Initialize demo event with competitors
  initializeDemoEvent(competitors, controls = [33, 38]) {
    console.log('[Mock Server] initializeDemoEvent called with', competitors.length, 'competitors');

    // Reset punches for fresh start
    this.punches = [];

    this.runners = competitors.map((comp, index) => {
      // Use the card number provided by the competitor object, or generate consistent one
      const card = comp.card || (8000000 + index * 100);
      // Each runner has a different time to reach the control
      const timeToControl = (2 + index * 0.5 + Math.random() * 1) * 60 * 1000; // 2-7 minutes spread
      console.log(`[Mock Server] Runner ${index}: ${comp.name} will reach control in ${Math.round(timeToControl/1000)}s`);
      return {
        ...comp,
        card: card,
        startTimeMs: this.parseStartTime(comp.startTime),
        currentPosition: 'start',
        controlsSplit: this.generateRandomSplits(controls.length),
        timeToControl: timeToControl
      };
    });

    this.controls = controls;
    this.startTime = Date.now();

    console.log('[Mock Server] Initialized with', this.runners.length, 'runners');
    console.log('[Mock Server] Controls:', controls);
    console.log('[Mock Server] Will generate punches starting from ID:', this.currentId);
  }

  // Parse start time to milliseconds from start
  parseStartTime(timeStr) {
    if (!timeStr) return 0;

    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;

      // Convert to milliseconds from 00:00:00
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    return 0;
  }

  // Generate random split times for controls (as percentages of total time)
  generateRandomSplits(numControls) {
    const splits = [];
    let cumulative = 0;

    for (let i = 0; i < numControls; i++) {
      // Each control takes 20-40% of remaining time
      const remaining = 100 - cumulative;
      const split = 20 + Math.random() * 20;
      const actualSplit = Math.min(split, remaining / (numControls - i));
      splits.push(actualSplit);
      cumulative += actualSplit;
    }

    // Add finish
    splits.push(100 - cumulative);

    return splits;
  }

  // Start simulation
  startSimulation(speedMultiplier = 10) {
    if (this.simulationInterval) {
      console.log('[Mock Server] Simulation already running, clearing old interval');
      clearInterval(this.simulationInterval);
    }

    console.log('[Mock Server] Starting simulation with speed multiplier:', speedMultiplier);
    console.log('[Mock Server] Runners:', this.runners.length, 'Controls:', this.controls);

    // For demo, start all runners immediately (ignore actual start times)
    const demoStartTime = Date.now();
    this.startTime = demoStartTime;

    let simulationTick = 0;
    const checkInterval = 1000; // Check every second
    this.simulationInterval = setInterval(() => {
      simulationTick++;
      const elapsed = simulationTick * 1000 * speedMultiplier; // Use tick count instead of real time

      // Log every 5 seconds
      if (simulationTick % 5 === 0) {
        console.log(`[Mock Server] Simulation tick ${simulationTick}, elapsed: ${Math.round(elapsed/1000)}s`);
      }

      this.runners.forEach((runner, runnerIndex) => {
        // Use each runner's individual time to control
        if (elapsed >= runner.timeToControl && !runner[`passed_control0`]) {
          // Runner has reached the first control
          if (this.controls.length > 0) {
            const punch = this.generatePunch(runner, this.controls[0], 'BcControl', Date.now());
            runner[`passed_control0`] = true;
            console.log(`[Mock] ${runner.name} reached control after ${Math.round(elapsed/1000)}s (simulated), punch ID: ${punch.id}`);
          }
        }
      });
    }, checkInterval);

    console.log('[Mock Server] Simulation started - runners will arrive gradually');
  }

  // Generate a punch event
  generatePunch(runner, controlCode, mode, elapsed) {
    const punch = {
      id: this.currentId++,
      modem: null,
      card: runner.card,
      time: Date.now(),
      code: controlCode,
      mode: mode,
      receptionTime: Date.now() - 500 + Math.random() * 1000,
      // Add runner info for display
      runnerName: runner.name,
      runnerCountry: runner.country,
      runnerCategory: runner.category
    };

    this.punches.push(punch);
    console.log(`[Mock] Generated PUNCH #${punch.id}: ${runner.name} (card: ${runner.card}) at control ${controlCode}, total punches: ${this.punches.length}`);

    // Notify callbacks
    this.eventCallbacks.forEach(cb => cb(punch));

    return punch;
  }

  // Fetch punches (mock API)
  async fetchPunches(afterId = null) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    console.log(`[Mock Server] fetchPunches called with afterId: ${afterId}, punches available: ${this.punches.length}`);

    // Return new punches since afterId (or none if no afterId)
    const newPunches = afterId ? this.punches.filter(p => p.id > afterId) : [];

    if (newPunches.length > 0) {
      console.log(`[Mock Server] Returning ${newPunches.length} new punches after ID ${afterId}:`,
        newPunches.map(p => `${p.runnerName}(${p.card})`).join(', '));
    } else {
      console.log(`[Mock Server] No new punches to return`);
    }

    return newPunches;
  }

  // Subscribe to punch events
  onPunch(callback) {
    this.eventCallbacks.push(callback);
  }

  // Stop simulation
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  // Reset simulation
  reset() {
    console.log('[Mock Server] Resetting simulation');
    this.stopSimulation();
    this.punches = [];
    this.currentId = Date.now(); // Use timestamp to avoid ID conflicts
    this.runners = [];
    this.eventCallbacks = [];
  }
}

const sportIdentService = new SportIdentService();
export default sportIdentService;