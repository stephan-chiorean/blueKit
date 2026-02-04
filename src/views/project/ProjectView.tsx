import { useState, useEffect, useMemo, useRef, useTransition, useDeferredValue, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Box,
  VStack,
  Splitter,
} from '@chakra-ui/react';
import { LuFile, LuBookOpen, LuBot, LuPalette, LuMap, LuListTodo, LuLibrary, LuFolder, LuPackage } from 'react-icons/lu';
import { BsStack } from 'react-icons/bs';
import { toaster } from '@/shared/components/ui/toaster';
import { listen } from '@tauri-apps/api/event';
import path from 'path';
import KitsSection from './sections/KitsSection';
import WalkthroughsSection from './sections/WalkthroughsSection';
import BlueprintsSection from './sections/BlueprintsSection';
import AgentsTabContent from '@/features/agents/components/AgentsTabContent';
import ScrapbookTabContent from '@/features/scrapbook/components/ScrapbookTabContent';
import DiagramsTabContent from '@/features/diagrams/components/DiagramsTabContent';
import GitSection from './sections/GitSection';
import BookmarksTabContent from '@/features/bookmarks/components/BookmarksTabContent';
import TasksSection, { TasksSectionRef } from './sections/TasksSection';
import PlansSection, { PlansSectionRef } from './sections/PlansSection';
import ResourceViewPage from '@/pages/ResourceViewPage';
import NoteViewPage from '@/pages/NoteViewPage';
import ProjectSidebar from './ProjectSidebar';
import { ViewType } from './components/SidebarContent';
import ProjectsTabContent from '@/features/projects/components/ProjectsTabContent';
import WorkflowsTabContent from '@/features/workflows/components/WorkflowsTabContent';
import { BrowserTabs } from '@/tabs';
import EmptyTabState from '@/shared/components/EmptyTabState';
import { invokeGetProjectArtifacts, invokeGetChangedArtifacts, invokeWatchProjectArtifacts, invokeStopWatcher, invokeReadFile, invokeWriteFile, invokeGetProjectRegistry, invokeGetBlueprintTaskFile, invokeDbGetProjects, invokeGetProjectPlans, ArtifactFile, Project, TimeoutError, FileTreeNode } from '@/ipc';
import { deleteResources } from '@/ipc/artifacts';
import { invokeGetOrCreateWalkthroughByPath } from '@/ipc/walkthroughs';
import { ResourceFile, ResourceType } from '@/types/resource';
import { Plan, PlanDetails } from '@/types/plan';
import { invokeGetPlanDetails } from '@/ipc/plans';
import { useFeatureFlags } from '@/shared/contexts/FeatureFlagsContext';
import { useProjectArtifacts } from '@/shared/contexts/ProjectArtifactsContext';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { SelectionProvider } from '@/shared/contexts/SelectionContext';
import { useTabContext } from '@/app/TabContext';

interface ProjectViewProps {
  project: Project;
  onBack: () => void;
  onProjectSelect?: (project: Project) => void;
  isWorktreeView?: boolean;
  isVault?: boolean;
}

