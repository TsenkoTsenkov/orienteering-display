import React from "react";
import { countryFlags } from "../data/flags";
import "./SceneStyles.css";

const RunnerPreStart = ({
  competitors,
  category,
  sceneTitle,
  selectedCompetitorId,
}) => {
  // If a specific competitor is selected, use them, otherwise find the next starter
  const selectedRunner = selectedCompetitorId
    ? competitors.find((c) => c.id === selectedCompetitorId)
    : competitors.find((c) => c.status === "not_started");

  if (!selectedRunner) {
    return (
      <div className="scene-container current-runner">
        <div className="scene-header">
          <div className="header-accent"></div>
          <h2 className="scene-title">{sceneTitle || "RUNNER - PRE START"}</h2>
          <div className="category-badge">{category}</div>
        </div>
        <div className="no-runner">
          <p>
            {selectedCompetitorId
              ? "Selected competitor not found"
              : "No upcoming runner found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-container current-runner compact">
      <div className="compact-runner-display">
        <div className="runner-left">
          {selectedRunner.bib && (
            <span className="bib-number">#{selectedRunner.bib}</span>
          )}
          <div className="flag-country-group">
            <span className="flag-compact">
              {countryFlags[selectedRunner.country]}
            </span>
            <span className="country-code">{selectedRunner.country}</span>
          </div>
          <span className="runner-name-compact">
            {selectedRunner.name.toUpperCase()}
          </span>
        </div>

        <div className="runner-center">
          {selectedRunner.startTime && (
            <span className="start-time-display">
              <span className="time-label-pre">START TIME</span>
              <span className="time-value-pre">{selectedRunner.startTime}</span>
            </span>
          )}
        </div>

        <div className="runner-right">
          <span className="pre-start-badge">AT START</span>
        </div>
      </div>
    </div>
  );
};

export default RunnerPreStart;
