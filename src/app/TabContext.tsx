import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import path from "path";
import type { ResourceType } from "@/types/resource";
import type { ViewType } from "@/views/project/components/SidebarContent";
import {
  invokeCreateFolder,
  invokeGetVaultProject,
  invokeReadFile,
  invokeWriteFile,
  invokeDbGetProjects,
} from "@/ipc";

export type TabType = "library" | "project" | "editor-plans" | ResourceType;

export interface TabResource {
  path?: string;
  projectId?: string;
  view?: ViewType;
  planId?: string;
  walkthroughId?: string;
  blueprintPath?: string;
  taskFile?: string;
  plansSource?: "claude" | "cursor";
}

export interface TabResourceInput extends TabResource {
  type: TabType;
}

export interface TabState {
  id: string;
  type: TabType;
  title: string;
  icon: string;
  resource: TabResource;
  view: {
    scrollTop?: number;
    cursor?: { line: number; ch: number };
  };
  pinned: boolean;
  dirty: boolean;
  closable: boolean;
  openedAt: string;
}

interface TabCreateOptions {
  title?: string;
  icon?: string;
  pinned?: boolean;
  dirty?: boolean;
  closable?: boolean;
  forceNew?: boolean; // If true, always create a new tab even if duplicate exists
}

export interface TabContextValue {
  tabs: TabState[];
  activeTabId: string;
  activeContext: string;
  createTab: (
    resource: TabResourceInput,
    options?: TabCreateOptions,
    contextKey?: string
  ) => string;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string) => void;
  switchContext: (
    contextKey: string
  ) => Promise<{ contextKey: string; tabs: TabState[] }>;
  updateTabResource: (
    tabId: string,
    resource: Partial<TabResource>,
    meta?: Pick<TabCreateOptions, "title" | "icon">
  ) => void;
  updateTabMeta: (
    tabId: string,
    meta: Pick<
      TabCreateOptions,
      "title" | "icon" | "pinned" | "dirty" | "closable"
    >
  ) => void;
  openInNewTab: (
    resource: TabResourceInput,
    options?: TabCreateOptions
  ) => void;
  openInCurrentTab: (
    resource: TabResourceInput,
    options?: TabCreateOptions
  ) => void;
  saveTabs: () => Promise<void>;
  loadTabs: () => Promise<void>;
}

const TAB_SCHEMA_VERSION = "bluekit.tabs.v2";

const TabContext = createContext<TabContextValue | undefined>(undefined);

function createDefaultLibraryTab(): TabState {
  const openedAt = new Date().toISOString();
  return {
    id: createTabId(),
    type: "library",
    title: "New Tab",
    icon: "", // No icon for empty state
    resource: {
      // No view set ensures EmptyTabState is rendered if the consuming component handles it
      // For library, ProjectView expects specific views, but if we want "Empty State", we might need to handle 'undefined' view in ProjectView or designated component.
      // However, the user request says: "when you click on someting and its tabs have no initialized state yet you just have the EmptyTabState"
      // We should check what renders this tab.
    },
    view: {},
    pinned: false,
    dirty: false,
    closable: true,
    openedAt,
  };
}

function createTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tab_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `tab_${Math.random().toString(36).slice(2, 10)}`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.(md|mmd|mermaid)$/i, "");
}

function getTitleFromPath(filePath?: string) {
  if (!filePath) return "";
  return stripExtension(path.basename(filePath));
}

function getDefaultTitle(resource: TabResourceInput) {
  switch (resource.type) {
    case "library":
      return "New Tab";
    case "project":
      return "New Tab";
    case "editor-plans":
      return resource.plansSource ? `${resource.plansSource} plans` : "Plans";
    default:
      return getTitleFromPath(resource.path) || resource.type;
  }
}

function getMatchKey(type: TabType, resource: TabResource): string | null {
  switch (type) {
    case "library":
      return "library";
    case "project":
      return resource.projectId
        ? `project:${resource.projectId}:${resource.view ?? ""}`
        : null;
    case "plan":
      return resource.planId
        ? `plan:${resource.planId}`
        : resource.path
        ? `plan:${resource.path}`
        : null;
    case "walkthrough":
      return resource.walkthroughId
        ? `walkthrough:${resource.walkthroughId}`
        : resource.path
        ? `walkthrough:${resource.path}`
        : null;
    case "task":
      if (resource.blueprintPath && resource.taskFile) {
        return `task:${resource.blueprintPath}:${resource.taskFile}`;
      }
      return resource.path ? `task:${resource.path}` : null;
    case "editor-plans":
      return resource.plansSource
        ? `editor-plans:${resource.plansSource}`
        : "editor-plans";
    default:
      return resource.path ? `${type}:${resource.path}` : null;
  }
}

