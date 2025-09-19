import React from "react";
import { countryFlags } from "../data/flags";
import "./SceneStyles.css";

const StartList = ({ competitors, category }) => {
  const upcomingCompetitors = competitors
    .filter((c) => !c.status || c.status === "not_started")
    .slice(0, 10);

  return (
    <div className="scene-container start-list">
      <div className="scene-header">
        <div className="header-accent"></div>
        <h2 className="scene-title">START LIST</h2>
        <div className="category-badge">{category}</div>
      </div>

      <div className="competitors-list">
        <div className="list-header">
          <span className="header-time">START TIME</span>
          <span className="header-name">NAME</span>
          <span className="header-country">NATION</span>
        </div>

        {upcomingCompetitors.map((competitor, index) => (
          <div
            key={competitor.id}
            className={`competitor-row ${index === 0 ? "next-starter" : ""}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span className="start-time">{competitor.startTime}</span>
            <span className="competitor-name">
              {competitor.name.toUpperCase()}
            </span>
            <span className="competitor-country">
              <span className="country-flag">
                {countryFlags[competitor.country]}
              </span>
              <span className="country-code">{competitor.country}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="scene-footer">
        <div className="broadcast-logo">CX80 MTBO World Cup SPRINT</div>
      </div>
    </div>
  );
};

export default StartList;
