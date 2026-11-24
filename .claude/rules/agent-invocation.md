# Agent Invocation Discipline

**Scope:** when Claude Code may spawn a subagent, `Task`, skill, or slash-command in this repo. This is the primary token-cost control. CLAUDE.md `# BEHAVIORAL RULES` cites it under `no_agent_without_trigger` / `explicit_activation_only`.

---

## The rule

Never spawn a subagent, `Task` tool call, skill, or slash-command on your own initiative. A subagent runs a whole separate model context — it is the single largest multiplier on token cost. Spawn one ONLY when the user explicitly invokes it in the current message. The exceptions are the rows of `.claude/rules/standing-exceptions.md`: the `use agents` trigger and `crew-explorer`.

## What counts as explicit activation

- The user types a slash-command or skill name (`/foo`, "run the X skill").
- The user names an agent ("use the debug agent", "spawn a reviewer", "fan out agents", "orchestrate this with subagents").
- The user asks, in their own words, for parallel or multi-agent work.
- The user's message contains the words "use agents": the main session may start any agent in `.claude/reference/agent-routing.md` for the work in that agent's row, without naming each one. The routing table decides which agent takes which work, how many copies run, and which agents run together.

Anything else — including a task that *would* benefit from an agent — is done INLINE.

## The one standing exception: `crew-explorer`

- `crew-explorer` (`.claude/agents/crew-explorer.md`) spawns without a trigger for a sweep that reads across several files.
- A lookup in one known file stays inline.
- The agent establishes codebase facts. It only reads and reports, and runs only the suites that rewrite no file, through the run lock.
- Every other agent, skill or command still needs a trigger in the current message: its name, or the words "use agents".

## The inline-first default

Everything a search/investigation agent would do, do directly:

- find files → `Glob`
- find code/text → `Grep` (narrow path + specific pattern)
- read a file → `Read`
- run or check → `Bash`

If a task feels large, decompose it into inline tool calls, not into agents. If you genuinely believe an agent is warranted, DESCRIBE what it would do and its rough token cost and ask first — do not spawn it.

## No standing permission

Approval to use an agent applies only to the message that gave it. Each spawn needs a fresh trigger in the current message; permission does not carry across turns. `crew-explorer` is the only standing permission.

## Why

Agent spawns duplicate context and multiply output tokens. This repo's Claude setup exists specifically to cut that cost. One targeted `Grep` answers most "where is X / how does Y work" questions for a fraction of the tokens an Explore/general agent would burn.

## Precedence

CLAUDE.md `# BEHAVIORAL RULES` > this digest > memory.
