import React from "react";
import { countryFlags } from "../data/flags";
import "./SceneStyles.css";

const SplitTimes = ({ competitors, category, controlPoint }) => {
  const getCompetitorsWithSplits = () => {
    const controlKey = `control${controlPoint}`;

    return competitors
      .filter((c) => c.splits && c.splits[controlKey])
      .map((c) => ({
        ...c,
        splitTime: c.splits[controlKey],
      }))
      .sort((a, b) => {
        const parseTime = (t) => {
          const parts = t.split(":");
          return (
            parseInt(parts[0]) * 3600 +
            parseInt(parts[1]) * 60 +
            parseFloat(parts[2])
          );
        };
        return parseTime(a.splitTime) - parseTime(b.splitTime);
      })
      .map((c, index) => ({
        ...c,
        splitRank: index + 1,
      }))
      .slice(0, 10);
  };

  const competitorsWithSplits = getCompetitorsWithSplits();
  const bestSplitTime = competitorsWithSplits[0]?.splitTime;

  const getTimeDifference = (time, bestTime) => {
    if (!time || !bestTime || time === bestTime) return "";

    const parseTime = (t) => {
      const parts = t.split(":");
      return (
        parseInt(parts[0]) * 3600 +
        parseInt(parts[1]) * 60 +
        parseFloat(parts[2])
      );
    };

    const diff = parseTime(time) - parseTime(bestTime);
    const minutes = Math.floor(diff / 60);
    const seconds = (diff % 60).toFixed(0).padStart(2, "0");

    return `+${minutes}:${seconds}`;
  };

  return (
    <div className="scene-container split-times">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">CONTROL POINT {controlPoint}</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="competitors-list">
        <div className="list-header split-header">
          <span className="header-rank">POS</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
          <span className="header-time">SPLIT TIME</span>
          <span className="header-diff">DIFF</span>
        </div>

        {competitorsWithSplits.map((competitor, index) => (
          <div
            key={competitor.id}
            className={`competitor-row split-row ${competitor.splitRank === 1 ? "leader" : ""}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span className="rank">
              {competitor.splitRank === 1 && (
                <span className="leader-icon">👑</span>
              )}
              {competitor.splitRank}
            </span>
            <span className="competitor-name">
              {competitor.name.toUpperCase()}
            </span>
            <span className="competitor-country">
              <span className="country-flag">
                {countryFlags[competitor.country]}
              </span>
              <span className="country-code">{competitor.country}</span>
            </span>
            <span className="split-time">{competitor.splitTime}</span>
            <span className="time-diff">
              {getTimeDifference(competitor.splitTime, bestSplitTime)}
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

export default SplitTimes;
