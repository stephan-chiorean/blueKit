# Multi-Screen Auth & Onboarding Implementation Plan

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-02-01

---

## Executive Summary

Transform BlueKit's current single-screen Welcome flow into a sophisticated multi-screen onboarding experience that:
1. Collects user preferences (IDE/tool usage)
2. Integrates authentication
3. Personalizes the UI based on user profile
4. Provides progressive disclosure of features
5. Creates a seamless first-run experience

**Key Insight:** HomeView currently exists primarily as a vault detection wrapper. This reorganization will elevate onboarding to a first-class system while simplifying the library/vault rendering architecture.

---

## Current State Analysis

### Existing Architecture

**Welcome Flow** (src/App.tsx:11-29):
```
Welcome Screen → Home Page → Project Detail
```

**HomeView Role** (src/views/home/HomeView.tsx):
- Loads vault project from database
- Shows LibrarySetupScreen if no vault
- Renders ProjectView with `isVault=true`
- **Problem:** Mixing concerns (vault detection + library rendering)

**IDE Integration** (ProjectsTabContent.tsx:437-460):
- Shows all IDE options (Cursor, VSCode, Antigravity) unconditionally
- No personalization based on user tools

### Problems to Solve

1. **No user profile system** - nowhere to store preferences
2. **No progressive onboarding** - single welcome screen is limiting
3. **Non-personalized UI** - shows features user may not use
4. **Vault setup conflated with onboarding** - HomeView does too much
5. **No authentication integration** - mentioned in requirements but not implemented

---

## Proposed Architecture

### 1. Onboarding Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ONBOARDING FLOW                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Welcome                                                │
│  - Brand introduction                                           │
│  - Value proposition                                            │
│  - "Get Started" CTA                                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Auth (Optional)                                        │
│  - Sign in / Sign up                                            │
│  - "Skip for now" option                                        │
│  - OAuth providers (GitHub, Google)                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Tool Survey                                            │
│  - "Which tools do you use?" (multi-select)                     │
│  - [ ] Cursor                                                   │
│  - [ ] VSCode                                                   │
│  - [ ] Claude Desktop                                           │
│  - [ ] Antigravity                                              │
│  - [ ] Other (specify)                                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Workspace Setup                                        │
│  - Create or select vault location                              │
│  - Import existing projects (optional)                          │
│  - "I'll do this later" option                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Feature Tour (Optional)                                │
│  - Interactive walkthrough of key features                      │
│  - Can be skipped or revisited via Help menu                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  Complete → Main Application                                    │
│  - Profile saved                                                │
│  - UI personalized based on preferences                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. State Machine Design

**Onboarding Steps Enum:**
```typescript
type OnboardingStep =
  | 'welcome'
  | 'auth'
  | 'tool-survey'
  | 'workspace-setup'
  | 'feature-tour'
  | 'complete';

type OnboardingState = {
  currentStep: OnboardingStep;
  canSkip: boolean;
  canGoBack: boolean;
  progress: number; // 0-100
  completedSteps: OnboardingStep[];
};
```

**Navigation Rules:**
- Welcome → Auth (or skip to survey)
- Auth → Tool Survey
- Tool Survey → Workspace Setup
- Workspace Setup → Feature Tour (or skip to complete)
- Feature Tour → Complete

**Persistence:** Save state to allow users to resume if they close app mid-onboarding

---

## Frontend Implementation

### 3.1 Component Structure

```
src/
├── features/
│   └── onboarding/
│       ├── OnboardingFlow.tsx          # Main orchestrator
│       ├── OnboardingContext.tsx       # State management
│       ├── steps/
│       │   ├── WelcomeStep.tsx        # Brand intro
│       │   ├── AuthStep.tsx           # Sign in/up
│       │   ├── ToolSurveyStep.tsx     # IDE selection
│       │   ├── WorkspaceSetupStep.tsx # Vault creation
│       │   └── FeatureTourStep.tsx    # Interactive tour
│       ├── components/
│       │   ├── OnboardingLayout.tsx   # Shared layout
│       │   ├── ProgressBar.tsx        # Step indicator
│       │   └── NavigationButtons.tsx  # Next/Back/Skip
│       └── hooks/
│           ├── useOnboardingState.ts  # State machine
│           └── useProfileSync.ts      # Profile persistence
```

