import axios from 'axios';

class SportIdentService {
  constructor() {
    this.baseUrl = 'https://center-origin.sportident.com/api/rest/v1/public';
    this.pollingIntervals = new Map();
    this.lastPunchIds = new Map();
    this.punchCache = new Map();
    this.listeners = new Map();

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

      // In demo mode, use mock server
      if (isDemoMode || (this.demoMode && this.demoServer)) {
        if (this.demoServer) {
          return this.demoServer.fetchPunches(afterId);
        }
        console.warn('[SportIdent] Demo mode but no mock server initialized');
        return [];
      }

      const url = `${this.baseUrl}/events/${eventId}/punches`;
      const params = afterId ? { afterId } : {};

      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });

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

    // Initialize last punch ID if not set
    if (!this.lastPunchIds.has(pollingKey)) {
      this.lastPunchIds.set(pollingKey, null);
    }

    // Store the listener
    if (!this.listeners.has(pollingKey)) {
      this.listeners.set(pollingKey, []);
    }
    this.listeners.get(pollingKey).push(onPunchReceived);

    const poll = async () => {
      try {
        const lastId = this.lastPunchIds.get(pollingKey);
        const punches = await this.fetchPunches(effectiveEventId, lastId);

        if (punches && punches.length > 0) {
          // Filter punches for the specific control code
          const relevantPunches = punches.filter(p =>
            p.code === controlCode ||
            (controlCode === 'all' || controlCode === null)
          );

          if (relevantPunches.length > 0) {
            // Update last punch ID
            const maxId = Math.max(...punches.map(p => p.id));
            this.lastPunchIds.set(pollingKey, maxId);

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
            listeners.forEach(listener => {
              relevantPunches.forEach(punch => listener(punch));
            });
          }
        }
      } catch (error) {
        console.error(`Polling error for control ${controlCode}:`, error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, interval);
    this.pollingIntervals.set(pollingKey, intervalId);

    console.log(`[SportIdent] Started polling for control ${controlCode} on event ${effectiveEventId}`);
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
    }

    // Clear listeners
    this.listeners.delete(pollingKey);
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
    this.demoServer = mockServer;

    if (enabled) {
      console.log('[SportIdent] Demo mode enabled');
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
    this.currentId = 1000;
    this.runners = [];
    this.startTime = null;
    this.simulationInterval = null;
    this.eventCallbacks = [];
  }

  // Initialize demo event with competitors
  initializeDemoEvent(competitors, controls = [33, 38]) {
    this.runners = competitors.map((comp, index) => ({
      ...comp,
      card: 8000000 + index * 100 + Math.floor(Math.random() * 99),
      startTimeMs: this.parseStartTime(comp.startTime),
      currentPosition: 'start',
      controlsSplit: this.generateRandomSplits(controls.length)
    }));

    this.controls = controls;
    this.startTime = Date.now();

    console.log('[Mock Server] Initialized with', this.runners.length, 'runners and controls:', controls);
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
      clearInterval(this.simulationInterval);
    }

    console.log('[Mock Server] Starting simulation with speed multiplier:', speedMultiplier);

    const checkInterval = 1000; // Check every second
    this.simulationInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) * speedMultiplier;

      this.runners.forEach(runner => {
        // Check if runner should have started
        if (elapsed >= runner.startTimeMs) {
          const runnerElapsed = elapsed - runner.startTimeMs;

          // Simulate runner progress (typical time 35-45 minutes)
          const totalTime = (35 + Math.random() * 10) * 60 * 1000; // in ms
          const progress = Math.min(runnerElapsed / totalTime * 100, 100);

          // Check control passages
          let cumulativeSplit = 0;
          for (let i = 0; i < this.controls.length; i++) {
            cumulativeSplit += runner.controlsSplit[i];

            if (progress >= cumulativeSplit && runner.currentPosition !== `control${i}`) {
              // Runner has reached this control
              this.generatePunch(runner, this.controls[i], 'BcControl', elapsed);
              runner.currentPosition = `control${i}`;
            }
          }

          // Check finish
          if (progress >= 95 && runner.currentPosition !== 'finish') {
            this.generatePunch(runner, 21, 'BcFinish', elapsed);
            runner.currentPosition = 'finish';
          }
        }
      });
    }, checkInterval);
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

    // Notify callbacks
    this.eventCallbacks.forEach(cb => cb(punch));

    console.log(`[Mock] PUNCH: ${runner.name} at control ${controlCode} (${mode})`);

    return punch;
  }

  // Fetch punches (mock API)
  async fetchPunches(afterId = null) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    if (afterId) {
      return this.punches.filter(p => p.id > afterId);
    }

    return this.punches.slice(-10); // Return last 10 punches if no afterId
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
    this.stopSimulation();
    this.punches = [];
    this.currentId = 1000;
    this.runners = [];
    this.eventCallbacks = [];
  }
}

const sportIdentService = new SportIdentService();
export default sportIdentService;