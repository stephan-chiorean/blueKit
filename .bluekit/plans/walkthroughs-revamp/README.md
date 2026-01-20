# Walkthroughs Revamp Plan

## TL;DR

Walkthroughs mirror the **Plans UX** but for **understanding** instead of execution:
- **Takeaways** instead of Milestones (understanding checkpoints)
- **1 file** instead of folder
- **No "Documents" tab** — the walkthrough IS the document
- **Notes + Status** — DB-backed, just like plans

## Plans vs Walkthroughs

| Aspect | Plans | Walkthroughs |
|--------|-------|--------------|
| Structure | Folder with docs | Single .md file |
| Progress unit | Milestones (tasks) | Takeaways (understanding) |
| Notes | DB-backed | DB-backed |
| Status | DB-backed | DB-backed |

## Layout

```
┌───────────────────────────┬─────────────────────────────────────────┐
│ Takeaways                 │  # GitHub Auth Flow                     │
│ ━━━━━━━━━━━━━━ 1/3       │                                         │
│                           │  BlueKit implements GitHub's            │
│ ┌───────────────────────┐ │  Authorization Code Flow with PKCE...   │
│ │ ✓ Understand PKCE     │ │                                         │
│ └───────────────────────┘ │  [Full markdown content scrollable]     │
│ ┌───────────────────────┐ │                                         │
│ │ ○ Know token storage  │ │                                         │
│ └───────────────────────┘ │                                         │
│                           │                                         │
│ Notes                     │                                         │
│ ┌───────────────────────┐ │                                         │
│ │ Remember to check...  │ │                                         │
│ └───────────────────────┘ │                                         │
│ [+ Add Note]              │                                         │
└───────────────────────────┴─────────────────────────────────────────┘
```

## What We're NOT Doing

- ❌ Section splitting
- ❌ YAML front matter changes
- ❌ Collapsible cards
- ❌ Multiple view modes

## Implementation Phases

1. **Database Schema** — walkthroughs, takeaways, progress, notes tables
2. **IPC Commands** — CRUD for all entities
3. **Frontend IPC** — TypeScript wrappers
4. **Creation Flow** — CreateWalkthroughDialog
5. **WalkthroughViewPage** — Mirrors PlanDocViewPage
6. **List View** — Fetch from DB, show status/progress

See `implementation-plan.md` for details.
