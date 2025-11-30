---
id: context-providers
type: task
version: 1
---

# React Context Providers

Create React context providers for state management, following the project's context patterns.

## Requirements

- Completed "React Setup" task
- Understanding of React Context API

## Steps

### 1. Create Selection Context

Create `src/contexts/SelectionContext.tsx`:

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectionContextType {
  selectedItem: any | null;
  setSelectedItem: (item: any | null) => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  return (
    <SelectionContext.Provider value={{ selectedItem, setSelectedItem }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
```

### 2. Create Color Mode Context

Create `src/contexts/ColorModeContext.tsx`:

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';

type ColorMode = 'light' | 'dark';

interface ColorModeContextType {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>('light');

  const toggleColorMode = () => {
    setColorMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ColorModeContext.Provider value={{ colorMode, toggleColorMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (context === undefined) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}
```

### 3. Create Workstation Context

Create `src/contexts/WorkstationContext.tsx`:

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { KitFile } from '../ipc';

interface WorkstationContextType {
  selectedKit: KitFile | null;
  setSelectedKit: (kit: KitFile | null) => void;
  kitContent: string | null;
  setKitContent: (content: string | null) => void;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

export function WorkstationProvider({ children }: { children: ReactNode }) {
  const [selectedKit, setSelectedKit] = useState<KitFile | null>(null);
  const [kitContent, setKitContent] = useState<string | null>(null);

  return (
    <WorkstationContext.Provider value={{
      selectedKit,
      setSelectedKit,
      kitContent,
      setKitContent,
    }}>
      {children}
    </WorkstationContext.Provider>
  );
}

export function useWorkstation() {
  const context = useContext(WorkstationContext);
  if (context === undefined) {
    throw new Error('useWorkstation must be used within a WorkstationProvider');
  }
  return context;
}
```

### 4. Update App.tsx

Wrap App with all providers:

```typescript
import { WorkstationProvider } from './contexts/WorkstationContext';

// In App component:
return (
  <ColorModeProvider>
    <WorkstationProvider>
      <SelectionProvider>
        {/* App content */}
      </SelectionProvider>
    </WorkstationProvider>
  </ColorModeProvider>
);
```

## Context Patterns

1. **Provider Component**: Wraps children and provides state
2. **Custom Hook**: `useContext` wrapper for easy access
3. **Type Safety**: TypeScript interfaces for context values
4. **Error Handling**: Throw error if hook used outside provider

## Best Practices

1. Keep contexts focused on specific domains
2. Use custom hooks for context access
3. Provide default values where appropriate
4. Document context purpose and usage

## Verification

- Contexts should be accessible in child components
- Hooks should throw errors when used outside providers
- State updates should trigger re-renders

## Next Steps

After completing this task, proceed to "Chakra UI Setup" task.