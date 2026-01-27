# Phase 1: Architecture Restructure - File Organization

## Goal

Reorganize BlueKit's codebase to align with tab-based architecture WITHOUT changing any functionality or styling. This is a pure refactoring phase focused on moving files and updating import paths.

**Success Criteria**:
- ✅ App runs identically to before
- ✅ All existing functionality preserved
- ✅ Zero visual changes
- ✅ Zero TypeScript errors
- ✅ All file watchers still work
- ✅ New folder structure reflects architectural hierarchy

---

## Pre-Migration Checklist

### 1. No need to create safety net
User will be manually ensuring that there is a rollback mechanism. do not stage changes. User will handle any git actions. 

### 2. Run Baseline Tests

```bash
# Verify app works before changes
npm run build           # Should succeed with no errors
npm run dev             # Should start successfully
npm run tauri dev       # Should launch app

# Manual verification:
# - Open app
# - Navigate to project
# - Click sidebar items
# - Open tabs (if implemented)
# - Verify file watchers work (edit a kit, see update)
```

### 3. Document Current Import Patterns

```bash
# Generate import report (helps with verification)
grep -r "from '@/" src/ > imports-before.txt
grep -r "from '\.\./" src/ > relative-imports-before.txt
```

---

## Migration Steps

### Step 1: Update TypeScript Configuration

**File**: `tsconfig.json`

**Add path aliases**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],              // Keep existing
      "@/app/*": ["src/app/*"],      // New
      "@/views/*": ["src/views/*"],  // New
      "@/features/*": ["src/features/*"],  // New
      "@/shared/*": ["src/shared/*"],      // New
      "@/tabs/*": ["src/tabs/*"]           // New
    }
  }
}
```

**File**: `vite.config.ts`

**Update resolve.alias**:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/app': path.resolve(__dirname, './src/app'),
      '@/views': path.resolve(__dirname, './src/views'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/tabs': path.resolve(__dirname, './src/tabs'),
    }
  },
  // ... rest of config
});
```

**Verify**:
```bash
npm run build  # Should still compile
```

---

### Step 2: Create New Folder Structure

**Create all directories at once**:

```bash
cd src

# Core infrastructure
mkdir -p app

# Top-level views
mkdir -p views/home/components
mkdir -p views/project/sections
mkdir -p views/project/components
mkdir -p views/viewer

# Feature modules
mkdir -p features/agents/{components,hooks}
mkdir -p features/bases/{components,hooks}
mkdir -p features/blueprints/{components,hooks}
mkdir -p features/clones/{components,hooks}
mkdir -p features/collections/{components,hooks}
mkdir -p features/diagrams/{components,hooks}
mkdir -p features/kits/{components,hooks}
mkdir -p features/plans/{components,hooks}
mkdir -p features/projects/{components,hooks}
mkdir -p features/scrapbook/{components,hooks}
mkdir -p features/tasks/{components,hooks}
mkdir -p features/templates/{components,hooks}
mkdir -p features/walkthroughs/{components,hooks}
mkdir -p features/workflows/{components,hooks}
mkdir -p features/workstation/{components,hooks}

# Shared utilities
mkdir -p shared/components/{buttons,layouts,modals,forms}
mkdir -p shared/hooks
mkdir -p shared/contexts
mkdir -p shared/utils

# Tab UI
mkdir -p tabs
```

**Create placeholder READMEs**:

```bash
cat > app/README.md << 'EOF'
# app/

Core application infrastructure. This is the skeleton that orchestrates everything else.

**Contents**:
- `App.tsx` - Entry point and provider setup
- `TabManager.tsx` - Root container managing tab lifecycle (future)
- `TabContext.tsx` - Tab state management (future)
- `TabContent.tsx` - Tab content renderer (future)

**Imports**: Can import from views, features, shared, tabs
**Imported by**: Nothing (this is the root)
EOF

cat > views/README.md << 'EOF'
# views/

Top-level views that render in tabs. Each view is a complete "screen" in the app.

**Contents**:
- `home/` - Library/home screen
- `project/` - Project detail view
- `viewer/` - Content viewers (kits, walkthroughs, diagrams)

**Naming**: Use `*View.tsx` suffix (e.g., `HomeView.tsx`)
**Imports**: Can import from features, shared, tabs
**Imported by**: app/
EOF

cat > features/README.md << 'EOF'
# features/

Self-contained domain modules. Each feature is independent and reusable.

**Structure**:
```
features/<feature-name>/
├── components/      # Feature-specific UI
├── hooks/           # Feature-specific React hooks
├── types.ts         # Type definitions
├── utils.ts         # Utilities
└── index.ts         # Public API exports
```

**Imports**: Can import from shared, other features (sparingly)
**Imported by**: views/, app/
EOF

cat > shared/README.md << 'EOF'
# shared/

Truly generic, reusable code with no domain knowledge. Could be extracted to a library.

**Contents**:
- `components/` - Generic UI (buttons, layouts, modals)
- `hooks/` - Generic React hooks
- `contexts/` - Global contexts (ColorMode, FeatureFlags)
- `utils/` - Generic utilities

**Imports**: Nothing (except external libraries)
**Imported by**: Everything
EOF

cat > tabs/README.md << 'EOF'
# tabs/

Browser-style tab UI components (chrome only, not logic).

Tab *logic* lives in `app/TabContext.tsx`. These are presentational components.

**Imports**: Can import from shared
**Imported by**: app/, views/
EOF
```

**Verify**:
```bash
tree src -L 2  # Should show new structure
```

---

### Step 3: Move Core Infrastructure

**3.1 Move App.tsx**

```bash
git mv src/App.tsx src/app/App.tsx
```

**Update**: `index.html`

```diff
- <script type="module" src="/src/main.tsx"></script>
+ <script type="module" src="/src/main.tsx"></script>
```

**Update**: `src/main.tsx`

```diff
- import App from './App'
+ import App from './app/App'
```

