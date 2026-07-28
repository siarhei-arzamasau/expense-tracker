---
name: standup
description: Summarize what was done in this repository over the last 24 hours, read from git history and grouped into standup notes. Use when asked for a standup, a daily update, or "what did I do yesterday/today".
model: sonnet
allowed-tools: Bash(git log:*), Bash(git show:*), Bash(git status:*), Bash(git branch:*), Bash(git diff:*), Bash(git config:*), Bash(git rev-list:*), Read, Grep, Glob
---

# Standup

Turn the last 24 hours of git history into a short, grouped account of what got done. The output is
for a human standing up in front of other humans — an outcome list, not a `git log` dump.

This skill only reads. It never stages, commits, pushes, or rewrites anything.

## 1. Pick the window

Default to `--since='24 hours ago'`. An argument overrides it and is passed straight through to
`--since`, so `/standup 3d`, `/standup yesterday`, and `/standup since=monday` all work.

Do not silently widen the window. If nothing comes back, say the window is empty and offer the
wider one — Monday mornings and post-weekend standups are exactly when a 24-hour window is
honestly empty and a three-day window is what was meant.

## 2. Collect the commits

```bash
git log --all --no-merges --since='24 hours ago' --author="$(git config user.email)" \
  --date=format:'%Y-%m-%d %H:%M' --format='%h %ad %d %s' --shortstat
```

Every flag is load-bearing:

- **`--all`**, because work lives on short-lived branches under GitHub Flow and the newest of them
  may not have reached `main` yet. Logging `HEAD` alone silently drops a whole feature branch.
- **`--no-merges`**, because a merge commit restates work the branch commits already describe. With
  `--all` you get the branch side anyway, so merges are pure duplication.
- **`--author` matched on _email_, never on name.** This repository's history carries
  `Sergei Arzamasov`, `Sergey Arzamasov`, and `sergey arzamasov` under the single address
  `sergei.arzamasov@gmail.com`; a name filter drops commits at random. Reading the address from
  `git config user.email` also keeps the skill correct for anyone else who clones this.
- **`--shortstat`**, so a bullet can say "12 files" without guessing. Only quote numbers this
  printed.

`--since` filters on **committer** date, not author date. That is the same thing here — this
history has no rebases — but a rebased branch can shift commits into or out of the window, so check
`%aI` against `%cI` before trusting a boundary case.

Drop the `--author` filter only when the request is explicitly about the whole team.

## 3. Read past the subject lines

A commit subject is a label, not a description. Before writing a bullet about any commit whose
substance you cannot state from its subject, open it:

```bash
git show --stat <sha>          # what it touched
git show <sha> -- <path>       # what it actually changed
```

Two habits matter here. Never paraphrase a subject you have not verified against the diff — a
standup that misreports the work is worse than a terse one. And read the diff before deciding two
commits are one piece of work; adjacent subjects can look related and touch unrelated code.

## 4. Collect what is not committed

Commits are not the whole day. Two more reads:

```bash
git status --short --branch    # work in flight right now
git branch --no-merged main    # finished on a branch, not landed
```

Both feed the **In progress** section. Do not describe uncommitted files as done.

## 5. Write it

```markdown
## Standup — <date> (last 24 hours)

**Done**

- **transactions** — Added description search to the list endpoint and capped the `page` query
  parameter so an out-of-range page can no longer be requested. (`4315aac`, `78ba092`)
- **frontend** — Repaired paging, logout, and mobile nav labelling, and brought the query and filter
  helpers under Vitest. (`d98c08d`, `473d667`)

**In progress**

- `<branch>` — <n> commits finished but not yet merged into `main`.
- Uncommitted in the working tree: `<path>`.
```

(The **Done** bullets above are real commits from this history, shown to fix the shape and the
level of detail. The **In progress** lines are placeholders — fill them from step 4, and drop either
section entirely when it has nothing in it.)

Rules for the bullets:

- **Group by area of work, not by chronology.** Lead each bullet with the area in bold, taken from
  the Conventional Commit scope where there is one (`backend`, `frontend`, `database`, `shared`,
  `auth`, `users`, `categories`, `transactions`) and from the diff where there is not.
- **One bullet per coherent piece of work, not per commit.** Four commits refining one file are one
  bullet. This is the whole job when the window is busy — a 50-commit window that becomes 50 bullets
  has not been summarized.
- **State outcomes in past tense, in plain language.** Translate the type prefix rather than
  reprinting it: `feat` became a capability, `fix` corrected a behaviour, `refactor` moved something
  without changing behaviour, `docs` recorded something. "Added a date-range filter", never
  "feat(transactions): add date range filter".
- **Collapse the noise.** Formatting-only (`style`) commits, merge commits, and the two
  bot-authored GitHub Actions workflow commits are worth at most one closing line, usually nothing.
- **Cite short SHAs** in parentheses so a bullet can be chased down. Drop them if the user wants
  something to paste into Slack.
- **English, always** — including when the request arrives in another language.

Two things not to do. **Do not invent a "Today" or "Blockers" section**: plans and blockers are not
in git, so include them only when the user supplies them. And **do not pad an empty window** — "no
commits in the last 24 hours" is a complete and correct standup.

## Repository notes

Commit subjects follow Conventional Commits only from `2134288` onward. Of the 29 commits before
it, two are conventional and the rest are sentence-case with no type prefix
(`Add category management`). Parse a type and scope when they are there; describe the diff when they
are not. See the `commit` skill for what the types and scopes mean.

While this project is only days old, a 24-hour window can cover most of its history — the scaffold
commit is dated 2026-07-28 — so expect windows of 50+ commits and group hard rather than listing.
