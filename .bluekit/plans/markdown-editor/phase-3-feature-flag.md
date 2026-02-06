# Phase 3: Feature Flag

**Status:** Not Started
**Duration:** 1 day
**Dependencies:** Phase 2 complete

## Overview

Deploy both editors side-by-side with a feature flag toggle. This allows A/B testing, easy rollback, and gradual migration without risk to production users.

## Goals

- Add `useHybridEditor` feature flag
- Create toggle UI for switching editors
- Enable conditional rendering in pages
- Test both editors work without conflicts
- Prepare for gradual rollout

## Implementation

### 1. Add Feature Flag to Context

**Location:** `src/shared/contexts/FeatureFlagsContext.tsx`

**Current interface (verify):**
```typescript
export interface FeatureFlags {
  // Existing flags...
}
```

**Add new flag:**
```typescript
export interface FeatureFlags {
  // Existing flags...
  useHybridEditor: boolean;
}
```

**Update default values:**
```typescript
const defaultFlags: FeatureFlags = {
  // Existing defaults...
  useHybridEditor: false,  // Off by default for safety
};
```

**If FeatureFlagsContext doesn't exist, create it:**

```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface FeatureFlags {
  useHybridEditor: boolean;
}

const defaultFlags: FeatureFlags = {
  useHybridEditor: false,
};

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  setFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void;
  resetFlags: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    // Load from localStorage
    const stored = localStorage.getItem('featureFlags');
    return stored ? { ...defaultFlags, ...JSON.parse(stored) } : defaultFlags;
  });

  useEffect(() => {
    // Persist to localStorage
    localStorage.setItem('featureFlags', JSON.stringify(flags));
  }, [flags]);

  const setFlag = <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlags(prev => ({ ...prev, [key]: value }));
  };

  const resetFlags = () => {
    setFlags(defaultFlags);
    localStorage.removeItem('featureFlags');
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, setFlag, resetFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
}
```

**Wrap app in provider** (`src/App.tsx`):
```tsx
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';

function App() {
  return (
    <FeatureFlagsProvider>
      <ColorModeProvider>
        <WorkstationProvider>
          {/* Rest of app */}
        </WorkstationProvider>
      </ColorModeProvider>
    </FeatureFlagsProvider>
  );
}
```

---

### 2. Create Feature Flag Toggle UI

**Option A: Settings Page (Recommended)**

**Location:** `src/pages/SettingsPage.tsx` or create if doesn't exist

```tsx
import { VStack, HStack, Text, Box } from '@chakra-ui/react';
import { Switch } from '@/shared/components/ui/switch';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';

export default function SettingsPage() {
  const { flags, setFlag } = useFeatureFlags();

  return (
    <Box p={8}>
      <VStack align="stretch" gap={6} maxW="600px">
        <Text fontSize="2xl" fontWeight="bold">Settings</Text>

        <Box>
          <Text fontSize="lg" fontWeight="medium" mb={4}>
            Experimental Features
          </Text>

          <VStack align="stretch" gap={4}>
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <Text fontWeight="medium">Hybrid Block Editor</Text>
                <Text fontSize="sm" color="text.secondary">
                  Click individual blocks to edit. More modern UX, but still in testing.
                </Text>
              </VStack>
              <Switch
                checked={flags.useHybridEditor}
                onCheckedChange={(e) => setFlag('useHybridEditor', e.checked)}
              />
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
```

**Add route:**
```tsx
// In router config
<Route path="/settings" element={<SettingsPage />} />
```

**Add navigation link** (sidebar or menu):
```tsx
<MenuItem onClick={() => navigate('/settings')}>
  Settings
</MenuItem>
```

---

**Option B: Dev Menu (Quick Access)**

**Location:** Add to existing dev menu or create keyboard shortcut

```tsx
// In main layout component
import { useHotkeys } from '@/shared/hooks/useHotkeys';

function MainLayout() {
  const { flags, setFlag } = useFeatureFlags();
  const [showDevMenu, setShowDevMenu] = useState(false);

  // Toggle dev menu with Cmd+Shift+D
  useHotkeys('mod+shift+d', () => setShowDevMenu(prev => !prev));

  return (
    <>
      {/* Main content */}

      {showDevMenu && (
        <Box
          position="fixed"
          bottom={4}
          right={4}
          bg="gray.800"
          color="white"
          p={4}
          borderRadius="lg"
          boxShadow="xl"
          zIndex={9999}
        >
          <VStack align="stretch" gap={2}>
            <Text fontSize="sm" fontWeight="bold">Dev Menu</Text>
            <HStack>
              <Switch
                size="sm"
                checked={flags.useHybridEditor}
                onCheckedChange={(e) => setFlag('useHybridEditor', e.checked)}
              />
              <Text fontSize="sm">Hybrid Editor</Text>
            </HStack>
          </VStack>
        </Box>
      )}
    </>
  );
}
```

---

