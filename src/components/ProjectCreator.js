import React, { useState } from 'react';
import liveResultsService from '../services/liveResultsService';
import './ProjectCreator.css';

const ProjectCreator = ({ onProjectCreated, onCancel }) => {
  const [projectName, setProjectName] = useState('');
  const [eventUrl, setEventUrl] = useState('');
  const [dataSource, setDataSource] = useState('liveresults'); // 'liveresults' or 'manual'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventData, setEventData] = useState(null);

  const handleFetchEvent = async () => {
    if (!eventUrl) {
      setError('Please enter an event URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await liveResultsService.fetchEventData(eventUrl);
      setEventData(data);
      if (!projectName && data.eventName) {
        setProjectName(data.eventName);
      }
    } catch (err) {
      setError('Failed to fetch event data. Please check the URL and try again.');
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    if (!projectName) {
      setError('Please enter a project name');
      return;
    }

    if (dataSource === 'liveresults' && !eventData) {
      setError('Please fetch event data first');
      return;
    }

    const project = {
      id: Date.now().toString(),
      name: projectName || eventData?.eventName || 'Untitled Project',
      dataSource,
      eventUrl: dataSource === 'liveresults' ? eventUrl : null,
      eventData: dataSource === 'liveresults' ? eventData : null,
      createdAt: new Date().toISOString()
    };

    onProjectCreated(project);
  };

  return (
    <div className="project-creator-overlay">
      <div className="project-creator-modal">
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Data Source</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  value="liveresults"
                  checked={dataSource === 'liveresults'}
                  onChange={(e) => setDataSource(e.target.value)}
                />
                <span>LiveResults.it Event</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  value="manual"
                  checked={dataSource === 'manual'}
                  onChange={(e) => setDataSource(e.target.value)}
                />
                <span>Manual Data (Demo)</span>
              </label>
            </div>
          </div>

          {dataSource === 'liveresults' && (
            <>
              <div className="form-group">
                <label>Event URL</label>
                <div className="url-input-group">
                  <input
                    type="text"
                    value={eventUrl}
                    onChange={(e) => setEventUrl(e.target.value)}
                    placeholder="https://app.liveresults.it/seemoc2025"
                    className="form-input"
                  />
                  <button
                    onClick={handleFetchEvent}
                    disabled={loading}
                    className="fetch-btn"
                  >
                    {loading ? 'Fetching...' : 'Fetch Event'}
                  </button>
                </div>
                <small className="help-text">
                  Enter a LiveResults.it event URL (e.g., https://app.liveresults.it/seemoc2025)
                </small>
              </div>

              {eventData && (
                <div className="event-preview">
                  <h4>Event Preview</h4>
                  <div className="preview-info">
                    <p><strong>Event:</strong> {eventData.eventName}</p>
                    <p><strong>Competitions:</strong> {eventData.competitions.length}</p>
                  </div>
                  <div className="competitions-list">
                    {eventData.competitions.map(comp => (
                      <div key={comp.id} className="competition-item">
                        <div className="comp-header">
                          <span className="comp-name">{comp.name}</span>
                          {comp.date && <span className="comp-date">{comp.date}</span>}
                          {comp.time && <span className="comp-time">{comp.time}</span>}
                        </div>
                        <div className="comp-stats">
                          <span>Men: {comp.men?.length || 0}</span>
                          <span>Women: {comp.women?.length || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleCreateProject}
            disabled={loading}
            className="btn-primary"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCreator;