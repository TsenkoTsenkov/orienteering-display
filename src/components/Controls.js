import React, { useState } from 'react';
import { Settings, Monitor, Users, Timer, Trophy, MapPin, Play, Pause } from 'lucide-react';
import './Controls.css';

const Controls = ({
  category,
  setCategory,
  scene,
  setScene,
  controlPoint,
  setControlPoint,
  isDisplayMode,
  autoRotate,
  setAutoRotate,
  rotationInterval,
  setRotationInterval,
  onGoLive,
  customSceneNames,
  updateSceneName,
  sceneConfigs,
  updateSceneConfig
}) => {
  const [editingScene, setEditingScene] = useState(null);
  const [tempSceneName, setTempSceneName] = useState('');

  const scenes = [
    { id: 'start-list', name: customSceneNames['start-list'] || 'Start List', icon: <Users size={18} /> },
    { id: 'current-runner', name: customSceneNames['current-runner'] || 'Current Runner', icon: <Timer size={18} /> },
    { id: 'split-1', name: customSceneNames['split-1'] || 'Control 1', icon: <MapPin size={18} /> },
    { id: 'split-2', name: customSceneNames['split-2'] || 'Control 2', icon: <MapPin size={18} /> },
    { id: 'split-3', name: customSceneNames['split-3'] || 'Control 3', icon: <MapPin size={18} /> },
    { id: 'split-4', name: customSceneNames['split-4'] || 'Control 4', icon: <MapPin size={18} /> },
    { id: 'results', name: customSceneNames['results'] || 'Results', icon: <Trophy size={18} /> }
  ];


  const handleSceneChange = (sceneId) => {
    setScene(sceneId);
    if (sceneId.startsWith('split-')) {
      const point = parseInt(sceneId.split('-')[1]);
      setControlPoint(point);
    }
  };

  const handleStartEdit = (sceneId, currentName) => {
    setEditingScene(sceneId);
    setTempSceneName(currentName);
  };

  const handleSaveSceneName = () => {
    if (tempSceneName.trim()) {
      updateSceneName(editingScene, tempSceneName.trim());
    }
    setEditingScene(null);
    setTempSceneName('');
  };

  const handleCancelEdit = () => {
    setEditingScene(null);
    setTempSceneName('');
  };

  const toggleDisplayMode = () => {
    const newUrl = isDisplayMode
      ? window.location.href.replace('?display=true', '')
      : window.location.href + '?display=true';
    window.location.href = newUrl;
  };

  return (
    <div className="controls-container">
      <div className="controls-header">
        <Settings className="header-icon" />
        <h3>Broadcast Controls</h3>
      </div>

      <div className="control-section go-live-section">
        <button className="go-live-control-btn" onClick={onGoLive}>
          <span className="live-icon">📡</span>
          PUSH PREVIEW TO LIVE
        </button>
      </div>

      <div className="control-section">
        <h4>Preview Settings</h4>
        {sceneConfigs && sceneConfigs[scene] && (
          <div className="scene-config-controls">
            <div className="size-position-group">
              <div className="config-row">
                <label>Size:</label>
                <span className="config-value">
                  {Math.round(sceneConfigs[scene].size.width)} × {Math.round(sceneConfigs[scene].size.height)}
                </span>
              </div>
              <div className="config-row">
                <label>Position:</label>
                <div className="position-inputs">
                  <div className="position-input-group">
                    <label>X:</label>
                    <input
                      type="number"
                      value={Math.round(sceneConfigs[scene].position?.x || 0)}
                      onChange={(e) => {
                        const newX = parseInt(e.target.value) || 0;
                        updateSceneConfig(scene, null, { ...sceneConfigs[scene].position, x: newX });
                      }}
                      className="position-input"
                    />
                  </div>
                  <div className="position-input-group">
                    <label>Y:</label>
                    <input
                      type="number"
                      value={Math.round(sceneConfigs[scene].position?.y || 0)}
                      onChange={(e) => {
                        const newY = parseInt(e.target.value) || 0;
                        updateSceneConfig(scene, null, { ...sceneConfigs[scene].position, y: newY });
                      }}
                      className="position-input"
                    />
                  </div>
                </div>
              </div>
              <button
                className="reset-position-btn"
                onClick={() => updateSceneConfig(scene, null, { x: 0, y: 0 })}
              >
                Center Display
              </button>
            </div>
            <p className="config-hint">Click preview to resize. Each scene has its own size and position.</p>
          </div>
        )}
      </div>

      <div className="control-section">
        <h4>Category</h4>
        <div className="category-buttons">
          <button
            className={`control-btn ${category === 'Men' ? 'active' : ''}`}
            onClick={() => setCategory('Men')}
          >
            Men
          </button>
          <button
            className={`control-btn ${category === 'Women' ? 'active' : ''}`}
            onClick={() => setCategory('Women')}
          >
            Women
          </button>
        </div>
      </div>

      <div className="control-section">
        <h4>Scene</h4>
        <div className="scene-buttons">
          {scenes.map(s => (
            <div key={s.id} className="scene-item">
              <button
                className={`scene-btn ${scene === s.id ? 'active' : ''}`}
                onClick={() => handleSceneChange(s.id)}
              >
                {s.icon}
                {editingScene === s.id ? (
                  <input
                    type="text"
                    value={tempSceneName}
                    onChange={(e) => setTempSceneName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSceneName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="scene-name-input"
                  />
                ) : (
                  <span onDoubleClick={() => handleStartEdit(s.id, s.name)}>{s.name}</span>
                )}
              </button>
              {editingScene === s.id && (
                <div className="edit-actions">
                  <button onClick={handleSaveSceneName} className="save-btn">✓</button>
                  <button onClick={handleCancelEdit} className="cancel-btn">✗</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="edit-hint">Double-click scene names to edit</p>
      </div>

      <div className="control-section">
        <h4>Auto Rotation</h4>
        <div className="rotation-controls">
          <button
            className={`rotation-btn ${autoRotate ? 'active' : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
          >
            {autoRotate ? <Pause size={18} /> : <Play size={18} />}
            {autoRotate ? 'Stop Rotation' : 'Start Rotation'}
          </button>
          <div className="rotation-interval">
            <label>Rotation Interval (seconds):</label>
            <select
              value={rotationInterval / 1000}
              onChange={(e) => setRotationInterval(parseInt(e.target.value) * 1000)}
              disabled={!autoRotate}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="30">30</option>
            </select>
          </div>
        </div>
      </div>

      <div className="control-section">
        <h4>View Mode</h4>
        <button
          className="display-mode-btn"
          onClick={toggleDisplayMode}
        >
          <Monitor size={18} />
          {isDisplayMode ? 'Exit Display Mode' : 'Enter Display Mode'}
        </button>
        <p className="mode-hint">
          {isDisplayMode
            ? 'Currently in display mode (for OBS capture)'
            : 'Display mode shows only the scene without controls'}
        </p>
      </div>

      <div className="obs-info">
        <h4>OBS Setup</h4>
        <ol>
          <li>Enter Display Mode</li>
          <li>Add Browser Source in OBS</li>
          <li>URL: {window.location.origin}?display=true</li>
          <li>Adjust size in preview editor</li>
        </ol>
      </div>
    </div>
  );
};

export default Controls;