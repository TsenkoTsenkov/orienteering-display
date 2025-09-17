import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const StartListPaginated = ({ competitors, category, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 8;
  const pageDuration = rotationInterval || 5000; // Use rotation interval from props or default

  const upcomingCompetitors = competitors
    .filter(c => c.status === 'not_started');

  const totalPages = Math.ceil(upcomingCompetitors.length / itemsPerPage);

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
  const currentCompetitors = upcomingCompetitors.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="scene-container start-list paginated">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">START LIST</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="competitors-list-paginated">
        <div className="list-header">
          <span className="header-time">START TIME</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
        </div>

        <div className="page-transition">
          {currentCompetitors.map((competitor, index) => (
            <div
              key={`${currentPage}-${competitor.id}`}
              className={`competitor-row large-row ${index === 0 && currentPage === 0 ? 'next-starter' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <span className="start-time large-time">{competitor.startTime}</span>
              <span className="competitor-name large-name">{competitor.name.toUpperCase()}</span>
              <span className="competitor-country">
                <span className="country-flag large-flag">{getFlag(competitor.country)}</span>
                <span className="country-code">{competitor.country}</span>
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

export default StartListPaginated;