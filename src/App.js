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
  // Load saved settings from localStorage
  const loadSettings = () => {
    const saved = localStorage.getItem('orienteeringDisplaySettings');
    if (saved) {
      const settings = JSON.parse(saved);
      return settings;
    }
    return {
      displaySize: { width: 1280, height: 720 },
      displayPosition: { x: 0, y: 0 },
      contentScale: 1
    };
  };

  // Load saved live state from localStorage
  const loadLiveState = () => {
    const saved = localStorage.getItem('orienteeringLiveState');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      category: 'Men',
      scene: 'results',
      controlPoint: 1,
      pageIndex: 0
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

  // Preview settings (being edited)
  const [previewSize, setPreviewSize] = useState(savedSettings.displaySize);

  // Live settings (being broadcast)
  const [liveSize, setLiveSize] = useState(savedSettings.displaySize);
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

  // Save settings whenever live settings change
  useEffect(() => {
    const settings = {
      displaySize: liveSize,
      displayPosition: { x: 0, y: 0 },
      contentScale: 1
    };
    localStorage.setItem('orienteeringDisplaySettings', JSON.stringify(settings));
  }, [liveSize]);

  // Save live state whenever it changes
  useEffect(() => {
    const liveState = {
      category: liveCategory,
      scene: liveScene,
      controlPoint: liveControlPoint,
      pageIndex: livePageIndex
    };
    localStorage.setItem('orienteeringLiveState', JSON.stringify(liveState));

    // Dispatch storage event to notify other tabs/windows
    window.dispatchEvent(new Event('storage'));
  }, [liveCategory, liveScene, liveControlPoint, livePageIndex]);

  const urlParams = new URLSearchParams(window.location.search);
  const isDisplayMode = urlParams.get('display') === 'true';

  // In display mode, listen for storage changes to update the view
  useEffect(() => {
    if (!isDisplayMode) return;

    const handleStorageChange = () => {
      const liveState = loadLiveState();
      setLiveCategory(liveState.category);
      setLiveScene(liveState.scene);
      setLiveControlPoint(liveState.controlPoint);
      setLivePageIndex(liveState.pageIndex || 0);
    };

    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Poll for changes as backup (for same-tab updates)
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isDisplayMode]);

  // Auto-rotation effect for live pages
  useEffect(() => {
    if (!autoRotate || rotationPaused) return;

    const interval = setInterval(() => {
      setLivePageIndex(prev => prev + 1);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [autoRotate, rotationPaused, rotationInterval]);

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
    setLiveSize(previewSize);
    setLivePageIndex(0); // Reset to first page when pushing new content to live
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
    return (
      <div className="app display-mode">
        <div
          className="display-output"
          style={{
            width: `${liveSize.width}px`,
            height: `${liveSize.height}px`
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
          initialWidth={previewSize.width}
          initialHeight={previewSize.height}
          onSizeChange={setPreviewSize}
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
                  initialWidth={previewSize.width}
                  initialHeight={previewSize.height}
                  onSizeChange={() => {}}
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
                  initialWidth={liveSize.width}
                  initialHeight={liveSize.height}
                  onSizeChange={() => {}}
                  isPreview={false}
                  previewScale={liveSize.width > 1280 ? 0.4 : 0.5}
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
          />
        </div>
      </div>
    </div>
  );
}

export default App;
