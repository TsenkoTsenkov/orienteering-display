import React, { useEffect, useState } from 'react';
import { countryFlags } from '../data/flags';
import './SceneStyles.css';

const CurrentRunner = ({ competitors, category, sceneTitle, selectedCompetitorId }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // If a specific competitor is selected, use them, otherwise find a running competitor
  const currentRunner = selectedCompetitorId
    ? competitors.find(c => c.id === selectedCompetitorId)
    : competitors.find(c => c.status === 'running');

  useEffect(() => {
    if (!currentRunner || !currentRunner.startTime) return;

    // If competitor has finished, don't calculate elapsed time
    if (currentRunner.time) {
      setElapsedTime(0);
      return;
    }

    const calculateElapsedTime = () => {
      // Parse the start time (format: "HH:MM:SS")
      const startTimeParts = currentRunner.startTime.split(':');
      const startHours = parseInt(startTimeParts[0], 10);
      const startMinutes = parseInt(startTimeParts[1], 10);
      const startSeconds = parseInt(startTimeParts[2] || 0, 10);

      // Get current time
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();

      // Calculate elapsed time in seconds
      const startTotalSeconds = startHours * 3600 + startMinutes * 60 + startSeconds;
      const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

      let elapsed = currentTotalSeconds - startTotalSeconds;

      // Handle case where race crosses midnight
      if (elapsed < 0) {
        elapsed += 24 * 3600; // Add 24 hours worth of seconds
      }

      return Math.max(0, elapsed);
    };

    // Calculate initial elapsed time
    setElapsedTime(calculateElapsedTime());

    // Update every second
    const interval = setInterval(() => {
      setElapsedTime(calculateElapsedTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRunner]);

  if (!currentRunner) {
    return (
      <div className="scene-container current-runner">
        <div className="scene-header">
          <div className="header-accent"></div>
          <h2 className="scene-title">{sceneTitle || 'CURRENT RUNNER'}</h2>
          <div className="category-badge">{category}</div>
        </div>
        <div className="no-runner">
          <p>{selectedCompetitorId ? 'Selected competitor not found' : 'No runner currently on course'}</p>
        </div>
      </div>
    );
  }

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLastSplit = () => {
    const splits = currentRunner.splits;
    if (!splits || Object.keys(splits).length === 0) return null;

    const splitKeys = Object.keys(splits).sort();
    const lastKey = splitKeys[splitKeys.length - 1];
    return {
      control: lastKey.replace('control', ''),
      time: splits[lastKey]
    };
  };

  const lastSplit = getLastSplit();

  const getProjectedPosition = () => {
    if (!lastSplit) return null;

    const controlKey = `control${lastSplit.control}`;
    const competitorsAtControl = competitors
      .filter(c => c.splits && c.splits[controlKey])
      .sort((a, b) => {
        const parseTime = (t) => {
          const parts = t.split(':');
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        };
        return parseTime(a.splits[controlKey]) - parseTime(b.splits[controlKey]);
      });

    const position = competitorsAtControl.findIndex(c =>
      c.id === currentRunner.id
    ) + 1;

    return position > 0 ? position : null;
  };

  const projectedPosition = getProjectedPosition();

  return (
    <div className="scene-container current-runner">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">{currentRunner.time ? 'FINISHED' : 'ON COURSE NOW'}</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="runner-spotlight">
        <div className="runner-info">
          <div className="runner-country">
            <span className="large-flag">{countryFlags[currentRunner.country]}</span>
            <span className="country-name">{currentRunner.country}</span>
          </div>
          <h1 className="runner-name">{currentRunner.name.toUpperCase()}</h1>
        </div>

        <div className="time-display">
          <div className="elapsed-time">
            <span className="time-label">{currentRunner.time ? 'FINISH TIME' : 'ELAPSED TIME'}</span>
            <span className="time-value live-time">{currentRunner.time || formatElapsedTime(elapsedTime)}</span>
          </div>

          {lastSplit && (
            <div className="last-split">
              <span className="split-label">CONTROL {lastSplit.control}</span>
              <span className="split-value">{lastSplit.time}</span>
              {projectedPosition && (
                <span className="projected-position">
                  Currently {projectedPosition === 1 ? '1st' : projectedPosition === 2 ? '2nd' : projectedPosition === 3 ? '3rd' : `${projectedPosition}th`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="start-time-info">
          <span className="start-label">START TIME</span>
          <span className="start-value">{currentRunner.startTime}</span>
        </div>
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">ORIENTEERING WORLD CUP 2024</div>
        <div className="live-indicator">
          <span className="live-dot"></span>
          LIVE
        </div>
      </div>
    </div>
  );
};

export default CurrentRunner;