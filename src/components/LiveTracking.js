import React, { useState, useEffect, useRef } from 'react';
import { getFlag } from '../data/flags';
import './LiveTracking.css';

const LiveTracking = ({
  competitors,
  category,
  controlCode,
  controlName,
  sportIdentService,
  eventId,
  autoRotate,
  currentPageIndex,
  rotationInterval,
  setCurrentPageIndex,
  itemsPerPage = 10
}) => {
  const [trackedCompetitors, setTrackedCompetitors] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [currentPage, setCurrentPage] = useState(0);
  const [showNewCompetitorPage, setShowNewCompetitorPage] = useState(false);
  const [newCompetitorPageIndex, setNewCompetitorPageIndex] = useState(0);
  const competitorMapRef = useRef(new Map());

  // Build competitor map by card number - filtered by category
  useEffect(() => {
    const map = new Map();
    competitors.forEach((comp, index) => {
      // Use existing card or generate consistent card for demo
      const cardNumber = comp.card || (8000000 + index * 100);
      // Make sure to preserve the ID and category!
      map.set(cardNumber, { ...comp, id: comp.id, card: cardNumber, category: category });
    });
    competitorMapRef.current = map;
    console.log(`[LiveTracking] Built competitor map for ${category} with ${map.size} entries`);
    // Log first few entries for debugging
    const entries = Array.from(map.entries()).slice(0, 3);
    entries.forEach(([card, comp]) => {
      console.log(`[LiveTracking] Card ${card} -> ${comp.name} (${category}, ID: ${comp.id})`);
    });

    // In demo mode, don't initialize from splits (they don't exist)
    // The mock server will generate initial punches
    const isDemoMode = !eventId || eventId === 'demo';
    if (!isDemoMode) {
      // Initialize tracked competitors from existing data - only for this category
      const initialTracked = competitors
        .filter(comp => comp.splits && comp.splits[`control${controlCode}`])
        .map(comp => ({
          ...comp,
          splitTime: comp.splits[`control${controlCode}`],
          punchTime: Date.now() - 1000000, // Old punch
          isNew: false,
          category: category // Ensure category is set
        }))
        .sort((a, b) => {
          // Sort by split time
          const timeA = parseSplitTime(a.splitTime);
          const timeB = parseSplitTime(b.splitTime);
          return timeA - timeB;
        });

      setTrackedCompetitors(initialTracked);
    } else {
      // Clear for demo mode - will be populated by mock server
      setTrackedCompetitors([]);
    }
  }, [competitors, controlCode, category]);

  // Initialize demo mode and handle polling
  useEffect(() => {
    if (!sportIdentService) return;

    const isDemoMode = !eventId || eventId === 'demo';
    const effectiveEventId = eventId || 'demo';

    // Initialize demo mode if needed (only once per control)
    if (isDemoMode) {
      console.log('[LiveTracking] Setting up demo mode for control', controlCode);

      // Enable demo mode and initialize
      sportIdentService.setDemoMode(true);
      sportIdentService.initializeDemo(competitors, controlCode);
    }

    const handlePunch = (punch) => {
      console.log(`[LiveTracking] Received punch from card ${punch.card} at control ${punch.code}`);

      // Find competitor by card number - make sure card is a number
      const cardNumber = typeof punch.card === 'string' ? parseInt(punch.card) : punch.card;
      const competitor = competitorMapRef.current.get(cardNumber);
      if (!competitor) {
        console.log(`[LiveTracking] Unknown card: ${cardNumber}, available cards:`, Array.from(competitorMapRef.current.keys()).slice(0, 5));
        return;
      }
      console.log(`[LiveTracking] Found competitor:`, competitor);

      // Calculate split time
      const splitTime = calculateSplitTime(competitor.startTime, punch.time);

      console.log(`[LiveTracking] ${competitor.name} punched at control ${punch.code}: ${splitTime}`);

      // Update tracked competitors
      setTrackedCompetitors(prev => {
        // Check if competitor already tracked by card number
        const existing = prev.find(c => c.card === competitor.card);
        if (existing) {
          // Update existing entry
          return prev.map(c =>
            c.card === competitor.card
              ? { ...c, splitTime, punchTime: punch.time, isNew: true }
              : { ...c, isNew: false }
          ).sort((a, b) => {
            const timeA = parseSplitTime(a.splitTime);
            const timeB = parseSplitTime(b.splitTime);
            return timeA - timeB;
          });
        }

        // Add new entry
        const newEntry = {
          ...competitor,
          splitTime,
          punchTime: punch.time,
          isNew: true,
          rank: 0 // Will be calculated after sort
        };

        const updated = [...prev, newEntry].sort((a, b) => {
          const timeA = parseSplitTime(a.splitTime);
          const timeB = parseSplitTime(b.splitTime);
          return timeA - timeB;
        });

        // Update ranks
        updated.forEach((comp, index) => {
          comp.rank = index + 1;
        });

        // Find which page the new competitor is on
        const newCompIndex = updated.findIndex(c => c.card === newEntry.card);
        const newCompPage = Math.floor(newCompIndex / itemsPerPage);

        // Jump to the page with the new competitor
        setNewCompetitorPageIndex(newCompPage);
        setShowNewCompetitorPage(true);

        // After showing the new competitor, resume normal rotation
        setTimeout(() => {
          setShowNewCompetitorPage(false);
          setTrackedCompetitors(current =>
            current.map(c => ({ ...c, isNew: false }))
          );
        }, 5000); // Show new competitor for 5 seconds

        return updated;
      });

      setLastUpdateTime(Date.now());
    };

    // Start polling for this control
    console.log(`[LiveTracking] Starting polling for control ${controlCode} (${controlName}) on event ${effectiveEventId}`);
    sportIdentService.startPolling(effectiveEventId, controlCode, handlePunch, 3000);

    return () => {
      console.log(`[LiveTracking] Cleaning up polling for control ${controlCode}`);
      sportIdentService.stopPolling(effectiveEventId, controlCode);
      // Don't stop the mock server - let it persist across component remounts
    };
  }, [sportIdentService, eventId, controlCode, controlName, competitors]);

  // Parse split time string to seconds
  const parseSplitTime = (timeStr) => {
    if (!timeStr) return 999999;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 999999;
  };

  // Calculate split time from start time and punch time
  const calculateSplitTime = (startTime, punchTime) => {
    if (!startTime || !punchTime) return '--:--';

    // For demo mode, just generate a reasonable split time
    // Real implementation would calculate based on actual times
    const baseTime = 5 * 60; // 5 minutes base
    const variation = Math.floor(Math.random() * 120); // up to 2 minutes variation
    const totalSeconds = baseTime + variation;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  // Get time difference to leader
  const getTimeDiff = (splitTime, leaderTime) => {
    if (!splitTime || !leaderTime || splitTime === '--:--' || leaderTime === '--:--') return '';

    const time = parseSplitTime(splitTime);
    const leader = parseSplitTime(leaderTime);

    if (time === 999999 || leader === 999999) return '';

    const diff = time - leader;
    if (diff === 0) return '';

    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;

    if (minutes > 0) {
      return `+${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return `+${seconds}`;
  };

  const leaderTime = trackedCompetitors[0]?.splitTime;

  // Calculate total pages
  const totalPages = trackedCompetitors.length > 0
    ? Math.ceil(trackedCompetitors.length / itemsPerPage)
    : 1;

  // Determine page to show based on mode
  let pageToShow = 0;

  // If we have a new competitor, show their page temporarily
  if (showNewCompetitorPage) {
    pageToShow = newCompetitorPageIndex;
  } else if (currentPageIndex !== undefined) {
    // External control mode (live) - use the rotation system
    pageToShow = Math.min(currentPageIndex, totalPages - 1);
  } else {
    // Internal control mode (preview)
    pageToShow = currentPage % totalPages;
  }

  // Handle rotation - both for preview mode and when integrated with main rotation
  useEffect(() => {
    // Don't rotate when showing a new competitor
    if (showNewCompetitorPage) return;

    // For external control (when currentPageIndex is provided)
    if (currentPageIndex !== undefined && setCurrentPageIndex) {
      // Report total pages to the parent for proper rotation
      // This will be handled by the parent's rotation system
      return;
    }

    // Internal rotation for preview mode only
    if (!autoRotate || totalPages <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage(prev => (prev + 1) % totalPages);
    }, rotationInterval || 15000);

    return () => clearInterval(interval);
  }, [autoRotate, totalPages, rotationInterval, currentPageIndex, showNewCompetitorPage, setCurrentPageIndex]);

  // Get current page competitors
  const startIndex = pageToShow * itemsPerPage;
  const currentCompetitors = trackedCompetitors.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="live-tracking-container">
      <div className="scene-header">
        <h2>{controlName || `Control Point ${controlCode}`}</h2>
        <div className="category-label">{category}</div>
        {lastUpdateTime && (
          <div className="last-update">
            Live • Updated {new Date(lastUpdateTime).toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="competitors-list-paginated">
        <div className="list-header">
          <span className="header-rank">RANK</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        <div className="page-transition">
          {currentCompetitors.map((competitor, index) => {
            const actualRank = startIndex + index + 1;
            const isLeader = actualRank === 1;
            return (
              <React.Fragment key={competitor.card || `comp-${index}`}>
                <div
                  className={`competitor-row split-row large-row ${isLeader ? 'leader' : ''} ${competitor.isNew ? 'new-punch' : ''}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="rank large-rank">
                    <span className="rank-number">{actualRank}</span>
                  </span>
                  <span className="competitor-name large-name">{competitor.name.toUpperCase()}</span>
                  <span className="competitor-country">
                    <span className="country-flag large-flag">{getFlag(competitor.country)}</span>
                    <span className="country-code">{competitor.country}</span>
                  </span>
                  <span className="split-time large-time">{competitor.splitTime}</span>
                  <span className="time-diff large-diff">
                    {getTimeDiff(competitor.splitTime, leaderTime)}
                  </span>
                </div>
                {/* Add separator line after leader */}
                {isLeader && currentCompetitors.length > 1 && (
                  <div className="top-three-separator-line"></div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Add pagination indicator */}
        {totalPages > 1 && (
          <div className="pagination-indicator">
            {[...Array(totalPages)].map((_, i) => (
              <span
                key={i}
                className={`page-dot ${i === pageToShow ? 'active' : ''}`}
              />
            ))}
          </div>
        )}

        {currentCompetitors.length === 0 && trackedCompetitors.length === 0 && (
          <div className="no-data">
            <p>Waiting for competitors to reach {controlName}...</p>
            <div className="pulse-indicator"></div>
          </div>
        )}
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">CX80 MTBO World Cup LONG</div>
        {totalPages > 1 && (
          <div className="page-info">
            Page {pageToShow + 1} of {totalPages}
            {showNewCompetitorPage && <span style={{marginLeft: '10px', color: '#4CAF50'}}>• NEW</span>}
          </div>
        )}
        <div className="stats">
          {trackedCompetitors.length} / {competitors.length} passed
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;