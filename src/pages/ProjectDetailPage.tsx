import { useState, useEffect, useMemo, useRef, useTransition, useDeferredValue, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Box,
  VStack,
  Splitter,
} from '@chakra-ui/react';
import { toaster } from '../components/ui/toaster';
import { listen } from '@tauri-apps/api/event';
import KitsTabContent from '../components/kits/KitsTabContent';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import BlueprintsTabContent from '../components/blueprints/BlueprintsTabContent';
import AgentsTabContent from '../components/agents/AgentsTabContent';
import ScrapbookTabContent from '../components/scrapbook/ScrapbookTabContent';
import DiagramsTabContent from '../components/diagrams/DiagramsTabContent';
import GitTabContent from '../components/commits/GitTabContent';
import BookmarksTabContent from '../components/bookmarks/BookmarksTabContent';
import TasksTabContent, { TasksTabContentRef } from '../components/tasks/TasksTabContent';
import PlansTabContent, { PlansTabContentRef } from '../components/plans/PlansTabContent';
import ResourceViewPage from './ResourceViewPage';
import NoteViewPage from './NoteViewPage';
import ProjectSidebar from '../components/sidebar/ProjectSidebar';
import { ViewType } from '../components/sidebar/SidebarContent';
import EmptyProjectState from '../components/shared/EmptyProjectState';
import ProjectsTabContent from '../components/projects/ProjectsTabContent';
import WorkflowsTabContent from '../components/workflows/WorkflowsTabContent';
import { invokeGetProjectArtifacts, invokeGetChangedArtifacts, invokeWatchProjectArtifacts, invokeStopWatcher, invokeReadFile, invokeWriteFile, invokeGetProjectRegistry, invokeGetBlueprintTaskFile, invokeDbGetProjects, invokeGetProjectPlans, ArtifactFile, Project, ProjectEntry, TimeoutError, FileTreeNode } from '../ipc';
import { deleteResources } from '../ipc/artifacts';
import { invokeGetOrCreateWalkthroughByPath } from '../ipc/walkthroughs';
import { ResourceFile, ResourceType } from '../types/resource';
import { Plan } from '../types/plan';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useProjectArtifacts } from '../contexts/ProjectArtifactsContext';
import { useColorMode } from '../contexts/ColorModeContext';
import { SelectionProvider } from '../contexts/SelectionContext';

interface ProjectDetailPageProps {
  project: ProjectEntry;
  onBack: () => void;
  onProjectSelect?: (project: Project) => void;
  isWorktreeView?: boolean;
  isVault?: boolean;
}

