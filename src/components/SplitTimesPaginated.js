import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const SplitTimesPaginated = ({ competitors, category, controlPoint, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 8;
  const pageDuration = rotationInterval || 5000; // Use rotation interval from props or default

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
  const totalPages = Math.ceil(competitorsWithSplits.length / itemsPerPage);
  const bestSplitTime = competitorsWithSplits[0]?.splitTime;

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
  const currentCompetitors = competitorsWithSplits.slice(startIndex, startIndex + itemsPerPage);

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
        <h2 className="scene-title">CONTROL POINT {controlPoint}</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="competitors-list-paginated">
        <div className="list-header split-header">
          <span className="header-rank">POS</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">SPLIT TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        <div className="page-transition">
          {currentCompetitors.map((competitor, index) => (
            <div
              key={`${currentPage}-${competitor.id}`}
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

export default SplitTimesPaginated;