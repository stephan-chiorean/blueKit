---
title: BlueKit Design Philosophy - UX Migration Strategy
created: 2025-01-12
purpose: Define the core philosophy for evolving BlueKit's UX toward a more flexible, Obsidian-inspired approach while leveraging code-native advantages
status: exploratory
---

# BlueKit Design Philosophy

## The Core Position

> "Obsidian is where YOUR knowledge lives. BlueKit is where your PROJECT's knowledge lives."

BlueKit manages **note vaults alongside projects** with collaboration, publishing, and sharing mechanisms natively built in. It's not a general-purpose note-taking app—it's a **project-native knowledge system** where documentation travels with code.

---

## The Fundamental Difference

| Obsidian | BlueKit |
|----------|---------|
| Document-centric | Project-centric |
| One vault → references many projects | Each project → has its own knowledge |
| Knowledge lives in YOUR brain | Knowledge lives WITH the code |
| Personal vault | Portable, shareable, version-controlled |

The `.bluekit/` directory is the key insight: **knowledge that travels with the repo**.

---

## Code-Native Advantages

BlueKit's desktop app understands projects, git, and file systems in ways Obsidian + Claude Code cannot:

### 1. Knowledge Portability

```
git clone some-repo
# You now have their kits, walkthroughs, architectural decisions
```

When you clone a repo, you get its institutional memory. Obsidian vaults are personal—they don't come with the code.

### 2. Project Context Switching

Claude Code operates in ONE project directory at a time. BlueKit is the "meta layer":
- "Here are the kits for THIS project"
- "Here's what I learned in project A that applies here"
- "Send this pattern to my other 3 React projects"

### 3. Git-Aware Knowledge

Things Obsidian cannot know:
- "This walkthrough explains these 5 commits"
- "This kit was created when we refactored auth"
- "Show me what changed since this decision was made"
- Branch-specific notes (feature branch has its own context)

### 4. Dependency-Aware Surfacing

If `package.json` includes `prisma`, BlueKit could surface:
- Your prisma kits
- Community prisma patterns
- "Here's how project X solved this same prisma issue"

### 5. Cross-Project Operations

- Send resources between projects
- Maintain pattern libraries across codebases
- Propagate updates when a kit improves

---

## The Flexibility vs Structure Question

### Current Model: Location-Based

```
.bluekit/
├── kits/           # type = kit
├── walkthroughs/   # type = walkthrough
├── agents/         # type = agent
└── blueprints/     # type = blueprint
```

Structure determined by directory. Predictable but rigid.

### Alternative Model: Front Matter-Based

```
.bluekit/
├── notes/              # freeform scratchpad
├── architecture.md     # type: kit (from front matter)
├── auth-guide.md       # type: walkthrough
└── onboarding/         # blueprint (has blueprint.json)
```

Structure determined by content. Flexible but requires front matter.

### Hybrid Model (Recommended)

Inspired by Hugo/Jekyll static site generators:

- **Location is a default**, front matter is an override
- Special directories have meaning, but you can organize freely
- Any `.md` file with `type: kit` is a kit, regardless of location
- Views aggregate by type ("All Kits", "All Walkthroughs")