### 3.2 OnboardingContext API

```typescript
interface OnboardingContextValue {
  // State
  currentStep: OnboardingStep;
  progress: number;
  userProfile: UserProfile;

  // Navigation
  nextStep: () => void;
  previousStep: () => void;
  skipStep: () => void;
  goToStep: (step: OnboardingStep) => void;

  // Profile management
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}
```

### 3.3 ToolSurveyStep Implementation

**Key Features:**
- Multi-select checkboxes with tool icons
- Auto-detection of installed tools (backend command)
- "Other" field for unlisted tools
- Validation: at least one tool required

**UI/UX:**
```typescript
interface ToolSurveyStepProps {
  onComplete: (selectedTools: ToolPreference[]) => void;
}

type ToolPreference = {
  tool: 'cursor' | 'vscode' | 'claude' | 'antigravity' | 'other';
  detected: boolean; // auto-detected on system
  selected: boolean; // user manually selected
};
```

**Auto-Detection Flow:**
1. Call `detect_installed_tools()` backend command
2. Pre-check detected tools
3. Allow user to adjust selections
4. Show badge "Detected" vs "Manually added"

### 3.4 App.tsx Reorganization

**Before:**
```typescript
// Current: Simple view switching
<Welcome> or <Home> or <ProjectDetail>
```

**After:**
```typescript
// New: Onboarding-aware routing
{!hasCompletedOnboarding ? (
  <OnboardingFlow onComplete={handleOnboardingComplete} />
) : (
  <TabManager>
    <TabContent />
  </TabManager>
)}
```

---

## Backend Implementation

### 4.1 User Profile Schema

**SQLite Table:** `user_profile`

```sql
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton row
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Onboarding
  onboarding_completed BOOLEAN NOT NULL DEFAULT 0,
  onboarding_completed_at TEXT,
  onboarding_version TEXT, -- Track which onboarding flow they completed

  -- Auth (optional)
  user_id TEXT, -- External auth provider ID
  email TEXT,
  name TEXT,

  -- Tool preferences
  preferred_tools TEXT NOT NULL DEFAULT '[]', -- JSON array of tool names
  detected_tools TEXT NOT NULL DEFAULT '[]',  -- JSON array of auto-detected tools

  -- Workspace
  vault_configured BOOLEAN NOT NULL DEFAULT 0,
  default_vault_path TEXT,

  -- Feature preferences
  skip_feature_tour BOOLEAN NOT NULL DEFAULT 0,
  ui_preferences TEXT NOT NULL DEFAULT '{}' -- JSON for future customization
);
```

**Rust Struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: i64,
    pub created_at: String,
    pub updated_at: String,

    pub onboarding_completed: bool,
    pub onboarding_completed_at: Option<String>,
    pub onboarding_version: Option<String>,

    pub user_id: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,

    pub preferred_tools: Vec<String>,
    pub detected_tools: Vec<String>,

    pub vault_configured: bool,
    pub default_vault_path: Option<String>,

    pub skip_feature_tour: bool,
    pub ui_preferences: serde_json::Value,
}
```

### 4.2 New IPC Commands

**Profile Management:**
```rust
#[tauri::command]
async fn get_user_profile() -> Result<UserProfile, String>

#[tauri::command]
async fn update_user_profile(updates: UserProfileUpdate) -> Result<UserProfile, String>

#[tauri::command]
async fn complete_onboarding(profile: UserProfile) -> Result<(), String>
```

**Tool Detection:**
```rust
#[tauri::command]
async fn detect_installed_tools() -> Result<Vec<DetectedTool>, String>

