# BlueKit Architecture Restructure Plan

## Overview

This document outlines a comprehensive restructure of BlueKit's codebase to align folder structure with the tab-based architecture. The goal is to make the file system a clear reflection of the application's conceptual model.

**Core Principle**: TabManager is the foundational container for the entire app. The folder structure should reflect this hierarchy and make the distinction between core infrastructure, feature modules, and view components explicit.

---

## Current vs. Target Structure

### Current Structure (Flat Component Organization)

```
src/
├── App.tsx                         # Entry point
├── components/                     # Everything is a "component"
│   ├── agents/
│   ├── bases/
│   ├── blueprints/
│   ├── clones/
│   ├── collections/
│   ├── diagrams/
│   ├── kits/
│   ├── plans/
│   ├── projects/
│   ├── scrapbook/
│   ├── shared/                     # Generic shared components
│   ├── sidebar/                    # Sidebar components
│   ├── tabs/                       # Tab UI components
│   ├── tasks/
│   ├── templates/
│   ├── walkthroughs/
│   ├── workflows/
│   └── workstation/
├── contexts/                       # React contexts
│   ├── ColorModeContext.tsx
│   ├── FeatureFlagsContext.tsx
│   ├── SelectionContext.tsx
│   └── WorkstationContext.tsx
├── pages/                          # "Pages" (legacy routing concept)
│   ├── HomePage.tsx
│   ├── ProjectDetailPage.tsx
│   └── WelcomeScreen.tsx
├── utils/                          # Utilities
└── ipc.ts                          # IPC communication
```

**Problems**:
1. ❌ TabManager buried in `components/tabs/` alongside UI components
2. ❌ No distinction between "feature modules" and "infrastructure"
3. ❌ "Pages" concept conflicts with tab-based architecture
4. ❌ Unclear where new tab-related code should go
5. ❌ Feature folders (kits, blueprints) mixed with UI scaffolding (sidebar, shared)
6. ❌ Contexts scattered - no clear relationship to features

### Target Structure (Hierarchical Module Organization)

```
src/
├── app/                            # 🆕 Core application infrastructure
│   ├── App.tsx                     # Moved from src/
│   ├── TabManager.tsx              # 🆕 Root container
│   ├── TabContent.tsx              # 🆕 Content renderer
│   ├── TabContext.tsx              # 🆕 Tab state management
│   └── AppProviders.tsx            # 🆕 Context provider wrapper
│
├── views/                          # 🆕 Top-level views that render in tabs
│   ├── home/
│   │   ├── HomeView.tsx            # Renamed from HomePage
│   │   ├── WelcomeView.tsx         # Renamed from WelcomeScreen
│   │   └── components/             # Home-specific components
│   │       ├── ProjectsGrid.tsx
│   │       └── QuickActions.tsx
│   │
│   ├── project/                    # Project detail view
│   │   ├── ProjectView.tsx         # Renamed from ProjectDetailPage
│   │   ├── ProjectSidebar.tsx      # Moved from components/sidebar/
│   │   └── sections/               # Project sub-views
│   │       ├── KitsSection.tsx
│   │       ├── WalkthroughsSection.tsx
│   │       ├── BlueprintsSection.tsx
│   │       ├── TasksSection.tsx
│   │       └── PlansSection.tsx
│   │
│   └── viewer/                     # Content viewer views
│       ├── KitViewerView.tsx
│       ├── WalkthroughViewerView.tsx
│       └── DiagramViewerView.tsx
│
├── features/                       # 🆕 Self-contained feature modules
│   ├── kits/
│   │   ├── components/             # Kit-specific UI
│   │   │   ├── KitCard.tsx
│   │   │   ├── KitList.tsx
│   │   │   └── KitBrowser.tsx
│   │   ├── hooks/                  # Kit-specific hooks
│   │   │   ├── useProjectKits.ts
│   │   │   └── useKitContent.ts
│   │   ├── types.ts                # Kit type definitions
│   │   └── utils.ts                # Kit utilities
│   │
│   ├── walkthroughs/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types.ts
│   │   └── utils.ts
│   │
│   ├── blueprints/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types.ts
│   │   └── utils.ts
│   │
│   ├── agents/
│   ├── clones/
│   ├── diagrams/
│   ├── plans/
│   ├── projects/
│   ├── scrapbook/
│   ├── tasks/
│   ├── templates/
│   ├── workflows/
│   └── workstation/
│
├── shared/                         # Truly shared/generic code
│   ├── components/                 # Generic UI components
│   │   ├── buttons/
│   │   ├── layouts/
│   │   ├── modals/
│   │   └── forms/
│   │
│   ├── hooks/                      # Generic React hooks
│   │   ├── useDebounce.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── contexts/                   # Global contexts
│   │   ├── ColorModeContext.tsx
│   │   ├── FeatureFlagsContext.tsx
│   │   └── SelectionContext.tsx
│   │
│   └── utils/                      # Generic utilities
│       ├── ipc.ts
│       └── formatting.ts
│
└── tabs/                           # 🆕 Tab system UI (chrome, not logic)
    ├── BrowserTabs.tsx             # Tab bar UI
    ├── BrowserTab.tsx              # Individual tab UI
    ├── TabDivider.tsx
    ├── InvertedCorner.tsx
    ├── tabStyles.ts
    └── index.ts
```

