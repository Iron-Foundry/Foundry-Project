# Agent Invocation Discipline

**Scope:** when Claude Code may spawn a subagent, `Task`, skill, or slash-command in this repo. This is the primary token-cost control. CLAUDE.md `# WORK DISCIPLINE` cites it under `no_agent_without_trigger` / `explicit_activation_only`.

---

## The rule

Never spawn a subagent, `Task` tool call, skill, or slash-command on your own initiative. A subagent runs a whole separate model context — it is the single largest multiplier on token cost. Spawn one ONLY when the user explicitly invokes it in the current message.

## What counts as explicit activation

- The user types a slash-command or skill name (`/foo`, "run the X skill").
- The user names an agent ("use the debug agent", "spawn a reviewer", "fan out agents", "orchestrate this with subagents").
- The user asks, in their own words, for parallel or multi-agent work.

Anything else — including a task that *would* benefit from an agent — is done INLINE.

## The inline-first default

Everything a search/investigation agent would do, do directly:

- find files → `Glob`
- find code/text → `Grep` (narrow path + specific pattern)
- read a file → `Read`
- run or check → `Bash`

If a task feels large, decompose it into inline tool calls, not into agents. If you genuinely believe an agent is warranted, DESCRIBE what it would do and its rough token cost and ask first — do not spawn it.

## No standing permission

Approval to use an agent applies only to the message that gave it. Each spawn needs a fresh trigger in the current message; permission does not carry across turns.

## Why

Agent spawns duplicate context and multiply output tokens. This repo's Claude setup exists specifically to cut that cost. One targeted `Grep` answers most "where is X / how does Y work" questions for a fraction of the tokens an Explore/general agent would burn.

## Precedence

CLAUDE.md `# WORK DISCIPLINE` > this digest > memory.
