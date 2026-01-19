# Workspace Architecture Decision: Cloud Sync vs Git-Native

**Status:** DECIDED - Hybrid (Git-Native + Personal Library)
**Decision Date:** 2026-01-19
**See also:** `personal-library-spec.md` for library implementation details

---

## The Core Question

Should BlueKit workspaces be:
1. **Pure Cloud Sync** - Supabase-backed storage with cloud-first architecture
2. **Git-Native** - GitHub repos as the source of truth, enhanced with cloud features

---

## Current State

Today, `.bluekit` directories live inside git repos. This means:
- Artifacts are version controlled alongside code
- Sharing happens via repo access (push/pull)
- Teams already collaborating on code automatically share BlueKit artifacts
- No additional infrastructure required

---

## Scenario A: Pure Cloud Sync

### How It Works
- All BlueKit artifacts stored in Supabase
- Local `.bluekit` directories are synced copies
- Workspaces are cloud entities, not repo directories
- Users authenticate, see their workspaces, sync locally

### What the World Looks Like
```
User logs in → Sees all workspaces → Picks one → Local sync happens
                    ↓
         Can access from any machine
                    ↓
         Workspace invite = Supabase permission grant
                    ↓
         Artifacts exist independent of any repo
```

### Unique Capabilities (Cloud-Only)
1. **Cross-device seamless access** - Login from new laptop, everything's there
2. **Repo-agnostic artifacts** - Kits that don't belong to any specific codebase
3. **Instant workspace sharing** - Email invite, accept, done (no git access needed)
4. **Offline-proof permanence** - Artifacts survive local machine loss
5. **Non-developer collaboration** - Designers, PMs can access without git knowledge
6. **Granular permissions** - View-only, edit, admin per artifact (not repo-level)
7. **Usage analytics** - Track which artifacts are actually being used
8. **Real-time collaboration** - Multiple users editing same workspace simultaneously

### Challenges
- Sync conflicts between cloud and local
- Requires internet for full functionality
- Another account/service to manage
- Version control is now BlueKit's responsibility (not git's)
- Migration complexity for existing users
- Storage costs scale with users

---

## Scenario B: Git-Native (Enhanced)

### How It Works
- `.bluekit` stays in repos as source of truth
- Cloud layer is additive: personal library, marketplace publishing, discovery
- "Workspaces" = repos you have access to
- Sharing = sharing repo access (existing flow)

### What the World Looks Like
```
Clone repo → .bluekit is there → Start using
                    ↓
         Personal library = cloud-synced favorites/bookmarks
                    ↓
         Publish to marketplace = push artifact to community
                    ↓
         Import from marketplace = copy artifact to local .bluekit
```

### Unique Capabilities (Git-Native Only)
1. **Zero new infrastructure for teams** - Already using git? Already sharing.
2. **Artifacts evolve with code** - Kit about auth lives next to auth code, versioned together
3. **Git blame/history** - Who wrote this kit? When? Why?
4. **Branch-aware artifacts** - Different kits on different branches (feature docs)
5. **PR-driven artifact review** - "Add this kit" goes through code review
6. **No sync conflicts** - Git already solved this
7. **Works offline completely** - It's just files
8. **Existing access control** - GitHub/GitLab permissions already work

