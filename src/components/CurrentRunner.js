import React, { useEffect, useState } from 'react';
import { countryFlags } from '../data/flags';
import './SceneStyles.css';

const CurrentRunner = ({ competitors, category }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  const currentRunner = competitors.find(c => c.status === 'running');

  useEffect(() => {
    if (!currentRunner) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRunner]);

  if (!currentRunner) {
    return (
      <div className="scene-container current-runner">
        <div className="scene-header">
          <div className="header-accent"></div>
          <h2 className="scene-title">CURRENT RUNNER</h2>
          <div className="category-badge">{category}</div>
        </div>
        <div className="no-runner">
          <p>No runner currently on course</p>
        </div>
      </div>
    );
  }

  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
        <h2 className="scene-title">ON COURSE NOW</h2>
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
            <span className="time-label">ELAPSED TIME</span>
            <span className="time-value live-time">{formatElapsedTime(elapsedTime)}</span>
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