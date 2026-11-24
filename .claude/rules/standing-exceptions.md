# Standing exceptions

**Scope:** the only places where a session may do, without a trigger in the current message, something the workspace's base rules otherwise forbid: start an agent, run git, or start a continuous process. Each row names the base rule it narrows and the exact act it permits. Nothing outside a row is permitted. `CLAUDE.md` cites this digest wherever a base rule names a standing exception.

---

## The rows

| row | base rule it narrows | the act it permits |
| --- | --- | --- |
| agent invocation | the ban on starting an agent, skill or workflow without a trigger | the words "use agents" in the operator's current message start any agent in `.claude/reference/agent-routing.md` for its row's work, for that message only. `crew-explorer` starts without a trigger for a sweep that reads across several files. Every other agent, skill and workflow still needs its name in the current message |
| investigatory git | the ban on git without a literal request | `crew-explorer` runs the read-only git forms its own file lists, scoped to a path, and never one that writes. Git output never stands in for the disk |
| release git | the ban on git without a literal request | on the operator's literal commit request, `crew-release` groups the changed files by tree and feature, drafts each subject, has `crew-wording` reword them, then stages each group by path and commits it alone. It pushes only when the same request says push |
| reference clone | the ban on git without a literal request | a session and `crew-researcher` may run `git clone --depth 1` into the reference clone root named in `.claude/rules/work-discipline.md`, and nowhere else |
| the preview server | the ban on starting a continuous process | when the previewbench app does not answer on `http://localhost:3001`, `python -m http.server 3001 --bind localhost --directory previews` runs in the background the turn a preview is written, per `a_preview_is_served` in `.claude/rules/look-and-feel.md`. The previewbench app itself, and every other continuous process, stays the operator's |

## Adding a row

A new standing exception is the operator's decision. It lands here as one row naming the base rule and the exact act, in the change that relies on it. An exception stated anywhere else is not one.

## Precedence

`CLAUDE.md` > this digest > the agent files > memory.
