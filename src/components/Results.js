import React from 'react';
import { countryFlags } from '../data/flags';
import './SceneStyles.css';

const Results = ({ competitors, category }) => {
  const finishedCompetitors = competitors
    .filter(c => c.status === 'finished' && c.rank)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);

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

  const bestTime = finishedCompetitors[0]?.finalTime;

  return (
    <div className="scene-container results">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">RESULTS</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="competitors-list">
        <div className="list-header results-header">
          <span className="header-rank">RANK</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        {finishedCompetitors.map((competitor, index) => (
          <div
            key={competitor.id}
            className={`competitor-row result-row ${competitor.rank <= 3 ? `rank-${competitor.rank}` : ''}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span className="rank">
              {competitor.rank === 1 && <span className="medal gold">🥇</span>}
              {competitor.rank === 2 && <span className="medal silver">🥈</span>}
              {competitor.rank === 3 && <span className="medal bronze">🥉</span>}
              {competitor.rank}
            </span>
            <span className="competitor-name">{competitor.name.toUpperCase()}</span>
            <span className="competitor-country">
              <span className="country-flag">{countryFlags[competitor.country]}</span>
              <span className="country-code">{competitor.country}</span>
            </span>
            <span className="final-time">{formatTime(competitor.finalTime)}</span>
            <span className="time-diff">
              {getTimeDifference(competitor.finalTime, bestTime)}
            </span>
          </div>
        ))}
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">CX80 MTBO World Cup LONG</div>
      </div>
    </div>
  );
};

export default Results;