# Walkthroughs: Guided Paths Through Your Knowledge

## What Is a Walkthrough?

A walkthrough is a **reading path** over existing content. It takes files that already exist in your notebook and adds:

- **Sequence**: What order to read them
- **Progress**: Track what you've completed
- **Annotations**: Author notes at transitions
- **Type semantics**: How to interact with the content

**The files don't move. The walkthrough is a view.**

---

## The Core Insight

You have content scattered across your notebook:
- Architecture docs
- Implementation notes
- Diagrams
- Decision records

Without structure, it's overwhelming. Where do you start? What depends on what?

**A walkthrough says: "Read these files, in this order, for this purpose."**

---

## Walkthrough Types

The same content can be viewed through different lenses. The **type** determines:
- What UI elements appear
- What actions are available
- What metadata is tracked

### Type: Review

**Purpose**: Get feedback on content from someone else.

**Decorations**:
- Assignee field
- Status: `pending` | `approved` | `changes_requested`
- Comment threads on each step
- "Approve" / "Request Changes" buttons
- Due date

**Use case**: Tech lead creates walkthrough of RFC, assigns to senior dev for review.

```
Same files: /docs/new-auth-system/*.md

As Review:
  Assigned to: @sarah
  Due: Friday
  Status: Pending

  [Step 1: Overview]
    💬 3 comments
  [Step 2: Architecture]
    💬 1 comment
  [Step 3: Migration Plan]
    ✅ Approved
```

---

### Type: Guide / Runbook

**Purpose**: Step-by-step instructions to execute.

**Decorations**:
- Checkboxes for each step
- "Copy command" buttons for code blocks
- Environment selector (dev/staging/prod)
- "Last run" timestamp
- Emergency contact info

**Use case**: On-call engineer follows runbook during incident.

```
Same files: /ops/deploy-process/*.md

As Guide:
  Environment: Production
  Last run: 3 days ago

  [Step 1: Pre-flight checks]
    ☑️ Completed
    [Copy: kubectl get pods -n prod]
  [Step 2: Database backup]
    ☐ Not started
    ⚠️ Required before proceeding
```

---

### Type: Documentation

**Purpose**: Reference material to understand a system.

**Decorations**:
- Table of contents
- Search within walkthrough
- Version history
- "Last updated" timestamp
- Maintainer attribution
- Cross-references to related docs

**Use case**: Developer looks up how the payment system works.

```
Same files: /docs/payments/*.md

As Documentation:
  Version: 2.3
  Last updated: Jan 10
  Maintainer: @payments-team

  Table of Contents:
    1. Overview
    2. Stripe Integration
    3. Webhook Handling
    4. Error Codes

  [Search within docs...]
```

---

### Type: Tutorial

**Purpose**: Learn something new with active engagement.

**Decorations**:
- Progress bar
- Estimated time per step
- Quiz questions after sections
- "Mark as understood" vs just "read"
- Spaced repetition reminders
- Exercises/challenges

**Use case**: New developer learning the codebase.

```
Same files: /docs/architecture/*.md

As Tutorial:
  Progress: 40% (2 of 5 sections)
  Time remaining: ~45 min

  [Section 1: Core Concepts] ✅ Completed
    Quiz: 3/3 correct
  [Section 2: Data Flow] ✅ Completed
    Quiz: 2/3 correct (review flagged)
  [Section 3: API Layer] 📖 Current
    Est: 15 min
```

---

### Type: Architecture

**Purpose**: Understand how components connect.

**Decorations**:
- Diagrams prominently displayed
- Zoom levels (high-level → detailed)
- Component highlighting
- "Show dependencies" for each part
- Layer toggling (infra/app/data)

**Use case**: Architect explaining system to stakeholders.

```
Same files: /docs/system-design/*.md + /diagrams/*.mmd

As Architecture:
  View: High-level
  Layers: [x] App  [x] Data  [ ] Infra

  [Interactive diagram]
    Click component → shows related docs
    Hover → shows connections

  [Component: Auth Service]
    Depends on: Redis, Postgres
    Depended by: API Gateway, User Service
```

---

### Type: Onboarding

**Purpose**: New person ramp-up with tracked completion.

**Decorations**:
- Checklist with sign-off
- Prerequisites shown
- Manager visibility into progress
- Completion certificate/badge
- "Ask questions" integration
- Time-boxed sections

**Use case**: HR/team lead tracks new hire onboarding.

```
Same files: /docs/onboarding/*.md

As Onboarding:
  New hire: @alex
  Started: Jan 5
  Target completion: Jan 19

  Week 1: Fundamentals
    [x] Company overview (signed off by @manager)
    [x] Dev environment setup
    [ ] Codebase tour ← Current

  Week 2: Deep Dives
    [ ] Auth system
    [ ] Database patterns

  Progress visible to: @manager, @hr
```

---

## Real-World Use Cases

### Use Case 1: Codebase Onboarding

**Scenario**: New developer joins. Docs exist but where to start?

**Flow**:
1. Tech lead selects `/docs/` folder
2. Creates walkthrough, type: **Onboarding**
3. Arranges sequence: setup → concepts → architecture → practices
4. Assigns to new dev with due date
5. New dev works through, checking off steps
6. Lead gets notified on completion

**Value**:
- Structured path vs. "just read the docs"
- Progress visibility both directions
- Consistent onboarding across hires

---

### Use Case 2: Feature Review

**Scenario**: Dev wrote RFC for new feature. Needs senior review.

**Flow**:
1. Dev has RFC in `/rfcs/new-cache-layer/`
2. Creates walkthrough, type: **Review**
3. Assigns to senior dev
4. Senior reads, leaves comments at specific steps
5. Status: "Changes requested"
6. Dev updates docs, re-requests review
7. Senior approves

**Value**:
- Structured review process
- Comments attached to specific sections
- Clear approval workflow

---

### Use Case 3: Incident Runbook

**Scenario**: Database is down. Need to follow recovery procedure.

**Flow**:
1. On-call opens "Database Recovery" walkthrough
2. Type: **Guide**
3. Selects environment: Production
4. Follows steps, checking each off
5. Copies commands directly from steps
6. Records completion time

**Value**:
- No guessing during incident
- Commands ready to copy
- Audit trail of what was done

---

### Use Case 4: Architecture Presentation

**Scenario**: Explaining system to new team or stakeholders.

**Flow**:
1. Architect creates walkthrough, type: **Architecture**
2. Includes diagrams prominently
3. Configures zoom levels (exec summary → technical details)
4. Walks through in meeting
5. Shares link for async reference

**Value**:
- Diagrams and docs unified
- Multiple detail levels
- Reusable across presentations

---

### Use Case 5: Self-Study Learning Path

**Scenario**: Dev wants to learn GraphQL. Has collected resources.

**Flow**:
1. Dev has various GraphQL docs/notes in notebook
2. Creates walkthrough, type: **Tutorial**
3. Sequences from basics → advanced
4. System estimates time per section
5. Dev works through, takes quizzes
6. Spaced repetition reminds to review weak areas

**Value**:
- Structured self-learning
- Active engagement (quizzes)
- Retention via spaced repetition

---

### Use Case 6: Living Documentation

**Scenario**: Team maintains architecture docs. Need to keep them current.

**Flow**:
1. Create walkthrough over `/docs/architecture/`
2. Type: **Documentation**
3. Assign maintainers per section
4. Track "last updated" per step
5. Stale sections get flagged
6. Search across all sections

**Value**:
- Clear ownership
- Staleness visible
- Searchable reference

---

## AI-Assisted Walkthrough Creation

### Auto-Sequencing

User selects 15 scattered files:
```
AI: "I analyzed the content. Suggested reading order:
1. overview.md (introduces concepts used in others)
2. data-model.md (referenced by 5 other files)
3. api-design.md (builds on data model)
...
Adjust this sequence?"
```

### Type Suggestion

```
AI: "This content looks like operational procedures.
Suggested type: Guide (runbook)
- Has step-by-step commands
- References environments
- Sequential dependencies

Or did you want: Review | Documentation | Tutorial?"
```

