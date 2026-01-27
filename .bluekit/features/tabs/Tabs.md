# Tabs

# BlueKit Tabs (Workspace State) — JSON-First Design

## Goal

Implement **Tabs** in BlueKit as a **local JSON workspace snapshot**, similar in spirit to Obsidian’s `workspace.json`, but scoped intentionally to BlueKit’s philosophy.

Tabs represent **what the user is looking at**, not meaning or knowledge.

They must be:
- Local-first
- Ephemeral
- Cheap to discard
- Fast to restore
- Isolated from semantic artifacts (kits, walkthroughs, blueprints)

---

## Core Principle

**Tabs are UI state, not content.**

They should never be:
- Required for understanding the project
- Used as source-of-truth
- Treated as durable knowledge

They exist only to restore user flow.

---

## File Location

```text
.bluekit/
  workspace/
    tabs.json

Optional:

.bluekit/
  workspace/
    tabs.mobile.json


⸻

Schema Overview

{
  "schemaVersion": "bluekit.tabs.v1",
  "updatedAt": "2026-01-18T19:22:00Z",
  "activeTabId": "tab_a1b2",
  "groups": []
}


⸻

Tab Groups

Tabs are grouped by split / column / panel.

{
  "id": "group_main",
  "direction": "vertical",
  "size": 1,
  "tabs": []
}


⸻

Tab Definition

{
  "id": "tab_a1b2",
  "type": "markdown",
  "title": "WorkerGroupsProvider",
  "icon": "file",
  "resource": {
    "path": "src/providers/WorkerGroupsProvider.tsx",
    "line": 1
  },
  "view": {
    "mode": "preview",
    "scrollTop": 0
  },
  "pinned": false,
  "dirty": false,
  "openedAt": "2026-01-18T19:20:00Z"
}


⸻

Supported Tab Types (v1)

Type	Description
markdown	Rendered markdown preview
code	Code file with editor state
kit	Kit viewer
walkthrough	Walkthrough runner
blueprint	Blueprint executor
graph	Visual graph view
base	Table / structured view
external	URL / embedded content


⸻

Resource Resolution Rules

Tabs reference resources, never embed content.

"resource": {
  "path": "bluekit/Concept/Overview.md"
}

Rules:
	•	Paths must be relative to repo root
	•	Missing files → tab shows error state
	•	No content duplication

⸻

View State (Ephemeral)

"view": {
  "mode": "source",
  "scrollTop": 428,
  "cursor": { "line": 22, "ch": 4 }
}

Allowed:
	•	Scroll position
	•	Cursor
	•	Editor mode

Not allowed:
	•	Semantic metadata
	•	Task state
	•	Execution history

⸻

Example tabs.json

{
  "schemaVersion": "bluekit.tabs.v1",
  "updatedAt": "2026-01-18T19:22:00Z",
  "activeTabId": "tab_a1b2",
  "groups": [
    {
      "id": "group_main",
      "direction": "vertical",
      "size": 1,
      "tabs": [
        {
          "id": "tab_a1b2",
          "type": "markdown",
          "title": "Overview",
          "icon": "file",
          "resource": { "path": "bluekit/Overview.md" },
          "view": { "mode": "preview", "scrollTop": 120 },
          "pinned": false,
          "dirty": false
        },
        {
          "id": "tab_c3d4",
          "type": "code",
          "title": "WorkerGroupsProvider.tsx",
          "icon": "code",
          "resource": {
            "path": "src/providers/WorkerGroupsProvider.tsx",
            "line": 1
          },
          "view": {
            "mode": "source",
            "cursor": { "line": 12, "ch": 2 }
          },
          "pinned": true,
          "dirty": false
        }
      ]
    }
  ]
}


⸻

Persistence Rules
	•	Write on:
	•	Tab open
	•	Tab close
	•	Active tab change
	•	Pane resize (debounced)
	•	Never block UI on write
	•	Safe to delete at any time

⸻

Git & Collaboration
	•	Tabs are per-user
	•	Tabs are per-device
	•	Tabs are not semantic
	•	Default stance: not required to commit

But design-wise:
	•	JSON is explicit
	•	Human-readable
	•	Diffable if needed

⸻

Recovery Behavior

If tabs.json is:
	•	Missing → start with empty workspace
	•	Corrupt → ignore + regenerate
	•	Schema mismatch → migrate or reset

⸻

Design Boundary (Critical)

Tabs must never:
	•	Trigger execution
	•	Encode intent
	•	Replace kits / walkthroughs
	•	Act as workflows

Tabs answer only one question:

“What was I looking at last time?”

⸻

Mental Model
	•	Markdown / Kits / Blueprints → meaning
	•	Tabs JSON → attention
	•	Runs / Logs → history

This separation is intentional and non-negotiable.

⸻

One-Line Summary

Tabs are disposable memory, not durable knowledge.

This keeps BlueKit simple, predictable, and powerful.



