import React, { useState, useEffect } from 'react';
import StartListPaginated from './components/StartListPaginated';
import ResultsPaginated from './components/ResultsPaginated';
import SplitTimesPaginated from './components/SplitTimesPaginated';
import CurrentRunner from './components/CurrentRunner';
import RunnerPreStart from './components/RunnerPreStart';
import Controls from './components/Controls';
import SimpleResizable from './components/SimpleResizable';
import ProjectCreator from './components/ProjectCreator';
import liveResultsService from './services/liveResultsService';
import { saveData, listenToData, getData } from './utils/firebaseConfig';
import './App.css';

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isDisplayMode = urlParams.get('display') === 'true';

  // Project state
  const [showProjectCreator, setShowProjectCreator] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [currentCompetitionId, setCurrentCompetitionId] = useState(null);
  const [competitorsData, setCompetitorsData] = useState({
    men: [],
    women: []
  });
  const [pollingInterval, setPollingInterval] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isRefetching, setIsRefetching] = useState(false);
  const [refetchCategory, setRefetchCategory] = useState(null);

  // Preview state (what's being edited in control mode)
  const [previewCategory, setPreviewCategory] = useState('Men');
  const [previewScene, setPreviewScene] = useState('start-list');
  const [previewControlPoint, setPreviewControlPoint] = useState(1);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState(null);

  // Track if control mode has been initialized to prevent default states from being pushed
  const [controlInitialized, setControlInitialized] = useState(false);

  // Reset selected competitor when category changes
  useEffect(() => {
    setSelectedCompetitorId(null);
  }, [previewCategory]);

  // Live state (what's being broadcast)
  const [liveCategory, setLiveCategory] = useState('Men');
  const [liveScene, setLiveScene] = useState('start-list');
  const [liveControlPoint, setLiveControlPoint] = useState(1);
  const [livePageIndex, setLivePageIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [liveSelectedCompetitorId, setLiveSelectedCompetitorId] = useState(null);
  const [streamVisible, setStreamVisible] = useState(true); // New state for stream visibility
  const [sceneInitialized, setSceneInitialized] = useState(false); // Track if scene has been properly initialized

  // Scene configurations (size and position per scene)
  const [sceneConfigs, setSceneConfigs] = useState({
    'results': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'start-list': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'runner-pre-start': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'current-runner': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-1': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-2': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-3': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } },
    'split-4': { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } }
  });

  const [liveSceneConfig, setLiveSceneConfig] = useState({ size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } });
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotationInterval, setRotationInterval] = useState(10000); // 10 seconds between pages
  const [rotationPaused, setRotationPaused] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [customSceneNames, setCustomSceneNames] = useState({
    'results': 'Results',
    'start-list': 'Start List',
    'runner-pre-start': 'Runner - Pre Start',
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
          // Validate scene before setting
          const validScenes = ['start-list', 'results', 'runner-pre-start', 'current-runner', 'split-1', 'split-2', 'split-3', 'split-4'];
          const scene = validScenes.includes(data.scene) ? data.scene : 'start-list';

          // Batch update state to prevent intermediate renders
          setLiveCategory(data.category || 'Men');
          setLiveScene(scene);
          setLiveControlPoint(data.controlPoint || 1);
          setLivePageIndex(data.pageIndex || 0);
          setItemsPerPage(data.itemsPerPage || 10);
          setLiveSceneConfig(data.sceneConfig || { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } });
          setLiveSelectedCompetitorId(data.selectedCompetitorId || null);

          // Ensure stream visibility is properly synced
          const newStreamVisible = data.streamVisible !== undefined ? data.streamVisible : true;
          console.log('[Display Mode] Setting streamVisible to:', newStreamVisible);
          setStreamVisible(newStreamVisible);

          // Mark as initialized only after all state is set
          setSceneInitialized(true);
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

    // Listen to competitors data changes
    unsubscribers.push(
      listenToData('competitorsData', (data) => {
        if (data) {
          console.log('[Display Mode] Competitors data updated - Men:', data.men?.length, 'Women:', data.women?.length);
          // Check for finished competitors
          const menFinished = data.men?.filter(c => c.status === 'finished').length || 0;
          const womenFinished = data.women?.filter(c => c.status === 'finished').length || 0;
          console.log('[Display Mode] Finished competitors - Men:', menFinished, 'Women:', womenFinished);
          setCompetitorsData(data);
        } else {
          console.log('[Display Mode] No competitors data in Firebase!');
        }
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isDisplayMode]);

  // Save live state to Firebase (only in control mode and after initialization)
  useEffect(() => {
    if (isDisplayMode) return;
    if (!controlInitialized) return; // Don't save until control is initialized

    // Debounce the save to prevent rapid Firebase writes
    const timeoutId = setTimeout(() => {
      const liveState = {
        category: liveCategory,
        scene: liveScene,
        controlPoint: liveControlPoint,
        pageIndex: livePageIndex,
        itemsPerPage: itemsPerPage,
        sceneConfig: liveSceneConfig,
        selectedCompetitorId: liveSelectedCompetitorId,
        streamVisible: streamVisible,
        timestamp: Date.now()
      };

      saveData('liveState', liveState);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [liveCategory, liveScene, liveControlPoint, livePageIndex, itemsPerPage, liveSceneConfig, liveSelectedCompetitorId, streamVisible, isDisplayMode, controlInitialized]);

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

    // Only auto-rotate for paginated scenes
    const paginatedScenes = ['start-list', 'results', 'split-1', 'split-2', 'split-3', 'split-4'];
    if (!paginatedScenes.includes(liveScene)) {
      console.log('[Control] Scene', liveScene, 'does not support pagination, skipping auto-rotation');
      return;
    }

    // Calculate actual number of pages based on current data and scene
    const competitors = liveCategory === 'Men' ? competitorsData.men : competitorsData.women;

    let relevantCompetitors = competitors;
    if (liveScene === 'start-list') {
      // Filter same way as StartListPaginated: include if no status or status is 'not_started'
      relevantCompetitors = competitors.filter(c => !c.status || c.status === 'not_started');
    } else if (liveScene === 'results') {
      // Filter same way as ResultsPaginated: only finished competitors with rank
      relevantCompetitors = competitors.filter(c => c.status === 'finished' && c.rank);
    }

    const totalPages = relevantCompetitors && relevantCompetitors.length > 0
      ? Math.ceil(relevantCompetitors.length / itemsPerPage)
      : 1;

    console.log('[Control] Starting auto-rotation, scene:', liveScene, 'interval:', rotationInterval, 'totalPages:', totalPages, 'competitors:', relevantCompetitors.length);
    const interval = setInterval(() => {
      setLivePageIndex(prev => {
        // Wrap around to 0 when reaching the last page
        const next = (prev + 1) % totalPages;
        console.log('[Control] Rotating page from', prev, 'to', next, 'of', totalPages);
        return next;
      });
    }, rotationInterval);

    return () => {
      console.log('[Control] Stopping auto-rotation');
      clearInterval(interval);
    };
  }, [autoRotate, rotationPaused, rotationInterval, isDisplayMode, liveScene, liveCategory, competitorsData, itemsPerPage]);

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
    console.log('[Control] Pushing to live - Scene:', previewScene, 'Category:', previewCategory);

    // Validate scene before pushing to live
    const validScenes = ['start-list', 'results', 'runner-pre-start', 'current-runner', 'split-1', 'split-2', 'split-3', 'split-4'];
    if (!validScenes.includes(previewScene)) {
      console.error('[Control] Invalid scene attempted to push live:', previewScene);
      alert(`Cannot push invalid scene to live: ${previewScene}`);
      return;
    }

    setLiveCategory(previewCategory);
    setLiveScene(previewScene);
    setLiveControlPoint(previewControlPoint);
    setLiveSceneConfig(sceneConfigs[previewScene]);
    setLivePageIndex(0); // Reset to first page when pushing new content to live
    setLiveSelectedCompetitorId(selectedCompetitorId);
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
    // Add timestamp for sorting
    const projectWithTimestamp = {
      ...project,
      timestamp: Date.now()
    };

    setCurrentProject(projectWithTimestamp);
    setShowProjectCreator(false);

    // Save project to Firebase
    await saveData(`projects/${projectWithTimestamp.id}`, projectWithTimestamp);

    // Also save as the current project
    await saveData('currentProjectId', projectWithTimestamp.id);

    // Add to local projects list (check for duplicates)
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectWithTimestamp.id);
      const updated = [...filtered, projectWithTimestamp];
      return updated;
    });

    if (projectWithTimestamp.dataSource === 'liveresults' && projectWithTimestamp.eventData) {
      // Set the first competition as current
      const firstCompetition = projectWithTimestamp.eventData.competitions[0];
      if (firstCompetition) {
        setCurrentCompetitionId(firstCompetition.id);

        const newCompetitorsData = {
          men: firstCompetition.men || [],
          women: firstCompetition.women || []
        };
        setCompetitorsData(newCompetitorsData);

        // Save competitors data to Firebase
        await saveData('competitorsData', newCompetitorsData);
        await saveData('currentCompetitionId', firstCompetition.id);

        // Start polling for updates if we have a live event
        if (projectWithTimestamp.eventUrl && pollingInterval) {
          liveResultsService.stopPolling(pollingInterval);
        }

        // Don't set up polling - start list is static
        console.log('[Start List] Data loaded, no polling needed for start list');
      }
    }
  };

  // Handle competition change
  const handleCompetitionChange = async (competitionId) => {
    if (!currentProject || !currentProject.eventData) return;

    const competition = currentProject.eventData.competitions.find(c => c.id === competitionId);
    if (competition) {
      setCurrentCompetitionId(competitionId);
      // Save competition ID to Firebase
      await saveData('currentCompetitionId', competitionId);

      // Reset page index to 0 when changing competitions
      setLivePageIndex(0);

      // Clear old data immediately
      setCompetitorsData({ men: [], women: [] });

      // If we have a URL, fetch fresh data
      if (currentProject.eventUrl) {
        try {
          const eventId = liveResultsService.parseEventIdFromUrl(currentProject.eventUrl);
          const classes = await liveResultsService.fetchClasses(eventId, competitionId);
          const { menClass, womenClass } = liveResultsService.findEliteClasses(classes);

          // Fetch fresh data for both categories (includes both start list and results)
          const [menData, womenData] = await Promise.all([
            menClass ? liveResultsService.fetchCompetitors(eventId, competitionId, menClass.id) : [],
            womenClass ? liveResultsService.fetchCompetitors(eventId, competitionId, womenClass.id) : []
          ]);

          // Transform the competitor data
          const transformedMenData = menData.map((c, index) =>
            liveResultsService.transformCompetitor(c, 'Men', index)
          );
          const transformedWomenData = womenData.map((c, index) =>
            liveResultsService.transformCompetitor(c, 'Women', index)
          );

          console.log('[App] Fetched competitors - Men:', transformedMenData.length, 'Women:', transformedWomenData.length);

          // Check how many have finished status
          const menFinished = transformedMenData.filter(c => c.status === 'finished').length;
          const womenFinished = transformedWomenData.filter(c => c.status === 'finished').length;
          console.log('[App] Finished competitors - Men:', menFinished, 'Women:', womenFinished);

          const newCompetitorsData = {
            men: transformedMenData,
            women: transformedWomenData
          };
          console.log('[App] Setting competitors data - Men:', transformedMenData.length, 'Women:', transformedWomenData.length);
          setCompetitorsData(newCompetitorsData);
          // Save to Firebase for display mode - CRITICAL FOR PRODUCTION
          console.log('[App] Saving competitors data to Firebase');
          await saveData('competitorsData', newCompetitorsData);
        } catch (error) {
          console.error('Error fetching competition data:', error);
          // Fallback to cached data if available
          const newCompetitorsData = {
            men: competition.men || [],
            women: competition.women || []
          };
          setCompetitorsData(newCompetitorsData);
          // Save to Firebase for display mode
          await saveData('competitorsData', newCompetitorsData);
        }
      } else {
        // No URL, use cached data
        const newCompetitorsData = {
          men: competition.men || [],
          women: competition.women || []
        };
        setCompetitorsData(newCompetitorsData);
        // Save to Firebase for display mode
        await saveData('competitorsData', newCompetitorsData);
      }

      // Stop any existing polling when changing competition
      if (pollingInterval) {
        liveResultsService.stopPolling(pollingInterval);
        setPollingInterval(null);
        console.log('[Competition Change] Stopped polling, start list is static');
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

      // Update state and // localStorage removed for OBS compatibility
      setCompetitorsData(updatedData);
      //setItem('competitorsData', JSON.stringify(updatedData));

      // Update the project's event data in memory
      if (currentProject.eventData) {
        const competitionIndex = currentProject.eventData.competitions.findIndex(c => c.id === currentCompetitionId);
        if (competitionIndex !== -1) {
          currentProject.eventData.competitions[competitionIndex].men = updatedData.men;
          currentProject.eventData.competitions[competitionIndex].women = updatedData.women;

          // Save updated project
          //setItem('currentProject', JSON.stringify(currentProject));
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

    // Remove from local state and // localStorage removed for OBS compatibility
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectId);
      //setItem('projects', JSON.stringify(filtered));
      return filtered;
    });

    // If this was the current project, clear it
    if (currentProject && currentProject.id === projectId) {
      setCurrentProject(null);
      setCurrentCompetitionId(null);
      setCompetitorsData({ men: [], women: [] });
      //removeItem('currentProject');
      //removeItem('currentCompetitionId');
      //removeItem('competitorsData');

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
      const unsubscribers = [];

      // First, restore the live state from Firebase ONCE to avoid overwriting it
      // Use onlyOnce flag to prevent continuous updates
      const loadInitialState = async () => {
        const data = await getData('liveState');
        if (data && !controlInitialized) {
          console.log('[Control] Restoring live state from Firebase (once):', data);
          setLiveCategory(data.category || 'Men');
          setLiveScene(data.scene || 'start-list');
          setLiveControlPoint(data.controlPoint || 1);
          setLivePageIndex(data.pageIndex || 0);
          setItemsPerPage(data.itemsPerPage || 10);
          setLiveSceneConfig(data.sceneConfig || { size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 } });
          setLiveSelectedCompetitorId(data.selectedCompetitorId || null);
          setStreamVisible(data.streamVisible !== undefined ? data.streamVisible : true);
          setControlInitialized(true);
        } else if (!controlInitialized) {
          // No existing live state, mark as initialized with defaults
          setControlInitialized(true);
        }
      };

      loadInitialState();

      // Listen to projects and restore current project
      unsubscribers.push(
        listenToData('projects', (data) => {
          if (data) {
            const projectsList = Object.values(data);
            setProjects(projectsList);

            // If we have projects but no current project, restore the last one
            if (projectsList.length > 0 && !currentProject) {
              // Get the most recent project
              const latestProject = projectsList.sort((a, b) =>
                (b.timestamp || 0) - (a.timestamp || 0)
              )[0];

              if (latestProject) {
                setCurrentProject(latestProject);
              }
            }
          }
        })
      );

      // Listen to saved competitor data
      unsubscribers.push(
        listenToData('competitorsData', (data) => {
          if (data) {
            console.log('[Control] Loaded competitors data from Firebase - Men:', data.men?.length, 'Women:', data.women?.length);
            setCompetitorsData(data);
          }
        })
      );

      // Listen to saved competition ID
      unsubscribers.push(
        listenToData('currentCompetitionId', (data) => {
          if (data) {
            setCurrentCompetitionId(data);
          }
        })
      );

      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    }
  }, [isDisplayMode, currentProject, controlInitialized]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        liveResultsService.stopPolling(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const renderScene = (sceneType, categoryType, controlPt, isLive = false) => {
    // Add validation to ensure we only render valid scenes
    const validScenes = ['start-list', 'results', 'runner-pre-start', 'current-runner', 'split-1', 'split-2', 'split-3', 'split-4'];

    if (!validScenes.includes(sceneType)) {
      console.warn(`[RenderScene] Invalid scene type: ${sceneType}, defaulting to start-list`);
      sceneType = 'start-list';
    }

    const competitors = categoryType === 'Men' ? competitorsData.men : competitorsData.women;
    const rotationProps = isLive ? pageRotationState : { itemsPerPage };
    const sceneTitle = customSceneNames[sceneType] || sceneType;


    switch (sceneType) {
      case 'start-list':
        return <StartListPaginated competitors={competitors} category={categoryType} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'results':
        return <ResultsPaginated competitors={competitors} category={categoryType} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'runner-pre-start':
        return <RunnerPreStart
          competitors={competitors}
          category={categoryType}
          sceneTitle={sceneTitle}
          selectedCompetitorId={isLive ? liveSelectedCompetitorId : selectedCompetitorId}
        />;
      case 'current-runner':
        return <CurrentRunner
          competitors={competitors}
          category={categoryType}
          sceneTitle={sceneTitle}
          selectedCompetitorId={isLive ? liveSelectedCompetitorId : selectedCompetitorId}
        />;
      case 'split-1':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={1} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'split-2':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={2} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'split-3':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={3} sceneTitle={sceneTitle} {...rotationProps} />;
      case 'split-4':
        return <SplitTimesPaginated competitors={competitors} category={categoryType} controlPoint={4} sceneTitle={sceneTitle} {...rotationProps} />;
      default:
        console.error(`[RenderScene] Unhandled scene type after validation: ${sceneType}`);
        return <StartListPaginated competitors={competitors} category={categoryType} sceneTitle={sceneTitle} {...rotationProps} />;
    }
  };

  if (isDisplayMode) {
    const displayWidth = liveSceneConfig?.size?.width || 1920;
    const displayHeight = liveSceneConfig?.size?.height || 1080;
    const relativeX = liveSceneConfig?.position?.x || 0;
    const relativeY = liveSceneConfig?.position?.y || 0;

    const absoluteX = (window.innerWidth / 2) - (displayWidth / 2) + relativeX;
    const absoluteY = (window.innerHeight / 2) - (displayHeight / 2) + relativeY;

    // Log stream visibility state for debugging
    console.log('[Display Mode] streamVisible:', streamVisible, 'sceneInitialized:', sceneInitialized);

    return (
      <div className="app display-mode">
        {streamVisible && sceneInitialized && (
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
        )}
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
            <h1>
              Orienteering Broadcast Control
              {currentProject?.isDemo && <span className="demo-badge">Demo</span>}
            </h1>
            <div className="project-info">
              {projects.length > 0 ? (
                <div className="project-controls">
                  <div className="current-project">
                    <select
                      className="project-selector"
                      value={currentProject?.id || ''}
                      onChange={async (e) => {
                        const project = projects.find(p => p.id === e.target.value);
                        if (project) {
                          setCurrentProject(project);
                          // Save current project ID to Firebase
                          await saveData('currentProjectId', project.id);
                          if (project.eventData && project.eventData.competitions[0]) {
                            await handleCompetitionChange(project.eventData.competitions[0].id);
                          }
                        }
                      }}
                    >
                      {!currentProject && <option value="">Select a project</option>}
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name} {project.isDemo && '(Demo)'}
                        </option>
                      ))}
                    </select>

                    {currentProject?.dataSource === 'liveresults' && currentProject?.eventData && (
                      <>
                        <select
                          className="competition-selector"
                          value={currentCompetitionId || ''}
                          onChange={(e) => handleCompetitionChange(e.target.value)}
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
                            {isRefetching && refetchCategory === 'men' ? '⏳ ' : ''}Men
                          </button>
                          <button
                            className="refetch-btn refetch-women"
                            onClick={() => handleRefetch('women')}
                            disabled={isRefetching}
                            title="Refetch women's data only"
                          >
                            {isRefetching && refetchCategory === 'women' ? '⏳ ' : ''}Women
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
            competitorsData={competitorsData}
            selectedCompetitorId={selectedCompetitorId}
            setSelectedCompetitorId={setSelectedCompetitorId}
            streamVisible={streamVisible}
            setStreamVisible={setStreamVisible}
          />
        </div>
      </div>
    </div>
  );
}

export default App;