### Summary Generation

For each step, AI can generate:
- TL;DR summary
- Key concepts to understand
- Questions to verify understanding

---

## Walkthrough vs. Just Reading Files

| Just Files | Walkthrough |
|------------|-------------|
| No suggested order | Defined sequence |
| No progress tracking | Track completion |
| No type semantics | Different modes (review, guide, etc.) |
| No annotations | Author notes at transitions |
| Individual files | Cohesive journey |
| Discoverable by filename | Discoverable by purpose |

---

## The Notebook → Walkthrough Flow

```
1. Content exists in notebook
   /notes/graphql/
     ├─ basics.md
     ├─ schemas.md
     ├─ resolvers.md
     └─ testing.md

2. User: "Create walkthrough from this folder"

3. Dialog:
   ┌─────────────────────────────────────┐
   │ Create Walkthrough                  │
   ├─────────────────────────────────────┤
   │ Name: [GraphQL Deep Dive        ]   │
   │                                     │
   │ Type:                               │
   │   ○ Review      ○ Guide             │
   │   ● Tutorial    ○ Documentation     │
   │   ○ Architecture ○ Onboarding       │
   │                                     │
   │ Sequence: (drag to reorder)         │
   │   1. basics.md                      │
   │   2. schemas.md                     │
   │   3. resolvers.md                   │
   │   4. testing.md                     │
   │                                     │
   │ [AI: Suggest optimal order]         │
   └─────────────────────────────────────┘

4. Database record created:
   {
     name: "GraphQL Deep Dive",
     type: "tutorial",
     resources: [
       { path: "/notes/graphql/basics.md", order: 1 },
       { path: "/notes/graphql/schemas.md", order: 2 },
       ...
     ]
   }

5. Files unchanged. Walkthrough is a view.
```

---

## Type-Specific Metadata

```typescript
interface Walkthrough {
  id: string;
  name: string;
  type: WalkthroughType;
  resources: Resource[];

  // Type-specific metadata (discriminated union)
  metadata:
    | ReviewMetadata
    | GuideMetadata
    | DocumentationMetadata
    | TutorialMetadata
    | ArchitectureMetadata
    | OnboardingMetadata;
}

interface ReviewMetadata {
  assignee: string;
  status: 'pending' | 'approved' | 'changes_requested';
  comments: Comment[];
  dueDate?: Date;
  reviewHistory: ReviewEvent[];
}

interface GuideMetadata {
  environment?: 'dev' | 'staging' | 'prod';
  completedSteps: string[];
  lastRunAt?: Date;
  lastRunBy?: string;
  emergencyContact?: string;
}

interface DocumentationMetadata {
  version: string;
  lastUpdated: Date;
  maintainers: string[];
  searchIndex: SearchEntry[];
}

interface TutorialMetadata {
  progress: {
    currentStep: string;
    completedSteps: string[];
    quizScores: Record<string, number>;
  };
  estimatedMinutes: number;
  spacedRepetition: {
    reviewDates: Date[];
    weakAreas: string[];
  };
}

interface ArchitectureMetadata {
  zoomLevel: 'high' | 'medium' | 'detailed';
  activeLayers: string[];
  diagrams: DiagramRef[];
  componentIndex: ComponentEntry[];
}

interface OnboardingMetadata {
  assignee: string;
  supervisor: string;
  startDate: Date;
  targetCompletionDate: Date;
  signoffs: Record<string, { by: string; at: Date }>;
  visibleTo: string[];
}
```

---

## Summary

**Walkthroughs are not content. They're views over content.**

The notebook holds the files. Walkthroughs add:
- Sequence (what order)
- Progress (how far along)
- Type semantics (how to interact)
- Annotations (author guidance)

**Same files. Different purposes. Different experiences.**

Type determines everything:
- Review → feedback workflow
- Guide → execution checklist
- Documentation → reference lookup
- Tutorial → active learning
- Architecture → visual exploration
- Onboarding → tracked ramp-up

**Files stay simple. Structure lives in the database. Types unlock workflows.**