---

## Key Architectural Principles

### 1. **App Layer = Core Infrastructure**

**Location**: `src/app/`

**Contents**:
- `App.tsx`: Entry point, providers, routing (if any)
- `TabManager.tsx`: Root container managing tab lifecycle
- `TabContent.tsx`: Renderer that switches between views based on tab type
- `TabContext.tsx`: Tab state management (create/close/update tabs)
- `AppProviders.tsx`: Wraps all context providers in one place

**Rationale**: This is the skeleton of the application. These files orchestrate everything else but contain minimal business logic.

### 2. **Views = What Renders in Tabs**

**Location**: `src/views/`

**Contents**:
- `home/`: Library/home screen view
- `project/`: Project detail view with sections
- `viewer/`: Content viewer views (kits, walkthroughs, etc.)

**Rationale**: These are the "screens" users see. Each view is a potential tab content type. Views compose feature modules and shared components.

**Naming Convention**: `*View.tsx` (e.g., `HomeView.tsx`, `ProjectView.tsx`)

### 3. **Features = Self-Contained Modules**

**Location**: `src/features/`

**Contents**: One folder per feature domain (kits, blueprints, etc.)

**Structure**:
```
features/kits/
├── components/      # Kit-specific UI components
├── hooks/           # Kit-specific React hooks
├── types.ts         # Kit type definitions
└── utils.ts         # Kit-specific utilities
```

**Rationale**: Features are independent, reusable modules. They don't know about tabs or views—they just provide domain functionality.

**Guidelines**:
- Features export components/hooks/types
- Features never import from `views/` (one-way dependency)
- Features can import from other features (sparingly)
- Features can import from `shared/`

### 4. **Shared = Generic, Reusable Code**

**Location**: `src/shared/`

**Contents**:
- `components/`: Generic UI (buttons, layouts, modals)
- `hooks/`: Generic React hooks (useDebounce, useLocalStorage)
- `contexts/`: Global contexts (ColorMode, FeatureFlags)
- `utils/`: Generic utilities (IPC, formatting)

**Rationale**: Truly generic code with no domain knowledge. Could be extracted to a library.

### 5. **Tabs = UI Chrome (Not Logic)**

**Location**: `src/tabs/`

**Contents**: Browser-style tab UI components

**Rationale**: These are presentational components for the tab bar itself. Tab *logic* lives in `app/TabContext.tsx`.

---

## Dependency Rules

```
┌─────────────────────────────────────────┐
│ app/ (infrastructure)                   │
│ - Can import from: views, features,     │
│   shared, tabs                          │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ views/ (screens)                        │
│ - Can import from: features, shared,    │
│   tabs                                  │
│ - Cannot import from: app               │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ features/ (domain modules)              │
│ - Can import from: shared, other        │
│   features (sparingly)                  │
│ - Cannot import from: app, views        │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ shared/ (generic utilities)             │
│ - Can import from: nothing (except      │
│   external libraries)                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ tabs/ (UI chrome)                       │
│ - Can import from: shared               │
│ - Cannot import from: app, views,       │
│   features                              │
└─────────────────────────────────────────┘
```

