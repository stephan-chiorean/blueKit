import { useEffect, useRef } from 'react';
import TabContent from './TabContent';
import { TabProvider, useTabContext } from './TabContext';

function TabPersistence() {
  const { tabs, activeTabId, saveTabs, loadTabs } = useTabContext();

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadTabs();
      loadedRef.current = true;
    }
  }, [loadTabs]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveTabs();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [tabs, activeTabId, saveTabs]);

  return null;
}

export default function TabManager() {
  return (
    <TabProvider>
      <TabPersistence />
      <TabContent />
    </TabProvider>
  );
}
