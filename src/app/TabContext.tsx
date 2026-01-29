import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import path from 'path';
import type { ResourceType } from '@/types/resource';
import type { ViewType } from '@/views/project/components/SidebarContent';
import { invokeCreateFolder, invokeGetVaultProject, invokeReadFile, invokeWriteFile } from '@/ipc';

export type TabType = 'home' | 'project' | 'editor-plans' | ResourceType;

export interface TabResource {
  path?: string;
  projectId?: string;
  view?: ViewType;
  planId?: string;
  walkthroughId?: string;
  blueprintPath?: string;
  taskFile?: string;
  plansSource?: 'claude' | 'cursor';
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
}

export interface TabContextValue {
  tabs: TabState[];
  activeTabId: string;
  createTab: (resource: TabResourceInput, options?: TabCreateOptions) => string;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string) => void;
  updateTabResource: (tabId: string, resource: Partial<TabResource>, meta?: Pick<TabCreateOptions, 'title' | 'icon'>) => void;
  updateTabMeta: (tabId: string, meta: Pick<TabCreateOptions, 'title' | 'icon' | 'pinned' | 'dirty' | 'closable'>) => void;
  openInNewTab: (resource: TabResourceInput, options?: TabCreateOptions) => void;
  openInCurrentTab: (resource: TabResourceInput, options?: TabCreateOptions) => void;
  saveTabs: () => Promise<void>;
  loadTabs: () => Promise<void>;
}

const TAB_SCHEMA_VERSION = 'bluekit.tabs.v1';
const DEFAULT_HOME_TAB_ID = 'tab_home';

const TabContext = createContext<TabContextValue | undefined>(undefined);