### 3. Conditional Rendering Pattern

**Template for all pages:**

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { HybridEditorWithFeatures } from '@/shared/components/hybridEditor';
import { MarkdownEditor } from '@/shared/components/editor/MarkdownEditor';

function SomePage() {
  const { flags } = useFeatureFlags();
  const [resource, setResource] = useState<ResourceFile>(...);

  return (
    <Box>
      {flags.useHybridEditor ? (
        <HybridEditorWithFeatures
          resource={resource}
          showSearch={true}
          showBacklinks={true}
        />
      ) : (
        <MarkdownEditor
          value={resource.content}
          onChange={(value) => {
            // Handle change with old editor
          }}
        />
      )}
    </Box>
  );
}
```

---

### 4. Add Visual Indicator

**Show which editor is active:**

```tsx
{flags.useHybridEditor && (
  <Box
    position="fixed"
    bottom={4}
    left={4}
    fontSize="xs"
    color="text.tertiary"
    bg="blue.100"
    px={2}
    py={1}
    borderRadius="md"
    _dark={{ bg: 'blue.900' }}
  >
    🚀 Hybrid Editor
  </Box>
)}
```

---

## Testing Plan

### Test 1: Flag Toggle

**Steps:**
1. Open settings page
2. Toggle hybrid editor ON
3. Navigate to note/kit page
4. Verify hybrid editor renders
5. Toggle hybrid editor OFF
6. Refresh page
7. Verify old editor renders

**Expected:**
- [ ] Toggle persists across page refreshes
- [ ] Toggle persists across app restarts (localStorage)
- [ ] Editor switches immediately (no stale state)

---

### Test 2: Both Editors Work

**Steps:**
1. Flag OFF → Edit note with old editor → Verify save
2. Flag ON → Edit same note with new editor → Verify save
3. Compare content → Should be identical

**Expected:**
- [ ] Both editors save correctly
- [ ] No markdown corruption switching between editors
- [ ] Auto-save works in both modes
- [ ] File watcher works in both modes

---

### Test 3: Feature Flag Persistence

**Steps:**
1. Enable hybrid editor
2. Close app
3. Reopen app
4. Verify hybrid editor still enabled

**Expected:**
- [ ] Flag persists in localStorage
- [ ] App loads with correct editor
- [ ] No flash of wrong editor

---

### Test 4: Reset Functionality

**Steps:**
1. Enable hybrid editor
2. Change other settings
3. Click "Reset to Defaults"
4. Verify hybrid editor disabled

**Expected:**
- [ ] All flags reset to defaults
- [ ] localStorage cleared
- [ ] Old editor active

---

## Rollout Strategy

### Week 1: Internal Testing
- Flag default: `false`
- Enable for development team only
- Gather initial feedback
- Fix critical bugs

### Week 2: Beta Testing
- Add opt-in UI in settings
- Allow users to enable voluntarily
- Monitor for issues
- Collect user feedback

### Week 3: Gradual Rollout
- Consider changing default to `true` for new users
- Keep toggle available for rollback
- Monitor metrics (save success rate, error rate)

### Week 4+: Make Default
- Move to Phase 6: Remove Old Code
- Deprecated old editor
- Remove CodeMirror dependencies

---

## Monitoring & Metrics

**Track these metrics during rollout:**

```typescript
// Analytics event when flag toggled
function trackFeatureFlagChange(flag: string, value: boolean) {
  console.log('[Analytics] Feature flag changed', { flag, value });
  // Send to analytics service if available
}

// Track editor usage
useEffect(() => {
  if (flags.useHybridEditor) {
    console.log('[Analytics] Hybrid editor active');
  } else {
    console.log('[Analytics] Legacy editor active');
  }
}, [flags.useHybridEditor]);
```

**Metrics to monitor:**
- % of users with hybrid editor enabled
- Save success rate (both editors)
- Error rate (console errors, crashes)
- User feedback (bug reports)

---

## Acceptance Criteria

- [ ] `useHybridEditor` flag added to context
- [ ] Toggle UI implemented (settings or dev menu)
- [ ] Flag persists in localStorage
- [ ] Conditional rendering works in all pages
- [ ] Both editors tested and working
- [ ] No conflicts between editors
- [ ] Visual indicator shows active editor
- [ ] Reset functionality works
- [ ] Code reviewed and approved

---

## Next Steps

After Phase 3 completion:
- Tag commit: `hybrid-editor-phase-3-complete`
- Move to Phase 4: Migrate Pages
- Begin replacing editors page-by-page

---

**Files Created:**
- `src/shared/contexts/FeatureFlagsContext.tsx` (if doesn't exist)
- `src/pages/SettingsPage.tsx` (if doesn't exist)

**Files Modified:**
- `src/App.tsx` (add provider)
- Router config (add settings route)
- Sidebar/menu (add settings link)

**No changes to:**
- Existing editor components
- Page components (until Phase 4)
