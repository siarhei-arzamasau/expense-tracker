---
name: pr
description: Open a pull request on GitHub for a branch in this repository, given a PR title and a branch name. Use whenever asked to create, open, or raise a PR here.
model: sonnet
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git push:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh pr create:*), Bash(pnpm:*), Read, Grep, Glob
argument-hint: [title] [head-branch, defaults to current]
---

# Open a pull request

- $0 - the PR title
- $1 - the branch the PR comes from

- **First argument — the PR title.** Required.
- **Second argument — the branch the PR comes from** (the head branch). Optional; defaults to the
  branch you are on.
- **The base is always `main`.** `main` is the only long-lived branch here, so a target argument
  would only ever have one value. Branching rules live in the `commit` skill — this skill assumes
  them rather than restating them.

Both arguments may arrive unquoted or in any order that is unambiguous: the value that names an
existing branch is the branch, the rest is the title.

This skill pushes a branch and opens a PR — both outward-facing. It stops there. It never merges,
never deletes a branch, and never commits: bring the branch to the state you want with the `commit`
skill first.

## 1. Preflight

```bash
git rev-parse --verify <branch>                   # the branch exists locally
git fetch origin main                             # compare against a current base
git log --oneline origin/main..<branch>           # what the PR would contain
git status --short --branch
gh pr list --head <branch> --state all --json number,url,state,title
```

Five stop conditions. In each, report and stop rather than working around it:

- **The branch is `main`.** There is no PR to open; `main` is the base.
- **`git log origin/main..<branch>` is empty.** The branch has nothing `main` does not already
  have. Usually it was already merged, or the commits went to a different branch.
- **A PR is already open for the branch.** Print its URL. `gh pr create` would fail anyway, and the
  fix is `gh pr edit` on the existing one, not a second PR. A _closed_ or _merged_ PR for the same
  branch is not a blocker — mention it and continue.
- **The named branch does not exist locally.** Do not create it and do not guess at a near match;
  ask which branch was meant.
- **The working tree is dirty and `<branch>` is the branch you are on.** Uncommitted work is not in
  the PR. Say which files are being left out and stop — committing them is the `commit` skill's job
  and the user may have left them out deliberately.

## 2. Run the checks nothing else will

`.github/workflows` contains `claude.yml` and `claude-code-review.yml` and nothing else. **No job
runs `typecheck`, `lint`, or `test` on a pull request.** If you do not run them, they do not run.

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

Run this in the background; the full pass takes minutes. `pnpm test` covers backend Jest specs and
frontend Vitest specs and deliberately excludes backend e2e, which needs Postgres up and migrated —
so a green run here is not a claim about e2e.

If anything fails, stop and report it. Do not open a PR on a red tree, and do not describe a failure
as something review or CI will catch. When the user wants the PR open regardless — early feedback on
unfinished work — open it with `--draft` and say in the body which check is failing.

Skip the checks only for a branch that touches no code at all (documentation, `.claude/`), and say
that you skipped them and why.

## 3. Settle the title

The PR title follows the same [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
spec as commit subjects — `<type>(<scope>): <description>`, imperative, lowercase, no trailing
period, under ~72 characters. The `commit` skill is the source of truth for the types and scopes.

Use the title you were given. If it has no type prefix, derive one from the branch name, which
already carries the type as its first segment:

| Branch prefix | Commit type |
| ------------- | ----------- |
| `feature/`    | `feat`      |
| `fix/`        | `fix`       |
| `docs/`       | `docs`      |
| `refactor/`   | `refactor`  |
| `test/`       | `test`      |
| `chore/`      | `chore`     |

Say what you changed and why — a title is the user's words, and rewriting them silently is how a PR
ends up describing something other than what its author meant. If the branch name gives no usable
type, ask instead of guessing.

## 4. Push the branch

```bash
git push -u origin <branch>
```

Push before creating. `gh pr create --head <branch>` **skips gh's own push prompt entirely** — that
is what `--head` is documented to do — so without this step the command fails against a branch
GitHub has never seen, or, worse, opens a PR against a stale remote branch pushed earlier.

## 5. Write the body

Read the branch before describing it: `git log origin/main..<branch>` for the commits and
`git diff origin/main...<branch>` (three dots) for the change itself. Commit subjects are a table of
contents, not a description — a PR body assembled by pasting them tells the reviewer nothing they
could not get from the commit list GitHub already renders.

**The audience is a reviewer who is about to read the diff**, which is the opposite of the `standup`
skill's audience. File paths, type names, and command names belong here.

```markdown
## Summary

What this branch changes, and why it was worth changing. One paragraph.

## Changes

- One bullet per coherent change, not per commit or per file.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` — pass locally.
- Anything checked by hand, and anything deliberately not checked.
```

- **Only claim what you ran.** "Checks pass" means checks you ran locally in step 2. Never write
  that CI will verify something, never mark a PR as blocked on a job that does not exist, and list
  what you did not verify (backend e2e, a manual flow) as plainly as what you did.
- **Add `Closes #<n>`** when the user names an issue. Do not go looking for one to attach.
- **No tool attribution** — no `Co-Authored-By`, no generated-with footer. Claude Code appends one
  by default, so leaving it out is a deliberate override, matching the same rule for commit
  messages in the `commit` skill.
- **English, always**, including when the request or the branch's commits arrive in another
  language.
- Call out anything a reviewer would otherwise flag as a mistake: a hand-written migration, a pinned
  dependency, an intentional omission. The "Constraints that look like mistakes but are not" section
  of `CLAUDE.md` is the standing list of these.

## 6. Create it

```bash
gh pr create --base main --head $1 --title "$0" --body-file - <<'EOF'
<body>
EOF
```

A heredoc into `--body-file -` keeps backticks, `$`, and blank lines intact; `--body` with a long
quoted string does not survive contact with a shell. Add `--draft` for work opened early. Add
`--dry-run` first if you want to show the user the PR before it exists — it prints what would be
created without creating it, though note it may still push.

## 7. Report

Print the PR URL, and say what now happens on its own:

- `claude-code-review.yml` runs on `opened`, `synchronize`, `ready_for_review`, and `reopened`, and
  posts a `/code-review` pass as a PR comment. This is the only automation that reacts to the PR.
- `claude.yml` responds to `@claude` in a PR or issue comment, on review comments, and on review
  submissions.

Neither one builds, typechecks, lints, or tests anything. The PR is ready to merge when its review
is done and the checks from step 2 pass — say it that way, and do not tell the user to wait for CI.

Stop at the URL. Merging and deleting the branch are separate, later steps that the user asks for.
