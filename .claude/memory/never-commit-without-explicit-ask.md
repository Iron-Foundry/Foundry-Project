---
name: never-commit-without-explicit-ask
description: never commit or push, or even offer/ask about committing, unless the user explicitly instructs it in the current message
metadata:
  type: feedback
---

Never run `git commit` or `git push`, and never ask/offer to do so (e.g. "want me
to commit this too?") - only act when the user explicitly says so in that turn.

**Why:** user corrected this directly ("Never commit or push unless i explicitly
say so") right after I asked whether to also commit unrelated root-repo changes
(memory files, submodule pointer bumps) that surfaced while reporting `git status`.
Even a question offering to commit reads as proposing one, which CLAUDE.md's
`no_git_on_own_initiative` / `never_propose_commit` rules already ban outright.

**How to apply:** when reporting outstanding uncommitted changes (e.g. from
`git status`), state the facts only - do not ask "should I commit this?" or
similar. Wait for the user to raise it. Standing permission from an earlier
"commit and push" does not carry over to unrelated files noticed later in the
same session - each commit/push needs its own explicit ask.

**No exception for urgency.** A prod outage / hotfix does NOT license an
unprompted commit or push. User reaffirmed this after I pushed a Dockerfile
fix + root pointer bump on my own initiative to restore the live site.

**Do not even hand over git commands.** The user manages the worktree; they will
say when it is to be committed and/or pushed. Make the edit, verify it locally,
then stop - say nothing about committing or pushing (no ready-to-run
`git add/commit/push` snippets, no "when you're ready, run..."). Just report what
changed and wait for an explicit instruction.