function createTabId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `tab_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `tab_${Math.random().toString(36).slice(2, 10)}`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.(md|mmd|mermaid)$/i, '');
}

function getTitleFromPath(filePath?: string) {
  if (!filePath) return '';
  return stripExtension(path.basename(filePath));
}

function getDefaultTitle(resource: TabResourceInput) {
  switch (resource.type) {
    case 'home':
      return 'Home';
    case 'project':
      return 'Project';
    case 'editor-plans':
      return resource.plansSource ? `${resource.plansSource} plans` : 'Plans';
    default:
      return getTitleFromPath(resource.path) || resource.type;
  }
}

function createDefaultHomeTab(): TabState {
  const openedAt = new Date().toISOString();
  return {
    id: DEFAULT_HOME_TAB_ID,
    type: 'home',
    title: 'Home',
    icon: 'home',
    resource: { view: 'projects' },
    view: {},
    pinned: true,
    dirty: false,
    closable: false,
    openedAt,
  };
}

function getMatchKey(type: TabType, resource: TabResource): string | null {
  switch (type) {
    case 'home':
      return 'home';
    case 'project':
      return resource.projectId ? `project:${resource.projectId}:${resource.view ?? ''}` : null;
    case 'plan':
      return resource.planId
        ? `plan:${resource.planId}`
        : resource.path
          ? `plan:${resource.path}`
          : null;
    case 'walkthrough':
      return resource.walkthroughId
        ? `walkthrough:${resource.walkthroughId}`
        : resource.path
          ? `walkthrough:${resource.path}`
          : null;
    case 'task':
      if (resource.blueprintPath && resource.taskFile) {
        return `task:${resource.blueprintPath}:${resource.taskFile}`;
      }
      return resource.path ? `task:${resource.path}` : null;
    case 'editor-plans':
      return resource.plansSource ? `editor-plans:${resource.plansSource}` : 'editor-plans';
    default:
      return resource.path ? `${type}:${resource.path}` : null;
  }
}

export function TabProvider({ children }: { children: ReactNode }) {
  const initialTab = createDefaultHomeTab();
  const [tabs, setTabs] = useState<TabState[]>([initialTab]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
  const tabsFilePathRef = useRef<string | null>(null);
  const tabsDirRef = useRef<string | null>(null);

  const resolveTabsFilePath = useCallback(async () => {
    if (tabsFilePathRef.current) return tabsFilePathRef.current;

    const vault = await invokeGetVaultProject();
    if (!vault?.path) return null;

    const tabsDir = path.join(vault.path, '.bluekit', 'workspace');
    const tabsFilePath = path.join(tabsDir, 'tabs.json');

    tabsDirRef.current = tabsDir;
    tabsFilePathRef.current = tabsFilePath;

    return tabsFilePath;
  }, []);

  const ensureTabsDirectory = useCallback(async () => {
    const tabsFilePath = await resolveTabsFilePath();
    if (!tabsFilePath) return null;

    const tabsDir = tabsDirRef.current || path.dirname(tabsFilePath);
    if (tabsDir) {
      try {
        await invokeCreateFolder(tabsDir);
      } catch (error) {
        console.warn('Failed to create tabs workspace directory:', error);
      }
    }

    return tabsFilePath;
  }, [resolveTabsFilePath]);

  const createTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
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

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab.id;
  }, []);

  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabToClose = prev.find(tab => tab.id === tabId);
      if (!tabToClose || tabToClose.closable === false) return prev;

      const nextTabs = prev.filter(tab => tab.id !== tabId);

      if (nextTabs.length === 0) {
        const fallbackTab = createDefaultHomeTab();
        setActiveTabId(fallbackTab.id);
        return [fallbackTab];
      }

      if (activeTabId === tabId) {
        const closedIndex = prev.findIndex(tab => tab.id === tabId);
        const newActiveIndex = Math.max(0, closedIndex - 1);
        setActiveTabId(nextTabs[newActiveIndex]?.id ?? nextTabs[0].id);
      }

      return nextTabs;
    });
  }, [activeTabId]);

  const updateTabResource = useCallback((tabId: string, resource: Partial<TabResource>, meta?: Pick<TabCreateOptions, 'title' | 'icon'>) => {
    setTabs(prev => prev.map(tab => {
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
    }));
  }, []);

  const updateTabMeta = useCallback((tabId: string, meta: Pick<TabCreateOptions, 'title' | 'icon' | 'pinned' | 'dirty' | 'closable'>) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        ...meta,
      };
    }));
  }, []);

  const findMatchingTab = useCallback((resource: TabResourceInput) => {
    const key = getMatchKey(resource.type, resource);
    if (!key) return null;
    return tabs.find(tab => getMatchKey(tab.type, tab.resource) === key) ?? null;
  }, [tabs]);

  const openInNewTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
    const existing = findMatchingTab(resource);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    createTab(resource, options);
  }, [createTab, findMatchingTab]);

  const openInCurrentTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
    if (!activeTabId) {
      createTab(resource, options);
      return;
    }

    const { type, ...resourceData } = resource;
    const title = options?.title ?? getDefaultTitle(resource);
    const icon = options?.icon ?? resource.type;
    const closable = options?.closable ?? true;
    const pinned = options?.pinned ?? false;
    const dirty = options?.dirty ?? false;

    setTabs(prev => prev.map(tab => {
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
    }));
  }, [activeTabId, createTab]);

  const saveTabs = useCallback(async () => {
    const tabsFilePath = await ensureTabsDirectory();
    if (!tabsFilePath) return;

    const payload = {
      schemaVersion: TAB_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      activeTabId,
      groups: [
        {
          id: 'group_main',
          direction: 'vertical',
          size: 1,
          tabs,
        },
      ],
    };

    try {
      await invokeWriteFile(tabsFilePath, JSON.stringify(payload, null, 2));
    } catch (error) {
      console.warn('Failed to save tabs:', error);
    }
  }, [activeTabId, ensureTabsDirectory, tabs]);

  const loadTabs = useCallback(async () => {
    const tabsFilePath = await resolveTabsFilePath();
    if (!tabsFilePath) return;

    try {
      const content = await invokeReadFile(tabsFilePath);
      const data = JSON.parse(content);

      if (data.schemaVersion !== TAB_SCHEMA_VERSION) {
        console.warn('Unsupported tabs schema, creating default tab');
        const fallbackTab = createDefaultHomeTab();
        setTabs([fallbackTab]);
        setActiveTabId(fallbackTab.id);
        return;
      }

      const loadedTabs: TabState[] = Array.isArray(data.groups)
        ? (data.groups[0]?.tabs ?? []).map((tab: TabState) => ({
          ...tab,
          resource: tab.resource ?? {},
          view: tab.view ?? {},
        }))
        : [];

      if (loadedTabs.length === 0) {
        const fallbackTab = createDefaultHomeTab();
        setTabs([fallbackTab]);
        setActiveTabId(fallbackTab.id);
        return;
      }

      setTabs(loadedTabs);
      const restoredActiveId = loadedTabs.some(tab => tab.id === data.activeTabId)
        ? data.activeTabId
        : loadedTabs[0].id;
      setActiveTabId(restoredActiveId);
    } catch (error) {
      const fallbackTab = createDefaultHomeTab();
      setTabs([fallbackTab]);
      setActiveTabId(fallbackTab.id);
    }
  }, [resolveTabsFilePath]);

  const value: TabContextValue = {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    selectTab,
    updateTabResource,
    updateTabMeta,
    openInNewTab,
    openInCurrentTab,
    saveTabs,
    loadTabs,
  };

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within TabProvider');
  }
  return context;
}
