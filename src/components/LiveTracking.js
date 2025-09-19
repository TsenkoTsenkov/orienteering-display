import React, { useState, useEffect, useRef } from 'react';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { countryFlags as flags } from '../data/flags';
import { SportIdentMockServer } from '../services/sportIdentService';
import './LiveTracking.css';

const LiveTracking = ({
  competitors,
  category,
  controlCode,
  controlName,
  sportIdentService,
  eventId
}) => {
  const [trackedCompetitors, setTrackedCompetitors] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const competitorMapRef = useRef(new Map());
  const mockServerRef = useRef(null);

  // Build competitor map by card number
  useEffect(() => {
    const map = new Map();
    competitors.forEach(comp => {
      if (comp.card) {
        map.set(parseInt(comp.card), comp);
      }
    });
    competitorMapRef.current = map;

    // Initialize tracked competitors from existing data
    const initialTracked = competitors
      .filter(comp => comp.splits && comp.splits[`control${controlCode}`])
      .map(comp => ({
        ...comp,
        splitTime: comp.splits[`control${controlCode}`],
        punchTime: Date.now() - 1000000, // Old punch
        isNew: false
      }))
      .sort((a, b) => {
        // Sort by split time
        const timeA = parseSplitTime(a.splitTime);
        const timeB = parseSplitTime(b.splitTime);
        return timeA - timeB;
      });

    setTrackedCompetitors(initialTracked);
  }, [competitors, controlCode]);

  // Initialize demo mode if needed
  useEffect(() => {
    const isDemoMode = !eventId || eventId === 'demo';

    if (isDemoMode && !mockServerRef.current) {
      console.log('[LiveTracking] Initializing demo mode for control', controlCode);
      mockServerRef.current = new SportIdentMockServer();

      // Initialize with current competitors
      const competitorsWithCards = competitors.map((comp, index) => ({
        ...comp,
        card: comp.card || (8000000 + index * 100 + Math.floor(Math.random() * 99)),
        category
      }));

      mockServerRef.current.initializeDemoEvent(competitorsWithCards, [controlCode]);
      mockServerRef.current.startSimulation(20); // Speed up simulation for demo

      // Set the mock server in the service
      sportIdentService.setDemoMode(true, mockServerRef.current);
    }

    return () => {
      if (isDemoMode && mockServerRef.current) {
        mockServerRef.current.stopSimulation();
        sportIdentService.setDemoMode(false);
      }
    };
  }, [eventId, controlCode, competitors, category, sportIdentService]);

  // Handle incoming punch events
  useEffect(() => {
    if (!sportIdentService) return;

    const handlePunch = (punch) => {
      // Find competitor by card number
      const competitor = competitorMapRef.current.get(punch.card);
      if (!competitor) {
        console.log(`[LiveTracking] Unknown card: ${punch.card}`);
        return;
      }

      // Calculate split time
      const splitTime = calculateSplitTime(competitor.startTime, punch.time);

      console.log(`[LiveTracking] ${competitor.name} punched at ${controlName}: ${splitTime}`);

      // Update tracked competitors
      setTrackedCompetitors(prev => {
        // Check if competitor already tracked
        const existing = prev.find(c => c.id === competitor.id);
        if (existing) {
          // Update existing entry
          return prev.map(c =>
            c.id === competitor.id
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

        // Mark all others as not new after a delay
        setTimeout(() => {
          setTrackedCompetitors(current =>
            current.map(c => ({ ...c, isNew: false }))
          );
        }, 3000);

        return updated;
      });

      setLastUpdateTime(Date.now());
    };

    // Start polling for this control
    const effectiveEventId = eventId || 'demo';
    console.log(`[LiveTracking] Starting polling for control ${controlCode} (${controlName}) on event ${effectiveEventId}`);
    sportIdentService.startPolling(effectiveEventId, controlCode, handlePunch, 3000);

    return () => {
      sportIdentService.stopPolling(effectiveEventId, controlCode);
    };
  }, [sportIdentService, eventId, controlCode, controlName]);

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

    // Parse start time
    const startParts = startTime.split(':');
    const startHours = parseInt(startParts[0]) || 0;
    const startMinutes = parseInt(startParts[1]) || 0;
    const startSeconds = parseInt(startParts[2]) || 0;

    const startMs = (startHours * 3600 + startMinutes * 60 + startSeconds) * 1000;

    // Calculate difference
    const diffMs = punchTime - startMs;
    if (diffMs < 0) return '--:--';

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  // Format rank difference
  const formatRankDiff = (diff) => {
    if (!diff || diff === 0) return '';
    if (diff > 0) return `+${diff}`;
    return `${diff}`;
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

      <div className="tracking-list">
        <div className="tracking-header">
          <div className="rank-col">Rank</div>
          <div className="name-col">Competitor</div>
          <div className="time-col">Time</div>
          <div className="diff-col">Diff</div>
        </div>

        <TransitionGroup className="tracking-body">
          {trackedCompetitors.map((comp, index) => (
            <CSSTransition
              key={comp.id}
              timeout={500}
              classNames="competitor-row"
            >
              <div className={`tracking-row ${comp.isNew ? 'new-punch' : ''} ${index === 0 ? 'leader' : ''}`}>
                <div className="rank-col">
                  <span className="rank-number">{index + 1}</span>
                  {comp.previousRank && comp.previousRank !== index + 1 && (
                    <span className={`rank-change ${comp.previousRank > index + 1 ? 'up' : 'down'}`}>
                      {formatRankDiff(comp.previousRank - (index + 1))}
                    </span>
                  )}
                </div>
                <div className="name-col">
                  <img
                    src={flags[comp.country] || flags.UNK}
                    alt={comp.country}
                    className="flag-icon"
                  />
                  <span className="competitor-name">{comp.name}</span>
                  {comp.bib && <span className="bib-number">#{comp.bib}</span>}
                </div>
                <div className="time-col">
                  <span className="split-time">{comp.splitTime}</span>
                </div>
                <div className="diff-col">
                  <span className="time-diff">{getTimeDiff(comp.splitTime, leaderTime)}</span>
                </div>
              </div>
            </CSSTransition>
          ))}
        </TransitionGroup>

        {trackedCompetitors.length === 0 && (
          <div className="no-data">
            <p>Waiting for competitors to reach {controlName}...</p>
            <div className="pulse-indicator"></div>
          </div>
        )}
      </div>

      <div className="tracking-footer">
        <div className="stats">
          <span>{trackedCompetitors.length} / {competitors.length} passed</span>
        </div>
        <div className="control-info">
          Control Code: {controlCode}
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;