**3.2 Move WorkstationContext** (if it's app-level state)

```bash
git mv src/contexts/WorkstationContext.tsx src/app/WorkstationContext.tsx
```

**Update imports** in any file that uses it:

```bash
# Find all files importing WorkstationContext
grep -r "WorkstationContext" src/

# Update each file's import:
# from '@/contexts/WorkstationContext'
# to '@/app/WorkstationContext'
```

**Verify**:
```bash
npm run build  # Should compile
npm run dev    # App should run
```

---

### Step 4: Move Tab UI Components

**Move all tab UI files**:

```bash
git mv src/components/tabs/BrowserTabs.tsx src/tabs/BrowserTabs.tsx
git mv src/components/tabs/BrowserTab.tsx src/tabs/BrowserTab.tsx
git mv src/components/tabs/TabDivider.tsx src/tabs/TabDivider.tsx
git mv src/components/tabs/InvertedCorner.tsx src/tabs/InvertedCorner.tsx
git mv src/components/tabs/tabStyles.ts src/tabs/tabStyles.ts
git mv src/components/tabs/index.ts src/tabs/index.ts
```

**Update imports in moved files** (they may import from each other):

```typescript
// In src/tabs/BrowserTabs.tsx
// Update any relative imports from './TabDivider' to use same directory
// (should already work since they're in same folder)
```

**Find and update all imports of tab components**:

```bash
# Find files importing from '@/components/tabs'
grep -r "from '@/components/tabs" src/

# For each file, update to:
# from '@/tabs'
```

**Common files to update**:
- `src/pages/ProjectDetailPage.tsx`
- Any view components using tabs

**Verify**:
```bash
npm run build
npm run dev
# Test tab switching if tabs are visible in UI
```

---

### Step 5: Move Views (Pages → Views)

**5.1 Move Home View**

```bash
git mv src/pages/HomePage.tsx src/views/home/HomeView.tsx
git mv src/pages/WelcomeScreen.tsx src/views/home/WelcomeView.tsx
```

**Update component names inside files**:

```typescript
// In src/views/home/HomeView.tsx
// Change: export default function HomePage() {
// To:     export default function HomeView() {
```

```typescript
// In src/views/home/WelcomeView.tsx
// Change: export default function WelcomeScreen() {
// To:     export default function WelcomeView() {
```

**5.2 Move Project View**

```bash
git mv src/pages/ProjectDetailPage.tsx src/views/project/ProjectView.tsx
```

**Update component name**:

```typescript
// In src/views/project/ProjectView.tsx
// Change: export default function ProjectDetailPage() {
// To:     export default function ProjectView() {
```

**5.3 Update App.tsx to import new view names**

```typescript
// In src/app/App.tsx
import WelcomeView from '@/views/home/WelcomeView';
import HomeView from '@/views/home/HomeView';
import ProjectView from '@/views/project/ProjectView';

// Update JSX:
// <WelcomeScreen /> → <WelcomeView />
// <HomePage /> → <HomeView />
// <ProjectDetailPage /> → <ProjectView />
```

**5.4 Delete empty pages directory**

```bash
rmdir src/pages  # Should be empty now
```

**Verify**:
```bash
npm run build
npm run dev
# Test: Welcome → Home → Project navigation
```

---

### Step 6: Move Sidebar Components to Project View

Sidebar is project-specific, should live with project view.

```bash
git mv src/components/sidebar/ProjectSidebar.tsx src/views/project/ProjectSidebar.tsx
git mv src/components/sidebar/SidebarContent.tsx src/views/project/components/SidebarContent.tsx
git mv src/components/sidebar/SidebarSection.tsx src/views/project/components/SidebarSection.tsx
git mv src/components/sidebar/NotebookTree.tsx src/views/project/components/NotebookTree.tsx
```

**Update imports within sidebar files**:

```typescript
// In ProjectSidebar.tsx
import SidebarContent from './components/SidebarContent';
import SidebarSection from './components/SidebarSection';
```

**Update ProjectView import**:

```typescript
// In src/views/project/ProjectView.tsx
import ProjectSidebar from './ProjectSidebar';
```

**Find and update any other imports**:

```bash
grep -r "from '@/components/sidebar" src/
# Update each to use new paths
```

**Delete empty sidebar directory**:

```bash
rmdir src/components/sidebar  # Should be empty
```

**Verify**:
```bash
npm run build
npm run dev
# Test: Project sidebar renders and works
```

---

### Step 7: Move Tab Content Components to Sections

These are sub-views within project view.

```bash
git mv src/components/kits/KitsTabContent.tsx src/views/project/sections/KitsSection.tsx
git mv src/components/walkthroughs/WalkthroughsTabContent.tsx src/views/project/sections/WalkthroughsSection.tsx
git mv src/components/blueprints/BlueprintsTabContent.tsx src/views/project/sections/BlueprintsSection.tsx
git mv src/components/tasks/TasksTabContent.tsx src/views/project/sections/TasksSection.tsx
git mv src/components/plans/PlansTabContent.tsx src/views/project/sections/PlansSection.tsx
```

**Update component names**:

```typescript
// In KitsSection.tsx
// Change: export default function KitsTabContent() {
// To:     export default function KitsSection() {
```

*(Repeat for all section files)*

**Update ProjectView imports**:

```typescript
// In src/views/project/ProjectView.tsx
import KitsSection from './sections/KitsSection';
import WalkthroughsSection from './sections/WalkthroughsSection';
import BlueprintsSection from './sections/BlueprintsSection';
import TasksSection from './sections/TasksSection';
import PlansSection from './sections/PlansSection';

// Update JSX:
// <KitsTabContent /> → <KitsSection />
// etc.
```

**Verify**:
```bash
npm run build
npm run dev
# Test: Click each sidebar item, verify sections render
```

---

### Step 8: Move Feature Module Components

For each feature, move components to `features/<feature>/components/`.

**8.1 Kits Feature**

```bash
# Move all kit components except KitsTabContent (already moved)
for file in src/components/kits/*.tsx; do
  filename=$(basename "$file")
  if [ "$filename" != "KitsTabContent.tsx" ]; then
    git mv "$file" src/features/kits/components/
  fi
done
```

**Create feature index**:

```typescript
// src/features/kits/index.ts
export { default as KitCard } from './components/KitCard';
export { default as KitList } from './components/KitList';
export { default as KitBrowser } from './components/KitBrowser';
// ... export all public components
```

**Update imports in KitsSection**:

```typescript
// In src/views/project/sections/KitsSection.tsx
import { KitCard, KitList, KitBrowser } from '@/features/kits';
```

**8.2 Repeat for all features**:

```bash
# Walkthroughs
for file in src/components/walkthroughs/*.tsx; do
  filename=$(basename "$file")
  if [ "$filename" != "WalkthroughsTabContent.tsx" ]; then
    git mv "$file" src/features/walkthroughs/components/
  fi
done

# Blueprints
for file in src/components/blueprints/*.tsx; do
  filename=$(basename "$file")
  if [ "$filename" != "BlueprintsTabContent.tsx" ]; then
    git mv "$file" src/features/blueprints/components/
  fi
done

# Tasks
for file in src/components/tasks/*.tsx; do
  filename=$(basename "$file")
  if [ "$filename" != "TasksTabContent.tsx" ]; then
    git mv "$file" src/features/tasks/components/
  fi
done

# Plans
for file in src/components/plans/*.tsx; do
  filename=$(basename "$file")
  if [ "$filename" != "PlansTabContent.tsx" ]; then
    git mv "$file" src/features/plans/components/
  fi
done

# Projects
git mv src/components/projects/* src/features/projects/components/

# Agents
git mv src/components/agents/* src/features/agents/components/

# Bases
git mv src/components/bases/* src/features/bases/components/

# Clones
git mv src/components/clones/* src/features/clones/components/

# Collections
git mv src/components/collections/* src/features/collections/components/

# Diagrams
git mv src/components/diagrams/* src/features/diagrams/components/

# Scrapbook
git mv src/components/scrapbook/* src/features/scrapbook/components/

# Templates
git mv src/components/templates/* src/features/templates/components/

# Workflows
git mv src/components/workflows/* src/features/workflows/components/

# Workstation
git mv src/components/workstation/* src/features/workstation/components/
```

**For each feature, create index.ts**:

```bash
# Example script to generate index files
for feature in agents bases blueprints clones collections diagrams kits plans projects scrapbook tasks templates walkthroughs workflows workstation; do
  cat > "src/features/$feature/index.ts" << EOF
// Auto-generated exports for $feature feature
export * from './components';
EOF
done
```

**Update imports across codebase**:

```bash
# Find all imports from old component paths
grep -r "from '@/components/kits" src/
grep -r "from '@/components/walkthroughs" src/
# ... etc for each feature

# Update each to use feature path:
# from '@/components/kits/KitCard' → from '@/features/kits'
```

**Verify**:
```bash
npm run build  # Should compile
npm run dev
# Test each feature area
```

---

### Step 9: Move Shared Components

```bash
# Move shared components
git mv src/components/shared/EmptyProjectState.tsx src/shared/components/
git mv src/components/shared/StandardPageLayout.tsx src/shared/components/layouts/
git mv src/components/shared/ToolkitHeader.tsx src/shared/components/

# Move any other files in shared/
git mv src/components/shared/* src/shared/components/
```

**Create shared components index**:

```typescript
// src/shared/components/index.ts
export { default as EmptyProjectState } from './EmptyProjectState';
export { default as ToolkitHeader } from './ToolkitHeader';
export { default as StandardPageLayout } from './layouts/StandardPageLayout';
```

**Update imports**:

```bash
# Find imports from old shared path
grep -r "from '@/components/shared" src/

# Update to:
# from '@/shared/components'
```

**Verify**:
```bash
npm run build
```

---

### Step 10: Move Contexts

```bash
git mv src/contexts/ColorModeContext.tsx src/shared/contexts/
git mv src/contexts/FeatureFlagsContext.tsx src/shared/contexts/
git mv src/contexts/SelectionContext.tsx src/shared/contexts/
# WorkstationContext already moved to app/ in Step 3
```

**Create contexts index**:

```typescript
// src/shared/contexts/index.ts
export { ColorModeContext, ColorModeProvider } from './ColorModeContext';
export { FeatureFlagsContext, FeatureFlagsProvider } from './FeatureFlagsContext';
export { SelectionContext, SelectionProvider } from './SelectionContext';
```

**Update imports in App.tsx**:

```typescript
// In src/app/App.tsx
import { ColorModeProvider } from '@/shared/contexts';
import { FeatureFlagsProvider } from '@/shared/contexts';
// ... etc
```

**Find and update all context imports**:

```bash
grep -r "from '@/contexts/" src/
# Update each to '@/shared/contexts'
```

**Verify**:
```bash
npm run build
```

---

### Step 11: Move Utilities

```bash
# Move all utilities to shared/utils
git mv src/utils/* src/shared/utils/
git mv src/ipc.ts src/shared/utils/ipc.ts
```

**Create utils index**:

```typescript
// src/shared/utils/index.ts
export * from './ipc';
export * from './ipcTimeout';
export * from './formatting';
// ... export all utilities
```

**Update imports**:

```bash
# Find all utils imports
grep -r "from '@/utils/" src/
grep -r "from '@/ipc" src/

# Update to:
# from '@/shared/utils'
```

**Verify**:
```bash
npm run build
```

---

### Step 12: Clean Up Empty Directories

```bash
# Remove old empty directories
rmdir src/components/tabs 2>/dev/null || true
rmdir src/components/sidebar 2>/dev/null || true
rmdir src/components/shared 2>/dev/null || true
rmdir src/components/kits 2>/dev/null || true
rmdir src/components/walkthroughs 2>/dev/null || true
rmdir src/components/blueprints 2>/dev/null || true
rmdir src/components/tasks 2>/dev/null || true
rmdir src/components/plans 2>/dev/null || true
rmdir src/components/projects 2>/dev/null || true
rmdir src/components/agents 2>/dev/null || true
rmdir src/components/bases 2>/dev/null || true
rmdir src/components/clones 2>/dev/null || true
rmdir src/components/collections 2>/dev/null || true
rmdir src/components/diagrams 2>/dev/null || true
rmdir src/components/scrapbook 2>/dev/null || true
rmdir src/components/templates 2>/dev/null || true
rmdir src/components/workflows 2>/dev/null || true
rmdir src/components/workstation 2>/dev/null || true
rmdir src/components 2>/dev/null || true
rmdir src/contexts 2>/dev/null || true
rmdir src/utils 2>/dev/null || true
rmdir src/pages 2>/dev/null || true

# Verify structure
tree src -L 2
```

**Verify**:
```bash
# Ensure no old directories remain
ls src/components  # Should not exist
ls src/pages      # Should not exist
ls src/contexts   # Should not exist
ls src/utils      # Should not exist
```

---

## Post-Migration Checklist

### 1. Verify Build

```bash
npm run build
# Should complete with zero errors
```

### 2. Verify TypeScript

```bash
npx tsc --noEmit
# Should report zero errors
```

### 3. Manual Testing

**Test all major workflows**:
- [ ] App launches successfully
- [ ] Welcome screen renders
- [ ] Home screen renders
- [ ] Can select project
- [ ] Project view renders with sidebar
- [ ] Each sidebar item works:
  - [ ] Kits
  - [ ] Walkthroughs
  - [ ] Blueprints
  - [ ] Tasks
  - [ ] Plans
  - [ ] Agents
  - [ ] Templates
  - [ ] Collections
  - [ ] Scrapbook
  - [ ] Workflows
  - [ ] Diagrams
  - [ ] Clones
  - [ ] Bases
- [ ] File watchers work (edit a kit, see update in UI)
- [ ] No console errors
- [ ] No visual regressions

### 4. Compare Import Patterns

```bash
# Generate new import report
grep -r "from '@/" src/ > imports-after.txt

# Compare
diff imports-before.txt imports-after.txt
# Should show only path changes, no missing imports
```

### 5. Git Status Check

```bash
git status

# Should show:
# - Renamed files (git mv preserves history)
# - Modified files (import updates)
# - New files (index.ts exports, READMEs)
# - Deleted directories
```

---

## Commit Strategy

**Option A: Single Atomic Commit**

```bash
git add -A
git commit -m "Phase 1: Restructure architecture to align with tab-based system

- Move app infrastructure to src/app/
- Move views to src/views/
- Move feature modules to src/features/
- Move shared utilities to src/shared/
- Move tab UI to src/tabs/
- Update all import paths to use new structure
- Add path aliases to tsconfig.json and vite.config.ts
- Add README files documenting folder purpose

No functional changes. Pure refactoring for better architecture alignment."
```

**Option B: Step-by-Step Commits**

```bash
# Commit after each major step:
git add tsconfig.json vite.config.ts
git commit -m "Add path aliases for new folder structure"

git add src/app/ src/main.tsx
git commit -m "Move core infrastructure to src/app/"

git add src/tabs/ src/views/
git commit -m "Move tab UI and views to dedicated folders"

# ... etc for each step
```

**Recommendation**: **Option A** for cleaner history, but **Option B** if you want easier rollback of specific steps.

---

## Rollback Plan

### If Build Fails

```bash
# Full rollback
git reset --hard pre-phase1-restructure
git clean -fd
```

### If Specific Import Broken

```bash
# Find the broken import
npm run build 2>&1 | grep "Cannot find module"

# Fix manually:
# 1. Find the file with broken import
# 2. Update import path
# 3. Re-test: npm run build
```

### If App Runs but Feature Broken

```bash
# Check browser console for errors
# Common issues:
# - Missing export in feature index.ts
# - Incorrect import path
# - Component name mismatch

# Fix and verify:
npm run dev
```

---

## Common Issues & Solutions

### Issue: "Cannot find module '@/features/kits'"

**Cause**: Missing index.ts or incorrect export

**Solution**:
```typescript
// Check src/features/kits/index.ts exists and exports components
export { default as KitCard } from './components/KitCard';
```

### Issue: "Module has no exported member 'KitCard'"

**Cause**: Component not exported from index.ts

**Solution**:
```typescript
// Add to src/features/kits/index.ts
export { default as KitCard } from './components/KitCard';
```

### Issue: Circular dependency warning

**Cause**: Feature imports from view, or view imports from app

**Solution**: Review dependency rules. Features should never import from views.

### Issue: File watcher stops working

**Cause**: Rust backend may reference old paths

**Solution**: Check `src-tauri/src/` for any hardcoded paths. This migration only touches frontend, so watchers should be unaffected.

---

## Verification Script

Create a script to automatically verify structure:

```bash
#!/bin/bash
# verify-structure.sh

echo "Verifying folder structure..."

# Check new folders exist
for dir in app views features shared tabs; do
  if [ ! -d "src/$dir" ]; then
    echo "❌ Missing: src/$dir"
    exit 1
  else
    echo "✅ Found: src/$dir"
  fi
done

# Check old folders are gone
for dir in components pages contexts utils; do
  if [ -d "src/$dir" ]; then
    echo "❌ Old folder still exists: src/$dir"
    exit 1
  else
    echo "✅ Removed: src/$dir"
  fi
done

# Check build succeeds
echo "Testing build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed"
  exit 1
fi

echo "✅ All checks passed!"
```

**Usage**:
```bash
chmod +x verify-structure.sh
./verify-structure.sh
```

---

## Documentation Updates

After migration completes, update:

### CLAUDE.md

Update "Frontend Component Organization" section:

```markdown
### Frontend Component Organization

```
src/
├── app/                 # Core infrastructure (TabManager, App.tsx)
├── views/              # Top-level views that render in tabs
├── features/           # Self-contained domain modules
├── shared/             # Generic utilities and components
└── tabs/               # Tab UI chrome
```

**Dependency Rules**:
- app/ → can import from all
- views/ → can import from features, shared, tabs
- features/ → can import from shared
- shared/ → imports nothing (except external libs)
```

### Add Migration Note

Create `MIGRATION.md`:

```markdown
# Architecture Migration History

## Phase 1: Folder Restructure (2026-01-26)

Reorganized codebase to align with tab-based architecture:
- Moved pages → views
- Created features/ for domain modules
- Separated shared/ utilities
- Established clear dependency hierarchy

**Git Tag**: `pre-phase1-restructure` (state before migration)
**Branch**: `feat/phase1-architecture-restructure`
```

---

## Success Metrics

### Quantitative
- [ ] Zero TypeScript errors
- [ ] Build time unchanged (±5%)
- [ ] Bundle size unchanged (±2%)
- [ ] Zero new console warnings

### Qualitative
- [ ] Folder structure is intuitive
- [ ] New developer can find components quickly
- [ ] Import paths are cleaner
- [ ] Architecture matches mental model

---

## Next Steps After Phase 1

Once this phase completes successfully:

1. **Merge to main**:
   ```bash
   git checkout main
   git merge feat/phase1-architecture-restructure
   git push
   ```

2. **Begin Phase 2**: Implement TabManager infrastructure (see `tabs-implementation.md`)

3. **Document lessons learned**: Update this file with any issues encountered

---

## Estimated Timeline

| Step | Task | Time | Cumulative |
|------|------|------|------------|
| 1 | Update TypeScript config | 15 min | 15 min |
| 2 | Create folder structure | 15 min | 30 min |
| 3 | Move core infrastructure | 30 min | 1 hr |
| 4 | Move tab UI | 20 min | 1.5 hr |
| 5 | Move views | 30 min | 2 hr |
| 6 | Move sidebar | 20 min | 2.5 hr |
| 7 | Move sections | 30 min | 3 hr |
| 8 | Move feature modules | 2 hr | 5 hr |
| 9 | Move shared components | 30 min | 5.5 hr |
| 10 | Move contexts | 30 min | 6 hr |
| 11 | Move utilities | 30 min | 6.5 hr |
| 12 | Clean up | 15 min | 7 hr |
| | **Testing & Verification** | 1 hr | 8 hr |
| | **Documentation** | 30 min | **8.5 hr** |

**Total**: ~8.5 hours for one developer

**Parallelization**: Steps 8-11 can be done in parallel by multiple developers, reducing to ~5-6 hours.

---

## Conclusion

This phase establishes a solid architectural foundation by aligning the folder structure with BlueKit's tab-based architecture. By separating infrastructure (`app/`), screens (`views/`), domain logic (`features/`), and utilities (`shared/`), the codebase becomes more maintainable and scalable.

**Key Principle**: The file system should reflect the architecture. If TabManager is foundational, it should live in `app/`, not buried in `components/tabs/`.

**After Phase 1**: All existing functionality preserved, zero visual changes, but codebase is now structured for tab-based navigation implementation in Phase 2.
