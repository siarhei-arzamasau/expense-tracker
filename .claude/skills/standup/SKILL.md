---
name: standup
description: Summarize what was done in this repository over the last 24 hours, read from git history and grouped into standup notes. Use when asked for a standup, a daily update, or "what did I do yesterday/today".
model: sonnet
allowed-tools: Bash(git log:*), Bash(git show:*), Bash(git status:*), Bash(git branch:*), Bash(git diff:*), Bash(git config:*), Bash(git rev-list:*), Read, Grep, Glob
---

# Standup

Turn the last 24 hours of git history into a short, grouped account of what got done. The output is
for a human standing up in front of other humans — an outcome list, not a `git log` dump.

**Assume the room is mixed.** A product manager, a designer, or a client may be listening, and they
should follow every line without knowing this codebase. Write for them; the engineers in the room
will follow plain language too, while the reverse is not true.

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
- **`--shortstat`**, to gauge how much weight a commit carries — a 44-file commit is probably its
  own bullet, a 1-file commit probably folds into a neighbour. The numbers are for your judgement,
  not for the output; file counts and line counts never reach the notes.

`--since` filters on **committer** date, not author date. That is the same thing here — this
history has no rebases — but a rebased branch can shift commits into or out of the window, so check
`%aI` against `%cI` before trusting a boundary case.

Drop the `--author` filter only when the request is explicitly about the whole team.

The `%h` in that format is a working handle for step 3 only. It never appears in the notes.

## 3. Read past the subject lines

A commit subject is a label written by an engineer for engineers. It rarely says what changed for
the person using the app, which is the thing the notes have to say. So open anything you cannot
already describe in plain words:

```bash
git show --stat <sha>          # what it touched
git show <sha> -- <path>       # what it actually changed
```

Three habits matter here. Never paraphrase a subject you have not verified against the diff — a
standup that misreports the work is worse than a terse one, and because the notes carry no commit
hashes, nobody in the room can check a bullet against the source. Read the diff before deciding two
commits are one piece of work; adjacent subjects can look related and touch unrelated code. And
keep reading until you can name the effect, not just the mechanism: `feat(transactions): add
description search` is a mechanism, "you can now find an expense by typing part of its description"
is the effect.

## 4. Collect what is not committed

Commits are not the whole day. Two more reads:

```bash
git status --short --branch    # work in flight right now
git branch --no-merged main    # finished on a branch, not landed
```

Both feed the **In progress** section. Do not describe uncommitted files as done.

A branch name is an engineering artifact, so say what the branch _is_ rather than printing it —
read its commits with `git log main..<branch>` and describe them the same way you describe
everything else. Same for uncommitted files: "started on the monthly summary screen" tells the room
more than a list of paths does.

## 5. Write it

```markdown
## Standup — <date> (last 24 hours)

**Done**

- **Expense list** — You can now find an expense by typing part of its description, and asking for
  a page of results that does not exist no longer breaks the list.
- **Signing in and getting around** — Fixed paging through expenses, fixed signing out, and
  corrected the labels in the menu on phones. The parts that were breaking are now covered by
  automated checks, so they stay fixed.

**In progress**

- <plain description of the work> — finished, but not yet folded into the main line of work.
- Started and not yet finished: <plain description of what the uncommitted files are for>.
```

(The **Done** bullets are real work from this history, shown to fix the shape and the level of
detail. The **In progress** lines are placeholders — fill them from step 4, and drop either section
entirely when it has nothing in it.)

Rules for the bullets:

- **Group by area of work, not by chronology.** Lead each bullet with the area in bold, named the
  way a user of the app would name it — "Expense list", "Signing in", "Categories", "Reports". The
  Conventional Commit scope (`transactions`, `auth`, `shared`, `database`) tells you which area a
  commit belongs to; it is a lookup key, not the label you print.
- **One bullet per coherent piece of work, not per commit.** Four commits refining one file are one
  bullet. This is the whole job when the window is busy — a 50-commit window that becomes 50 bullets
  has not been summarized.
- **State outcomes in past tense, in plain language.** Translate the type prefix rather than
  reprinting it: `feat` became a capability, `fix` corrected a behaviour, `refactor` moved something
  without changing behaviour, `docs` recorded something.
- **No commit hashes, no file paths, no identifiers from the code.** Nobody in the room is going to
  open a diff, and a bullet ending in `(4315aac)` reads as noise to everyone who cannot. Say "the
  expense list", not `TransactionsController`; "how far back the report goes", not the `page`
  parameter. Never quote file counts or line counts.
- **Collapse the noise.** Formatting-only (`style`) commits, merge commits, and bot-authored
  workflow commits are worth at most one closing line, usually nothing.
- **English, always** — including when the request arrives in another language.

Two things not to do. **Do not invent a "Today" or "Blockers" section**: plans and blockers are not
in git, so include them only when the user supplies them. And **do not pad an empty window** — "no
commits in the last 24 hours" is a complete and correct standup.

## 6. Strip the jargon

Every term below appears in this repository's commit subjects, and none of them mean anything to a
non-engineer. Translate rather than reprint:

| In the commits                          | In the standup                                                   |
| --------------------------------------- | ---------------------------------------------------------------- |
| endpoint, API route, controller         | what the app can now do, show, or save                           |
| migration, schema, model, column        | what the app can now remember about an expense                   |
| DTO, validation, type                   | what the app accepts, and what it now rejects as invalid         |
| CQRS, repository, service, module       | (usually drop — say what it enabled, not how it is wired)        |
| refactor, extract, move                 | tidied up behind the scenes; nothing changed for anyone using it |
| unit tests, e2e, Vitest, Jest, coverage | automated checks, so this keeps working                          |
| Swagger, JSDoc, AGENTS.md               | written down for the people building it                          |
| CI, workflow, lint, formatter           | automated checks that run on every change                        |

Some work genuinely has no user-visible effect — a refactor, a documentation pass, a tooling
migration. Do not drop it and do not dress it up as a feature. Say what it makes possible or why it
was worth the day: "Reorganised how expenses are stored so that adding new kinds of reports later
is straightforward" is honest, useful, and understandable.

The test for any bullet: **could someone who has never seen this codebase repeat it back?** If not,
it is still a commit subject, not a standup line.

## Repository notes

Commit subjects follow Conventional Commits only from `2134288` onward. Of the 29 commits before
it, two are conventional and the rest are sentence-case with no type prefix
(`Add category management`). Parse a type and scope when they are there; describe the diff when they
are not. See the `commit` skill for what the types and scopes mean.

While this project is only days old, a 24-hour window can cover most of its history — the scaffold
commit is dated 2026-07-28 — so expect windows of 50+ commits and group hard rather than listing.
