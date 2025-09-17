import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const StartListPaginated = ({ competitors, category, sceneTitle, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const pageDuration = rotationInterval || 10000; // Use rotation interval from props or default (10 seconds)

  const upcomingCompetitors = competitors
    .filter(c => c.status === 'not_started');

  // Ensure we have at least 1 page if we have any competitors
  const totalPages = upcomingCompetitors.length > 0
    ? Math.ceil(upcomingCompetitors.length / itemsPerPage)
    : 1;

  // Determine which page to show (use external control in live mode)
  const pageToShow = currentPageIndex !== undefined
    ? (totalPages > 0 ? currentPageIndex % totalPages : 0)
    : currentPage;

  // Sync with external page control when in live mode
  useEffect(() => {
    if (setCurrentPageIndex !== undefined && currentPageIndex !== undefined) {
      const newPage = totalPages > 0 ? currentPageIndex % totalPages : 0;
      console.log('[StartListPaginated] External page control - currentPageIndex:', currentPageIndex, 'newPage:', newPage, 'totalPages:', totalPages);
      setCurrentPage(newPage);
    } else if (currentPageIndex !== undefined) {
      // Display mode: no setter, just currentPageIndex
      const newPage = totalPages > 0 ? currentPageIndex % totalPages : 0;
      console.log('[StartListPaginated] Display mode - currentPageIndex:', currentPageIndex, 'newPage:', newPage, 'totalPages:', totalPages);
      setCurrentPage(newPage);
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

  const startIndex = pageToShow * itemsPerPage;
  const currentCompetitors = upcomingCompetitors.slice(startIndex, startIndex + itemsPerPage);

  // Safeguard: If we somehow have no competitors to show, show the first page
  if (currentCompetitors.length === 0 && upcomingCompetitors.length > 0) {
    const fallbackCompetitors = upcomingCompetitors.slice(0, itemsPerPage);
    return (
      <div className="scene-container start-list paginated">
        <div className="scene-header">
          <div className="header-accent"></div>
          <h2 className="scene-title">{sceneTitle || 'START LIST'}</h2>
          <div className="category-badge">{category}</div>
        </div>

        <div className={`competitors-list-paginated items-${itemsPerPage}`}>
          <div className="list-header">
            <span className="header-time">START TIME</span>
            <span className="header-name">NAME</span>
            <span className="header-country">NATION</span>
          </div>

          <div className="page-transition">
            {fallbackCompetitors.map((competitor, index) => (
              <div
                key={competitor.id}
                className={`competitor-row large-row ${index === 0 ? 'next-starter' : ''}`}
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
        </div>
      </div>
    );
  }

  return (
    <div className="scene-container start-list paginated">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">{sceneTitle || 'START LIST'}</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className={`competitors-list-paginated items-${itemsPerPage}`}>
        <div className="list-header">
          <span className="header-time">START TIME</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
        </div>

        <div className="page-transition">
          {currentCompetitors.map((competitor, index) => (
            <div
              key={competitor.id}
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