export default function ProjectView({ project, onBack, onProjectSelect, isWorktreeView = false, isVault = false }: ProjectViewProps) {
  // Feature flags
  const { flags } = useFeatureFlags();
  const { setArtifacts: setGlobalArtifacts } = useProjectArtifacts();
  const { colorMode } = useColorMode();

  // Glass styling for sidebar to match header
  const sidebarBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(20, 20, 25, 0.15)';




  const [fileTreeVersion, setFileTreeVersion] = useState(0);
  const { tabs, activeTabId, selectTab, closeTab, reorderTabs, openInNewTab, openInCurrentTab, updateTabResource } = useTabContext();
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  console.log('[ProjectView] Render:', { activeTabId, activeTab, tabsCount: tabs.length });

  const getTabIconComponent = useCallback((iconId?: string) => {
    switch (iconId) {
      case 'book':
      case 'walkthrough':
        return LuBookOpen;
      case 'bot':
      case 'agent':
        return LuBot;
      case 'palette':
      case 'diagram':
        return LuPalette;
      case 'map':
      case 'plan':
      case 'editor-plans':
        return LuMap;
      case 'list':
      case 'task':
        return LuListTodo;
      case 'stack':
      case 'blueprint':
        return BsStack;
      case 'library':
        return LuLibrary;
      case 'folder':
      case 'project':
        return LuFolder;
      case 'file':
      case 'kit':
      case 'scrapbook':
      default:
        return LuFile;
    }
  }, []);

  const getViewForTabType = useCallback((tabType?: string): ViewType | undefined => {
    switch (tabType) {
      case 'library':
        return undefined; // Default to Empty State for library too
      case 'project':
        // Return undefined to trigger EmptyTabState for new project tabs
        return undefined;
      case 'kit':
        return 'kits';
      case 'walkthrough':
        return 'walkthroughs';
      case 'plan':
        return 'plans';
      case 'diagram':
        return 'diagrams';
      case 'agent':
        return 'agents';
      case 'blueprint':
        return 'blueprints';
      case 'task':
        return 'blueprints';
      case 'scrapbook':
        return 'scrapbook';
      case 'file':
        return 'file';
      default:
        // Always default to undefined (Empty State) unless a specific view is matched
        return undefined;
    }
  }, [isVault]);

  const activeView: ViewType | undefined = activeTab?.resource.view ?? getViewForTabType(activeTab?.type);

  const getTabLabel = useCallback((tab: { title?: string; resource?: { path?: string }; type?: string }) => {
    let label = '';
    if (tab.title) {
      label = tab.title;
    } else if (tab.resource?.path) {
      label = path.basename(tab.resource.path);
    } else {
      label = tab.type ?? 'Tab';
    }
    // Always strip markdown extensions from the label
    return label.replace(/\.(md|mmd|mermaid)$/i, '');
  }, []);

  const browserTabs = useMemo(() => {
    return tabs.map(tab => {
      let label = getTabLabel(tab);
      // Suppress icon for "New Tab" and regular .md files (file/scrapbook types)
      const shouldSuppressIcon = tab.title === 'New Tab' || tab.type === 'file' || tab.type === 'scrapbook';
      let icon = shouldSuppressIcon ? undefined : getTabIconComponent(tab.icon || tab.type);
      let iconColor: string | undefined = undefined;

      // Override based on view
      if (tab.resource?.view === 'kits') {
        // Show generic "Kits" only if no specific path (viewing list)
        if (!tab.resource?.path) {
          label = 'Kits';
        }
        icon = LuPackage;
        iconColor = 'blue.400';
      } else if (tab.resource?.view === 'walkthroughs') {
        // Show generic "Walkthroughs" only if no specific path (viewing list)
        if (!tab.resource?.path) {
          label = 'Walkthroughs';
        }
        icon = LuBookOpen;
        iconColor = 'orange.400';
      }

      return {
        id: tab.id,
        label,
        icon,
        iconColor,
        closable: tab.closable,
      };
    });
  }, [getTabIconComponent, getTabLabel, tabs]);

  // Removed useEffect that forced default view
  // We want to allow "Empty State" tabs which have no view defined

  // Sidebar drag UX constants - tuned to industry standards (VS Code, Obsidian, Notion)
  const SIDEBAR_STORAGE_KEY = 'bluekit-sidebar-width';
  const SIDEBAR_MIN_PX = 240;              // Compact-friendly minimum (allows readable content)
  const SIDEBAR_MAX_PX = 500;              // Absolute max in pixels
  const SIDEBAR_MAX_PERCENT = 40;          // Never more than 40% of viewport
  const SIDEBAR_DEFAULT_PERCENT = 18;      // ~280px on typical 1440px screens
  const SNAP_COLLAPSE_THRESHOLD = 0.55;    // Collapse if below 55% of min (more forgiving)
  const COLLAPSED_SIDEBAR_PERCENT = 0;     // True "zero" – content hidden completely

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

  // Track the last valid sidebar size (size before collapse)
  const [lastSidebarSize, setLastSidebarSize] = useState<number>(SIDEBAR_DEFAULT_PERCENT);

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



  // Handle drag end snapping
  useEffect(() => {
    if (!isSidebarDragging) {
      // Drag just finished (or initial load). Check if we need to snap.
      setSplitSizes(prev => {
        const [sidebar] = prev;
        const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
        const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;
        const snapThresholdPercent = minSidebarPercent * SNAP_COLLAPSE_THRESHOLD;

        // Visual "zero" check (allow small variance)
        if (sidebar <= COLLAPSED_SIDEBAR_PERCENT + 0.1) return prev;

        // 1. If below threshold, snap to ZERO
        if (sidebar < snapThresholdPercent) {
          return [COLLAPSED_SIDEBAR_PERCENT, 100 - COLLAPSED_SIDEBAR_PERCENT];
        }
        // 2. If between threshold and min, snap to MIN
        else if (sidebar < minSidebarPercent) {
          return [minSidebarPercent, 100 - minSidebarPercent];
        }

        return prev;
      });
    }
  }, [isSidebarDragging, SIDEBAR_MIN_PX]);

  // Handle responsive resizing
  useEffect(() => {
    const container = splitterContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        if (containerWidth <= 0) continue;

        setSplitSizes(prev => {
          const currentSidebarPercent = prev[0];

          // Don't auto-expand if collapsed
          if (currentSidebarPercent <= COLLAPSED_SIDEBAR_PERCENT + 0.1) {
            return prev;
          }

          // Calculate current pixel width
          const currentPx = (currentSidebarPercent / 100) * containerWidth;

          // Enforce min pixel width
          if (currentPx < SIDEBAR_MIN_PX) {
            const newPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;
            // If min width is too large (e.g. > max percent), clamp it
            if (newPercent > SIDEBAR_MAX_PERCENT) {
              return [SIDEBAR_MAX_PERCENT, 100 - SIDEBAR_MAX_PERCENT];
            }
            return [newPercent, 100 - newPercent];
          }

          // Enforce max pixel width
          if (currentPx > SIDEBAR_MAX_PX) {
            const newPercent = (SIDEBAR_MAX_PX / containerWidth) * 100;
            return [newPercent, 100 - newPercent];
          }

          return prev;
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [SIDEBAR_MIN_PX, SIDEBAR_MAX_PX, SIDEBAR_MAX_PERCENT]);

  // Keyboard shortcut: Cmd/Ctrl + \ to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSplitSizes(prev => {
          const isCollapsed = prev[0] <= COLLAPSED_SIDEBAR_PERCENT + 0.1;
          const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
          const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;

          if (isCollapsed) {
            // Currently collapsed - expand to minimum readable width
            return [minSidebarPercent, 100 - minSidebarPercent];
          } else {
            // Currently expanded - collapse
            return [COLLAPSED_SIDEBAR_PERCENT, 100 - COLLAPSED_SIDEBAR_PERCENT];
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle sidebar collapse/expand with animation
  const toggleSidebar = useCallback(() => {
    setSplitSizes(prev => {
      const isCollapsed = prev[0] <= COLLAPSED_SIDEBAR_PERCENT + 0.1;

      if (isCollapsed) {
        // Restore to last valid size, or default, or min
        const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
        const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;

        // Use lastSize if it's substantial, otherwise ensure minimum
        const targetSize = Math.max(lastSidebarSize, minSidebarPercent);
        return [targetSize, 100 - targetSize];
      } else {
        // Save current size before collapsing
        setLastSidebarSize(prev[0]);
        return [COLLAPSED_SIDEBAR_PERCENT, 100 - COLLAPSED_SIDEBAR_PERCENT];
      }
    });
  }, [lastSidebarSize, SIDEBAR_MIN_PX]);

  const handleTreeRefresh = useCallback(() => setFileTreeVersion(v => v + 1), []);

  // Notebook handlers (new file/folder) - lifted from SidebarContent -> NotebookTree
  const [notebookHandlers, setNotebookHandlers] = useState<{
    onNewFile: (folderPath: string) => void;
    onNewFolder: (folderPath: string) => void;
  } | null>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+T: New Tab
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        openInNewTab(
          {
            type: 'project',
            projectId: project.id,
            path: project.path,
            view: 'file',
          },
          { title: "New Tab" }
        );
      }

      // Cmd+W: Close Tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }

      // Cmd+1-9: Switch Tabs
      if ((e.metaKey || e.ctrlKey) && !isNaN(parseInt(e.key)) && parseInt(e.key) >= 1 && parseInt(e.key) <= 9) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (browserTabs[index]) {
          selectTab(browserTabs[index].id);
        }
      }

      // Cmd+N: New Note (only if actively viewing a project tab)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        if (notebookHandlers && project.path) {
          e.preventDefault();
          notebookHandlers.onNewFile(project.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, closeTab, selectTab, browserTabs, notebookHandlers, project.path]);

  // Separate artifacts and loading state for better performance
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  const tasksTabRef = useRef<TasksSectionRef>(null);
  const plansTabRef = useRef<PlansSectionRef>(null);

  // Database project (for git metadata)
  const [dbProject, setDbProject] = useState<Project | null>(null);

  // Plans state
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Use transition for non-urgent updates (file watching updates)
  const [, startTransition] = useTransition();

  // Defer artifact updates to prevent blocking UI
  const deferredArtifacts = useDeferredValue(artifacts);

  // Resource viewing state
  const [viewingResource, setViewingResource] = useState<ResourceFile | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);
  const [notebookFile, setNotebookFile] = useState<{ resource: ResourceFile; content: string } | null>(null);

  useEffect(() => {
    let isActive = true;

    const resetResourceState = () => {
      setViewingResource(null);
      setResourceContent(null);
      setResourceType(null);
      setNotebookFile(null);
    };

    const loadResourceFromTab = async () => {
      if (!activeTab || activeTab.type === 'project' || activeTab.type === 'library') {
        resetResourceState();
        return;
      }

      const tabType = activeTab.type as ResourceType;
      const tabPath = activeTab.resource.path;
      const tabTitle = activeTab.title || (tabPath ? path.basename(tabPath).replace(/\.(md|mmd|mermaid)$/i, '') : 'Untitled');

      if (tabType === 'file') {
        if (!tabPath) {
          resetResourceState();
          return;
        }
        const fileResource: ResourceFile = {
          name: tabTitle,
          path: tabPath,
          resourceType: 'file',
          frontMatter: { type: 'file', alias: tabTitle },
        };
        setNotebookFile({
          resource: fileResource,
          content: '',
        });
        try {
          const content = await invokeReadFile(tabPath);
          if (!isActive) return;
          setNotebookFile({
            resource: fileResource,
            content,
          });
          setViewingResource(null);
          setResourceType(null);
          setResourceContent(null);
        } catch (error) {
          if (!isActive) return;
          resetResourceState();
        }
        return;
      }

      const resource: ResourceFile & { id?: string } = {
        name: tabTitle,
        path: tabPath || '',
        resourceType: tabType,
        frontMatter: {
          type: tabType,
          alias: tabTitle,
          id: activeTab.resource.planId || activeTab.resource.walkthroughId,
        },
      };

      if (tabType === 'plan' && activeTab.resource.planId) {
        resource.id = activeTab.resource.planId;
        if (!isActive) return;
        setViewingResource(resource);
        setResourceType('plan');
        setResourceContent('');
        setNotebookFile(null);
        return;
      }

      if (tabType === 'walkthrough' && activeTab.resource.walkthroughId) {
        resource.id = activeTab.resource.walkthroughId;
        if (!isActive) return;
        setViewingResource(resource);
        setResourceType('walkthrough');
        setResourceContent('');
        setNotebookFile(null);
        return;
      }

      if (tabType === 'task') {
        const blueprintPath = activeTab.resource.blueprintPath;
        const taskFile = activeTab.resource.taskFile;
        if (!blueprintPath || !taskFile) {
          if (!isActive) return;
          resetResourceState();
          return;
        }
        try {
          const content = await invokeGetBlueprintTaskFile(blueprintPath, taskFile);
          if (!isActive) return;
          setViewingResource(resource);
          setResourceType('task');
          setResourceContent(content);
          setNotebookFile(null);
        } catch (error) {
          if (!isActive) return;
          setViewingResource(resource);
          setResourceType('task');
          setResourceContent('');
          setNotebookFile(null);
        }
        return;
      }

      if (!tabPath) {
        resetResourceState();
        return;
      }

      try {
        const content = await invokeReadFile(tabPath);
        if (!isActive) return;
        setViewingResource(resource);
        setResourceType(tabType);
        setResourceContent(content);
        setNotebookFile(null);
      } catch (error) {
        if (!isActive) return;
        setViewingResource(resource);
        setResourceType(tabType);
        setResourceContent('');
        setNotebookFile(null);
      }
    };

    loadResourceFromTab();

    return () => {
      isActive = false;
    };
  }, [activeTab]);

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
  // Load plans for this project - wrapped in useCallback for stable reference
  const loadPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      // First get the list of plans
      const projectPlans = await invokeGetProjectPlans(project.id);

      // Then fetch full details for each plan to get milestones
      const plansWithDetails = await Promise.all(
        projectPlans.map(async (plan) => {
          try {
            return await invokeGetPlanDetails(plan.id);
          } catch (e) {
            console.warn(`Failed to load details for plan ${plan.id}`, e);
            return plan as unknown as PlanDetails; // Fallback to basic plan if details fail
          }
        })
      );

      flushSync(() => {
        setPlans(plansWithDetails);
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
      if (activeTabId) updateTabResource(activeTabId, { view: 'tasks' });
    } else if (activeView === 'scrapbook' && !flags.scrapbook) {
      if (activeTabId) updateTabResource(activeTabId, { view: 'tasks' });
    } else if (activeView === 'agents' && !flags.agents) {
      if (activeTabId) updateTabResource(activeTabId, { view: 'tasks' });
    } else if (activeView === 'diagrams' && !flags.diagrams) {
      if (activeTabId) updateTabResource(activeTabId, { view: 'tasks' });
    }
  }, [activeTabId, activeView, flags.blueprints, flags.scrapbook, flags.agents, flags.diagrams, updateTabResource]);

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
      // Only show loading if we have no artifacts yet (true initial load)
      // When switching projects, keep showing old artifacts until new ones load
      if (artifacts.length === 0) {
        setArtifactsLoading(true);
      }
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
    // Clear old artifacts immediately when project changes to avoid showing wrong data
    // This creates a brief empty state, but we've optimized sections to handle this gracefully
    setArtifacts([]);
    setError(null);

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

  const handleViewKit = useCallback((artifact: ArtifactFile) => {
    const resourceType = (artifact.frontMatter?.type as ResourceType) || 'kit';
    const label = artifact.frontMatter?.alias || artifact.name;
    openInCurrentTab(
      {
        type: resourceType,
        path: artifact.path,
        projectId: project.id,
        view: getViewForTabType(resourceType),
      },
      { title: label }
    );
  }, [getViewForTabType, openInCurrentTab, project.id]);

  const handleViewDiagram = useCallback((diagram: ArtifactFile) => {
    const label = diagram.frontMatter?.alias || diagram.name;
    openInCurrentTab(
      {
        type: 'diagram',
        path: diagram.path,
        projectId: project.id,
        view: getViewForTabType('diagram'),
      },
      { title: label }
    );
  }, [getViewForTabType, openInCurrentTab, project.id]);

  const handleViewTask = useCallback((blueprintPath: string, taskFile: string, taskDescription: string) => {
    const taskPath = `${blueprintPath}/${taskFile}`;
    openInCurrentTab(
      {
        type: 'task',
        path: taskPath,
        projectId: project.id,
        view: getViewForTabType('task'),
        blueprintPath,
        taskFile,
      },
      { title: taskDescription || taskFile.replace('.md', '') }
    );
  }, [getViewForTabType, openInCurrentTab, project.id]);

  const handleViewPlan = useCallback((plan: Plan) => {
    openInCurrentTab(
      {
        type: 'plan',
        path: plan.folderPath,
        projectId: project.id,
        view: getViewForTabType('plan'),
        planId: plan.id,
      },
      { title: plan.name }
    );
  }, [getViewForTabType, openInCurrentTab, project.id]);

  const handleViewWalkthrough = useCallback(async (walkthrough: ArtifactFile) => {
    try {
      const walkthroughData = await invokeGetOrCreateWalkthroughByPath(
        project.id,
        walkthrough.path
      );
      const title = walkthroughData.name || walkthrough.frontMatter?.alias || walkthrough.name;
      openInCurrentTab(
        {
          type: 'walkthrough',
          path: walkthrough.path,
          projectId: project.id,
          view: getViewForTabType('walkthrough'),
          walkthroughId: walkthroughData.id,
        },
        { title }
      );
    } catch (error) {
      console.error('Failed to load walkthrough:', error);
    }
  }, [getViewForTabType, openInNewTab, project.id]);

  const handleBackFromResourceView = useCallback(() => {
    openInCurrentTab(
      {
        type: 'project',
        projectId: project.id,
        view: activeView,
      },
      { title: project.name }
    );
  }, [activeView, openInCurrentTab, project.id, project.name]);

  const handleClearResourceView = useCallback(() => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
    setNotebookFile(null);
  }, []);

  // Helper to get display name and icon for a view
  const getViewDisplayInfo = useCallback((view: ViewType): { title: string; icon: string } => {
    const viewMap: Record<ViewType, { title: string; icon: string }> = {
      projects: { title: 'Projects', icon: 'folder' },
      workflows: { title: 'Workflows', icon: 'workflow' },
      tasks: { title: 'Tasks', icon: 'list' },
      plans: { title: 'Plans', icon: 'map' },
      kits: { title: 'Kits', icon: 'package' },
      walkthroughs: { title: 'Walkthroughs', icon: 'book-open' },
      diagrams: { title: 'Diagrams', icon: 'palette' },
      git: { title: 'Git', icon: 'git-branch' },
      bookmarks: { title: 'Bookmarks', icon: 'bookmark' },
      scrapbook: { title: 'Scrapbook', icon: 'notebook' },
      blueprints: { title: 'Blueprints', icon: 'stack' },
      agents: { title: 'Agents', icon: 'bot' },
      file: { title: project.name, icon: 'project' },
    };
    return viewMap[view] || { title: project.name, icon: 'project' };
  }, [project.name]);

  const handleViewChange = useCallback((view: ViewType) => {
    if (!activeTabId) return;

    const { title, icon } = getViewDisplayInfo(view);

    if (activeTab?.type && activeTab.type !== 'project' && activeTab.type !== 'library') {
      openInCurrentTab(
        {
          type: 'project',
          projectId: project.id,
          view,
        },
        { title, icon }
      );
      return;
    }
    updateTabResource(activeTabId, { view }, { title, icon });
    handleClearResourceView();
  }, [activeTab?.type, activeTabId, getViewDisplayInfo, handleClearResourceView, openInCurrentTab, project.id, updateTabResource]);

  const handleOpenViewInNewTab = useCallback((view: ViewType) => {
    const { title, icon } = getViewDisplayInfo(view);
    openInNewTab(
      {
        type: 'project',
        projectId: project.id,
        view,
      },
      { title, icon }
    );
  }, [getViewDisplayInfo, openInNewTab, project.id]);

  const handleNewTab = useCallback(() => {
    openInNewTab(
      {
        type: 'project',
        projectId: project.id,
        path: project.path,
        view: 'file',
      },
      { title: "New Tab", forceNew: true }
    );
  }, [openInNewTab, project.id, project.path, project.name]);

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
      const isDiagram = node.path.endsWith('.mmd') || node.path.endsWith('.mermaid');

      // Get display label
      const label = node.frontMatter?.alias || node.name;
      const resourceType: ResourceType = isDiagram ? 'diagram' : 'file';
      openInCurrentTab(
        {
          type: resourceType,
          path: node.path,
          projectId: project.id,
          view: getViewForTabType(resourceType),
        },
        { title: label }
      );
    } catch (e) {
      console.error("Failed to open file", e);
    }
  }, [finalizeTitleEdit, getViewForTabType, openInNewTab, project.id, titleEditPath]);

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

  // Render content based on active view
  const renderContent = () => {
    // If viewing any resource, render it within the tab content area
    // For plans and walkthroughs, resourceContent can be empty (they load their own data)
    if (viewingResource && resourceType) {
      const viewMode =
        resourceType === 'plan'
          ? 'plan'
          : resourceType === 'walkthrough'
            ? 'walkthrough'
            : undefined;

      const planDeletedCallback = resourceType === 'plan' ? handlePlanDeleted : undefined;
      return (
        <Box h="100%" minH={0} overflow="hidden">
          <ResourceViewPage
            resource={viewingResource}
            resourceContent={resourceContent || ''}
            resourceType={resourceType}
            viewMode={viewMode}
            onBack={handleBackFromResourceView}
            onPlanDeleted={planDeletedCallback}
            contained
          />
        </Box>
      );
    }

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
                      if (activeTabId) {
                        updateTabResource(activeTabId, { path: newPath }, { title: sanitizedTitle });
                      }
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
            if (activeTabId) {
              updateTabResource(
                activeTabId,
                { path: newResource.path },
                { title: newResource.frontMatter?.alias || newResource.name }
              );
            }
          }}
        />
      );
    }

    // Fallback for file view if notebookFile is missing (should ideally show empty state, but for now we follow pattern)
    if (activeView === 'file') {
      return (
        <EmptyTabState
          context="project"
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
          onCloseTab={() => {
            if (activeTabId) closeTab(activeTabId);
          }}
        />
      );
    }

    switch (activeView) {
      case 'tasks':
        return (
          <TasksSection
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
              onProjectSelect={(p) => {
                console.log('[ProjectView] onProjectSelect wrapper called', {
                  project: p.name,
                  onProjectSelectDefined: typeof onProjectSelect,
                });
                onProjectSelect?.(p);
                console.log('[ProjectView] onProjectSelect?.() completed');
              }}
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
          <PlansSection
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
          <KitsSection
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
            projects={allProjects}
          />
        );
      case 'walkthroughs':
        return (
          <WalkthroughsSection
            kits={walkthroughs}
            kitsLoading={artifactsLoading}
            error={error}
            projectsCount={1}
            projectPath={project.path}
            projectId={project.id}
            onViewKit={handleViewWalkthrough}
            onReload={loadProjectArtifacts}
            projects={allProjects}
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
          <GitSection
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
          <BlueprintsSection
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
        // No view defined -> Empty State
        if (!activeView) {
          return (
            <EmptyTabState
              context={isVault ? 'library' : 'project'}
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
              onCloseTab={() => {
                if (activeTabId) closeTab(activeTabId);
              }}
            />
          );
        }
        return null;
    }
  };

  const content = renderContent();
  console.log('[ProjectView] Render Content Decision:', {
    activeView,
    contentType: content ? (content as any).type?.name || 'Component' : 'null'
  });

  return (
    <SelectionProvider>
      <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
        {/* Full screen content area with Splitter */}
        <Box
          ref={splitterContainerRef}
          flex="1"
          minH={0}
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

                let newSidebar = sidebar;
                let newContent = content;

                // MAX CONSTRAINT ONLY (Allow free movement below min for smooth expansion/collapse)
                if (sidebar > maxSidebarPercent) {
                  newSidebar = maxSidebarPercent;
                  newContent = 100 - newSidebar;
                }

                // Update state
                setSplitSizes([newSidebar, newContent]);

                // If we are resizing to a valid non-collapsed size, update lastSidebarSize
                if (newSidebar > minSidebarPercent) {
                  setLastSidebarSize(newSidebar);
                }
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
                // When "collapsed", visually hide content. The resize handle remains accessible.
                opacity: splitSizes[0] <= COLLAPSED_SIDEBAR_PERCENT + 0.1 ? 0 : 1,
                pointerEvents: splitSizes[0] <= COLLAPSED_SIDEBAR_PERCENT + 0.1 ? 'none' : 'auto',
              }}
            >
              <ProjectSidebar
                project={project}
                allProjects={allProjects}
                activeView={activeView}
                onBack={onBack}
                onProjectSelect={onProjectSelect}
                onViewChange={handleViewChange}
                onOpenViewInNewTab={handleOpenViewInNewTab}
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
                onToggleSidebar={toggleSidebar}
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
              zIndex={100}
              onDoubleClick={toggleSidebar}
              onPointerDown={() => {
                setIsSidebarDragging(true);
                // Attach global listener to handle drag end robustly (even if mouse leaves Trigger)
                const handleGlobalUp = () => {
                  setIsSidebarDragging(false);
                  window.removeEventListener('pointerup', handleGlobalUp);
                };
                window.addEventListener('pointerup', handleGlobalUp);
              }}
              // Removed onPointerUp/onPointerLeave in favor of global listener for robustness
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
                overflow="hidden"
                position="relative"
                p={0}
              >
                <BrowserTabs
                  tabs={browserTabs}
                  selectedId={activeTabId || browserTabs[0]?.id || ''}
                  onSelect={selectTab}
                  onClose={closeTab}
                  onAddTab={handleNewTab}
                  onReorder={reorderTabs}
                  colorMode={colorMode}
                  onToggleSidebar={toggleSidebar}
                  isSidebarCollapsed={splitSizes[0] <= COLLAPSED_SIDEBAR_PERCENT + 0.1}
                >
                  {content}
                </BrowserTabs>
              </Box>
            </Splitter.Panel>
          </Splitter.Root>
        </Box>
      </VStack>

    </SelectionProvider>
  );
}