export default function ProjectDetailPage({ project, onBack, onProjectSelect, isWorktreeView = false, isVault = false }: ProjectDetailPageProps) {
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
      borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
    }
    : {
      borderTop: '1px solid rgba(99, 102, 241, 0.2)',
      borderLeft: '1px solid rgba(99, 102, 241, 0.2)',
    };

  // Sidebar state
  const [activeView, setActiveView] = useState<ViewType>(isVault ? 'projects' : 'file');
  const [fileTreeVersion, setFileTreeVersion] = useState(0);

  // Sidebar drag UX constants - tuned to industry standards (VS Code, Obsidian, Notion)
  const SIDEBAR_STORAGE_KEY = 'bluekit-sidebar-width';
  const SIDEBAR_MIN_PX = 240;           // Compact-friendly minimum (allows readable content)
  const SIDEBAR_MAX_PX = 500;           // Absolute max in pixels
  const SIDEBAR_MAX_PERCENT = 40;       // Never more than 40% of viewport
  const SIDEBAR_DEFAULT_PERCENT = 18;   // ~280px on typical 1440px screens
  const SNAP_COLLAPSE_THRESHOLD = 0.55; // Collapse if below 55% of min (more forgiving)

  // Sidebar width with localStorage persistence
  const [splitSizes, setSplitSizes] = useState<[number, number]>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 2) {
          return parsed as [number, number];
        }
      }
    } catch {
      // Invalid stored value, use default
    }
    return [SIDEBAR_DEFAULT_PERCENT, 100 - SIDEBAR_DEFAULT_PERCENT];
  });

  // Track whether sidebar is being actively dragged (for animation control)
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);

  // Ref to track splitter container width
  const splitterContainerRef = useRef<HTMLDivElement>(null);

  // Persist sidebar width to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(splitSizes));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [splitSizes]);

  // Keyboard shortcut: Cmd/Ctrl + \ to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
        const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;

        setSplitSizes(prev => {
          if (prev[0] < 5) {
            // Currently collapsed - expand to default
            return [minSidebarPercent, 100 - minSidebarPercent];
          } else {
            // Currently expanded - collapse
            return [0, 100];
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle sidebar collapse/expand with animation
  const toggleSidebar = useCallback(() => {
    const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
    const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;

    setSplitSizes(prev => {
      if (prev[0] < 5) {
        return [minSidebarPercent, 100 - minSidebarPercent];
      } else {
        return [0, 100];
      }
    });
  }, []);

  const handleTreeRefresh = useCallback(() => setFileTreeVersion(v => v + 1), []);

  // Notebook handlers (new file/folder) - lifted from SidebarContent -> NotebookTree
  const [notebookHandlers, setNotebookHandlers] = useState<{
    onNewFile: (folderPath: string) => void;
    onNewFolder: (folderPath: string) => void;
  } | null>(null);

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

  // Track if current file is newly created (to open in edit mode)
  const [isNewFile, setIsNewFile] = useState(false);

  // Key to force NoteViewPage remount on new file creation
  const [newFileKey, setNewFileKey] = useState(0);

  // Title edit mode: path being edited and current editing title (synced from editor H1)
  const [titleEditPath, setTitleEditPath] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('Untitled');

  // Debounce timer for real-time file rename during title edit
  const renameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to track when we're creating a new file (prevents race condition in handleFileSelect)
  const isCreatingNewFileRef = useRef(false);

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

  // Load plans for this project - wrapped in useCallback for stable reference
  const loadPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      const projectPlans = await invokeGetProjectPlans(project.id);
      flushSync(() => {
        setPlans(projectPlans);
      });
    } catch (err) {
      console.error('Failed to load plans:', err);
      flushSync(() => {
        setPlans([]);
      });
    } finally {
      setPlansLoading(false);
    }
  }, [project.id]);

  // Callback for plan deletion - refreshes the plans list
  const handlePlanDeleted = useCallback(async () => {
    await loadPlans();
  }, [loadPlans]);

  // Load plans on mount and when project changes
  useEffect(() => {
    loadPlans();
  }, [project.id, loadPlans]);

  // Handle restricted views
  useEffect(() => {
    if (activeView === 'blueprints' && !flags.blueprints) {
      setActiveView('tasks');
    } else if (activeView === 'scrapbook' && !flags.scrapbook) {
      setActiveView('tasks');
    } else if (activeView === 'agents' && !flags.agents) {
      setActiveView('tasks');
    } else if (activeView === 'diagrams' && !flags.diagrams) {
      setActiveView('tasks');
    }
  }, [activeView, flags.blueprints, flags.scrapbook, flags.agents, flags.diagrams]);

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

  const handleViewWalkthrough = async (walkthrough: ArtifactFile) => {
    try {
      // Get or create the walkthrough in DB (ensures file-based walkthroughs are synced)
      const walkthroughData = await invokeGetOrCreateWalkthroughByPath(
        project.id,
        walkthrough.path
      );

      // Create a ResourceFile object with the DB ID
      const walkthroughResource: ResourceFile & { id?: string } = {
        id: walkthroughData.id,
        name: walkthroughData.name,
        path: walkthrough.path,
        frontMatter: {
          ...walkthrough.frontMatter,
          id: walkthroughData.id, // Include ID in frontMatter for ResourceViewPage
          type: 'walkthrough',
        },
        resourceType: 'walkthrough',
      };

      setViewingResource(walkthroughResource);
      setResourceContent(''); // Walkthrough content is loaded by WalkthroughWorkspace
      setResourceType('walkthrough');
    } catch (error) {
      console.error('Failed to load walkthrough:', error);
    }
  };

  // Handler to go back from resource view - wrapped in useCallback for stable reference
  const handleBackFromResourceView = useCallback(() => {
    // Store resourceType before clearing it
    const wasViewingPlan = resourceType === 'plan';

    // If returning from a plan view, set activeView to 'plans' to show PlansTabContent
    if (wasViewingPlan) {
      setActiveView('plans');
      // Fallback refresh: reload plans when returning from plan view
      // This ensures the list is updated even if onPlanDeleted callback wasn't triggered
      loadPlans();
    }

    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
  }, [resourceType, loadPlans]);

  // Handler to clear resource view
  const handleClearResourceView = useCallback(() => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
    setNotebookFile(null);
  }, []);

  // Finalize title edit: clear debounce timer, save content, and clear state
  // Note: File rename already happens in real-time via debounced handler
  const finalizeTitleEdit = useCallback(async () => {
    // Clear any pending debounced rename
    if (renameDebounceRef.current) {
      clearTimeout(renameDebounceRef.current);
      renameDebounceRef.current = null;
    }

    if (!titleEditPath || !notebookFile) {
      setTitleEditPath(null);
      setEditingTitle('Untitled');
      return;
    }

    try {
      // Save the current content to the current path (may have been renamed)
      await invokeWriteFile(notebookFile.resource.path, notebookFile.content);
      // Refresh tree to ensure it's up to date
      handleTreeRefresh();
    } catch (error) {
      console.error('Failed to finalize title edit:', error);
    }

    // Clear title edit state
    setTitleEditPath(null);
    setEditingTitle('Untitled');
  }, [titleEditPath, notebookFile, handleTreeRefresh]);


  const handleFileSelect = useCallback(async (node: FileTreeNode) => {
    try {
      // Skip finalize check if we're in the middle of creating a new file (prevents race condition)
      if (!isCreatingNewFileRef.current && titleEditPath && node.path !== titleEditPath) {
        await finalizeTitleEdit();
        setIsNewFile(false);
      }

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
  }, [titleEditPath, finalizeTitleEdit]);

  // Handler for when a new file is created in NotebookTree
  // Opens the file immediately in edit mode with title sync enabled
  const handleNewFileCreated = useCallback(async (node: FileTreeNode) => {
    // Set ref FIRST to prevent race condition in handleFileSelect
    isCreatingNewFileRef.current = true;

    // Finalize any previous title edit
    await finalizeTitleEdit();

    // Now set up the new file's state
    setIsNewFile(true);
    setNewFileKey(k => k + 1); // Force NoteViewPage remount
    setTitleEditPath(node.path);
    setEditingTitle('Untitled');
    await handleFileSelect(node);

    // Clear the ref after file is loaded
    isCreatingNewFileRef.current = false;
  }, [handleFileSelect, finalizeTitleEdit]);

  // If viewing any resource, show the generic resource view page
  // For plans and walkthroughs, resourceContent can be empty (they load their own data)
  if (viewingResource && resourceType) {
    // Determine view mode based on resource type
    const viewMode = resourceType === 'plan' ? 'plan' : resourceType === 'walkthrough' ? 'walkthrough' : undefined;

    // For plans and walkthroughs, we allow empty content (they load their own data)
    // For other resources, require content
    if (resourceType === 'plan' || resourceType === 'walkthrough' || resourceContent) {
      // Provide onPlanDeleted callback for plan views to ensure list is refreshed after deletion
      const planDeletedCallback = resourceType === 'plan' ? handlePlanDeleted : undefined;
      return (
        <ResourceViewPage
          resource={viewingResource}
          resourceContent={resourceContent || ''}
          resourceType={resourceType}
          viewMode={viewMode}
          onBack={handleBackFromResourceView}
          onPlanDeleted={planDeletedCallback}
        />
      );
    }
  }

  // Render content based on active view
  const renderContent = () => {
    // If a notebook file is selected, show it directly (activeView='file' should be set)
    // But we check notebookFile just in case
    if (activeView === 'file' && notebookFile) {
      return (
        <NoteViewPage
          key={newFileKey}
          resource={notebookFile.resource}
          content={notebookFile.content}
          initialViewMode={isNewFile ? 'edit' : undefined}
          editingTitle={titleEditPath ? editingTitle : undefined}
          onContentChange={(newContent) => {
            setNotebookFile(prev => prev ? { ...prev, content: newContent } : null);
            // Extract H1 title from content and sync to tree if in title edit mode
            if (titleEditPath) {
              const h1Match = newContent.match(/^#\s+(.+)$/m);
              if (h1Match) {
                const newTitle = h1Match[1];
                setEditingTitle(newTitle);

                // Debounced real-time file rename
                if (renameDebounceRef.current) {
                  clearTimeout(renameDebounceRef.current);
                }
                renameDebounceRef.current = setTimeout(async () => {
                  const sanitizedTitle = newTitle.trim().replace(/[/\\:*?"<>|]/g, '-') || 'Untitled';
                  const oldPath = titleEditPath;
                  const dirPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) || oldPath.substring(0, oldPath.lastIndexOf('\\') + 1);
                  const newPath = `${dirPath}${sanitizedTitle}.md`;

                  if (newPath !== oldPath) {
                    try {
                      // Save content to new path
                      await invokeWriteFile(newPath, newContent);
                      // Delete old file
                      await deleteResources([oldPath]);
                      // Update titleEditPath to new path
                      setTitleEditPath(newPath);
                      // Update notebookFile state with new path
                      setNotebookFile(prev => prev ? {
                        ...prev,
                        resource: {
                          ...prev.resource,
                          name: `${sanitizedTitle}.md`,
                          path: newPath,
                        }
                      } : null);
                      // Refresh tree
                      handleTreeRefresh();
                    } catch (error) {
                      console.error('Real-time rename failed:', error);
                    }
                  }
                }, 800); // 800ms debounce for rename
              }
            }
          }}
          onNavigate={async (newResource, newContent) => {
            // Finalize title edit before navigating (saves and renames file)
            if (titleEditPath) {
              await finalizeTitleEdit();
            }
            setIsNewFile(false); // Reset when navigating
            setNotebookFile({
              resource: newResource,
              content: newContent,
            });
          }}
        />
      );
    }

    // Fallback for file view if notebookFile is missing (should ideally show empty state, but for now we follow pattern)
    if (activeView === 'file') {
      return (
        <EmptyProjectState
          onCreateNote={() => {
            if (notebookHandlers) {
              notebookHandlers.onNewFile(project.path);
            } else {
              toaster.create({
                title: 'Unable to create note',
                description: 'File tree is not ready yet',
                type: 'error'
              });
            }
          }}
        />
      );
    }

    switch (activeView) {
      case 'tasks':
        return (
          <TasksTabContent
            ref={tasksTabRef}
            context={isVault ? 'workspace' : project}
            projects={allProjects}
          />
        );
      case 'projects':
        if (isVault) {
          return (
            <ProjectsTabContent
              projects={allProjects}
              projectsLoading={false}
              error={null}
              onProjectSelect={(p) => onProjectSelect?.(p)}
              onProjectsChanged={() => {
                invokeGetProjectRegistry().then(setAllProjects);
              }}
            />
          );
        }
        return null;
      case 'workflows':
        if (isVault) {
          return <WorkflowsTabContent />;
        }
        return null;
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
            onViewKit={handleViewWalkthrough}
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
      case 'git':
        return (
          <GitTabContent
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
      case 'bookmarks':
        return (
          <BookmarksTabContent
            projectPath={project.path}
            onViewBookmark={handleFileSelect}
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
      default:
        return null;
    }
  };

  return (
    <SelectionProvider>
      <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
        {/* Full screen content area with Splitter */}
        <Box
          ref={splitterContainerRef}
          flex="1"
          minH={0}
          overflow="hidden"
          bg="transparent"
        >
          <Splitter.Root
            defaultSize={[SIDEBAR_DEFAULT_PERCENT, 100 - SIDEBAR_DEFAULT_PERCENT]}
            size={splitSizes}
            onResize={(details) => {
              if (details.size && details.size.length >= 2) {
                const [sidebar, content] = details.size;

                // Get container width to calculate pixel-based constraints
                const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;

                // Calculate minimum sidebar size as percentage
                const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;

                // Calculate maximum: use the smaller of pixel-based or viewport-relative max
                const pixelMaxPercent = (SIDEBAR_MAX_PX / containerWidth) * 100;
                const maxSidebarPercent = Math.min(pixelMaxPercent, SIDEBAR_MAX_PERCENT);

                // Calculate snap threshold (percentage below which we collapse)
                // Using 55% of min creates a comfortable "decision zone"
                const snapThresholdPercent = minSidebarPercent * SNAP_COLLAPSE_THRESHOLD;

                let newSidebar = sidebar;
                let newContent = content;

                // COLLAPSE ZONE: if below threshold, snap to fully collapsed
                if (sidebar > 0 && sidebar < snapThresholdPercent) {
                  newSidebar = 0;
                  newContent = 100;
                }
                // SNAP-TO-MIN ZONE: if between threshold and minimum, snap to minimum
                // This prevents awkward "almost collapsed" states
                else if (sidebar >= snapThresholdPercent && sidebar < minSidebarPercent) {
                  newSidebar = minSidebarPercent;
                  newContent = 100 - minSidebarPercent;
                }
                // MAX CONSTRAINT: enforce maximum width (responsive to viewport)
                else if (sidebar > maxSidebarPercent) {
                  newSidebar = maxSidebarPercent;
                  newContent = 100 - newSidebar;
                }
                // NORMAL ZONE: free resize within valid bounds
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
            {/* Sidebar Panel - with smooth transition when not dragging */}
            <Splitter.Panel
              id="sidebar"
              bg="transparent"
              style={{
                background: sidebarBg,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: isSidebarDragging ? 'none' : 'flex-basis 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: isSidebarDragging ? 'flex-basis' : 'auto',
              }}
            >
              <ProjectSidebar
                project={project}
                allProjects={allProjects}
                activeView={activeView}
                onBack={onBack}
                onProjectSelect={onProjectSelect}
                onViewChange={setActiveView}
                isWorktreeView={isWorktreeView}
                projectPath={project.path}
                onFileSelect={handleFileSelect}
                selectedFileId={notebookFile?.resource.path || viewingResource?.path}
                fileTreeVersion={fileTreeVersion}
                onTreeRefresh={handleTreeRefresh}
                onClearResourceView={handleClearResourceView}
                onNewFileCreated={handleNewFileCreated}
                titleEditPath={titleEditPath}
                editingTitle={editingTitle}
                onHandlersReady={setNotebookHandlers}
                isVault={isVault}
              />
            </Splitter.Panel>

            {/* Professional Resize Handle - wide hit area with visual feedback */}
            <Splitter.ResizeTrigger
              id="sidebar:content"
              w="20px"
              minW="20px"
              maxW="20px"
              p={0}
              mx="-10px"
              bg="transparent"
              cursor="col-resize"
              border="none"
              outline="none"
              boxShadow="none"
              position="relative"
              zIndex={10}
              onDoubleClick={toggleSidebar}
              onPointerDown={() => setIsSidebarDragging(true)}
              onPointerUp={() => setIsSidebarDragging(false)}
              onPointerLeave={() => setIsSidebarDragging(false)}
              css={{
                // Hide default splitter decorations
                '&::before': { display: 'none' },
                '&::after': { display: 'none' },
                // Visible resize line (thin, centered in the hit area)
                '&': {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                // Prevent text selection during drag
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              {/* Invisible resize hit area - stays transparent */}
              <Box
                position="absolute"
                left="50%"
                top={0}
                bottom={0}
                w="2px"
                transform="translateX(-50%)"
                bg="transparent"
              />
              {/* Drag dots indicator (shows on hover) */}
              <Box
                position="absolute"
                left="50%"
                top="50%"
                transform="translate(-50%, -50%)"
                opacity={0}
                transition="opacity 0.2s ease, transform 0.2s ease"
                css={{
                  '[data-part="resize-trigger"]:hover &': {
                    opacity: 0.7,
                    transform: 'translate(-50%, -50%) scale(1)',
                  },
                  '[data-part="resize-trigger"][data-state="dragging"] &': {
                    opacity: 1,
                    transform: 'translate(-50%, -50%) scale(1.1)',
                  },
                }}
              >
                <VStack gap="3px">
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      w="4px"
                      h="4px"
                      borderRadius="full"
                      bg={{ _light: 'rgba(99,102,241,0.7)', _dark: 'rgba(129,140,248,0.9)' }}
                      transition="transform 0.15s ease"
                      css={{
                        '[data-part="resize-trigger"][data-state="dragging"] &': {
                          transform: 'scale(1.2)',
                        },
                      }}
                    />
                  ))}
                </VStack>
              </Box>
            </Splitter.ResizeTrigger>

            {/* Main Content Panel */}
            <Splitter.Panel id="content">
              <Box
                h="100%"
                minH={0}
                overflowY="auto"
                overflowX="hidden"

                position="relative"
                p={notebookFile ? 0 : 6}
                borderTopLeftRadius="2xl"
                style={contentBorderStyle}
                css={{
                  background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                }}
              >
                {renderContent()}
              </Box>
            </Splitter.Panel>
          </Splitter.Root>
        </Box>
      </VStack>
    </SelectionProvider>
  );
}
