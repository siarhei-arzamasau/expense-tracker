---
name: git-commit
description: 'Background reference on the Conventional Commits specification itself — the type table, the breaking-change forms, and how to read a diff into a type and scope. NOT the entry point for committing in this repository: use the `commit` skill for that, which owns branching and the message rules and supersedes this file wherever the two differ.'
license: MIT
model: sonnet
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git add:*), Bash(git commit:*), Read, Grep, Glob
---

# Git Commit with Conventional Commits

## In this repository: read `commit` instead

**`.claude/skills/commit/SKILL.md` is the single source of truth for branching and commit messages
here**, and the root `CLAUDE.md` says so. This file is generic upstream guidance kept as background
reference on the specification; it does **not** describe how to commit in this repository, and where
the two disagree, `commit` wins. Do not "improve" this file with repo rules — the root `CLAUDE.md`
directs changes to `commit` rather than restating them elsewhere.

Follow the workflow in `commit`. These are the specific places where doing what this file says instead
would produce a wrong commit:

- **It never mentions branching.** Its workflow goes diff → stage → commit, so following it on `main`
  commits feature work directly to `main` — the one thing this repo's first rule forbids. `commit`
  starts with `git status --short --branch` and branches as `<type>/<short-kebab-case-description>`
  from an up-to-date `main`.
- **It is silent on tool attribution, and silence is the bug.** `commit` requires **no
  `Co-Authored-By: Claude ...` and no generated-with footer** — a deliberate override, since Claude
  Code appends one by default. Following this file lets the default through on every commit.
- **`git add -p` (step 2) cannot run here.** Interactive git flags are unsupported in this
  environment. Stage explicit paths instead; `commit` prefers them over `git add -A` anyway.
- **Descriptions are also lowercase with no trailing period.** This file asks only for imperative mood
  under 72 characters, which permits `feat: Add filter.` — `commit` does not.
- **Scope is not freeform.** `commit` enumerates it: a workspace (`backend`, `frontend`, `database`,
  `shared`) or a module (`auth`, `users`, `categories`, `transactions`). "What area/module is
  affected?" invites drift.
- **`style` is narrower than it looks.** In this repo `style` means a formatting pass only; changing
  how a page *looks* is `feat` or `fix`. The table below reads "Formatting/style (no logic)", which is
  easy to misapply to UI work.
- **`revert` is not in this repo's type list.** `commit` enumerates `feat`, `fix`, `docs`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`, `style`.
- **Committing is where you stop.** Pushing and opening a PR are separate, outward-facing steps to be
  offered rather than assumed; the `pr` skill covers them.

The two genuinely agree on: never `--no-verify`, never force-push `main`, never commit secrets, one
logical change per commit, imperative mood, and fixing a hook failure with a new commit rather than an
amend. `commit` adds the detail that `.husky/pre-commit` runs `lint-staged`, which restages what it
reformats, so a reformat is not something to plan around — only a *failing* task needs handling.

## Overview

Create standardized, semantic git commits using the Conventional Commits specification. Analyze the actual diff to determine appropriate type, scope, and message.

## Conventional Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build system/dependencies      |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

## Breaking Changes

```
# Exclamation mark after type/scope
feat!: remove deprecated endpoint

# BREAKING CHANGE footer
feat: allow config to extend other configs

BREAKING CHANGE: `extends` key behavior changed
```

## Workflow

> **Not the workflow to follow in this repository** — see `commit`, which begins with a branch check
> this one lacks. Kept for the diff-reading and message-construction mechanics.

### 1. Analyze Diff

```bash
# If files are staged, use staged diff
git diff --staged

# If nothing staged, use working tree diff
git diff

# Also check status
git status --porcelain
```

### 2. Stage Files (if needed)

If nothing is staged or you want to group changes differently:

```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Stage by pattern
git add *.test.*
git add src/components/*

# Interactive staging — NOT available in this environment; interactive git flags are
# unsupported. Stage explicit paths instead.
git add -p
```

**Never commit secrets** (.env, credentials.json, private keys).

### 3. Generate Commit Message

Analyze the diff to determine:

- **Type**: What kind of change is this?
- **Scope**: What area/module is affected?
- **Description**: One-line summary of what changed (present tense, imperative mood, <72 chars)

### 4. Execute Commit

```bash
# Single line
git commit -m "<type>[scope]: <description>"

# Multi-line with body/footer
git commit -m "$(cat <<'EOF'
<type>[scope]: <description>

<optional body>

<optional footer>
EOF
)"
```

## Best Practices

- One logical change per commit
- Present tense: "add" not "added"
- Imperative mood: "fix bug" not "fixes bug"
- Reference issues: `Closes #123`, `Refs #456`
- Keep description under 72 characters

## Git Safety Protocol

- NEVER update git config
- NEVER run destructive commands (--force, hard reset) without explicit request
- NEVER skip hooks (--no-verify) unless user asks
- NEVER force push to main/master
- If commit fails due to hooks, fix and create NEW commit (don't amend)
