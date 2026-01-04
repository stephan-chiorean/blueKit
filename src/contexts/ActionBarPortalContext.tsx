import { createContext, useContext, RefObject } from 'react';

interface ActionBarPortalContextValue {
  containerRef: RefObject<HTMLDivElement | null> | null;
}

export const ActionBarPortalContext = createContext<ActionBarPortalContextValue>({
  containerRef: null,
});

export const useActionBarPortal = () => useContext(ActionBarPortalContext);

