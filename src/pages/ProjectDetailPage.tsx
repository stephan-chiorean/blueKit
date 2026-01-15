import { useState, useEffect, useMemo, useRef, useTransition, useDeferredValue } from 'react';
import {
  Box,
  VStack,
  Splitter,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import Header from '../components/Header';
import KitsTabContent from '../components/kits/KitsTabContent';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import BlueprintsTabContent from '../components/blueprints/BlueprintsTabContent';
import AgentsTabContent from '../components/agents/AgentsTabContent';
import ScrapbookTabContent from '../components/scrapbook/ScrapbookTabContent';
import DiagramsTabContent from '../components/diagrams/DiagramsTabContent';
import TimelineTabContent from '../components/commits/TimelineTabContent';
import TasksTabContent, { TasksTabContentRef } from '../components/tasks/TasksTabContent';
import PlansTabContent, { PlansTabContentRef } from '../components/plans/PlansTabContent';
import ResourceViewPage from './ResourceViewPage';
import NoteViewPage from './NoteViewPage';
import ProjectSidebar from '../components/sidebar/ProjectSidebar';
import { ViewType } from '../components/sidebar/SidebarContent';
import { invokeGetProjectArtifacts, invokeGetChangedArtifacts, invokeWatchProjectArtifacts, invokeStopWatcher, invokeReadFile, invokeGetProjectRegistry, invokeGetBlueprintTaskFile, invokeDbGetProjects, invokeGetProjectPlans, ArtifactFile, Project, ProjectEntry, TimeoutError, FileTreeNode } from '../ipc';
import { ResourceFile, ResourceType } from '../types/resource';
import { Plan } from '../types/plan';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useProjectArtifacts } from '../contexts/ProjectArtifactsContext';
import { useColorMode } from '../contexts/ColorModeContext';

interface ProjectDetailPageProps {
  project: ProjectEntry;
  onBack: () => void;
  onProjectSelect?: (project: Project) => void;
}

