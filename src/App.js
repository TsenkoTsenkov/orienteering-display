import React, { useState, useEffect } from 'react';
import StartListPaginated from './components/StartListPaginated';
import ResultsPaginated from './components/ResultsPaginated';
import SplitTimesPaginated from './components/SplitTimesPaginated';
import CurrentRunner from './components/CurrentRunner';
import Controls from './components/Controls';
import SimpleResizable from './components/SimpleResizable';
import menData from './data/menData.json';
import womenData from './data/womenData.json';
import './App.css';

function App() {
  // Load saved settings from localStorage - now per scene
  const loadSettings = () => {
    const saved = localStorage.getItem('orienteeringDisplaySettings');
    if (saved) {
      const settings = JSON.parse(saved);
      // Migrate old format if needed
      if (settings.displaySize && !settings.sceneConfigs) {
        return {
          sceneConfigs: {
            'results': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } },
            'start-list': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } },
            'current-runner': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } },
            'split-1': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } },
            'split-2': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } },
            'split-3': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } },
            'split-4': { size: settings.displaySize, position: settings.displayPosition || { x: 0, y: 0 } }
          },
          contentScale: settings.contentScale || 1
        };
      }
      return settings;
    }
    // Default settings with per-scene configurations
    const defaultSize = { width: 1280, height: 720 };
    const defaultPosition = { x: 0, y: 0 };
    return {
      sceneConfigs: {
        'results': { size: defaultSize, position: defaultPosition },
        'start-list': { size: defaultSize, position: defaultPosition },
        'current-runner': { size: defaultSize, position: defaultPosition },
        'split-1': { size: defaultSize, position: defaultPosition },
        'split-2': { size: defaultSize, position: defaultPosition },
        'split-3': { size: defaultSize, position: defaultPosition },
        'split-4': { size: defaultSize, position: defaultPosition }
      },
      contentScale: 1
    };
  };

  // Load saved live state from localStorage
  const loadLiveState = () => {
    const saved = localStorage.getItem('orienteeringLiveState');
    if (saved) {
      const state = JSON.parse(saved);
      // Add timestamp if missing
      if (!state.timestamp) {
        state.timestamp = Date.now();
      }
      return state;
    }
    return {
      category: 'Men',
      scene: 'results',
      controlPoint: 1,
      pageIndex: 0,
      timestamp: Date.now(),
      sceneConfig: { size: { width: 1280, height: 720 }, position: { x: 0, y: 0 } }
    };
  };

  const savedSettings = loadSettings();
  const savedLiveState = loadLiveState();

  // Preview state (what's being edited)
  const [previewCategory, setPreviewCategory] = useState('Men');
  const [previewScene, setPreviewScene] = useState('results');
  const [previewControlPoint, setPreviewControlPoint] = useState(1);

  // Live state (what's being broadcast) - Initialize from localStorage
  const [liveCategory, setLiveCategory] = useState(savedLiveState.category);
  const [liveScene, setLiveScene] = useState(savedLiveState.scene);
  const [liveControlPoint, setLiveControlPoint] = useState(savedLiveState.controlPoint);
  const [liveTimestamp, setLiveTimestamp] = useState(savedLiveState.timestamp);

  // Scene configurations (size and position per scene)
  const [sceneConfigs, setSceneConfigs] = useState(savedSettings.sceneConfigs);

  // Current preview size (depends on selected scene)
  const previewSize = sceneConfigs[previewScene]?.size || { width: 1280, height: 720 };
  const previewPosition = sceneConfigs[previewScene]?.position || { x: 0, y: 0 };

  // Live settings (what's actually displayed)
  const [liveSceneConfig, setLiveSceneConfig] = useState(savedLiveState.sceneConfig || sceneConfigs[savedLiveState.scene]);
  const [autoRotate, setAutoRotate] = useState(true); // Auto-rotation enabled by default
  const [rotationInterval, setRotationInterval] = useState(5000); // 5 seconds for page rotation
  const [rotationPaused, setRotationPaused] = useState(false);
  const [livePageIndex, setLivePageIndex] = useState(savedLiveState.pageIndex || 0);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [customSceneNames, setCustomSceneNames] = useState({
    'results': 'Results',
    'start-list': 'Start List',
    'current-runner': 'Current Runner',
    'split-1': 'Control Point 1',
    'split-2': 'Control Point 2',
    'split-3': 'Control Point 3',
    'split-4': 'Control Point 4'
  });

  const urlParams = new URLSearchParams(window.location.search);
  const isDisplayMode = urlParams.get('display') === 'true';

  // Save settings whenever scene configurations change
  useEffect(() => {
    const settings = {
      sceneConfigs,
      contentScale: 1
    };
    localStorage.setItem('orienteeringDisplaySettings', JSON.stringify(settings));
  }, [sceneConfigs]);

  // Save live state whenever it changes (only in control mode, not display mode)
  useEffect(() => {
    // Don't save if we're in display mode - display mode only reads
    if (isDisplayMode) return;

    const liveState = {
      category: liveCategory,
      scene: liveScene,
      controlPoint: liveControlPoint,
      pageIndex: livePageIndex,
      timestamp: liveTimestamp,
      sceneConfig: liveSceneConfig
    };

    // Save the complete state
    localStorage.setItem('orienteeringLiveState', JSON.stringify(liveState));

    // Also save a simple version number that increments
    const currentVersion = parseInt(localStorage.getItem('orienteeringVersion') || '0');
    localStorage.setItem('orienteeringVersion', (currentVersion + 1).toString());

    console.log('[Control] Saved state, version:', currentVersion + 1);

  }, [liveCategory, liveScene, liveControlPoint, livePageIndex, liveTimestamp, liveSceneConfig, isDisplayMode]);

  // Display mode - poll for changes and refresh when detected
  useEffect(() => {
    if (!isDisplayMode) return;

    console.log('[Display] Starting in display mode');
    let lastVersion = localStorage.getItem('orienteeringVersion') || '0';

    // Function to check for updates
    const checkForUpdates = () => {
      const currentVersion = localStorage.getItem('orienteeringVersion') || '0';

      if (currentVersion !== lastVersion) {
        console.log('[Display] Version changed from', lastVersion, 'to', currentVersion, '- reloading page');
        // Force a full page reload to ensure OBS picks up the changes
        window.location.reload();
      }
    };

    // Check every 500ms
    const interval = setInterval(checkForUpdates, 500);

    return () => clearInterval(interval);
  }, [isDisplayMode]);

  // Load initial state for display mode
  useEffect(() => {
    if (!isDisplayMode) return;

    const initialState = loadLiveState();
    console.log('[Display] Loading initial state:', initialState);
    setLiveCategory(initialState.category);
    setLiveScene(initialState.scene);
    setLiveControlPoint(initialState.controlPoint);
    setLivePageIndex(initialState.pageIndex || 0);
    setLiveSceneConfig(initialState.sceneConfig || { size: { width: 1280, height: 720 }, position: { x: 0, y: 0 } });
    setLiveTimestamp(initialState.timestamp || Date.now());
  }, [isDisplayMode]);

  // Auto-rotation effect for live pages
  useEffect(() => {
    if (!autoRotate || rotationPaused) return;

    // In display mode, we still need pagination but it's controlled by the live state
    if (isDisplayMode) return;

    const interval = setInterval(() => {
      setLivePageIndex(prev => prev + 1);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [autoRotate, rotationPaused, rotationInterval, isDisplayMode]);

  // Pass page rotation state to components
  const pageRotationState = {
    autoRotate,
    rotationPaused,
    currentPageIndex: livePageIndex,
    rotationInterval,
    setCurrentPageIndex: setLivePageIndex
  };

  const handleStopRotation = () => {
    setRotationPaused(true);
  };

  const handleResumeRotation = () => {
    setRotationPaused(false);
  };

  const handleRestartRotation = () => {
    setLivePageIndex(0);
    setRotationPaused(false);
  };

  const handleFullscreenPreview = () => {
    setIsFullscreenPreview(true);
  };

  const handleExitFullscreen = () => {
    setIsFullscreenPreview(false);
  };

  const updateSceneName = (sceneId, newName) => {
    setCustomSceneNames(prev => ({
      ...prev,
      [sceneId]: newName
    }));
  };

  const handleGoLive = () => {
    setLiveCategory(previewCategory);
    setLiveScene(previewScene);
    setLiveControlPoint(previewControlPoint);
    setLiveSceneConfig(sceneConfigs[previewScene]);
    setLiveTimestamp(Date.now());
    setLivePageIndex(0); // Reset to first page when pushing new content to live
  };

  // Update preview size when scene changes or config is modified
  const updateSceneConfig = (scene, newSize, newPosition) => {
    setSceneConfigs(prev => ({
      ...prev,
      [scene]: {
        size: newSize || prev[scene].size,
        position: newPosition || prev[scene].position
      }
    }));
  };

  const renderScene = (sceneType, categoryType, controlPt, isLive = false) => {
    const competitors = categoryType === 'Men' ? menData.competitors : womenData.competitors;
    const rotationProps = isLive ? pageRotationState : {};

    switch (sceneType) {
      case 'start-list':
        return <StartListPaginated competitors={competitors} category={categoryType} {...rotationProps} />;
      case 'results':
        return <ResultsPaginated competitors={competitors} category={categoryType} {...rotationProps} />;
      case 'current-runner':
        return <CurrentRunner competitors={competitors} category={categoryType} />;
      case 'split-1':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={1} {...rotationProps} />;
      case 'split-2':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={2} {...rotationProps} />;
      case 'split-3':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={3} {...rotationProps} />;
      case 'split-4':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={4} {...rotationProps} />;
      default:
        return <ResultsPaginated competitors={competitors} category={categoryType} {...rotationProps} />;
    }
  };

  if (isDisplayMode) {
    // Convert center-relative position to absolute position
    const displayWidth = liveSceneConfig?.size?.width || 1280;
    const displayHeight = liveSceneConfig?.size?.height || 720;
    const relativeX = liveSceneConfig?.position?.x || 0;
    const relativeY = liveSceneConfig?.position?.y || 0;

    // Calculate absolute position (center of screen + relative offset)
    const absoluteX = (window.innerWidth / 2) - (displayWidth / 2) + relativeX;
    const absoluteY = (window.innerHeight / 2) - (displayHeight / 2) + relativeY;

    return (
      <div className="app display-mode">
        <div
          className="display-output"
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            position: 'absolute',
            left: `${absoluteX}px`,
            top: `${absoluteY}px`
          }}
        >
          {renderScene(liveScene, liveCategory, liveControlPoint, true)}
        </div>
      </div>
    );
  }

  if (isFullscreenPreview) {
    return (
      <div className="fullscreen-preview-editor">
        <div className="fullscreen-controls">
          <button onClick={handleExitFullscreen} className="exit-fullscreen-btn">
            ✕ Exit Fullscreen
          </button>
          <div className="size-display">
            {Math.round(previewSize.width)} × {Math.round(previewSize.height)}
          </div>
        </div>
        <SimpleResizable
          key={`fullscreen-${previewScene}`}
          initialWidth={previewSize.width}
          initialHeight={previewSize.height}
          initialX={previewPosition.x}
          initialY={previewPosition.y}
          onSizeChange={(newSize) => updateSceneConfig(previewScene, newSize, null)}
          onPositionChange={(newPosition) => updateSceneConfig(previewScene, null, newPosition)}
          isPreview={true}
          previewScale={1}
        >
          {renderScene(previewScene, previewCategory, previewControlPoint, false)}
        </SimpleResizable>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="main-container">
        <div className="broadcast-section">
          <div className="broadcast-header">
            <h1>Orienteering Broadcast Control</h1>
            <div className="header-controls">
              {autoRotate && (
                <div className="rotation-controls">
                  {!rotationPaused ? (
                    <button className="rotation-btn" onClick={handleStopRotation}>
                      ⏸ Pause Rotation
                    </button>
                  ) : (
                    <button className="rotation-btn" onClick={handleResumeRotation}>
                      ▶ Resume Rotation
                    </button>
                  )}
                  <button className="rotation-btn" onClick={handleRestartRotation}>
                    ↻ Restart
                  </button>
                </div>
              )}
              <button className="go-live-btn" onClick={handleGoLive}>
                <span className="live-icon">📡</span>
                PUSH TO LIVE
              </button>
            </div>
          </div>

          <div className="displays-container">
            <div className="display-panel preview-panel">
              <div className="panel-header">
                <span className="panel-label preview-label">PREVIEW</span>
                <span className="panel-info">{previewScene} - {previewCategory}</span>
              </div>
              <div className="display-wrapper" onClick={handleFullscreenPreview}>
                <SimpleResizable
                  key={`preview-${previewScene}`}
                  initialWidth={previewSize.width}
                  initialHeight={previewSize.height}
                  initialX={previewPosition.x}
                  initialY={previewPosition.y}
                  onSizeChange={(newSize) => updateSceneConfig(previewScene, newSize, null)}
                  onPositionChange={(newPosition) => updateSceneConfig(previewScene, null, newPosition)}
                  isPreview={false}
                  previewScale={previewSize.width > 1280 ? 0.4 : 0.5}
                >
                  {renderScene(previewScene, previewCategory, previewControlPoint, false)}
                </SimpleResizable>
                <div className="preview-overlay">
                  <div className="preview-hint">Click to edit size in fullscreen</div>
                </div>
              </div>
            </div>

            <div className="display-panel live-panel">
              <div className="panel-header">
                <span className="panel-label live-label">
                  <span className="live-dot"></span>
                  LIVE
                </span>
                <span className="panel-info">{liveScene} - {liveCategory}</span>
              </div>
              <div className="display-wrapper">
                <SimpleResizable
                  initialWidth={liveSceneConfig?.size?.width || 1280}
                  initialHeight={liveSceneConfig?.size?.height || 720}
                  initialX={liveSceneConfig?.position?.x || 0}
                  initialY={liveSceneConfig?.position?.y || 0}
                  onSizeChange={() => {}}
                  onPositionChange={() => {}}
                  isPreview={false}
                  previewScale={(liveSceneConfig?.size?.width || 1280) > 1280 ? 0.4 : 0.5}
                >
                  {renderScene(liveScene, liveCategory, liveControlPoint, true)}
                </SimpleResizable>
              </div>
            </div>
          </div>
        </div>

        <div className="controls-section">
          <Controls
            category={previewCategory}
            setCategory={setPreviewCategory}
            scene={previewScene}
            setScene={setPreviewScene}
            controlPoint={previewControlPoint}
            setControlPoint={setPreviewControlPoint}
            isDisplayMode={isDisplayMode}
            autoRotate={autoRotate}
            setAutoRotate={setAutoRotate}
            rotationInterval={rotationInterval}
            setRotationInterval={setRotationInterval}
            onGoLive={handleGoLive}
            customSceneNames={customSceneNames}
            updateSceneName={updateSceneName}
            sceneConfigs={sceneConfigs}
            updateSceneConfig={updateSceneConfig}
          />
        </div>
      </div>
    </div>
  );
}

export default App;