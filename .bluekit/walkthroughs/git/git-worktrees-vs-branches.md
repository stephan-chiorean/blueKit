---
id: git-worktrees-vs-branches
alias: Git Worktrees vs Branches
type: walkthrough
is_base: false
version: 1
tags:
  - git
  - workflow
  - productivity
description: A clear guide explaining the difference between Git branches and worktrees, and why worktrees are useful for parallel development.
complexity: simple
format: guide
---
# Git Worktrees vs Branches

Understanding why worktrees are a "superpower" compared to standard branching.

## The Core Difference

### 🌿 Branches
Think of a **Branch** as a **timeline**.
*   It's just a pointer to a specific commit history.
*   In a standard setup, you have **one** folder (your working directory).
*   When you switch branches (`git switch feature-a`), Git continually rewrites the files in that one folder to match the new timeline.

### 🌳 Worktrees
Think of a **Worktree** as a **parallel universe**.
*   It is a **separate folder** on your disk.
*   It is linked to the *same* `.git` history (repository).
*   It has a specific branch checked out *permanently* in that folder.

## Validating the "Why"

Why go through the trouble of making new folders?

### 1. Zero Context Switching Cost
**The Branch Way:**
You are working on `main`. Your boss asks for a fix on `legacy-v1`.
1.  `git stash` (hide your current mess).
2.  `git checkout legacy-v1`.
3.  `npm install` (dependencies are different!).
4.  *Wait for build...*
5.  Fix bug.
6.  `git checkout main`.
7.  `npm install` (back to new dependencies...).
8.  `git stash pop`.

**The Worktree Way:**
You have a `main` folder and a `legacy-v1` worktree folder.
1.  Open the `legacy-v1` folder.
2.  Fix bug.
3.  Close folder.
*Your `main` server was running the whole time. You never stopped it. You never re-installed node_modules.*

### 2. Side-by-Side Comparison
You can have `app-v1` running on port 3000 and `app-v2` running on port 3001 at the **exact same time**. You can visually compare them side-by-side. You cannot do this with simple branching because you can only have one version of the code "checked out" at a time.

## How to use it in BlueKit

We just created a worktree for `tasks-overhaul`.

1.  **Main Folder**: `/blueKit` (Checked out to `main`)
2.  **Worktree Folder**: `/blueKit-tasks-overhaul` (Checked out to `tasks-overhaul`)

To switch contexts, you don't use Git commands. **You just open the other folder.**

### Quick Commands

**Create a worktree:**
```bash
# git worktree add <path> <branch>
git worktree add ../new-feature-folder new-feature-branch
```

**List worktrees:**
```bash
git worktree list
```

**Remove a worktree:**
```bash
# Just delete the folder, then run:
git worktree prune
```