export default function ProjectDetailPage({ project, onBack, onProjectSelect }: ProjectDetailPageProps) {
  // Feature flags
  const { flags } = useFeatureFlags();
  const { setArtifacts: setGlobalArtifacts } = useProjectArtifacts();
  const { colorMode } = useColorMode();

  // Glass styling for sidebar to match header
  const sidebarBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(20, 20, 25, 0.15)';

  // Border styling for main content area (left border is the ResizeTrigger)
  const contentBorderStyle = colorMode === 'light'
    ? {
      borderTop: '1px solid rgba(0, 0, 0, 0.08)',
    }
    : {
      borderTop: '1px solid rgba(99, 102, 241, 0.2)',
    };

  // Sidebar state
  const [activeView, setActiveView] = useState<ViewType>('tasks');
  const [fileTreeVersion, setFileTreeVersion] = useState(0);
  const [splitSizes, setSplitSizes] = useState<[number, number]>([15, 85]);

  // Pixel-based minimum sidebar width (280px is a good default for sidebar content)
  const SIDEBAR_MIN_PX = 280;
  const SIDEBAR_MAX_PX = 500;

  // Ref to track splitter container width
  const splitterContainerRef = useRef<HTMLDivElement>(null);

  const handleTreeRefresh = () => setFileTreeVersion(v => v + 1);

  // Separate artifacts and loading state for better performance
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  const tasksTabRef = useRef<TasksTabContentRef>(null);
  const plansTabRef = useRef<PlansTabContentRef>(null);

  // Database project (for git metadata)
  const [dbProject, setDbProject] = useState<Project | null>(null);

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Use transition for non-urgent updates (file watching updates)
  const [, startTransition] = useTransition();

  // Defer artifact updates to prevent blocking UI
  const deferredArtifacts = useDeferredValue(artifacts);

  // Generic resource view state - for viewing any resource type
  const [viewingResource, setViewingResource] = useState<ResourceFile | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);

  // Notebook file selection - separate from resource view to avoid ResourceViewPage
  const [notebookFile, setNotebookFile] = useState<{
    resource: ResourceFile;
    content: string;
  } | null>(null);

  // Duplicate detection: Track last load timestamp to prevent rapid duplicate calls
  const lastLoadTimestampRef = useRef(0);

  // Load all projects for the dropdown
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projects = await invokeGetProjectRegistry();
        setAllProjects(projects);
      } catch (err) {
        // Failed to load projects
      }
    };
    loadProjects();
  }, []);

  // Load database project for git metadata
  useEffect(() => {
    const loadDbProject = async () => {
      try {
        const projects = await invokeDbGetProjects();
        // Find project by matching path
        const matchingProject = projects.find(p => p.path === project.path);
        setDbProject(matchingProject || null);
      } catch (err) {
        console.error('Failed to load database project:', err);
        setDbProject(null);
      }
    };
    loadDbProject();
  }, [project.path]);

  // Load plans for this project
  const loadPlans = async () => {
    try {
      setPlansLoading(true);
      const projectPlans = await invokeGetProjectPlans(project.id);
      setPlans(projectPlans);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  // Load plans on mount and when project changes
  useEffect(() => {
    loadPlans();
  }, [project.id]);

  // Handle restricted views
  useEffect(() => {
    if (activeView === 'blueprints' && !flags.blueprints) {
      setActiveView('tasks');
    } else if (activeView === 'scrapbook' && !flags.scrapbook) {
      setActiveView('tasks');
    } else if (activeView === 'diagrams' && !flags.diagrams) {
      setActiveView('tasks');
    } else if (activeView === 'agents' && !flags.agents) {
      setActiveView('tasks');
    }
  }, [activeView, flags.blueprints, flags.scrapbook, flags.diagrams, flags.agents]);

  // Load all artifacts from this project
  // This loads EVERYTHING from .bluekit/ (kits, walkthroughs, agents, diagrams, etc.)
  // Frontend filters by type later - see kitsOnly, walkthroughs, agents, blueprints memos below
  const loadProjectArtifacts = async () => {
    // Duplicate detection: Skip if called within 100ms window
    const now = Date.now();
    if (now - lastLoadTimestampRef.current < 100) {
      return;
    }
    lastLoadTimestampRef.current = now;

    try {
      // Only show loading on initial load
      setArtifactsLoading(true);
      setError(null);

      const projectArtifacts = await invokeGetProjectArtifacts(project.path);

      // Atomic update: set both artifacts and loading in one state update
      setArtifacts(projectArtifacts);
      setArtifactsLoading(false);
      setFileTreeVersion(v => v + 1);

      // Also update the global context for link resolution
      setGlobalArtifacts(projectArtifacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
      setArtifactsLoading(false);
    }
  };

  // Incremental update - only reload changed files
  // Uses transition to mark as non-urgent, preventing UI blocking
  const updateArtifactsIncremental = async (changedPaths: string[]) => {
    if (changedPaths.length === 0) {
      return;
    }

    try {
      const changedArtifacts = await invokeGetChangedArtifacts(project.path, changedPaths);

      // Use transition for non-urgent update - prevents blocking UI
      startTransition(() => {
        // Merge into existing state - update existing, add new, remove deleted
        setArtifacts(prev => {
          const updated = new Map(prev.map(a => [a.path, a]));

          // Track which paths we've seen in the results
          const seenPaths = new Set<string>();

          // Process changed artifacts
          changedArtifacts.forEach(newArtifact => {
            seenPaths.add(newArtifact.path);

            // Check if this is a moved file (same name, different path)
            // First, try to find by old path in changedPaths (standard move detection)
            let oldPath = Array.from(updated.keys()).find(oldPath => {
              const oldArtifact = updated.get(oldPath);
              return oldArtifact &&
                oldArtifact.name === newArtifact.name &&
                oldPath !== newArtifact.path &&
                changedPaths.includes(oldPath);
            });

            // If not found, check if there's an artifact with predicted path (from optimistic update)
            // The predicted path would be: folderPath + "/" + fileName
            // We can detect this by matching filename and checking if current path doesn't match newPath
            if (!oldPath) {
              oldPath = Array.from(updated.keys()).find(currentPath => {
                const currentArtifact = updated.get(currentPath);
                if (!currentArtifact || currentArtifact.name !== newArtifact.name) {
                  return false;
                }
                // Check if this is a predicted path (same filename, different full path)
                // and the newPath is the actual path we want
                return currentPath !== newArtifact.path &&
                  currentPath.endsWith(`/${newArtifact.name}`);
              });
            }

            if (oldPath) {
              // File was moved - remove old path (or predicted path)
              updated.delete(oldPath);
            }

            // Add/update with new artifact data (includes full frontMatter)
            updated.set(newArtifact.path, newArtifact);
          });

          // Remove artifacts that were deleted (in changedPaths but not in results)
          changedPaths.forEach(path => {
            if (!seenPaths.has(path) && updated.has(path)) {
              // Check if this file was moved (exists with same name but different path)
              const oldArtifact = updated.get(path);
              const wasMoved = oldArtifact && changedArtifacts.some(a =>
                a.name === oldArtifact.name && a.path !== path
              );

              if (!wasMoved) {
                // File was actually deleted, not moved
                updated.delete(path);
              }
            }
          });

          const finalArtifacts = Array.from(updated.values());

          // Also update the global context with the same artifacts
          setGlobalArtifacts(finalArtifacts);
          setFileTreeVersion(v => v + 1);

          return finalArtifacts;
        });
        // No loading state for incremental updates - they happen silently
      });
    } catch (err) {
      // Fallback to full reload on error
      loadProjectArtifacts();
    }
  };

  useEffect(() => {
    // Load artifacts on mount (direct call, no debounce)
    loadProjectArtifacts();

    let isMounted = true;
    let unlisten: (() => void) | null = null;

    // Set up file watcher for this project
    const setupWatcher = async () => {
      try {
        await invokeWatchProjectArtifacts(project.path);

        // Generate the event name (must match the Rust code)
        const sanitizedPath = project.path
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .replace(/:/g, '_')
          .replace(/\./g, '_')
          .replace(/ /g, '_');
        const eventName = `project-artifacts-changed-${sanitizedPath}`;

        // Listen for file change events - receive changed file paths
        unlisten = await listen<string[]>(eventName, (event) => {
          if (isMounted) {
            const changedPaths = event.payload;
            if (changedPaths.length > 0) {
              updateArtifactsIncremental(changedPaths);
            } else {
              // If no paths provided, fallback to full reload
              loadProjectArtifacts();
            }
          }
        });
      } catch (error) {
        if (error instanceof TimeoutError) {
          // File watcher setup timed out - watchers may not work
        }
      }
    };

    setupWatcher();

    // Cleanup function - called when component unmounts or project changes
    return () => {
      isMounted = false;
      if (unlisten) unlisten();

      // Stop the backend watcher to prevent resource leaks
      const sanitizedPath = project.path
        .replace(/\//g, '_')
        .replace(/\\/g, '_')
        .replace(/:/g, '_')
        .replace(/\./g, '_')
        .replace(/ /g, '_');
      const eventName = `project-artifacts-changed-${sanitizedPath}`;

      invokeStopWatcher(eventName).catch(err => {
        console.warn('Failed to stop backend watcher:', err);
      });
    };
  }, [project.path]);

  // Track artifacts that are currently moving (for loading indicators)
  const [movingArtifacts, setMovingArtifacts] = useState<Set<string>>(new Set());

  // Optimistic update function for moving artifacts
  // Immediately updates UI, then confirms with backend
  const handleOptimisticMove = useMemo(() => {
    return (artifactPath: string, targetFolderPath: string): (() => void) => {
      // Find the artifact
      const artifact = artifacts.find(a => a.path === artifactPath);
      if (!artifact) {
        return () => { }; // No-op rollback
      }

      // Calculate new path (backend will do this, but we need to predict it)
      const fileName = artifactPath.split('/').pop() || '';
      const predictedNewPath = `${targetFolderPath}/${fileName}`;

      // Store original state for rollback
      const originalArtifacts = [...artifacts];
      const originalMoving = new Set(movingArtifacts);

      // Mark as moving
      setMovingArtifacts(prev => new Set(prev).add(predictedNewPath));

      // Optimistically update: remove from old location, add to new with predicted path
      startTransition(() => {
        setArtifacts(prev => {
          // Remove from old location
          const filtered = prev.filter(a => a.path !== artifactPath);

          // Add to new location with predicted path
          filtered.push({
            ...artifact,
            path: predictedNewPath,
          });

          return filtered;
        });
      });

      // Return rollback function
      return () => {
        setArtifacts(originalArtifacts);
        setMovingArtifacts(originalMoving);
      };
    };
  }, [artifacts, movingArtifacts]);

  // Confirm optimistic move (called after backend succeeds)
  const handleConfirmMove = useMemo(() => {
    return (oldPath: string, newPath: string) => {
      startTransition(() => {
        // Calculate the predicted path (same as in optimistic update)
        // The predicted path is: targetFolderPath + "/" + fileName
        // Since newPath is the actual path from backend, we can derive the folder path
        const fileName = oldPath.split('/').pop() || '';
        const folderPath = newPath.substring(0, newPath.lastIndexOf('/'));
        const predictedPath = `${folderPath}/${fileName}`;

        // Update artifact path to actual new path and remove moving flag
        setArtifacts(prev => {
          return prev.map(artifact => {
            // Match by predicted path (set in optimistic update) or by old path
            // The optimistic update changed the path to predictedPath, so we match that
            if (artifact.path === predictedPath || artifact.path === oldPath) {
              return {
                ...artifact,
                path: newPath, // Update to actual path from backend
              };
            }
            return artifact;
          });
        });

        // Remove from moving set - remove predicted path
        setMovingArtifacts(prev => {
          const next = new Set(prev);
          next.delete(predictedPath);
          return next;
        });
      });
    };
  }, []);

  // Filter artifacts by type using deferred value to prevent blocking
  // This is where we separate the "load everything" approach into type-specific lists
  const kitsOnly = useMemo(() => {
    return deferredArtifacts.filter(artifact => {
      const type = artifact.frontMatter?.type;
      // Only include .md files that aren't other types
      return artifact.path.endsWith('.md') &&
        (!type || (type !== 'walkthrough' && type !== 'blueprint' && type !== 'agent' && type !== 'task'));
    });
  }, [deferredArtifacts]);

  const walkthroughs = useMemo(() => {
    return deferredArtifacts.filter(artifact => artifact.frontMatter?.type === 'walkthrough');
  }, [deferredArtifacts]);

  // Blueprints are loaded separately by BlueprintsTabContent
  // const blueprints = useMemo(() => {
  //   return deferredArtifacts.filter(artifact => artifact.frontMatter?.type === 'blueprint');
  // }, [deferredArtifacts]);

  const agents = useMemo(() => {
    return deferredArtifacts.filter(artifact => artifact.frontMatter?.type === 'agent');
  }, [deferredArtifacts]);

  const diagrams = useMemo(() => {
    // Filter for diagram files (.mmd or .mermaid extensions)
    return deferredArtifacts.filter(artifact =>
      artifact.path.endsWith('.mmd') || artifact.path.endsWith('.mermaid')
    );
  }, [deferredArtifacts]);

  // Generic handler to view any resource type
  const handleViewResource = async (resource: ResourceFile, type: ResourceType) => {
    try {
      const content = await invokeReadFile(resource.path);
      setViewingResource(resource);
      setResourceContent(content);
      setResourceType(type);
    } catch (error) {
      // Failed to load resource content
    }
  };

  // Convenience handlers for different resource types (backwards compatibility)
  const handleViewKit = async (artifact: ArtifactFile) => {
    await handleViewResource(artifact, (artifact.frontMatter?.type as ResourceType) || 'kit');
  };

  const handleViewDiagram = async (diagram: ArtifactFile) => {
    await handleViewResource(diagram, 'diagram');
  };

  const handleViewTask = async (blueprintPath: string, taskFile: string, taskDescription: string) => {
    try {
      const content = await invokeGetBlueprintTaskFile(blueprintPath, taskFile);

      // Create a ResourceFile object for the task
      const taskResource: ResourceFile = {
        name: taskFile.replace('.md', ''),
        path: `${blueprintPath}/${taskFile}`,
        frontMatter: {
          alias: taskDescription,
          type: 'task',
        },
        resourceType: 'task',
      };

      setViewingResource(taskResource);
      setResourceContent(content);
      setResourceType('task');
    } catch (error) {
      // Failed to load task content
    }
  };

  const handleViewPlan = async (plan: Plan) => {
    // Create a ResourceFile object for the plan
    const planResource: ResourceFile & { id?: string } = {
      id: plan.id, // Add plan ID to resource
      name: plan.name,
      path: plan.folderPath,
      frontMatter: {
        id: plan.id, // Also add to frontMatter for fallback
        alias: plan.name,
        type: 'plan',
        description: plan.description,
      },
      resourceType: 'plan',
    };

    // For now, set empty content - plan view will load its own data
    setViewingResource(planResource);
    setResourceContent(''); // Plan content is loaded separately
    setResourceType('plan');
  };

  // Handler to go back from resource view
  const handleBackFromResourceView = () => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
    // When returning from resource view, we might need to reset activeView?
    // No, keep current active view
  };

  // Find matching Project for Header (use dbProject if available, otherwise find from allProjects)
  const currentProjectForHeader = useMemo(() => {
    if (dbProject) {
      return dbProject;
    }
    return allProjects.find(p => p.id === project.id || p.path === project.path);
  }, [dbProject, allProjects, project.id, project.path]);

  // Handler to clear resource view
  const handleClearResourceView = () => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
    setNotebookFile(null);
  };

  const handleFileSelect = async (node: FileTreeNode) => {
    try {
      const content = await invokeReadFile(node.path);
      const isDiagram = node.path.endsWith('.mmd') || node.path.endsWith('.mermaid');

      // Set activeView to 'file' to indicate we're viewing a notebook file
      setActiveView('file');

      if (isDiagram) {
        // Diagrams use existing ResourceViewPage flow for MermaidDiagramViewer
        setViewingResource({
          name: node.name,
          path: node.path,
          resourceType: 'diagram',
          frontMatter: node.frontMatter
        });
        setResourceContent(content);
        setResourceType('diagram');
        setNotebookFile(null);
      } else {
        // Markdown files render directly in content area
        setNotebookFile({
          resource: {
            name: node.name,
            path: node.path,
            resourceType: (node.artifactType as ResourceType) || 'file',
            frontMatter: node.frontMatter
          },
          content
        });
        // Clear the main resource view if any
        setViewingResource(null);
        setResourceContent(null);
        setResourceType(null);
      }
    } catch (e) {
      console.error("Failed to read file", e);
    }
  };

  // If viewing any resource, show the generic resource view page
  // For plans, resourceContent can be empty (plans load their own data)
  if (viewingResource && resourceType) {
    // Determine view mode based on resource type
    const viewMode = resourceType === 'plan' ? 'plan' : undefined;

    // For plans, we allow empty content (they load their own data)
    // For other resources, require content
    if (resourceType === 'plan' || resourceContent) {
      return (
        <ResourceViewPage
          resource={viewingResource}
          resourceContent={resourceContent || ''}
          resourceType={resourceType}
          viewMode={viewMode}
          onBack={handleBackFromResourceView}
        />
      );
    }
  }

  // Render content based on active view
  const renderContent = () => {
    // If a notebook file is selected, show it directly
    if (notebookFile) {
      return (
        <NoteViewPage
          resource={notebookFile.resource}
          content={notebookFile.content}
          onContentChange={(newContent) => {
            setNotebookFile(prev => prev ? { ...prev, content: newContent } : null);
          }}
          onNavigate={(newResource, newContent) => {
            setNotebookFile({
              resource: newResource,
              content: newContent,
            });
          }}
        />
      );
    }

    switch (activeView) {
      case 'tasks':
        return (
          <TasksTabContent
            ref={tasksTabRef}
            context={project}
            projects={allProjects}
          />
        );
      case 'plans':
        return (
          <PlansTabContent
            ref={plansTabRef}
            plans={plans}
            plansLoading={plansLoading}
            onViewPlan={handleViewPlan}
            projectId={project.id}
            projectPath={project.path}
            onPlansChanged={loadPlans}
          />
        );
      case 'kits':
        return (
          <KitsTabContent
            kits={kitsOnly}
            kitsLoading={artifactsLoading}
            error={error}
            projectsCount={1}
            projectPath={project.path}
            projectId={project.id}
            onViewKit={handleViewKit}
            onReload={loadProjectArtifacts}
            onOptimisticMove={handleOptimisticMove}
            onConfirmMove={handleConfirmMove}
            movingArtifacts={movingArtifacts}
          />
        );
      case 'walkthroughs':
        return (
          <WalkthroughsTabContent
            kits={walkthroughs}
            kitsLoading={artifactsLoading}
            error={error}
            projectsCount={1}
            projectPath={project.path}
            projectId={project.id}
            onViewKit={handleViewKit}
            onReload={loadProjectArtifacts}
            onOptimisticMove={handleOptimisticMove}
            onConfirmMove={handleConfirmMove}
            movingArtifacts={movingArtifacts}
          />
        );
      case 'diagrams':
        return (
          <DiagramsTabContent
            diagrams={diagrams}
            diagramsLoading={artifactsLoading}
            error={error}
            projectPath={project.path}
            projectId={project.id}
            onViewDiagram={handleViewDiagram}
            onReload={loadProjectArtifacts}
            onOptimisticMove={handleOptimisticMove}
            onConfirmMove={handleConfirmMove}
            movingArtifacts={movingArtifacts}
          />
        );
      case 'timeline':
        return (
          <TimelineTabContent
            projectId={dbProject?.id || ''}
            gitUrl={dbProject?.gitUrl}
            gitConnected={dbProject?.gitConnected || false}
            onGitConnected={() => {
              // Reload database project to get updated git metadata
              invokeDbGetProjects().then(projects => {
                const matchingProject = projects.find(p => p.path === project.path);
                setDbProject(matchingProject || null);
              });
            }}
          />
        );
      case 'scrapbook':
        return (
          <ScrapbookTabContent
            projectPath={project.path}
            onViewKit={handleViewKit}
          />
        );
      case 'blueprints':
        return (
          <BlueprintsTabContent
            projectPath={project.path}
            projectsCount={1}
            onViewTask={handleViewTask}
          />
        );
      case 'agents':
        return (
          <AgentsTabContent
            kits={agents}
            kitsLoading={artifactsLoading}
            error={error}
            projectsCount={1}
            projectPath={project.path}
            projectId={project.id}
            onViewKit={handleViewKit}
          />
        );
      case 'file':
        // Placeholder for file view when selected from tree
        return (
          <Box p={4} textAlign="center" color="gray.500">
            Select a file from the notebook to view contents
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
      {/* Header above everything */}
      <Box flexShrink={0} bg="transparent">
        <Header
          currentProject={currentProjectForHeader}
          onNavigateToTasks={() => setActiveView('tasks')}
        />
      </Box>

      {/* Full screen content area with Splitter */}
      <Box
        ref={splitterContainerRef}
        flex="1"
        minH={0}
        overflow="hidden"
        bg="transparent"
      >
        <Splitter.Root
          defaultSize={[15, 85]}
          size={splitSizes}
          onResize={(details) => {
            if (details.size && details.size.length >= 2) {
              const [sidebar, content] = details.size;

              // Get container width to calculate pixel-based minimums
              const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;

              // Calculate minimum and maximum sidebar sizes as percentages
              const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;
              const maxSidebarPercent = (SIDEBAR_MAX_PX / containerWidth) * 100;

              let newSidebar = sidebar;
              let newContent = content;

              // Enforce pixel-based minimum (convert to percentage)
              if (sidebar > 0 && sidebar < minSidebarPercent) {
                // Snap to either 0 (collapsed) or minimum pixel width
                newSidebar = sidebar < minSidebarPercent / 2 ? 0 : minSidebarPercent;
                newContent = 100 - newSidebar;
              }
              // Enforce pixel-based maximum
              else if (sidebar > maxSidebarPercent) {
                newSidebar = maxSidebarPercent;
                newContent = 100 - newSidebar;
              }
              // Normal resize within bounds
              else {
                newSidebar = sidebar;
                newContent = content;
              }

              setSplitSizes([newSidebar, newContent]);
            }
          }}
          panels={[
            { id: 'sidebar', minSize: 0, maxSize: 100 },
            { id: 'content', minSize: 30 },
          ]}
          h="100%"
          orientation="horizontal"
        >
          {/* Sidebar Panel */}
          <Splitter.Panel
            id="sidebar"
            bg="transparent"
            style={{
              background: sidebarBg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <ProjectSidebar
              project={project}
              allProjects={allProjects}
              activeView={activeView}
              onBack={onBack}
              onProjectSelect={onProjectSelect}
              onViewChange={setActiveView}
              projectPath={project.path}
              onFileSelect={handleFileSelect}
              selectedFileId={notebookFile?.resource.path || viewingResource?.path}
              fileTreeVersion={fileTreeVersion}
              onTreeRefresh={handleTreeRefresh}
              onClearResourceView={handleClearResourceView}
            />
          </Splitter.Panel>

          {/* Resize Trigger - single 1px border with handle */}
          <Splitter.ResizeTrigger
            id="sidebar:content"
            w="1px"
            minW="1px"
            maxW="1px"
            p={0}
            m={0}
            bg={colorMode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(99, 102, 241, 0.2)'}
            cursor="col-resize"
            border="none"
            outline="none"
            boxShadow="none"
            css={{
              '&::before': { display: 'none' },
              '&::after': { display: 'none' },
              '& > *': { display: 'none' },
            }}
          />

          {/* Main Content Panel */}
          <Splitter.Panel id="content">
            <Box
              h="100%"
              minH={0}
              overflowY="auto"
              overflowX="hidden"
              position="relative"
              bg="transparent"
              p={notebookFile ? 0 : 6}
              style={contentBorderStyle}
            >
              {renderContent()}
            </Box>
          </Splitter.Panel>
        </Splitter.Root>
      </Box>
    </VStack>
  );
}