**Enforcement**: Consider ESLint rules to prevent circular dependencies.

---

## Migration Strategy

### Phase 1: Create New Structure (No Breaking Changes)

**Goal**: Introduce new folders without moving existing files.

**Steps**:
1. Create new folder structure:
   ```bash
   mkdir -p src/app
   mkdir -p src/views/{home,project,viewer}
   mkdir -p src/features
   mkdir -p src/shared/{components,hooks,contexts,utils}
   mkdir -p src/tabs
   ```

2. Create placeholder index files to document structure:
   ```bash
   touch src/app/README.md
   touch src/views/README.md
   touch src/features/README.md
   ```

3. Update `.gitignore` if needed

**Outcome**: New folders exist, but all imports still work.

---

### Phase 2: Move Core Infrastructure

**Goal**: Establish `app/` as the application root.

**Moves**:
```
src/App.tsx → src/app/App.tsx
src/contexts/WorkstationContext.tsx → src/app/WorkstationContext.tsx (maybe?)
```

**New Files**:
- `src/app/TabManager.tsx` (from tabs-implementation.md Phase 1)
- `src/app/TabContent.tsx`
- `src/app/TabContext.tsx`
- `src/app/AppProviders.tsx`

**Update**:
- `index.html`: Change entry point to `src/app/App.tsx`
- All imports of `App.tsx` (likely none, since it's the root)

**Verification**: App still runs identically.

---

### Phase 3: Migrate Tab UI Components

**Goal**: Separate tab chrome from tab logic.

**Moves**:
```
src/components/tabs/BrowserTabs.tsx → src/tabs/BrowserTabs.tsx
src/components/tabs/BrowserTab.tsx → src/tabs/BrowserTab.tsx
src/components/tabs/TabDivider.tsx → src/tabs/TabDivider.tsx
src/components/tabs/InvertedCorner.tsx → src/tabs/InvertedCorner.tsx
src/components/tabs/tabStyles.ts → src/tabs/tabStyles.ts
src/components/tabs/index.ts → src/tabs/index.ts
```

**Update Imports**:
- Search for `from '@/components/tabs'` → `from '@/tabs'`
- Update any existing usage in `ProjectDetailPage.tsx`

**Verification**: Tab UI still renders correctly.

---

### Phase 4: Migrate Views

**Goal**: Establish `views/` as top-level screens.

**Moves**:
```
src/pages/HomePage.tsx → src/views/home/HomeView.tsx
src/pages/WelcomeScreen.tsx → src/views/home/WelcomeView.tsx
src/pages/ProjectDetailPage.tsx → src/views/project/ProjectView.tsx

src/components/sidebar/ProjectSidebar.tsx → src/views/project/ProjectSidebar.tsx
src/components/sidebar/SidebarContent.tsx → src/views/project/components/SidebarContent.tsx
src/components/sidebar/SidebarSection.tsx → src/views/project/components/SidebarSection.tsx
src/components/sidebar/NotebookTree.tsx → src/views/project/components/NotebookTree.tsx

src/components/kits/KitsTabContent.tsx → src/views/project/sections/KitsSection.tsx
src/components/walkthroughs/WalkthroughsTabContent.tsx → src/views/project/sections/WalkthroughsSection.tsx
src/components/blueprints/BlueprintsTabContent.tsx → src/views/project/sections/BlueprintsSection.tsx
src/components/tasks/TasksTabContent.tsx → src/views/project/sections/TasksSection.tsx
src/components/plans/PlansTabContent.tsx → src/views/project/sections/PlansSection.tsx
```

**Update Imports**:
- Find all references to moved files
- Update to new paths
- Update component names (e.g., `HomePage` → `HomeView`)

**Delete**:
- `src/pages/` directory (now empty)
- `src/components/sidebar/` directory (now empty)

**Verification**: All views render in their new locations.

---

### Phase 5: Migrate Feature Modules

**Goal**: Organize domain logic into self-contained features.

**Moves** (example for kits):
```
src/components/kits/ → src/features/kits/components/
src/hooks/useProjectKits.ts → src/features/kits/hooks/useProjectKits.ts
src/types/kit.ts → src/features/kits/types.ts
src/utils/kitUtils.ts → src/features/kits/utils.ts
```

**Repeat for**:
- `walkthroughs/`
- `blueprints/`
- `agents/`
- `clones/`
- `diagrams/`
- `plans/`
- `projects/`
- `scrapbook/`
- `tasks/`
- `templates/`
- `workflows/`
- `workstation/`

**Create Feature Indexes**:
Each feature gets an `index.ts` that exports public API:
```typescript
// src/features/kits/index.ts
export { KitCard, KitList, KitBrowser } from './components';
export { useProjectKits, useKitContent } from './hooks';
export type { Kit, KitFile, KitMetadata } from './types';
export { parseKitFrontMatter, formatKitTitle } from './utils';
```

**Update Imports**:
- Change `from '@/components/kits/KitCard'` → `from '@/features/kits'`
- Use feature barrel exports

**Verification**: All features work independently.

---

### Phase 6: Consolidate Shared Code

**Goal**: Clean up generic utilities.

**Moves**:
```
src/components/shared/ → src/shared/components/
src/contexts/ → src/shared/contexts/
src/utils/ → src/shared/utils/
src/ipc.ts → src/shared/utils/ipc.ts
```

**Audit**:
- Review everything in `shared/` - does it have domain knowledge?
- If yes, move to appropriate feature
- If no, keep in `shared/`

**Update Imports**:
- Change `from '@/components/shared'` → `from '@/shared/components'`
- Change `from '@/utils'` → `from '@/shared/utils'`

**Verification**: Generic code is truly generic.

---

### Phase 7: Clean Up Old Structure

**Goal**: Remove empty directories and legacy files.

**Delete**:
- `src/components/` (should be empty now)
- Any remaining empty directories

**Update Documentation**:
- Update `CLAUDE.md` with new structure
- Add folder READMEs explaining purpose
- Update onboarding docs

**Verification**: No dead code, no import errors.

---

## File-by-File Migration Mapping

### Critical Files

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `src/App.tsx` | `src/app/App.tsx` | Entry point |
| `src/pages/ProjectDetailPage.tsx` | `src/views/project/ProjectView.tsx` | Main project view |
| `src/components/tabs/BrowserTabs.tsx` | `src/tabs/BrowserTabs.tsx` | Tab UI |
| `src/components/sidebar/ProjectSidebar.tsx` | `src/views/project/ProjectSidebar.tsx` | Project-specific |

### Feature Modules (Example: Kits)

| Current Location | New Location |
|-----------------|--------------|
| `src/components/kits/KitCard.tsx` | `src/features/kits/components/KitCard.tsx` |
| `src/components/kits/KitList.tsx` | `src/features/kits/components/KitList.tsx` |
| `src/components/kits/KitBrowser.tsx` | `src/features/kits/components/KitBrowser.tsx` |
| `src/components/kits/KitsTabContent.tsx` | `src/views/project/sections/KitsSection.tsx` |

*(Repeat pattern for all features: walkthroughs, blueprints, agents, etc.)*

### Shared Components

| Current Location | New Location |
|-----------------|--------------|
| `src/components/shared/EmptyProjectState.tsx` | `src/shared/components/EmptyProjectState.tsx` |
| `src/components/shared/StandardPageLayout.tsx` | `src/shared/components/layouts/StandardPageLayout.tsx` |
| `src/components/shared/ToolkitHeader.tsx` | `src/shared/components/ToolkitHeader.tsx` |

### Contexts

| Current Location | New Location |
|-----------------|--------------|
| `src/contexts/ColorModeContext.tsx` | `src/shared/contexts/ColorModeContext.tsx` |
| `src/contexts/FeatureFlagsContext.tsx` | `src/shared/contexts/FeatureFlagsContext.tsx` |
| `src/contexts/SelectionContext.tsx` | `src/shared/contexts/SelectionContext.tsx` |
| `src/contexts/WorkstationContext.tsx` | `src/app/WorkstationContext.tsx` or `src/features/workstation/WorkstationContext.tsx` |

---

## Import Path Strategy

### Option A: Update All Imports Manually

**Pros**: Simple, explicit
**Cons**: Tedious, error-prone

### Option B: Use Path Aliases (TypeScript)

**Recommended Approach**: Update `tsconfig.json` with clear aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/app/*": ["src/app/*"],
      "@/views/*": ["src/views/*"],
      "@/features/*": ["src/features/*"],
      "@/shared/*": ["src/shared/*"],
      "@/tabs/*": ["src/tabs/*"]
    }
  }
}
```

**Also Update**: `vite.config.ts`:
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './src/app'),
      '@/views': path.resolve(__dirname, './src/views'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/tabs': path.resolve(__dirname, './src/tabs'),
    }
  }
})
```

**Example Import Usage**:
```typescript
// Instead of: import { KitCard } from '../../components/kits/KitCard'
import { KitCard } from '@/features/kits';

// Instead of: import { useDebounce } from '../utils/hooks'
import { useDebounce } from '@/shared/hooks';
```

---

## Testing Strategy

### During Migration

1. **Run tests after each phase**
   ```bash
   npm run build  # Ensure no TypeScript errors
   npm run dev    # Verify app runs
   ```

2. **Verify key workflows**:
   - ✓ Open app → Welcome screen loads
   - ✓ Select project → Project view loads
   - ✓ Click sidebar item → Content updates
   - ✓ File watcher works (edit kit, see update)
   - ✓ Tab switching works (if Phase 2 complete)

3. **Check for**:
   - Broken imports (TypeScript errors)
   - Missing files (404s in network tab)
   - Circular dependencies (build warnings)

### Automated Tests (Future)

After migration, add:
- **Unit tests**: For feature modules (`features/kits/utils.test.ts`)
- **Integration tests**: For views (`views/project/ProjectView.test.tsx`)
- **E2E tests**: For tab workflows (Playwright/Cypress)

---

## Rollback Strategy

### If Migration Fails

1. **Phase-by-phase rollback**: Each phase is atomic. Revert commits for that phase only.
2. **Git branches**: Use feature branches for each phase:
   - `feat/restructure-phase-1-infrastructure`
   - `feat/restructure-phase-2-tab-ui`
   - etc.
3. **Backup**: Tag current state before starting: `git tag pre-restructure`

### Recovery Steps

```bash
# If things break:
git checkout pre-restructure

# Or revert specific phase:
git revert <phase-commit-sha>
```

---

## Post-Migration Benefits

### Developer Experience

1. **Faster Onboarding**:
   - New devs see clear structure: app → views → features
   - Obvious where to add code: "Adding kit filtering? Go to `features/kits/`"

2. **Better Code Organization**:
   - Related code lives together
   - Easy to find components: "Tab UI? Check `tabs/`"

3. **Enforced Boundaries**:
   - Features can't accidentally depend on views
   - Shared code stays generic

### Architecture Quality

1. **Scalability**:
   - New features follow module pattern
   - Views compose features, not components

2. **Maintainability**:
   - Changes localized to features
   - Views are thin orchestration layers

3. **Testability**:
   - Features are isolated, easy to test
   - Views can be integration-tested

---

## Timeline Estimate

| Phase | Effort | Risk | Blockers |
|-------|--------|------|----------|
| Phase 1: Create structure | 1 hour | Low | None |
| Phase 2: Move infrastructure | 2 hours | Low | Requires Phase 1 |
| Phase 3: Migrate tab UI | 1 hour | Low | Requires Phase 2 |
| Phase 4: Migrate views | 4 hours | Medium | Requires Phase 3 |
| Phase 5: Migrate features | 8 hours | Medium | Requires Phase 4 |
| Phase 6: Consolidate shared | 2 hours | Low | Requires Phase 5 |
| Phase 7: Clean up | 1 hour | Low | Requires Phase 6 |
| **Total** | **~19 hours** | **Medium** | Sequential |

**Notes**:
- Estimates assume no major refactoring, just moves
- Actual time depends on codebase familiarity
- Testing adds ~20% overhead

---

## Success Criteria

### Quantitative

- [ ] Zero TypeScript errors after migration
- [ ] All existing tests pass
- [ ] App builds successfully (`npm run build`)
- [ ] Bundle size unchanged (±5%)

### Qualitative

- [ ] New developers understand structure from folder names alone
- [ ] "Where does X go?" has obvious answer
- [ ] No circular dependencies (enforced by ESLint)
- [ ] Each feature module is independently testable

---

## Open Questions

### 1. Should Contexts Live in `app/` or `shared/`?

**Option A**: All contexts in `shared/contexts/`
- **Pro**: Easy to find
- **Con**: Not all contexts are "shared" (e.g., TabContext)

**Option B**: Core contexts in `app/`, generic in `shared/`
- **Pro**: Reflects usage (TabContext is app-level)
- **Con**: Split across two places

**Recommendation**: **Option B**. Put TabContext in `app/`, generic contexts in `shared/`.

### 2. What About `WorkstationContext`?

Currently in `src/contexts/`. Options:
- **A**: Move to `app/` (global app state)
- **B**: Move to `features/workstation/` (feature-specific)

**Recommendation**: **A** if it's used across multiple features, **B** if only workstation views use it.

### 3. Should Feature Folders Be Flat or Nested?

**Flat**:
```
features/
├── kits/
├── walkthroughs/
└── blueprints/
```

**Nested** (by category):
```
features/
├── content/
│   ├── kits/
│   ├── walkthroughs/
│   └── diagrams/
└── scaffolding/
    ├── blueprints/
    └── clones/
```

**Recommendation**: **Flat** initially. Add nesting if feature count exceeds ~15.

### 4. Where Should Type Definitions Live?

**Option A**: Each feature exports its own types
```typescript
import type { Kit } from '@/features/kits';
```

**Option B**: Centralized `src/types/`
```typescript
import type { Kit } from '@/types';
```

**Recommendation**: **Option A** for feature-specific types, **Option B** for truly global types (e.g., `TabResource`).

---

## Appendix: Example Feature Module Structure

```
features/kits/
├── components/              # UI components
│   ├── KitCard.tsx
│   ├── KitList.tsx
│   ├── KitBrowser.tsx
│   └── KitMetadataEditor.tsx
│
├── hooks/                   # React hooks
│   ├── useProjectKits.ts
│   ├── useKitContent.ts
│   └── useKitWatcher.ts
│
├── types.ts                 # Type definitions
│   ├── Kit
│   ├── KitFile
│   └── KitMetadata
│
├── utils.ts                 # Utilities
│   ├── parseKitFrontMatter()
│   ├── formatKitTitle()
│   └── validateKitSchema()
│
├── constants.ts             # Constants
│   └── KIT_FILE_EXTENSIONS
│
└── index.ts                 # Public API
    └── Re-exports for consumers
```

**Usage in Views**:
```typescript
import { KitBrowser, useProjectKits } from '@/features/kits';

function KitsSection() {
  const kits = useProjectKits(projectId);
  return <KitBrowser kits={kits} />;
}
```

---

## Conclusion

This restructure aligns BlueKit's file system with its tab-based architecture, making the codebase more maintainable and scalable. By establishing clear boundaries between infrastructure (`app/`), screens (`views/`), domain logic (`features/`), and utilities (`shared/`), new developers can navigate the codebase intuitively.

**Key Takeaway**: Architecture should be visible. If TabManager is the foundation of the app, it should live at the root, not buried three folders deep.

**Next Steps**:
1. Review this plan with team
2. Create migration branch: `feat/architecture-restructure`
3. Execute Phase 1 (create new structure)
4. Iterate through phases, testing after each
5. Merge when all phases complete and tests pass
