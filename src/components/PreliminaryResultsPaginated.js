import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const PreliminaryResultsPaginated = ({ competitors, category, sceneTitle, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [mounted, setMounted] = useState(false);
  // First place is always shown, so actual items per page for remaining is reduced by 1
  const remainingItemsPerPage = Math.max(2, itemsPerPage - 1);
  const pageDuration = rotationInterval || 15000; // Use rotation interval from props or default (15 seconds)

  const finishedCompetitors = (competitors || [])
    .filter(c => c.status === 'finished' && c.rank && c.finalTime)
    .sort((a, b) => a.rank - b.rank);

  // Debug logging for women's results
  if (category === 'Women' && finishedCompetitors.length > 0) {
    console.log(`[PreliminaryResultsPaginated] Women's results - Total: ${finishedCompetitors.length}, First: ${finishedCompetitors[0]?.name} (${finishedCompetitors[0]?.finalTime})`);
  }

  // Split into first place and the rest
  const firstPlace = finishedCompetitors[0];
  const remaining = finishedCompetitors.slice(1);

  // Calculate total pages for remaining competitors
  const totalPages = remaining.length > 0
    ? Math.ceil(remaining.length / remainingItemsPerPage)
    : 1; // Always at least 1 page to show first place

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
    // Skip if not mounted, external control, or only 1 page
    if (!mounted || currentPageIndex !== undefined || totalPages <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage(prev => (prev + 1) % totalPages);
    }, pageDuration);

    return () => clearInterval(interval);
  }, [mounted, totalPages, pageDuration, currentPageIndex]);

  const startIndex = pageToShow * remainingItemsPerPage;
  const endIndex = startIndex + remainingItemsPerPage;
  const currentRemainingCompetitors = remaining.slice(startIndex, endIndex);

  // Combine first place with current page of remaining competitors
  const displayCompetitors = firstPlace ? [firstPlace, ...currentRemainingCompetitors] : currentRemainingCompetitors;
  const bestTime = finishedCompetitors[0]?.finalTime;

  const formatTime = (time) => {
    if (!time) return '--:--:--';
    return time;
  };

  const getTimeDifference = (time, bestTime) => {
    if (!time || !bestTime) return '';
    if (time === bestTime) return ''; // Leader has no diff

    const parseTime = (t) => {
      if (!t || typeof t !== 'string') return 0;

      const parts = t.split(':');
      if (parts.length === 2) {
        // MM:SS format
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
      } else if (parts.length === 3) {
        // HH:MM:SS format
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
      }
      return 0;
    };

    const timeSec = parseTime(time);
    const bestTimeSec = parseTime(bestTime);
    const diff = timeSec - bestTimeSec;

    if (diff <= 0) return ''; // Should not happen, but guard against negative diff

    const minutes = Math.floor(diff / 60);
    const seconds = Math.round(diff % 60).toString().padStart(2, '0');

    return `+${minutes}:${seconds}`;
  };

  // Don't render until properly mounted and we have data
  if (!mounted && currentPageIndex === undefined) {
    return null;
  }

  // Don't render if no finished competitors
  if (finishedCompetitors.length === 0) {
    return (
      <div className="scene-container results paginated preliminary">
        <div className="scene-header">
          <div className="header-accent"></div>
          <h2 className="scene-title">{sceneTitle || 'PRELIMINARY RESULTS'}</h2>
          <div className="category-badge">{category}</div>
        </div>
        <div className="no-results-message" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          No finished competitors yet
        </div>
      </div>
    );
  }

  return (
    <div className="scene-container results paginated preliminary">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">{sceneTitle || 'PRELIMINARY RESULTS'}</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className={`competitors-list-paginated items-${itemsPerPage}`}>
        <div className="list-header results-header">
          <span className="header-rank">RANK</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        <div className="page-transition">
          {displayCompetitors.map((competitor, index) => (
            <React.Fragment key={competitor.id}>
              <div
                className={`competitor-row result-row large-row ${competitor.rank === 1 ? 'leader' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <span className="rank large-rank">
                  {/* No medals for preliminary results */}
                  <span className="rank-number">{competitor.rank}</span>
                </span>
                <span className="competitor-name large-name">{competitor.name.toUpperCase()}</span>
                <span className="competitor-country">
                  <span className="country-flag large-flag">{getFlag(competitor.country)}</span>
                  <span className="country-code">{competitor.country}</span>
                </span>
                <span className="final-time large-time">{formatTime(competitor.finalTime)}</span>
                <span className="time-diff large-diff">
                  {getTimeDifference(competitor.finalTime, bestTime)}
                </span>
              </div>
              {/* Add separator line after first place */}
              {competitor.rank === 1 && currentRemainingCompetitors.length > 0 && (
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
            Page {pageToShow + 1} of {totalPages} (showing ranks {2 + startIndex}-{Math.min(finishedCompetitors.length, 1 + endIndex)})
          </div>
        )}
      </div>
    </div>
  );
};

export default PreliminaryResultsPaginated;