### Challenges
- Cross-project sharing requires separate mechanism (personal library)
- Non-git users excluded from collaboration
- "Workspace" concept is less clean (it's just... repos)
- No real-time collaboration on artifacts

---

## The Hybrid Path

What if we don't choose? Git-native as foundation, cloud as enhancement layer.

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Community Marketplace                 │
│              (Supabase: published artifacts)            │
└─────────────────────────────────────────────────────────┘
                            ↑ publish
                            ↓ import
┌─────────────────────────────────────────────────────────┐
│                    Personal Library                      │
│         (Supabase: bookmarks, favorites, own kits)      │
│                                                          │
│   "My Kits" - artifacts you created, synced to cloud    │
│   "Bookmarks" - references to artifacts in repos        │
│   "Imports" - copies from marketplace                   │
└─────────────────────────────────────────────────────────┘
                            ↑ bookmark / copy
                            ↓ paste / reference
┌─────────────────────────────────────────────────────────┐
│                    Project Artifacts                     │
│              (Git: .bluekit in repositories)            │
│                                                          │
│   Version controlled with code                          │
│   Shared via repo access                                │
│   Team collaboration = git collaboration                │
└─────────────────────────────────────────────────────────┘
```

### This Gives Us

**From Git-Native:**
- Artifacts versioned with code ✓
- No sync complexity ✓
- Works offline ✓
- Teams already share via git ✓

**From Cloud Sync:**
- Personal library across projects ✓
- Accessible from anywhere (the library, not workspace artifacts) ✓
- Marketplace publishing ✓
- MCP integration via API ✓

### What We Explicitly Don't Do
- Cloud-stored workspace artifacts (git handles this)
- Real-time collaborative editing (use git + PRs)
- Workspace invites (share repo access instead)
- Sync conflict resolution (git handles this)

---

## Use Case Analysis

### Use Case 1: Team onboarding new developer
| Approach | Flow |
|----------|------|
| Cloud Sync | Invite to workspace → Accept → See all artifacts |
| Git-Native | Add to repo → Clone → See all artifacts |
| Hybrid | Add to repo → Clone → See all artifacts |

**Winner:** Tie (both work, git-native is already how teams work)

### Use Case 2: Solo dev wants personal kit library
| Approach | Flow |
|----------|------|
| Cloud Sync | Login → See all your kits across workspaces |
| Git-Native | ??? (kits scattered across repos) |
| Hybrid | Login → Personal Library has bookmarks + owned kits |

**Winner:** Cloud Sync / Hybrid (git-native can't do this alone)

### Use Case 3: Share kit with non-technical PM
| Approach | Flow |
|----------|------|
| Cloud Sync | Invite to workspace → They see artifacts |
| Git-Native | Give repo access → They need git knowledge |
| Hybrid | Publish to marketplace or share link → They view on web |

**Winner:** Cloud Sync (but hybrid can approximate with web viewer)

### Use Case 4: Artifact evolves with feature branch
| Approach | Flow |
|----------|------|
| Cloud Sync | Manual versioning, complex branch awareness |
| Git-Native | Just works (different branch = different .bluekit) |
| Hybrid | Just works |

**Winner:** Git-Native / Hybrid

### Use Case 5: Access kits from brand new machine
| Approach | Flow |
|----------|------|
| Cloud Sync | Login → Everything available |
| Git-Native | Clone repos → Kits available per repo |
| Hybrid | Login → Personal library available; Clone repos → Project kits |

**Winner:** Cloud Sync (but hybrid is close enough)

### Use Case 6: MCP integration for AI workflows
| Approach | Flow |
|----------|------|
| Cloud Sync | API serves all workspace artifacts |
| Git-Native | API serves... local files? Which repos? |
| Hybrid | API serves Personal Library (curated, stable) |

**Winner:** Hybrid (you want curated library for MCP, not raw repos)

### Use Case 7: Publish kit to community
| Approach | Flow |
|----------|------|
| Cloud Sync | Publish from workspace |
| Git-Native | Copy to marketplace somehow |
| Hybrid | Publish from library or directly from repo |

**Winner:** Tie (all need marketplace infrastructure)

---

## Decision

**DECIDED: Hybrid - Git-Native Foundation + Personal Library Layer**

### Reasoning

1. **Don't fight git** - Teams already share code via git. Making them also manage Supabase workspaces adds friction, not value.

2. **Solve the real gap** - What git doesn't give you is a personal library across projects. That's the cloud layer's job.

3. **MCP integration is cleaner** - Your API exposes a curated personal library, not a mess of all repos. Users choose what's in their MCP-accessible library.

4. **Marketplace fits naturally** - Personal library → Publish to marketplace. Import from marketplace → Personal library → Copy to repo.

5. **Less infrastructure** - You're storing library metadata + marketplace artifacts, not syncing entire workspaces.

6. **Familiar mental model** - "Projects are repos. Library is mine. Marketplace is community." Easy to explain.

### What Supabase Handles
- **User accounts / auth** (Google, GitHub, email)
- **Personal Library** (one per user, structured artifacts only)
  - Collections for organization
  - Cloud storage for library content
  - API for MCP integration
- **Marketplace** (published artifacts, discovery)
- **Project collaboration metadata** (tasks, checkpoints - NOT the files)

### What Git Handles
- **Project artifacts** (`.bluekit` in repos)
- **Version control** for code + kits
- **Team sharing** via repo access
- **File sync** between collaborators

### What We're NOT Building
- ❌ Shared workspaces (replaced by personal library + git)
- ❌ Cloud-synced project files (git does this)
- ❌ Team libraries (use git repos)
- ❌ Workspace invites (use project/repo invites instead)

---

## Implementation Path

### Phase 1: Auth Foundation
- Supabase Auth (Google, GitHub, email)
- User profiles
- Remove legacy GitHub-only auth

### Phase 2: Personal Library
- `library_catalog` and `library_collections` tables
- Storage bucket for library content
- "Save to Library" from project artifacts
- Collections for organization
- **Structured artifacts only** (with YAML front matter)

See `personal-library-spec.md` for full details.

### Phase 3: MCP Integration
- API endpoints for library access
- MCP resource definitions
- API key generation

### Phase 4: Marketplace
- Publish from library to marketplace
- Import from marketplace to library
- Community discovery / search

### Phase 5: Project Collaboration (Separate Track)
- Project invites (for git repos)
- Synced metadata (tasks, checkpoints)
- Real-time activity feeds

See `project-collab.md` and `invite-flow.md` for details.

### What We're NOT Doing
- ❌ Cloud-synced workspaces
- ❌ Real-time collaborative editing of kits
- ❌ Workspace invites / permissions
- ❌ Shared team libraries

---

## Resolved Questions

1. **Library storage** - Do we store full artifact content or just metadata?
   - **DECIDED: Full content.** Library is independent of project repos.

2. **Offline library** - Should library sync locally for offline access?
   - **DECIDED: No.** Keep it simple. Library requires connection.

3. **Team libraries** - Should teams have shared libraries?
   - **DECIDED: No.** Teams share via git repos. Library is personal.

4. **Unstructured content** - Allow notes without front matter in library?
   - **DECIDED: No.** Library is structured only. Use project scrapbook for drafts.

## Remaining Questions

1. **Marketplace licensing** - How do we handle artifact licensing?
   - MIT default? User-specified? Repo license inheritance?

2. **Library version history** - Track previous versions of library artifacts?
   - Leaning: Yes, but simple (not full git-style history)
