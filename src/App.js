import React, { useState, useEffect } from 'react';
import StartListPaginated from './components/StartListPaginated';
import ResultsPaginated from './components/ResultsPaginated';
import SplitTimesPaginated from './components/SplitTimesPaginated';
import CurrentRunner from './components/CurrentRunner';
import Controls from './components/Controls';
import SimpleResizable from './components/SimpleResizable';
import ProjectCreator from './components/ProjectCreator';
import menData from './data/menData.json';
import womenData from './data/womenData.json';
import liveResultsService from './services/liveResultsService';
import { saveData, listenToData } from './utils/firebaseConfig';
import './App.css';

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isDisplayMode = urlParams.get('display') === 'true';

  // Project state
  const [showProjectCreator, setShowProjectCreator] = useState(false);
  const [currentProject, setCurrentProject] = useState(() => {
    // Load current project from localStorage
    const saved = localStorage.getItem('currentProject');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentCompetitionId, setCurrentCompetitionId] = useState(() => {
    const saved = localStorage.getItem('currentCompetitionId');
    return saved ? JSON.parse(saved) : null;
  });
  const [competitorsData, setCompetitorsData] = useState(() => {
    // Load saved competitor data or use defaults
    const saved = localStorage.getItem('competitorsData');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      men: menData.competitors,
      women: womenData.competitors
    };
  });
  const [pollingInterval, setPollingInterval] = useState(null);
  const [projects, setProjects] = useState(() => {
    // Load projects from localStorage
    const saved = localStorage.getItem('projects');
    return saved ? JSON.parse(saved) : [];
  });
  const [isRefetching, setIsRefetching] = useState(false);
  const [refetchCategory, setRefetchCategory] = useState(null);

  // Preview state (what's being edited in control mode)
  const [previewCategory, setPreviewCategory] = useState('Men');
  const [previewScene, setPreviewScene] = useState('results');
  const [previewControlPoint, setPreviewControlPoint] = useState(1);

  // Live state (what's being broadcast)
  const [liveCategory, setLiveCategory] = useState('Men');
  const [liveScene, setLiveScene] = useState('results');
  const [liveControlPoint, setLiveControlPoint] = useState(1);
  const [livePageIndex, setLivePageIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Scene configurations (size and position per scene)
  const [sceneConfigs, setSceneConfigs] = useState({
    'results': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'start-list': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'current-runner': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-1': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-2': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-3': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-4': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } }
  });

  const [liveSceneConfig, setLiveSceneConfig] = useState({ size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } });
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotationInterval, setRotationInterval] = useState(5000);
  const [rotationPaused, setRotationPaused] = useState(false);
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

  // Current preview size and position
  const previewSize = sceneConfigs[previewScene]?.size || { width: 1920, height: 1080 };
  const previewPosition = sceneConfigs[previewScene]?.position || { x: 0, y: 0 };

  // Listen to Firebase for live state updates (for display mode)
  useEffect(() => {
    if (!isDisplayMode) return;

    console.log('[Display Mode] Setting up Firebase listeners');

    const unsubscribers = [];

    // Listen to live state changes
    unsubscribers.push(
      listenToData('liveState', (data) => {
        if (data) {
          console.log('[Display Mode] Live state updated:', data);
          setLiveCategory(data.category || 'Men');
          setLiveScene(data.scene || 'results');
          setLiveControlPoint(data.controlPoint || 1);
          setLivePageIndex(data.pageIndex || 0);
          setItemsPerPage(data.itemsPerPage || 10);
          setLiveSceneConfig(data.sceneConfig || { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } });
        }
      })
    );

    // Listen to settings changes
    unsubscribers.push(
      listenToData('settings', (data) => {
        if (data) {
          console.log('[Display Mode] Settings updated:', data);
          setAutoRotate(data.autoRotate !== undefined ? data.autoRotate : true);
          setRotationInterval(data.rotationInterval || 5000);
          setItemsPerPage(data.itemsPerPage || 10);
          if (data.sceneConfigs) {
            setSceneConfigs(data.sceneConfigs);
          }
          if (data.customSceneNames) {
            setCustomSceneNames(data.customSceneNames);
          }
        }
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isDisplayMode]);

  // Save live state to Firebase (only in control mode)
  useEffect(() => {
    if (isDisplayMode) return;

    const liveState = {
      category: liveCategory,
      scene: liveScene,
      controlPoint: liveControlPoint,
      pageIndex: livePageIndex,
      itemsPerPage: itemsPerPage,
      sceneConfig: liveSceneConfig,
      timestamp: Date.now()
    };

    console.log('[Control] Saving to Firebase, pageIndex:', livePageIndex);
    saveData('liveState', liveState);
  }, [liveCategory, liveScene, liveControlPoint, livePageIndex, itemsPerPage, liveSceneConfig, isDisplayMode]);

  // Save settings to Firebase (only in control mode)
  useEffect(() => {
    if (isDisplayMode) return;

    const settings = {
      autoRotate,
      rotationInterval,
      itemsPerPage,
      sceneConfigs,
      customSceneNames
    };

    saveData('settings', settings);
  }, [autoRotate, rotationInterval, itemsPerPage, sceneConfigs, customSceneNames, isDisplayMode]);

  // Auto-rotation effect for live pages
  useEffect(() => {
    if (!autoRotate || rotationPaused || isDisplayMode) return;

    console.log('[Control] Starting auto-rotation, interval:', rotationInterval);
    const interval = setInterval(() => {
      setLivePageIndex(prev => {
        const next = prev + 1;
        console.log('[Control] Rotating page from', prev, 'to', next);
        return next;
      });
    }, rotationInterval);

    return () => {
      console.log('[Control] Stopping auto-rotation');
      clearInterval(interval);
    };
  }, [autoRotate, rotationPaused, rotationInterval, isDisplayMode, liveScene]);

  // Pass page rotation state to components
  const pageRotationState = {
    autoRotate,
    rotationPaused,
    currentPageIndex: livePageIndex,
    rotationInterval,
    setCurrentPageIndex: !isDisplayMode ? setLivePageIndex : undefined,
    itemsPerPage
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
    console.log('[Control] Pushing to live');
    setLiveCategory(previewCategory);
    setLiveScene(previewScene);
    setLiveControlPoint(previewControlPoint);
    setLiveSceneConfig(sceneConfigs[previewScene]);
    setLivePageIndex(0); // Reset to first page when pushing new content to live
  };

  const updateSceneConfig = (scene, newSize, newPosition) => {
    setSceneConfigs(prev => ({
      ...prev,
      [scene]: {
        size: newSize || prev[scene].size,
        position: newPosition || prev[scene].position
      }
    }));
  };

  // Handle project creation
  const handleProjectCreated = async (project) => {
    setCurrentProject(project);
    setShowProjectCreator(false);

    // Save to localStorage
    localStorage.setItem('currentProject', JSON.stringify(project));

    // Save project to Firebase
    await saveData(`projects/${project.id}`, project);

    // Add to local projects list (check for duplicates)
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== project.id);
      const updated = [...filtered, project];
      localStorage.setItem('projects', JSON.stringify(updated));
      return updated;
    });

    if (project.dataSource === 'liveresults' && project.eventData) {
      // Set the first competition as current
      const firstCompetition = project.eventData.competitions[0];
      if (firstCompetition) {
        setCurrentCompetitionId(firstCompetition.id);
        localStorage.setItem('currentCompetitionId', JSON.stringify(firstCompetition.id));

        const newCompetitorsData = {
          men: firstCompetition.men || [],
          women: firstCompetition.women || []
        };
        setCompetitorsData(newCompetitorsData);
        localStorage.setItem('competitorsData', JSON.stringify(newCompetitorsData));

        // Start polling for updates if we have a live event
        if (project.eventUrl && pollingInterval) {
          liveResultsService.stopPolling(pollingInterval);
        }

        const interval = liveResultsService.startPolling(
          project.eventUrl,
          firstCompetition.id,
          (updatedData) => {
            const newData = {
              men: updatedData.men || [],
              women: updatedData.women || []
            };
            setCompetitorsData(newData);
            localStorage.setItem('competitorsData', JSON.stringify(newData));
          },
          30000 // Poll every 30 seconds
        );
        setPollingInterval(interval);
      }
    }
  };

  // Handle competition change
  const handleCompetitionChange = (competitionId) => {
    if (!currentProject || !currentProject.eventData) return;

    const competition = currentProject.eventData.competitions.find(c => c.id === competitionId);
    if (competition) {
      setCurrentCompetitionId(competitionId);
      localStorage.setItem('currentCompetitionId', JSON.stringify(competitionId));

      const newCompetitorsData = {
        men: competition.men || [],
        women: competition.women || []
      };
      setCompetitorsData(newCompetitorsData);
      localStorage.setItem('competitorsData', JSON.stringify(newCompetitorsData));

      // Update polling for new competition
      if (currentProject.eventUrl && pollingInterval) {
        liveResultsService.stopPolling(pollingInterval);

        const interval = liveResultsService.startPolling(
          currentProject.eventUrl,
          competitionId,
          (updatedData) => {
            const newData = {
              men: updatedData.men || [],
              women: updatedData.women || []
            };
            setCompetitorsData(newData);
            localStorage.setItem('competitorsData', JSON.stringify(newData));
          },
          30000
        );
        setPollingInterval(interval);
      }
    }
  };

  // Handle refetch for specific competition and category
  const handleRefetch = async (category = null) => {
    if (!currentProject || !currentProject.eventUrl || !currentCompetitionId) {
      alert('No active project or competition selected');
      return;
    }

    setIsRefetching(true);
    setRefetchCategory(category);

    try {
      const eventId = liveResultsService.parseEventIdFromUrl(currentProject.eventUrl);
      if (!eventId) {
        throw new Error('Invalid event URL');
      }

      // Get classes for the current competition
      const classes = await liveResultsService.fetchClasses(eventId, currentCompetitionId);
      const { menClass, womenClass } = liveResultsService.findEliteClasses(classes);

      let updatedData = { ...competitorsData };

      // Fetch data for specified category or both
      if (!category || category === 'men') {
        if (menClass) {
          const menCompetitors = await liveResultsService.fetchCompetitors(eventId, currentCompetitionId, menClass.id);
          updatedData.men = menCompetitors.map((c, index) =>
            liveResultsService.transformCompetitor(c, 'Men', index)
          );
        }
      }

      if (!category || category === 'women') {
        if (womenClass) {
          const womenCompetitors = await liveResultsService.fetchCompetitors(eventId, currentCompetitionId, womenClass.id);
          updatedData.women = womenCompetitors.map((c, index) =>
            liveResultsService.transformCompetitor(c, 'Women', index)
          );
        }
      }

      // Update state and localStorage
      setCompetitorsData(updatedData);
      localStorage.setItem('competitorsData', JSON.stringify(updatedData));

      // Update the project's event data in memory
      if (currentProject.eventData) {
        const competitionIndex = currentProject.eventData.competitions.findIndex(c => c.id === currentCompetitionId);
        if (competitionIndex !== -1) {
          currentProject.eventData.competitions[competitionIndex].men = updatedData.men;
          currentProject.eventData.competitions[competitionIndex].women = updatedData.women;

          // Save updated project
          localStorage.setItem('currentProject', JSON.stringify(currentProject));
          await saveData(`projects/${currentProject.id}`, currentProject);
        }
      }

      console.log(`Refetched data for ${category || 'all categories'}`);
    } catch (error) {
      console.error('Error refetching data:', error);
      alert(`Failed to refetch data: ${error.message}`);
    } finally {
      setIsRefetching(false);
      setRefetchCategory(null);
    }
  };

  // Handle delete project
  const handleDeleteProject = async (projectId) => {
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }

    // Remove from Firebase
    await saveData(`projects/${projectId}`, null);

    // Remove from local state and localStorage
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectId);
      localStorage.setItem('projects', JSON.stringify(filtered));
      return filtered;
    });

    // If this was the current project, clear it
    if (currentProject && currentProject.id === projectId) {
      setCurrentProject(null);
      setCurrentCompetitionId(null);
      setCompetitorsData({ men: [], women: [] });
      localStorage.removeItem('currentProject');
      localStorage.removeItem('currentCompetitionId');
      localStorage.removeItem('competitorsData');

      // Stop polling if active
      if (pollingInterval) {
        liveResultsService.stopPolling(pollingInterval);
        setPollingInterval(null);
      }
    }
  };

  // Load projects from Firebase on mount
  useEffect(() => {
    if (!isDisplayMode) {
      listenToData('projects', (data) => {
        if (data) {
          const projectsList = Object.values(data);
          setProjects(projectsList);
        }
      });
    }
  }, [isDisplayMode]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        liveResultsService.stopPolling(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const renderScene = (sceneType, categoryType, controlPt, isLive = false) => {
    const competitors = categoryType === 'Men' ? competitorsData.men : competitorsData.women;
    const rotationProps = isLive ? pageRotationState : { itemsPerPage };
    const sceneTitle = customSceneNames[sceneType];

    switch (sceneType) {
      case 'start-list':
        return <StartListPaginated competitors={competitors} category={categoryType} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'results':
        return <ResultsPaginated competitors={competitors} category={categoryType} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'current-runner':
        return <CurrentRunner competitors={competitors} category={categoryType} sceneTitle={sceneTitle} />;
      case 'split-1':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={1} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'split-2':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={2} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'split-3':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={3} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'split-4':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={4} sceneTitle={sceneTitle} {...rotationProps} />;
      default:
        return <ResultsPaginated competitors={competitors} category={categoryType} sceneTitle={sceneTitle} {...rotationProps} />;
    }
  };

  if (isDisplayMode) {
    const displayWidth = liveSceneConfig?.size?.width || 1920;
    const displayHeight = liveSceneConfig?.size?.height || 1080;
    const relativeX = liveSceneConfig?.position?.x || 0;
    const relativeY = liveSceneConfig?.position?.y || 0;

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
      {showProjectCreator && (
        <ProjectCreator
          onProjectCreated={handleProjectCreated}
          onCancel={() => setShowProjectCreator(false)}
        />
      )}

      <div className="main-container">
        <div className="broadcast-section">
          <div className="broadcast-header">
            <h1>Orienteering Broadcast Control</h1>
            <div className="project-info">
              {projects.length > 0 ? (
                <div className="project-controls">
                  <div className="current-project">
                    <select
                      className="project-selector"
                      value={currentProject?.id || ''}
                      onChange={(e) => {
                        const project = projects.find(p => p.id === e.target.value);
                        if (project) {
                          setCurrentProject(project);
                          if (project.eventData && project.eventData.competitions[0]) {
                            handleCompetitionChange(project.eventData.competitions[0].id);
                          }
                        }
                      }}
                    >
                      {!currentProject && <option value="">Select a project</option>}
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>

                    {currentProject?.dataSource === 'liveresults' && currentProject?.eventData && (
                      <>
                        <select
                          className="competition-selector"
                          value={currentCompetitionId || ''}
                          onChange={(e) => handleCompetitionChange(parseInt(e.target.value))}
                        >
                          {currentProject.eventData.competitions.map(comp => (
                            <option key={comp.id} value={comp.id}>
                              {comp.name} - {comp.date}
                            </option>
                          ))}
                        </select>
                        <div className="refetch-controls">
                          <button
                            className="refetch-btn"
                            onClick={() => handleRefetch()}
                            disabled={isRefetching}
                            title="Refetch all data for current competition"
                          >
                            {isRefetching ? '⏳' : '🔄'} Refresh All
                          </button>
                          <button
                            className="refetch-btn refetch-men"
                            onClick={() => handleRefetch('men')}
                            disabled={isRefetching}
                            title="Refetch men's data only"
                          >
                            {isRefetching && refetchCategory === 'men' ? '⏳' : '♂️'} Men
                          </button>
                          <button
                            className="refetch-btn refetch-women"
                            onClick={() => handleRefetch('women')}
                            disabled={isRefetching}
                            title="Refetch women's data only"
                          >
                            {isRefetching && refetchCategory === 'women' ? '⏳' : '♀️'} Women
                          </button>
                        </div>
                        <span className="live-indicator">● LIVE</span>
                      </>
                    )}
                  </div>
                  <button
                    className="new-project-btn"
                    onClick={() => setShowProjectCreator(true)}
                  >
                    + New
                  </button>
                  {currentProject && (
                    <button
                      className="delete-project-btn"
                      onClick={() => handleDeleteProject(currentProject.id)}
                      title="Delete current project"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              ) : (
                <button
                  className="create-project-btn"
                  onClick={() => setShowProjectCreator(true)}
                >
                  + New Project
                </button>
              )}
            </div>
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
                  previewScale={previewSize.width > 1920 ? 0.3 : 0.4}
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
                  initialWidth={liveSceneConfig?.size?.width || 1920}
                  initialHeight={liveSceneConfig?.size?.height || 1080}
                  initialX={liveSceneConfig?.position?.x || 0}
                  initialY={liveSceneConfig?.position?.y || 0}
                  onSizeChange={() => {}}
                  onPositionChange={() => {}}
                  isPreview={false}
                  previewScale={(liveSceneConfig?.size?.width || 1920) > 1920 ? 0.3 : 0.4}
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
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
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