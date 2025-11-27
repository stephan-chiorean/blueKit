---
id: tauri-file-watching
alias: Product
is_base: false
type: walkthrough
version: 1
tags: [tauri, file-system, events]
description: "Pattern for watching files in a Tauri application and updating the frontend"
---

# BlueKit Product Overview

## Vision

BlueKit is a desktop application designed to help developers organize, discover, and reuse code knowledge across projects. It transforms how teams capture, share, and apply reusable patterns, architectural decisions, and educational content.

## The Problem

Modern software development faces several challenges:

1. **Knowledge Silos**: Code patterns, architectural decisions, and best practices are scattered across projects, documentation, and individual developer knowledge
2. **Reinventing the Wheel**: Teams repeatedly solve the same problems because they can't easily find or reuse existing solutions
3. **Onboarding Friction**: New team members struggle to understand complex codebases without comprehensive, contextual explanations
4. **Documentation Drift**: Documentation becomes outdated as code evolves, losing its value
5. **Pattern Discovery**: There's no centralized way to discover what patterns and solutions already exist across projects

## The Solution

BlueKit provides a unified system for managing reusable code knowledge through **Kits** - markdown files that live alongside your code in `.bluekit` directories. These kits can be:

- **Code Patterns**: Reusable components, functions, or architectural patterns
- **Walkthroughs**: Step-by-step educational guides explaining how code works
- **Blueprints**: Templates for scaffolding new projects or features
- **Bases**: Foundational templates that serve as starting points

## Core Concepts

### Kits

A **Kit** is a markdown file stored in a project's `.bluekit` directory. Each kit represents a piece of reusable knowledge:

- **Self-contained**: Lives with the code it describes
- **Versioned**: Tracked in git alongside your codebase
- **Structured**: Uses YAML front matter for metadata (id, alias, tags, description, type)
- **Discoverable**: Automatically indexed and searchable across all linked projects

### Project Registry

BlueKit maintains a registry of linked projects, allowing you to:

- **Discover kits** across all your projects
- **Watch for changes** in real-time as kits are added, modified, or removed
- **Organize by project** while maintaining a unified view

### Types of Kits

1. **Kits** (default): General-purpose reusable code patterns, components, or solutions
2. **Walkthroughs**: Educational guides that explain how code works, step-by-step
3. **Blueprints**: Templates for scaffolding new projects or features
4. **Bases**: Foundational templates marked with `is_base: true` that serve as starting points

### Collections

Collections allow you to group related kits, blueprints, and walkthroughs together for specific purposes:

- **Organize by theme**: Group related content (e.g., "Authentication Patterns")
- **Create workflows**: Sequence kits for common development tasks
- **Share curated sets**: Distribute collections of best practices

### Workstation

The workstation view provides a focused environment for:

- **Viewing kit content**: Read full kit markdown with syntax highlighting
- **Context switching**: Quickly move between different kits
- **Deep work**: Focused interface for understanding and applying kit knowledge

## Key Features

### 1. Multi-Project Management

- Link multiple projects to BlueKit
- Automatically discover all kits across linked projects
- Real-time file watching for instant updates
- Project registry stored in `~/.bluekit/projectRegistry.json`

### 2. Real-Time Synchronization

- File watchers monitor `.bluekit` directories for changes
- Automatic reloading when kits are added, modified, or removed
- Event-driven architecture for responsive updates

### 3. Type-Safe IPC Communication

- Rust backend for file system operations and native integration
- TypeScript frontend with full type safety
- Seamless communication between frontend and backend

### 4. Rich Metadata System

Kits support YAML front matter for rich metadata:

```yaml
---
id: authentication-kit
alias: Authentication System
type: kit
is_base: false
version: 1
tags: [authentication, security, patterns]
description: "Complete authentication system with JWT tokens"
---
```

### 5. Filtering and Organization

- Filter kits by type (kit, walkthrough, blueprint)
- Tag-based organization
- Search and discovery across all projects
- Collection-based grouping

### 6. Selection System

- Select multiple kits for batch operations
- Visual indicators for selected items
- Context-aware selection across different views

## Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Chakra UI
- **Backend**: Rust + Tauri
- **Build Tool**: Vite
- **File Format**: Markdown with YAML front matter

### Design Principles

1. **File-Based**: Kits live in `.bluekit` directories, versioned with your code
2. **Non-Intrusive**: No database, no external dependencies, just markdown files
3. **Type-Safe**: Full TypeScript and Rust type safety throughout
4. **Real-Time**: Event-driven updates for immediate feedback
5. **Extensible**: Easy to add new kit types and features

## Use Cases

### 1. Pattern Library Management

Teams can maintain a living library of code patterns:

- **Authentication patterns**: JWT, OAuth, session management
- **API patterns**: REST, GraphQL, error handling
- **UI components**: Reusable React/Vue/Angular components
- **Database patterns**: Query patterns, migration strategies

### 2. Onboarding and Education

Walkthroughs help new team members understand:

- **Architecture decisions**: Why code is structured a certain way
- **Complex systems**: Step-by-step explanations of intricate code
- **Best practices**: How to follow team conventions
- **Code flow**: How data and logic flow through the application

### 3. Project Scaffolding

Blueprints and bases enable rapid project setup:

- **Starter templates**: Pre-configured project structures
- **Feature templates**: Common feature implementations
- **Best practices**: Scaffold with proven patterns built-in

### 4. Knowledge Sharing

Collections enable curated knowledge sharing:

- **Team playbooks**: Collections of team-specific patterns
- **Domain expertise**: Collections organized by domain (e.g., "E-commerce Patterns")
- **Learning paths**: Sequences of walkthroughs for skill development

## Workflow Example

1. **Developer creates a kit**: Writes a markdown file in `.bluekit/` describing a reusable pattern
2. **BlueKit discovers it**: Automatically detects the new kit via file watching
3. **Team discovers it**: Other team members see it in their BlueKit app
4. **Team uses it**: Developers reference the kit when implementing similar features
5. **Kit evolves**: As the pattern improves, the kit is updated and versioned
6. **Knowledge spreads**: The improved pattern becomes available to the entire team

## Benefits

### For Individual Developers

- **Personal knowledge base**: Organize your own code patterns and learnings
- **Quick reference**: Fast access to solutions you've used before
- **Learning tool**: Walkthroughs help understand complex codebases

### For Teams

- **Shared knowledge**: Centralized repository of team patterns and practices
- **Consistency**: Standardized approaches across projects
- **Onboarding**: New team members can learn from walkthroughs
- **Documentation**: Living documentation that stays with the code

### For Organizations

- **Knowledge retention**: Capture institutional knowledge in a discoverable format
- **Best practices**: Promote proven patterns across teams
- **Reduced duplication**: Reuse instead of reinventing
- **Faster development**: Quick access to proven solutions

## Future Vision

BlueKit is designed to grow into a comprehensive knowledge management platform:

- **AI Integration**: Intelligent suggestions and pattern matching
- **Collaboration Features**: Comments, reviews, and discussions on kits
- **Marketplace**: Share kits publicly or within organizations
- **Analytics**: Track which kits are most useful
- **Integration**: Connect with IDEs, documentation tools, and project management systems
- **Versioning**: Advanced versioning and migration tools for kits
- **Templates**: Rich template system for creating new kits

## Philosophy

BlueKit is built on the principle that **code knowledge should live with code**. By storing kits in `.bluekit` directories:

- **Version control**: Kits are versioned alongside code
- **Context**: Kits are near the code they describe
- **Ownership**: Teams own their knowledge, not a separate system
- **Simplicity**: No complex infrastructure, just markdown files
- **Portability**: Kits can be shared, forked, and evolved like code

## Getting Started

1. **Install BlueKit**: Download and install the desktop application
2. **Link Projects**: Add your projects to the registry (via CLI or UI)
3. **Create Kits**: Start adding markdown files to `.bluekit/` directories
4. **Discover**: Browse and search kits across all linked projects
5. **Organize**: Create collections to group related kits
6. **Share**: Use walkthroughs to educate, blueprints to scaffold, and kits to reuse

---

**BlueKit**: Where code knowledge lives with code.