**Rules:**
1. Sidebar shows file tree (Obsidian-style navigation)
2. `type` in front matter determines behavior
3. Gallery/library views aggregate by type (like Obsidian's tag pane)
4. No required folder structure—it's just organization preference

---

## The Latent Demand Principle

> Facebook created Groups. 50% were used for selling things. Facebook created Marketplace.

Build something simple and hackable. Watch how people use it. Build your product around observed patterns.

### The Hackable Foundation

Make `.bluekit/` the simplest possible thing:
- A folder of markdown files
- Optional front matter for metadata
- Claude Code can read/write it naturally

### Then Watch What People Do

- Do they organize by type? (kits/, walkthroughs/)
- Do they link between projects?
- Do they version control them?
- Do they share them with teams?
- What structures emerge organically?

### Build Features Around Observed Patterns

Don't assume—measure:
- Which artifact types get created most?
- How do people navigate between projects?
- What cross-project operations do they want?
- How do teams collaborate on shared knowledge?

---

## Native Collaboration & Publishing

Unlike Obsidian, BlueKit builds collaboration into the core:

### Team Knowledge Transfer

- New dev joins → project's `.bluekit/` onboards them
- Not a personal vault, but the PROJECT's institutional memory
- Shared patterns stay in sync across team

### Cross-Project Pattern Propagation

- "I solved auth well in project A"
- "Apply this to projects B, C, D"
- Keep them in sync when the pattern updates

### Publishing & Discovery

- Publish kits/blueprints to community library
- Browse others' architectural decisions
- Clone and customize proven patterns
- Gallery/Dribbble-style discovery

### Claude Code Integration

BlueKit could BE the knowledge layer for Claude Code:
- When Claude works on a project, it reads from `.bluekit/`
- Like CLAUDE.md but richer, structured, maintainable
- Project-specific context that travels with the code

---

## What a Kit Really Is

Strip away all ceremony. A kit is:

1. A markdown file
2. With optional metadata (tags, description, type)
3. That you want to reuse or share

That's it. The directory structure is just a UX affordance saying "put kits here." If users understand front matter, you don't need the scaffolding.

---

## Trade-offs to Consider

### What You'd Lose with Flexibility

- Obvious "where do I put this?" for new users
- Directory-as-type simplicity
- Clear onboarding ("create files in /kits")

### What You'd Gain

- Organize however makes sense to you
- One notebook, multiple lenses/views
- Matches mental model of "just markdown files"
- Lower learning curve
- Works with existing Claude Code workflows

---

## Implementation Implications

### File Scanning

- Instead of scanning specific directories, scan all `.md` files
- Parse front matter, look for `type` field
- Build indexes by type for gallery views
- Cache results for performance

### UI Structure

- Sidebar: file tree navigation (Obsidian-style)
- Gallery views: filtered by type (All Kits, All Walkthroughs)
- Project switcher: jump between project contexts
- Cross-project operations: send, sync, compare

### Front Matter Schema

```yaml
---
type: kit | walkthrough | agent | blueprint | note  # Required for typing
id: unique-identifier                                # For references
tags: [auth, security]                               # For filtering
description: "Brief description"                     # For preview
---
```

### Optional Conventional Folders

Keep optional defaults for new users:
- Creating file in `/kits/` auto-sets `type: kit`
- Power users can ignore and organize freely
- Best of both worlds

---

## Competitive Positioning

### vs Obsidian + Claude Code

| Obsidian | BlueKit |
|----------|---------|
| General-purpose notes | Project-native knowledge |
| Personal vault | Travels with code |
| Plugin-based integrations | Native collaboration |
| Folder-agnostic | Project-aware |
| No cross-project ops | Send between projects |
| No git awareness | Timeline, branch context |

### vs Notion for Engineering Teams

| Notion | BlueKit |
|-------|---------|
| Cloud-only | Local-first, offline capable |
| Separate from code | `.bluekit/` in repo |
| Manual syncing | Git-versioned automatically |
| Team wikis | Project-specific knowledge |

---

## Success Metrics

A successful UX migration achieves:

1. **Simpler mental model**: "It's just markdown files with optional metadata"
2. **Flexible organization**: Users structure knowledge however they want
3. **Preserved power features**: Library, gallery, collaboration still work
4. **Lower onboarding friction**: New users productive faster
5. **Code-native differentiation**: Clear advantages over Obsidian integration
6. **Latent demand captured**: Features built around observed usage patterns

---

## Next Steps

1. **User research**: How are current users organizing their `.bluekit/` directories?
2. **Prototype hybrid model**: File tree sidebar + type-based views
3. **Simplify artifact creation**: Any markdown file can be any type
4. **Build cross-project features**: The killer feature Obsidian can't match
5. **Iterate based on usage**: Follow the latent demand principle

---

## Conclusion

BlueKit's advantage is being **project-native**. Obsidian is a great markdown editor. But it doesn't understand:
- What project you're in
- How projects relate to each other
- That knowledge should travel with code
- That teams share project context, not personal vaults

Build the simplest hackable foundation. Watch what emerges. Build features around real usage. Let structure be optional, not required.

The goal: **Your project's institutional memory, portable and shareable.**