#[derive(Serialize)]
pub struct DetectedTool {
    name: String,          // "cursor", "vscode", etc.
    detected: bool,
    path: Option<String>,  // Installation path if found
    version: Option<String>,
}
```

**Implementation Strategy:**
- Check common installation paths per OS
- macOS: `/Applications/*.app`, `~/Applications/*.app`
- Windows: `%LOCALAPPDATA%`, `%PROGRAMFILES%`
- Linux: `~/.local/share/applications`, `/usr/share/applications`

### 4.3 Auth Integration (Phase 2)

**OAuth Flow:**
1. Open OAuth provider URL in system browser
2. Redirect to `bluekit://auth/callback?code=...`
3. Deep link handler captures code
4. Exchange code for tokens
5. Store user_id, email in profile

**Dependencies:**
```toml
# src-tauri/Cargo.toml
[dependencies]
oauth2 = "4.4"        # OAuth 2.0 client
reqwest = "0.11"      # HTTP client for token exchange
```

**Security:**
- Store tokens in OS keychain (via `keyring` crate)
- Never store in SQLite
- Implement token refresh flow

---

## UI Personalization System

### 5.1 PersonalizationContext

**Hook to conditionally render IDE integrations:**

```typescript
interface PersonalizationContextValue {
  profile: UserProfile | null;
  hasPreference: (tool: string) => boolean;
  shouldShowFeature: (feature: string) => boolean;
}

// Usage in ProjectsTabContent.tsx
const { hasPreference } = usePersonalization();

{hasPreference('cursor') && (
  <Menu.Item value="cursor" onSelect={...}>
    Cursor
  </Menu.Item>
)}
```

### 5.2 Feature Flags Integration

**Extend existing FeatureFlagsContext:**

```typescript
// Merge user preferences with feature flags
const effectiveFlags = {
  ...baseFeatureFlags,
  showCursorIntegration: profile?.preferred_tools.includes('cursor'),
  showVSCodeIntegration: profile?.preferred_tools.includes('vscode'),
  showAntigravityIntegration: profile?.preferred_tools.includes('antigravity'),
};
```

### 5.3 Settings Panel

**New Settings Page:**
- Location: `src/pages/SettingsPage.tsx`
- Allow users to update preferences post-onboarding
- Re-trigger tool detection
- Reset onboarding (for testing or re-configuration)

---

## Migration Strategy

### 6.1 HomeView Refactoring

**Current Responsibilities:**
1. Load vault project ← Keep (move to VaultContext)
2. Show LibrarySetupScreen ← Move to onboarding
3. Render ProjectView with isVault=true ← Keep

**Proposed Changes:**

**Before:**
```typescript
// HomeView.tsx (bloated)
const HomeView = () => {
  const [vaultProject, setVaultProject] = useState<Project | null>(null);

  useEffect(() => {
    loadVaultProject();
  }, []);

  if (!vaultProject) return <LibrarySetupScreen />;
  return <ProjectView project={vaultProject} isVault={true} />;
};
```

**After:**
```typescript
// VaultContext.tsx (dedicated)
const VaultProvider = ({ children }) => {
  const [vault, setVault] = useState<Project | null>(null);
  // Load vault logic here
};

// TabContent.tsx (simplified)
if (activeTab.type === 'library') {
  const { vault } = useVault();
  if (!vault) return <VaultNotConfiguredState />;
  return <ProjectView project={vault} isVault={true} />;
}
```

**Vault setup moves to onboarding WorkspaceSetupStep**

### 6.2 Database Migration

**Add user_profile table:**

```rust
// src-tauri/src/db.rs
pub fn migrate_add_user_profile(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ...
        )",
        [],
    )?;

    // Create default profile row
    conn.execute(
        "INSERT OR IGNORE INTO user_profile (id, onboarding_completed) VALUES (1, 0)",
        [],
    )?;

    Ok(())
}
```

**Version tracking:**
- Store migration version in database
- Auto-run migrations on app startup

### 6.3 Rollout Plan

**Phase 1: Foundation (Week 1-2)**
- [ ] Create user_profile table + backend commands
- [ ] Build OnboardingContext + state machine
- [ ] Implement basic step navigation
- [ ] Tool detection command

**Phase 2: Core Screens (Week 3-4)**
- [ ] WelcomeStep + ToolSurveyStep
- [ ] WorkspaceSetupStep (integrate existing vault logic)
- [ ] Profile persistence + loading

**Phase 3: Personalization (Week 5)**
- [ ] PersonalizationContext
- [ ] Conditionally render IDE options in ProjectsTabContent
- [ ] Settings panel for post-onboarding updates

**Phase 4: Auth Integration (Week 6-7)**
- [ ] OAuth provider integration
- [ ] AuthStep implementation
- [ ] Keychain token storage

**Phase 5: Polish (Week 8)**
- [ ] FeatureTourStep with interactive highlights
- [ ] Animations + transitions
- [ ] Error handling + edge cases
- [ ] Analytics tracking (optional)

---

## Edge Cases & Error Handling

### 7.1 Incomplete Onboarding

**Scenario:** User closes app during onboarding

**Solution:**
- Save onboarding state to SQLite after each step
- On restart, check `onboarding_completed` flag
- If false, resume from last completed step
- Show "Continue Setup" button on launch

### 7.2 Vault Already Exists

**Scenario:** User ran CLI `bluekit init` before first app launch

**Solution:**
- Detect existing vault in WorkspaceSetupStep
- Show "Vault found at [path]" with option to use it or create new
- Auto-populate default_vault_path

### 7.3 Tool Detection Failures

**Scenario:** Tool installed in non-standard location

**Solution:**
- Allow manual selection even if not detected
- Show "Detected" vs "Manually added" badges
- Provide "Browse for installation" button for custom paths

### 7.4 Auth Failures

**Scenario:** OAuth redirect fails or network error

**Solution:**
- Graceful degradation: allow "Skip for now"
- Store partial auth state, allow retry later
- Settings panel includes "Connect Account" option

---

## Success Metrics

**Onboarding Completion Rate:**
- Track % of users who complete all steps vs skip
- Identify drop-off points

**Tool Preference Accuracy:**
- Compare detected vs manually selected tools
- Improve detection algorithms based on data

**Time to First Value:**
- Measure time from app launch to first project opened
- Optimize slow steps

**Feature Engagement:**
- Track usage of IDE integrations per tool preference
- Validate that personalization increases engagement

---

## Future Enhancements

### Team Features
- Import preferences from team template
- Share vault locations across team
- Enterprise SSO integration

### Advanced Personalization
- AI-suggested tools based on detected projects
- Learning path recommendations based on skill level
- Customizable keyboard shortcuts per user

### Telemetry (Opt-in)
- Anonymous usage analytics
- Crash reporting
- Feature adoption tracking

---

## Technical Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OAuth complexity** | High | Start with manual auth (email/password), add OAuth later |
| **Tool detection inaccuracy** | Medium | Make detection optional, allow manual override |
| **Migration breaks existing users** | High | Add version checks, provide rollback mechanism |
| **Onboarding fatigue** | Medium | Allow skip at each step, save progress for later |
| **State management complexity** | Medium | Use proven state machine pattern, unit test transitions |

---

## Open Questions

1. **Should we support multiple profiles?** (e.g., work vs personal)
   - Current plan: Single profile per installation
   - Future: Add profile switching if users request

2. **How to handle vault migration?** (user changes vault location)
   - Need vault history table
   - Support switching between multiple vaults

3. **Auth provider priority?** (GitHub, Google, Email?)
   - Start with GitHub (developer audience)
   - Add email as fallback

4. **Should tool preferences be per-project or global?**
   - Current plan: Global preferences
   - Future: Allow project-specific overrides

---

## Appendix

### A. Related Documentation
- `tab-architecture-and-navigation.md` - Current navigation system
- `product.md` - Product vision
- `CLAUDE.md` - Development guidelines

### B. Design References
- Linear's onboarding flow (multi-step, progressive)
- Notion's workspace setup
- VSCode's welcome screen + extension recommendations

### C. Dependencies

**NPM Packages:**
```json
{
  "react-hook-form": "^7.50.0",      // Form state management
  "zod": "^3.22.0",                  // Schema validation
  "framer-motion": "^11.0.0"         // Animations (already installed)
}
```

**Rust Crates:**
```toml
oauth2 = "4.4"           # OAuth 2.0 client
keyring = "2.3"          # Secure token storage
which = "5.0"            # Executable detection
```

---

## Conclusion

This multi-screen onboarding system transforms BlueKit from a generic welcome screen to a personalized, user-aware application. By collecting preferences early and adapting the UI accordingly, we reduce cognitive load and improve time-to-value.

**Next Steps:**
1. Review plan with stakeholders
2. Create detailed design mockups for each step
3. Begin Phase 1 implementation (backend foundation)
4. Set up analytics to measure success metrics

**Estimated Timeline:** 8 weeks for full implementation
**Estimated Effort:** ~200-250 hours (1 full-time developer)
