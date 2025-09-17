import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const ResultsPaginated = ({ competitors, category, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 8;
  const pageDuration = rotationInterval || 5000; // Use rotation interval from props or default

  const finishedCompetitors = competitors
    .filter(c => c.status === 'finished' && c.rank)
    .sort((a, b) => a.rank - b.rank);

  const totalPages = Math.ceil(finishedCompetitors.length / itemsPerPage);

  // Sync with external page control when in live mode
  useEffect(() => {
    if (setCurrentPageIndex !== undefined && currentPageIndex !== undefined) {
      setCurrentPage(currentPageIndex % Math.max(1, totalPages));
    }
  }, [currentPageIndex, totalPages, setCurrentPageIndex]);

  // Handle auto-rotation for preview mode only
  useEffect(() => {
    // Only auto-rotate in preview mode (when setCurrentPageIndex is undefined)
    if (setCurrentPageIndex !== undefined) return;
    if (totalPages <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage(prev => (prev + 1) % totalPages);
    }, pageDuration);

    return () => clearInterval(interval);
  }, [totalPages, pageDuration, setCurrentPageIndex]);

  const startIndex = currentPage * itemsPerPage;
  const currentCompetitors = finishedCompetitors.slice(startIndex, startIndex + itemsPerPage);
  const bestTime = finishedCompetitors[0]?.finalTime;

  const formatTime = (time) => {
    if (!time) return '--:--:--';
    return time;
  };

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
    <div className="scene-container results paginated">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">RESULTS</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="competitors-list-paginated">
        <div className="list-header results-header">
          <span className="header-rank">RANK</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        <div className="page-transition">
          {currentCompetitors.map((competitor, index) => (
            <div
              key={`${currentPage}-${competitor.id}`}
              className={`competitor-row result-row large-row ${competitor.rank <= 3 ? `rank-${competitor.rank}` : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <span className="rank large-rank">
                {competitor.rank === 1 && <span className="medal gold">🥇</span>}
                {competitor.rank === 2 && <span className="medal silver">🥈</span>}
                {competitor.rank === 3 && <span className="medal bronze">🥉</span>}
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
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination-indicator">
            {[...Array(totalPages)].map((_, i) => (
              <span
                key={i}
                className={`page-dot ${i === currentPage ? 'active' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">ORIENTEERING WORLD CUP 2024</div>
        {totalPages > 1 && (
          <div className="page-info">
            Page {currentPage + 1} of {totalPages}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPaginated;