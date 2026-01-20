# Walkthroughs Revamp Plan

## TL;DR

Transform walkthroughs from flat markdown files to **structured reading experiences** using **YAML section definitions**—keeping them as single files while enabling progressive disclosure, navigation, and reading progress.

## Key Changes

| Before | After |
|--------|-------|
| Single `.md` files (flat) | Single `.md` files with `sections` array in YAML |
| Linear scroll reading | Collapsible section cards |
| No navigation | Floating outline sidebar |
| No progress tracking | Per-section read state + progress bar |
| Manual YAML editing | Section editor UI |

## Core Principles

1. **Single file = single walkthrough** — no folder complexity
2. **Structure in metadata** — sections defined in YAML front matter
3. **Progressive disclosure** — expand/collapse sections as needed
4. **Graceful degradation** — walkthroughs without sections auto-parsed from headings
5. **Beautiful reading** — glassmorphic cards, smooth animations, icons

## New YAML Schema

```yaml
sections:
  - id: overview           # Matches heading anchor
    title: "Overview"      # Display title
    summary: "Brief TLDR"  # Shown when collapsed
    icon: "🎯"             # Visual indicator
    type: overview         # Affects styling
    collapsed: false       # Default state
    estimatedMinutes: 2    # Reading time

reading:
  showProgress: true       # Progress bar in header
  showOutline: true        # Floating section nav
```

## Implementation Phases

1. **Schema & Parser** — YAML types, section parsing logic
2. **Walkthrough Reader** — Section cards, outline, progress header
3. **Progress Persistence** — localStorage reading state
4. **Section Editor UI** — Edit sections without touching YAML
5. **Fallback & Migration** — Auto-parse legacy walkthroughs

See `implementation-plan.md` for detailed specifications.
