import React, { useState, useEffect } from 'react';
import { getFlag } from '../data/flags';
import './SceneStyles.css';

const StartListPaginated = ({ competitors, category, sceneTitle, autoRotate, rotationPaused, currentPageIndex, rotationInterval, setCurrentPageIndex, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [mounted, setMounted] = useState(false);
  const pageDuration = rotationInterval || 10000; // Use rotation interval from props or default (10 seconds)

  // Filter for not_started status, but if no status field exists, include all
  const upcomingCompetitors = competitors.filter(c => {
    // If no status field or status is 'not_started', include the competitor
    return !c.status || c.status === 'not_started';
  });

  // Calculate total pages
  const totalPages = upcomingCompetitors.length > 0
    ? Math.ceil(upcomingCompetitors.length / itemsPerPage)
    : 1; // At least 1 page even if empty

  // Determine page to show based on mode
  let pageToShow = 0;

  if (currentPageIndex !== undefined) {
    // External control mode (live)
    pageToShow = Math.min(currentPageIndex, totalPages - 1);
  } else {
    // Internal control mode (preview)
    pageToShow = currentPage % totalPages;
  }

  console.log('[StartListPaginated] Total competitors:', competitors.length,
    'Filtered (not_started):', upcomingCompetitors.length,
    'Category:', category,
    'CurrentPageIndex:', currentPageIndex,
    'PageToShow:', pageToShow,
    'TotalPages:', totalPages);

  // Track mount status
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle internal rotation for preview mode only
  useEffect(() => {
    // Skip if not mounted, external control or no pages
    if (!mounted || currentPageIndex !== undefined || totalPages <= 1 || upcomingCompetitors.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPage(prev => {
        const next = (prev + 1) % totalPages;
        console.log('[StartListPaginated Internal] Rotating from', prev, 'to', next, 'of', totalPages);
        return next;
      });
    }, pageDuration);

    return () => clearInterval(interval);
  }, [mounted, totalPages, pageDuration, currentPageIndex, upcomingCompetitors.length]);

  const startIndex = pageToShow * itemsPerPage;
  const currentCompetitors = upcomingCompetitors.slice(startIndex, startIndex + itemsPerPage);

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
                className={`page-dot ${i === pageToShow ? 'active' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">CX80 MTBO World Cup SPRINT</div>
        {totalPages > 1 && (
          <div className="page-info">
            Page {pageToShow + 1} of {totalPages}
          </div>
        )}
      </div>
    </div>
  );
};

export default StartListPaginated;