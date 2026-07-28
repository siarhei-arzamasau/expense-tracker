---
name: commit
description: Commit work to a branch in this repository — GitHub Flow branching and Conventional Commits 1.0.0 message rules. Use whenever creating a branch, staging changes, writing a commit message, or opening a pull request here.
model: sonnet
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git checkout:*), Bash(git pull:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr create:*), Read, Grep, Glob
---

# Commit to a branch

Two rules govern every change in this repository: it lands on a short-lived branch, and its
commit message follows Conventional Commits. Both are described below.

## Workflow

1. **Check where you are.** `git status --short --branch`. If the current branch is `main`,
   branch before touching anything — feature work is never committed to `main` directly.
2. **Branch from an up-to-date `main`**: `git checkout main && git pull && git checkout -b <type>/<short-kebab-case-description>`.
3. **Stage deliberately.** Prefer explicit paths over `git add -A`; the change should stay
   focused on one coherent thing.
4. **Write the message** to the spec below. Explain _why_ in the body when the reason is not
   obvious from the diff.
5. **Commit.** `.husky/pre-commit` runs `lint-staged`; if it rewrites files, restage and retry.
6. **Merge through a pull request** once the relevant checks pass and review is complete, then
   delete the branch.

## Git branches

Use GitHub Flow for all repository changes:

- `main` is the only long-lived branch and must remain deployable. Do not commit feature work directly to it.
- Start each change from an up-to-date `main` in a dedicated, short-lived branch.
- Name branches `<type>/<short-kebab-case-description>`, using `feature`, `fix`, `docs`, `refactor`, `test`, or `chore` as the type; for example, `feature/frontend-homepage`.
- Keep each branch focused on one coherent change. Bring `main` into the branch before merging when needed to resolve divergence.
- Merge into `main` through a pull request only after the relevant checks pass and review is complete. Delete the branch after merge.
- Do not introduce a `develop` branch or other long-lived integration branches unless the repository workflow is explicitly changed.

## Git commits

**Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).**

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- **Type** is required and lowercase: `feat` for a new capability, `fix` for a bug fix, and `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `style` for the rest. `style` means formatting only — an Oxfmt pass, not a visual redesign; changing how a page looks is `feat` or `fix`.
- **Scope** is optional, and when present is a noun in parentheses naming a part of the codebase — a workspace (`backend`, `frontend`, `database`, `shared`) or a module (`auth`, `users`, `categories`, `transactions`).
- **Description** is imperative mood, lowercase, no trailing period, header under ~72 characters: `feat(auth): add forgot/reset password endpoints`, never `Added ...`.
- **Body** starts one blank line after the description and explains _why_; the diff already says what.
- **Breaking changes** take a `!` before the colon (`feat(shared)!: ...`) and/or a `BREAKING CHANGE: <explanation>` footer. Other footer tokens use hyphens instead of spaces (`Reviewed-by: ...`).
- English, always — including when the request, issue, or spec arrives in another language. Translate rather than mirror the input language.

Two things to know. **Nothing enforces this.** `.husky/pre-commit` runs `lint-staged` and that is all — there is no `commit-msg` hook and no commitlint, so a malformed message is accepted silently. And **`git log` is not a style reference here**: history predating this rule is mostly sentence-case subjects with no type prefix (`Add category management`), with two stray conventional ones mixed in. Follow the spec rather than the neighbouring commits, and leave the existing messages alone — rewriting published history to match is not worth it.

## Examples

```
feat(transactions): add date range filter to list endpoint

The dashboard needs month-scoped totals, and paging over the full history
to compute them was the only alternative.
```

```
fix(frontend): render pager from totalPages > 1

totalPages is 0 for an empty result set, so the truthiness check hid the
pager only by accident and showed it for single-page results.
```

```
docs(backend): document CQRS handler registration
```
