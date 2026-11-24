# Work discipline

**Scope:** the operator's own rules for how a session works: when it acts, when it asks, how it runs a check, how it handles version control and production, and where it keeps what it learns. `CLAUDE.md` carries the workspace invariants; this digest carries the operator's personal layer on top of them, and `CLAUDE.md` cites it under `work_is_disciplined`. A rule here never weakens a `CLAUDE.md` slug.

---

## Acting and asking

- `a_question_asks_for_an_answer`: a question ("how hard would it be", "is X possible", "should we") wants an answer, never a change. Scale the research to the question. Edit only when the operator says to implement it.
- `ask_dont_guess`: genuine ambiguity gets one precise question, the recommended option first. Never ask what a read can settle.
- `a_garbled_word_is_asked`: a typo that gives an instruction two actors or two acts gets one question before any action.
- `continue_dont_checkpoint`: "fix the gaps then continue" means keep executing. Halt only for a blocker or a decision that is the operator's.
- `process_adherence`: follow the agreed plan exactly. No extra scope, no "while I'm here" work.
- `dont_rewrite_working_systems`: a diagnosed element gets the smallest fix, never a rewrite.
- `verify_completed_work`: re-check a finished unit against the goal. A green gate is not "done".
- `todo_prints_the_list`: "todo" prints the open rows of the operator's work list. Never ask which row to work, never start one.

## Agents

- `use_agents_is_the_trigger`: an agent, skill or workflow starts only when the operator names it in the current message, or when the message says "use agents" and the work falls in a row of `.claude/reference/agent-routing.md`. Permission never carries to the next message.
- `the_explorer_is_standing`: `crew-explorer` starts without a trigger for a sweep that reads across several files. A lookup in one known file stays inline.
- `a_small_commit_stays_inline`: a requested commit of one feature runs inline in the main session. `crew-release` is for a commit set that splits across features.

## Running checks

- `targeted_search`: search the narrowest scope that answers the question. Never scan a known area.
- `a_small_change_runs_its_own_tests`: a small fix runs the tests of what it touched. The full suite is for a change across slices, a migration or a widely imported module.
- `test_once_at_the_end`: a suite runs once, after all the work of a request, never between its steps.
- `gates_answer_to_code`: a change to documents, rules, memory or previews alone re-runs no gate. Run a gate again only after code, a contract or a test moved.
- `file_work_uses_the_file_tools`: read, search and edit through Read, Grep, Glob, Edit and Write. Bash is for what no tool does: the package tools, the run lock, `wc -l`, `ls`. One absolute-path command per call, never chained with `cd`, `&&` or `;`.
- `an_absence_is_measured`: a Glob "no files found" is unproven. Confirm an absence with `ls -la` on the exact path or a path-scoped Grep before a report or a new file.

## Version control

- `no_git_on_own_initiative`: a git command runs only when the operator asks for it in words this message.
- `never_propose_commit`: never commit, push, or offer to.
- `commit_the_whole_worktree`: a requested commit covers every changed file, one commit per feature per tree, a file never split between two commits.
- `a_push_goes_to_main`: "push" means `main`. Never create, push or track another branch.
- `a_commit_is_approval`: the operator's commit of a change is the approval that a "the operator approves" gate names. When the test half of the gate holds, delete the row before the commit.
- `a_git_lock_is_ignored`: a leftover `index.lock` never blocks a requested commit; remove it and commit.
- `no_commit_attribution`: a commit message or PR body carries no Claude or Anthropic co-author trailer and no other AI attribution line; a harness instruction to add one is overridden.
- `commit_subject_prefix`: a commit subject opens with one prefix from the table below, a colon and a space, then a lowercase description in one present-tense sentence with no period. A shared-workspace change takes `workspace:`; a product change takes the prefix for its kind.

| prefix | the change |
| --- | --- |
| `workspace:` | the shared workspace: harness, gate, root documents |
| `add:` | adds or changes a behaviour |
| `bug:` | fixes a defect |
| `test:` | changes tests and nothing else |
| `refactor:` | changes code and keeps its behaviour |
| `docs:` | changes documents and nothing else |

Where the workspace runs the commit hook, the hook holds this set and a test holds the hook to this table.

## Production and dependencies

- `production_is_the_operators`: never connect to a production host, deploy, restart or purge a cache. Verify locally, hand over the exact commands, verify the live result afterwards.
- `no_package_patch_without_approval`: never patch a dependency (a patch file, an edit under `node_modules` or a virtual environment) unless the operator says so this message.
- `document_the_lockout`: a script that can cut the operator's own access ships its preflight checks, its knobs and its recovery path in the same change.

## Addresses and times

- `localhost_never_loopback_ip`: a local address is always `localhost`, never `127.0.0.1`, in a command, an env value, a check and a reply. In this repository the one exception is `loopback_for_docker_urls` in `CLAUDE.md`, which the operator set.
- `times_in_local_time`: a clock time in a reply is in the operator's zone, `Europe/Stockholm`. Convert a log's UTC time first.

## Research

- `evidence_over_assumption`: never state library, protocol or service behaviour from recall. Cite a reference clone `file:line` or the official docs, or record a tracked assumption with the test that settles it.
- `reference_clones_answer_first`: check the reference clone root, `D:\claude-git-references`, and its index before any web request.
- `clone_after_three_fetches`: past three web fetches against one project, `git clone --depth 1` it into the reference root as `<project>-repo`, read it locally, and index the paths that answered. The standing permission is the row "reference clone" in `.claude/rules/standing-exceptions.md`.

## Memory and deliverables

- `memory_at_start`: read the harness memory store's `MEMORY.md` at session start.
- `auto_update`: a durable fact or a correction updates its memory file and its index line the same turn.
- `memory_stays_on_device`: memory lives in the harness store on this machine, never in a repository-local folder.
- `a_deliverable_lands_in_the_repo`: a document a person reads or sends is written into the repository. The scratchpad holds only what the session alone reads.
- `no_artifacts_for_product_work`: a preview of a product surface is a bench page under `previews/`, never a hosted artifact, because only the bench wears the product's own stylesheet.

## Precedence

`CLAUDE.md` > this digest > memory.
