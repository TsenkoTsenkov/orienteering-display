import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const SplitTimesPaginated = ({ competitors, category, controlPoint, sceneTitle, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [mounted, setMounted] = useState(false);
  const remainingItemsPerPage = Math.max(2, itemsPerPage - 1); // Leader is always shown
  const pageDuration = rotationInterval || 15000; // Use rotation interval from props or default (15 seconds)

  const getCompetitorsWithSplits = () => {
    const controlKey = `control${controlPoint}`;

    return competitors
      .filter(c => c.splits && c.splits[controlKey])
      .map(c => ({
        ...c,
        splitTime: c.splits[controlKey]
      }))
      .sort((a, b) => {
        const parseTime = (t) => {
          const parts = t.split(':');
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        };
        return parseTime(a.splitTime) - parseTime(b.splitTime);
      })
      .map((c, index) => ({
        ...c,
        splitRank: index + 1
      }));
  };

  const competitorsWithSplits = getCompetitorsWithSplits();
  const leader = competitorsWithSplits[0];
  const remaining = competitorsWithSplits.slice(1);

  // Calculate total pages for remaining competitors
  const totalPages = remaining.length > 0
    ? Math.ceil(remaining.length / remainingItemsPerPage)
    : 1; // Always at least 1 page to show leader
  const bestSplitTime = leader?.splitTime;

  // Determine page to show based on mode
  let pageToShow = 0;

  if (totalPages > 0) {
    if (currentPageIndex !== undefined) {
      // External control mode (live)
      pageToShow = currentPageIndex % totalPages;
    } else {
      // Internal control mode (preview)
      pageToShow = currentPage;
    }
  }

  // Track mount status
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle internal rotation for preview mode only
  useEffect(() => {
    // Skip if not mounted, external control or only 1 page
    if (!mounted || currentPageIndex !== undefined || totalPages <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage(prev => (prev + 1) % totalPages);
    }, pageDuration);

    return () => clearInterval(interval);
  }, [mounted, totalPages, pageDuration, currentPageIndex]);

  const startIndex = pageToShow * remainingItemsPerPage;
  const currentRemainingCompetitors = remaining.slice(startIndex, startIndex + remainingItemsPerPage);
  const currentCompetitors = leader ? [leader, ...currentRemainingCompetitors] : currentRemainingCompetitors;

  const getTimeDifference = (time, bestTime) => {
    if (!time || !bestTime || time === bestTime) return '';

    const parseTime = (t) => {
      const parts = t.split(':');
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    };

    const diff = parseTime(time) - parseTime(bestTime);
    const minutes = Math.floor(diff / 60);
    const seconds = (diff % 60).toFixed(0).padStart(2, '0');

    return `+${minutes}:${seconds}`;
  };

  return (
    <div className="scene-container split-times paginated">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">{sceneTitle || `CONTROL POINT ${controlPoint}`}</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className={`competitors-list-paginated items-${itemsPerPage}`}>
        <div className="list-header split-header">
          <span className="header-rank">POS</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">SPLIT TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        <div className="page-transition">
          {currentCompetitors.map((competitor, index) => (
            <React.Fragment key={competitor.id}>
              <div
                className={`competitor-row split-row large-row ${competitor.splitRank === 1 ? 'leader' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <span className="rank large-rank">
                  {competitor.splitRank === 1 && <span className="leader-icon">👑</span>}
                  <span className="rank-number">{competitor.splitRank}</span>
                </span>
                <span className="competitor-name large-name">{competitor.name.toUpperCase()}</span>
                <span className="competitor-country">
                  <span className="country-flag large-flag">{getFlag(competitor.country)}</span>
                  <span className="country-code">{competitor.country}</span>
                </span>
                <span className="split-time large-time">{competitor.splitTime}</span>
                <span className="time-diff large-diff">
                  {getTimeDifference(competitor.splitTime, bestSplitTime)}
                </span>
              </div>
              {/* Add separator line after leader */}
              {competitor.splitRank === 1 && currentRemainingCompetitors.length > 0 && (
                <div className="top-three-separator-line"></div>
              )}
            </React.Fragment>
          ))}
        </div>

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
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">CX80 MTBO World Cup LONG</div>
        {totalPages > 1 && (
          <div className="page-info">
            Page {pageToShow + 1} of {totalPages}
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitTimesPaginated;