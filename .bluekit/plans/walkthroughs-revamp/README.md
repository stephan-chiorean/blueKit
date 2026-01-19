# Walkthroughs Revamp Plan

## TL;DR

Transform walkthroughs from single markdown files to **directory-based collections** with **database-backed metadata**, following the Plans system architecture.

## Key Changes

| Before | After |
|--------|-------|
| Single `.md` files | Directories with `index.md` + sections |
| YAML front matter only | Database metadata |
| MCP can create | User converts directories |
| No multi-file support | Native multi-file walkthroughs |

## Core Principles

1. **Every walkthrough is a folder** - even single-file walkthroughs
2. **User-initiated conversion** - no automatic creation via MCP
3. **Database-backed metadata** - fast queries, consistent data
4. **Progressive disclosure** - directories support growth naturally

## Implementation Phases

1. Database schema & entities
2. Rust operations (CRUD)
3. IPC commands
4. Frontend types & IPC wrappers
5. UI updates (convert dialog, list view)
6. Legacy migration
7. File watcher integration

See `implementation-plan.md` for detailed specifications.
