# bluekit-overview

**BlueKit is a project-scoped knowledge notebook for code.**

Think of it like Obsidian, but designed specifically for codebases:

## What It Is

BlueKit stores structured markdown files in `.bluekit` directories within your projects. These files—called **kits**, **walkthroughs**, **agents**, and more—capture reusable patterns, architectural decisions, educational guides, and project context.

## Key Differences from Obsidian

| Aspect | Obsidian | BlueKit |
|--------|----------|---------|
| **Scope** | Personal/global vault | Per-project `.bluekit` directory |
| **Context** | Manual organization | Automatic project boundaries |
| **Configuration** | Plugins, settings, themes | Zero-config, works out of the box |
| **Audience** | Humans | Humans AND AI agents via MCP |
| **Location** | Lives in your vault | Lives with your code, versioned in git |

## Core Philosophy

**Code knowledge should live with code.**

- No external databases
- No configuration required
- Context boundaries are automatic (one `.bluekit` per project)
- Content is versioned alongside the codebase
- Available to both humans and AI through the MCP server

## MCP Integration

BlueKit exposes its content through a Model Context Protocol server, allowing AI agents to:

- Read project kits, walkthroughs, and documentation
- Understand project-specific patterns and conventions
- Access architectural decisions and rationale
- Generate new kits, diagrams, and walkthroughs
- Work within defined project boundaries automatically

## Content Types

- **Kits**: Reusable code patterns and components
- **Walkthroughs**: Step-by-step explanations of how code works
- **Agents**: AI agent definitions with capabilities and behaviors
- **Diagrams**: Mermaid diagrams for visualizing architecture
- **Blueprints**: Templates for scaffolding new features
- **Notes**: General project documentation

## Why This Matters for Agents

Unlike a personal Obsidian vault, BlueKit:

1. **Scopes context automatically** — no need to configure which files the agent can see
2. **Lives in the project** — context travels with the code
3. **Is designed for agents** — structured for both human reading and machine parsing
4. **Zero friction** — drop in a `.bluekit` folder and it just works

## Target Use Cases

### Cross-Project Knowledge Capture

The core workflow BlueKit enables:

1. **Enter any codebase** — open a project you're working in or exploring
2. **Generate contextual markdown** — capture a component, design pattern, architecture decision, API contract, or any relevant piece of knowledge
3. **Transfer to another notebook** — easily move that markdown into a different project's `.bluekit` directory
4. **Modify and adapt** — edit the content to fit the new project's context

### What You Can Capture

- **Components**: React/Vue/Angular components with usage examples
- **Design patterns**: Authentication flows, state management approaches, error handling strategies
- **API contracts**: Endpoint definitions, request/response shapes
- **Architecture decisions**: Why something is built a certain way
- **Configuration recipes**: Build configs, environment setups, deployment patterns
- **Learned context**: Gotchas, edge cases, things you wish you knew earlier

### The Flow

```
Project A                          Project B
┌─────────────────┐               ┌─────────────────┐
│ Source code     │               │ .bluekit/       │
│ ────────────    │  ──generate─► │   └── kits/     │
│ Component X     │  ──transfer─► │       └── x.md  │
│ Pattern Y       │               │                 │
└─────────────────┘               └─────────────────┘
```

You're not copying code—you're capturing **knowledge about code** in a portable, editable format that travels between projects.

---

*BlueKit: Your codebase's built-in notebook.*
