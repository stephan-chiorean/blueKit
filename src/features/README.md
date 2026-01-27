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