export function TabProvider({ children }: { children: ReactNode }) {
  const initialTab = createDefaultLibraryTab();
  const [tabsByContext, setTabsByContext] = useState<{
    [contextKey: string]: TabState[];
  }>({
    library: [initialTab],
  });
  const [activeContext, setActiveContext] = useState<string>("library");
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
  const [lastActiveTabByContext, setLastActiveTabByContext] = useState<{
    [contextKey: string]: string;
  }>({
    library: initialTab.id,
  });
  const tabsFilePathRef = useRef<string | null>(null);
  const tabsDirRef = useRef<string | null>(null);
  const projectPathsRef = useRef<Map<string, string>>(new Map());

  // Compute current context's tabs
  const tabs = useMemo(() => {
    return tabsByContext[activeContext] || [];
  }, [tabsByContext, activeContext]);

  // Self-healing: if there are no tabs in the current context, create one
  useEffect(() => {
    const currentTabs = tabsByContext[activeContext] || [];
    if (currentTabs.length === 0) {
      console.warn(
        "[TabContext] ⚠️ Empty context detected, creating default tab.",
        { context: activeContext }
      );
      let newTab: TabState;

      if (activeContext === "library") {
        newTab = createDefaultLibraryTab();
      } else if (activeContext.startsWith("project:")) {
        const projectId = activeContext.replace("project:", "");
        newTab = createDefaultProjectTab(projectId);
      } else {
        newTab = createDefaultLibraryTab();
      }

      setTabsByContext((prev) => ({
        ...prev,
        [activeContext]: [newTab],
      }));
      setActiveTabId(newTab.id);
      setLastActiveTabByContext((prev) => ({
        ...prev,
        [activeContext]: newTab.id,
      }));
    }
  }, [activeContext, tabsByContext]);

  // Helper to set active tab and remember it for the context
  const setActiveTab = useCallback(
    (tabId: string, contextKey?: string) => {
      const ctx = contextKey || activeContext;
      setActiveTabId(tabId);
      setLastActiveTabByContext((prev) => ({
        ...prev,
        [ctx]: tabId,
      }));
    },
    [activeContext]
  );

  const getGlobalTabsPath = useCallback(async () => {
    if (tabsFilePathRef.current) return tabsFilePathRef.current;

    const vault = await invokeGetVaultProject();
    if (!vault?.path) return null;

    const tabsDir = path.join(vault.path, ".bluekit", "workspace");
    const tabsFilePath = path.join(tabsDir, "tabs.json");

    tabsDirRef.current = tabsDir;
    tabsFilePathRef.current = tabsFilePath;

    return tabsFilePath;
  }, []);

  const getProjectTabsPath = useCallback(async (projectId: string) => {
    // Check if we have the path cached
    if (projectPathsRef.current.has(projectId)) {
      const projectPath = projectPathsRef.current.get(projectId)!;
      return path.join(projectPath, ".bluekit", "workspace", "tabs.json");
    }

    // Fetch projects to find path
    try {
      const projects = await invokeDbGetProjects();
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        projectPathsRef.current.set(projectId, project.path);
        return path.join(project.path, ".bluekit", "workspace", "tabs.json");
      }
    } catch (error) {
      console.warn("Failed to resolve project path for tabs:", error);
    }
    return null;
  }, []);

  const ensureTabsDirectory = useCallback(async (filePath: string) => {
    const dir = path.dirname(filePath);
    try {
      await invokeCreateFolder(dir);
    } catch (error) {
      console.warn("Failed to create tabs workspace directory:", error);
    }
  }, []);

  // Get context key from tab resource
  const getContextKey = useCallback((resource: TabResourceInput): string => {
    if (resource.type === "library") {
      return "library";
    }
    if (resource.projectId) {
      return `project:${resource.projectId}`;
    }
    return "library"; // fallback
  }, []);

  // Create default project tab - Empty State
  const createDefaultProjectTab = useCallback((projectId: string): TabState => {
    return {
      id: createTabId(),
      type: "project",
      title: "New Tab",
      icon: "", // No icon for empty state
      resource: {
        projectId,
        // No view set for 'project' type ensures EmptyTabState is rendered
        // In ProjectView.tsx, if resource.view is undefined, it should handle this or we explicitly set it to undefined
      },
      view: {},
      pinned: false,
      dirty: false,
      closable: true,
      openedAt: new Date().toISOString(),
    };
  }, []);

  // Switch to a different context
  const loadContextTabs = useCallback(
    async (contextKey: string): Promise<TabState[]> => {
      console.log("[TabContext] loadContextTabs called", { contextKey });

      let filePath: string | null = null;
      if (contextKey === "library") {
        filePath = await getGlobalTabsPath();
      } else if (contextKey.startsWith("project:")) {
        const projectId = contextKey.replace("project:", "");
        filePath = await getProjectTabsPath(projectId);
      }

      console.log("[TabContext] loadContextTabs: Reading from disk", {
        contextKey,
        filePath,
      });

      if (!filePath) return [];

      try {
        const content = await invokeReadFile(filePath);
        const data = JSON.parse(content);

        console.log("[TabContext] loadContextTabs: Parsed file", {
          schemaVersion: data.schemaVersion,
          availableContexts: Object.keys(data.contexts || {}),
          activeContext: data.activeContext,
        });

        if (data.schemaVersion === TAB_SCHEMA_VERSION) {
          const loadedContextData = data.contexts?.[contextKey];
          if (loadedContextData) {
            const loadedTabs = (loadedContextData.tabs || []).map(
              (tab: TabState) => ({
                ...tab,
                resource: tab.resource ?? {},
                view: tab.view ?? {},
              })
            );

            console.log("[TabContext] loadContextTabs: Loaded tabs from disk", {
              contextKey,
              activeTabId: loadedContextData.activeTabId,
              tabs: loadedTabs.map((t: TabState) => ({
                id: t.id,
                title: t.title,
                view: t.resource?.view,
              })),
            });

            setTabsByContext((prev) => ({
              ...prev,
              [contextKey]: loadedTabs,
            }));

            if (loadedContextData.activeTabId) {
              setLastActiveTabByContext((prev) => ({
                ...prev,
                [contextKey]: loadedContextData.activeTabId,
              }));

              if (activeContext === contextKey) {
                setActiveTabId(loadedContextData.activeTabId);
              }
            }
            return loadedTabs;
          }
        }
      } catch (error) {
        console.log(
          "[TabContext] loadContextTabs: Failed to load (file may not exist)",
          { contextKey, error }
        );
      }
      return [];
    },
    [activeContext, getGlobalTabsPath, getProjectTabsPath, tabsByContext]
  );

  /* Ref for Vault Project ID to alias 'library' context */
  const vaultProjectIdRef = useRef<string | null>(null);

  /* Helper to ensure we have vault ID */
  const ensureVaultId = useCallback(async () => {
    if (vaultProjectIdRef.current) return vaultProjectIdRef.current;
    try {
      const vault = await invokeGetVaultProject();
      if (vault) {
        vaultProjectIdRef.current = vault.id;
        return vault.id;
      }
    } catch (e) {
      console.error("[TabContext] Failed to get vault project:", e);
    }
    return null;
  }, []);

  // Helper to read tabs from disk (source of truth)
  const readTabsFromDisk = useCallback(
    async (contextKey: string): Promise<TabState[]> => {
      console.log("[TabContext] readTabsFromDisk:", contextKey);

      let filePath: string | null = null;
      if (contextKey === "library") {
        filePath = await getGlobalTabsPath();
      } else if (contextKey.startsWith("project:")) {
        const projectId = contextKey.replace("project:", "");
        filePath = await getProjectTabsPath(projectId);
      }

      if (!filePath) {
        console.log("[TabContext] No file path for context:", contextKey);
        return [];
      }

      try {
        const content = await invokeReadFile(filePath);
        const data = JSON.parse(content);
        const tabs = data.contexts?.[contextKey]?.tabs || [];

        console.log("[TabContext] Loaded tabs from disk:", {
          contextKey,
          tabCount: tabs.length,
          tabs: tabs.map((t: TabState) => ({
            id: t.id,
            title: t.title,
            view: t.resource?.view,
          })),
        });

        return tabs.map((tab: TabState) => ({
          ...tab,
          resource: tab.resource ?? {},
          view: tab.view ?? {},
        }));
      } catch (error) {
        console.log(
          "[TabContext] Failed to read tabs (file may not exist):",
          { contextKey, error }
        );
        return [];
      }
    },
    [getGlobalTabsPath, getProjectTabsPath]
  );

  const switchContext = useCallback(
    async (contextKey: string) => {
      console.log("[TabContext] Switching context:", {
        from: activeContext,
        to: contextKey,
      });

      // Alias library -> project:<vaultId>
      let targetContext = contextKey;
      if (contextKey === "library") {
        const vaultId = await ensureVaultId();
        if (vaultId) {
          targetContext = `project:${vaultId}`;
          console.log("[TabContext] Aliasing library ->", targetContext);
        }
      }

      // ALWAYS read from disk - disk is source of truth
      console.log("[TabContext] switchContext: reading from disk", targetContext);
      let contextTabs = await readTabsFromDisk(targetContext);

      console.log("[TabContext] switchContext: loaded tabs from disk", {
        targetContext,
        tabCount: contextTabs.length,
      });

      if (contextTabs.length > 0) {
        // Tabs exist - restore them
        setTabsByContext((prev) => ({ ...prev, [targetContext]: contextTabs }));
      } else {
        // No tabs on disk - create default empty tab
        console.log("[TabContext] No tabs on disk, creating default tab");
        const isLibrary = targetContext.startsWith("project:") && targetContext === `project:${await ensureVaultId()}`;
        const projectId = targetContext.replace("project:", "");

        const defaultTab: TabState = {
          id: createTabId(),
          type: isLibrary ? "library" : "project",
          title: "New Tab",
          icon: isLibrary ? "" : "project",
          resource: isLibrary ? {} : { projectId },
          view: {},
          pinned: false,
          dirty: false,
          closable: true,
          openedAt: new Date().toISOString(),
        };

        contextTabs = [defaultTab];
        setTabsByContext((prev) => ({ ...prev, [targetContext]: contextTabs }));
      }

      // Set active context immediately
      setActiveContext(targetContext);

      // Restore last active tab
      const lastActiveTab = lastActiveTabByContext[targetContext];
      const tabToActivate =
        lastActiveTab && contextTabs.some((t) => t.id === lastActiveTab)
          ? lastActiveTab
          : contextTabs[0]?.id;

      if (tabToActivate) {
        console.log("[TabContext] Restoring active tab:", tabToActivate);
        setActiveTab(tabToActivate, targetContext);
      }

      return { contextKey: targetContext, tabs: contextTabs };
    },
    [
      readTabsFromDisk,
      createTabId,
      setTabsByContext,
      lastActiveTabByContext,
      setActiveTab,
      ensureVaultId,
    ]
  );

  const loadTabs = useCallback(async () => {
    const globalPath = await getGlobalTabsPath();
    const vaultId = await ensureVaultId();

    console.log("[TabContext] loadTabs starting", { globalPath, vaultId });
    if (!globalPath) return;

    try {
      const content = await invokeReadFile(globalPath);
      const data = JSON.parse(content);
      console.log("[TabContext] Global tabs loaded:", {
        schemaVersion: data.schemaVersion,
        activeContext: data.activeContext,
        contextKeys: Object.keys(data.contexts || {}),
      });

      if (data.schemaVersion !== TAB_SCHEMA_VERSION) return;

      // 1. Load library/vault tabs (checking both 'library' and 'project:<vaultId>')
      let libraryTabs: TabState[] = [];
      const vaultContextKey = vaultId ? `project:${vaultId}` : null;

      // Prefer project-keyed tabs for vault
      if (vaultContextKey && data.contexts?.[vaultContextKey]) {
        console.log(
          "[TabContext] Loading vault tabs from project key:",
          vaultContextKey
        );
        libraryTabs = (data.contexts[vaultContextKey].tabs || []).map(
          (tab: TabState) => ({
            ...tab,
            resource: tab.resource ?? {},
            view: tab.view ?? {},
          })
        );

        // Store under project key
        setTabsByContext((prev) => ({
          ...prev,
          [vaultContextKey]: libraryTabs,
        }));
        if (data.contexts[vaultContextKey].activeTabId) {
          setLastActiveTabByContext((prev) => ({
            ...prev,
            [vaultContextKey]: data.contexts[vaultContextKey].activeTabId,
          }));
        }
      }
      // Fallback to 'library' key if exists and no project key found (migration case)
      else if (data.contexts?.library) {
        console.log(
          "[TabContext] Loading library tabs from library key (legacy)"
        );
        libraryTabs = (data.contexts.library.tabs || []).map(
          (tab: TabState) => ({
            ...tab,
            resource: tab.resource ?? {},
            view: tab.view ?? {},
          })
        );

        // Store under vault key if known, otherwise library
        const storageKey = vaultContextKey || "library";
        setTabsByContext((prev) => ({ ...prev, [storageKey]: libraryTabs }));
        if (data.contexts.library.activeTabId) {
          setLastActiveTabByContext((prev) => ({
            ...prev,
            [storageKey]: data.contexts.library.activeTabId,
          }));
        }
      }

      // 2. Handle Active Context
      let persistedActiveContext =
        data.activeContext || vaultContextKey || "library";

      // Auto-migrate 'library' active context to project key
      if (persistedActiveContext === "library" && vaultId) {
        persistedActiveContext = `project:${vaultId}`;
      }

      // If the active context is present in global file (and not already loaded above), load it
      if (
        persistedActiveContext !== vaultContextKey &&
        persistedActiveContext !== "library" &&
        data.contexts?.[persistedActiveContext]
      ) {
        console.log(
          "[TabContext] Loading active context from Global file:",
          persistedActiveContext
        );
        const contextData = data.contexts[persistedActiveContext];
        const contextTabs = (contextData.tabs || []).map((tab: TabState) => ({
          ...tab,
          resource: tab.resource ?? {},
          view: tab.view ?? {},
        }));

        setTabsByContext((prev) => ({
          ...prev,
          [persistedActiveContext]: contextTabs,
        }));

        if (contextData.activeTabId) {
          setLastActiveTabByContext((prev) => ({
            ...prev,
            [persistedActiveContext]: contextData.activeTabId,
          }));
        }
      } else if (
        persistedActiveContext !== vaultContextKey &&
        persistedActiveContext !== "library"
      ) {
        // Load from project file
        await loadContextTabs(persistedActiveContext);
      }

      // 3. Set Active Context
      setActiveContext(persistedActiveContext);

      // Sync active tab ID for the active context
      const activeContextData =
        data.contexts?.[persistedActiveContext] ||
        data.contexts?.[data.activeContext];
      if (activeContextData?.activeTabId) {
        setActiveTabId(activeContextData.activeTabId);
      }
    } catch (error) {
      console.warn("Failed to load global tabs:", error);
    }
  }, [getGlobalTabsPath, loadContextTabs, ensureVaultId]);

  const createTab = useCallback(
    (
      resource: TabResourceInput,
      options?: TabCreateOptions,
      contextKey?: string
    ) => {
      const targetContext = contextKey ?? activeContext;
      const { type, ...resourceData } = resource;
      const openedAt = new Date().toISOString();
      const title = options?.title ?? getDefaultTitle(resource);
      const icon = options?.icon ?? resource.type;
      const closable = options?.closable ?? true;
      const pinned = options?.pinned ?? false;
      const dirty = options?.dirty ?? false;

      const newTab: TabState = {
        id: createTabId(),
        type,
        title,
        icon,
        resource: resourceData,
        view: {},
        pinned,
        dirty,
        closable,
        openedAt,
      };

      // Add to current context
      setTabsByContext((prev) => ({
        ...prev,
        [targetContext]: [...(prev[targetContext] || []), newTab],
      }));

      setActiveTab(newTab.id, targetContext);
      return newTab.id;
    },
    [activeContext, setActiveTab]
  );

  const selectTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsByContext[activeContext] || [];
      const tab = currentTabs.find((t) => t.id === tabId);
      if (tab) {
        setActiveTab(tabId);
      }
    },
    [activeContext, setActiveTab, tabsByContext]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabsByContext((prev) => {
        const currentTabs = prev[activeContext] || [];
        const tabToClose = currentTabs.find((tab) => tab.id === tabId);

        if (!tabToClose || tabToClose.closable === false) return prev;

        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

        // Handle empty context - always create a new tab
        if (nextTabs.length === 0) {
          let newTab: TabState;

          if (activeContext === "library") {
            // Create new Library tab
            newTab = createDefaultLibraryTab();
          } else if (activeContext.startsWith("project:")) {
            // Create new empty project tab
            const projectId = activeContext.replace("project:", "");
            newTab = createDefaultProjectTab(projectId);
          } else {
            // Fallback - create library tab
            newTab = createDefaultLibraryTab();
          }

          setActiveTab(newTab.id);
          return {
            ...prev,
            [activeContext]: [newTab],
          };
        }

        // Select adjacent tab
        if (activeTabId === tabId) {
          const closedIndex = currentTabs.findIndex((tab) => tab.id === tabId);
          const newActiveIndex = Math.max(0, closedIndex - 1);
          setActiveTab(nextTabs[newActiveIndex]?.id ?? nextTabs[0].id);
        }

        return {
          ...prev,
          [activeContext]: nextTabs,
        };
      });
    },
    [activeContext, activeTabId, createDefaultProjectTab, setActiveTab]
  );

  const updateTabResource = useCallback(
    (
      tabId: string,
      resource: Partial<TabResource>,
      meta?: Pick<TabCreateOptions, "title" | "icon">
    ) => {
      setTabsByContext((prev) => ({
        ...prev,
        [activeContext]: (prev[activeContext] || []).map((tab) => {
          if (tab.id !== tabId) return tab;
          const nextTab: TabState = {
            ...tab,
            resource: {
              ...tab.resource,
              ...resource,
            },
          };
          if (meta?.title) nextTab.title = meta.title;
          if (meta?.icon) nextTab.icon = meta.icon;
          return nextTab;
        }),
      }));
    },
    [activeContext]
  );

  const updateTabMeta = useCallback(
    (
      tabId: string,
      meta: Pick<
        TabCreateOptions,
        "title" | "icon" | "pinned" | "dirty" | "closable"
      >
    ) => {
      setTabsByContext((prev) => ({
        ...prev,
        [activeContext]: (prev[activeContext] || []).map((tab) => {
          if (tab.id !== tabId) return tab;
          return {
            ...tab,
            ...meta,
          };
        }),
      }));
    },
    [activeContext]
  );

  const updateCurrentTabInContext = useCallback(
    (resource: TabResourceInput, options?: TabCreateOptions) => {
      const { type, ...resourceData } = resource;
      const title = options?.title ?? getDefaultTitle(resource);
      const icon = options?.icon ?? resource.type;
      const closable = options?.closable ?? true;
      const pinned = options?.pinned ?? false;
      const dirty = options?.dirty ?? false;

      console.log(
        "[TabContext] updateCurrentTabInContext: OVERWRITING current tab",
        {
          currentTabId: activeTabId,
          newResource: resourceData,
          newTitle: title,
        }
      );

      setTabsByContext((prev) => ({
        ...prev,
        [activeContext]: (prev[activeContext] || []).map((tab) => {
          if (tab.id !== activeTabId) return tab;
          return {
            ...tab,
            type,
            title,
            icon,
            resource: resourceData,
            closable,
            pinned,
            dirty,
          };
        }),
      }));
    },
    [activeContext, activeTabId]
  );

  const openInNewTab = useCallback(
    async (resource: TabResourceInput, options?: TabCreateOptions) => {
      const targetContext = getContextKey(resource);
      const forceNew = options?.forceNew ?? false;

      console.log("[TabContext] openInNewTab called", {
        resource,
        options,
        targetContext,
        activeContext,
        forceNew,
      });

      let resolvedContext = targetContext;
      let contextTabs = tabsByContext[targetContext] || [];

      if (targetContext !== activeContext) {
        console.log("[TabContext] Different context - switching first");
        const switchResult = await switchContext(targetContext);
        resolvedContext = switchResult.contextKey;
        contextTabs = switchResult.tabs;
      }

      if (!forceNew) {
        const matchKey = getMatchKey(resource.type, resource);
        const existingTab = matchKey
          ? contextTabs.find(
              (tab) => getMatchKey(tab.type, tab.resource) === matchKey
            )
          : null;

        if (existingTab) {
          console.log(
            "[TabContext] Tab already exists, activating it:",
            existingTab.id
          );
          setActiveTab(existingTab.id, resolvedContext);
          return;
        }
      }

      console.log("[TabContext] Creating new tab");
      createTab(resource, options, resolvedContext);
    },
    [
      activeContext,
      createTab,
      getContextKey,
      setActiveTab,
      switchContext,
      tabsByContext,
    ]
  );

  const openInCurrentTab = useCallback(
    async (resource: TabResourceInput, options?: TabCreateOptions) => {
      console.log("[TabContext] openInCurrentTab called", {
        resource,
        options,
        activeTabId,
        activeContext,
      });

      if (!activeTabId) {
        console.log("[TabContext] No active tab, creating new tab");
        createTab(resource, options);
        return;
      }

      const targetContext = getContextKey(resource);
      console.log("[TabContext] Target context:", targetContext, "Active:", activeContext);

      // If resource is from different context, switch context
      if (targetContext !== activeContext) {
        // Cross-context: Just switch - switchContext reads from disk
        console.log("[TabContext] Cross-context navigation, switching to:", targetContext);
        await switchContext(targetContext);
      } else {
        // Same context - update current tab
        console.log("[TabContext] SAME CONTEXT: updating current tab", {
          currentTabId: activeTabId,
        });
        updateCurrentTabInContext(resource, options);
      }
    },
    [
      activeContext,
      activeTabId,
      createTab,
      getContextKey,
      switchContext,
      updateCurrentTabInContext,
    ]
  );

  const saveContextTabs = useCallback(
    async (
      contextKey: string,
      tabs: TabState[],
      activeTabIdInContext: string | null
    ) => {
      let filePath: string | null = null;

      if (contextKey === "library") {
        filePath = await getGlobalTabsPath();
      } else if (contextKey.startsWith("project:")) {
        const projectId = contextKey.replace("project:", "");
        filePath = await getProjectTabsPath(projectId);
      }

      if (!filePath) return;

      await ensureTabsDirectory(filePath);

      // For project tabs, we only save that project's context
      // For library tabs, we only save library context
      // This maintains the per-project file structure
      const payload = {
        schemaVersion: TAB_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        activeContext: contextKey, // This is just which context was active when saved
        contexts: {
          [contextKey]: {
            activeTabId: activeTabIdInContext,
            tabs: tabs,
          },
        },
      };

      try {
        await invokeWriteFile(filePath, JSON.stringify(payload, null, 2));
      } catch (error) {
        console.warn(`Failed to save tabs for context ${contextKey}:`, error);
      }
    },
    [ensureTabsDirectory, getGlobalTabsPath, getProjectTabsPath]
  );

  const saveTabs = useCallback(async () => {
    // Identify which contexts have been loaded/modified and save them
    // We can't just iterate tabsByContext because it might contain unloaded contexts if we aggressively initialized them
    // But since we only add to tabsByContext when we load or create, keys in tabsByContext are safe to save
    // UNLESS we want to optimize and only save what changed. For now, saving active context + others is fine.

    // HOWEVER, to avoid overwriting files needlessly, let's just save the ACTIVE context
    // and maybe any other dirty contexts if we tracked dirtiness at context level.
    // For simplicity: Save ALL loaded contexts to their respective files.

    const contextKeys = Object.keys(tabsByContext);

    for (const contextKey of contextKeys) {
      const contextTabs = tabsByContext[contextKey];
      const activeTabInContext =
        lastActiveTabByContext[contextKey] || (contextTabs[0]?.id ?? null);
      await saveContextTabs(contextKey, contextTabs, activeTabInContext);
    }
  }, [saveContextTabs, tabsByContext, lastActiveTabByContext]);

  const value: TabContextValue = {
    tabs,
    activeTabId,
    activeContext,
    createTab,
    closeTab,
    selectTab,
    switchContext,
    updateTabResource,
    updateTabMeta,
    openInNewTab,
    openInCurrentTab,
    saveTabs,
    loadTabs,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabContext must be used within TabProvider");
  }
  return context;
}
