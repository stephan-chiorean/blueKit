---
id: feature-flags
alias: Feature Flags
type: kit
is_base: false
version: 1
tags: [frontend, feature-flags, context, react]
description: "Pattern for adding feature flags to control frontend functionality"
---

# Feature Flags Pattern

## Overview
A reusable pattern for adding feature flags to control frontend functionality. This pattern provides a centralized way to enable or disable features across the application without code changes, making it easy to test new features, perform gradual rollouts, or disable features when needed.

## Pattern Description

This pattern solves the problem of needing to conditionally enable or disable features in the frontend. Instead of using environment variables or hardcoded values, this pattern provides:

1. **Centralized Management**: All feature flags in one place
2. **Type Safety**: TypeScript interfaces ensure correct usage
3. **Runtime Control**: Enable/disable features without code changes
4. **Context-Based**: React Context API for easy access throughout the app
5. **Initial State**: Support for setting initial flag values

## Use Cases

- Gradual feature rollouts
- A/B testing different features
- Disabling features for maintenance
- Enabling experimental features for specific users
- Feature toggles for development and testing
- Conditional rendering based on feature availability

## Component Structure

The feature flags system consists of:

1. **FeatureFlagsContext**: React context that provides flag state and controls
2. **FeatureFlagsProvider**: Provider component that wraps the app
3. **useFeatureFlags**: Hook for accessing flags in components

## Implementation Steps

### Step 1: Add Flag to Interface

Add your new feature flag to the `FeatureFlags` interface in `src/contexts/FeatureFlagsContext.tsx`:

```tsx
interface FeatureFlags {
  myNewFeature: boolean;
  // Add more flags as needed
}
```

### Step 2: Set Default Value

Set the default value in the `defaultFlags` object:

```tsx
const defaultFlags: FeatureFlags = {
  myNewFeature: false, // Default to disabled
  ...initialFlags,
};
```

### Step 3: Use Flag in Components

Import and use the `useFeatureFlags` hook in your component:

```tsx
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';

function MyComponent() {
  const { flags } = useFeatureFlags();
  
  if (!flags.myNewFeature) {
    return null; // Or return alternative UI
  }
  
  return (
    <div>
      {/* Feature content */}
    </div>
  );
}
```

### Step 4: Control Flag Programmatically (Optional)

You can also control flags programmatically:

```tsx
function FeatureToggle() {
  const { flags, setFlag, toggleFlag } = useFeatureFlags();
  
  return (
    <button onClick={() => toggleFlag('myNewFeature')}>
      {flags.myNewFeature ? 'Disable' : 'Enable'} Feature
    </button>
  );
}
```

### Step 5: Set Initial Flags (Optional)

You can set initial flag values when wrapping your app:

```tsx
<FeatureFlagsProvider initialFlags={{ myNewFeature: true }}>
  <App />
</FeatureFlagsProvider>
```

## Key Principles

1. **Type Safety**: Always add flags to the TypeScript interface
2. **Default Values**: Set sensible defaults (usually `false` for new features)
3. **Naming**: Use clear, descriptive names for flags (e.g., `enableNewDashboard`, `showBetaFeatures`)
4. **Centralized**: Keep all flags in the FeatureFlags interface
5. **Optional Initial State**: Support initial flags for testing or configuration

## Implementation Pattern

When adding a new feature flag:

1. **Define**: Add to `FeatureFlags` interface
2. **Default**: Set default value in `defaultFlags`
3. **Use**: Access via `useFeatureFlags()` hook
4. **Control**: Optionally provide UI to toggle flags
5. **Test**: Test both enabled and disabled states

## Benefits

- **Flexibility**: Enable/disable features without code changes
- **Safety**: Easy to disable problematic features quickly
- **Testing**: Test features in production with flags disabled
- **Gradual Rollout**: Enable features for specific users or percentages
- **Type Safety**: TypeScript ensures correct flag names
- **Developer Experience**: Simple hook-based API

## Example Usage

### Conditional Rendering

```tsx
function Dashboard() {
  const { flags } = useFeatureFlags();
  
  return (
    <div>
      <StandardDashboard />
      {flags.newDashboard && <NewDashboard />}
    </div>
  );
}
```

### Feature Gating

```tsx
function SettingsPage() {
  const { flags } = useFeatureFlags();
  
  if (!flags.advancedSettings) {
    return <BasicSettings />;
  }
  
  return <AdvancedSettings />;
}
```

### Toggle Control

```tsx
function AdminPanel() {
  const { flags, toggleFlag } = useFeatureFlags();
  
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={flags.experimentalFeature}
          onChange={() => toggleFlag('experimentalFeature')}
        />
        Enable Experimental Feature
      </label>
    </div>
  );
}
```

## Customization Points

- Default flag values
- Initial flag configuration
- Flag naming conventions
- UI for flag management (admin panel, settings, etc.)
- Persistence (localStorage, server-side config, etc.)
- Flag validation and type checking

## Notes

- The FeatureFlagsProvider is already set up in `src/App.tsx`
- Flags are stored in component state (not persisted by default)
- To persist flags, you could extend the context to use localStorage or a backend API
- Consider adding flag descriptions or metadata for better documentation

