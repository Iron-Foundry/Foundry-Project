---
name: agent-authoring
description: The runtime contract for authoring or auditing a subagent or a skill - which frontmatter fields exist, which are delivered, what reaches a subagent at startup, and which tools are silently removed. Use before writing, reviewing, correcting or auditing any file under .claude/agents/ or .claude/skills/, and whenever a spec's field appears not to take effect.
user-invocable: false
---

# agent-authoring

**This carries what an author or auditor must not get wrong, and it does not restate the runtime's field
list** — that list belongs to the runtime's own documentation, which changes on the runtime's schedule
rather than ours. Where the package ships a vendored copy of that documentation it sits in the upstream
tree the configuration declares; where it does not, the runtime's published reference is the source. **The
directory is named by its slot rather than by a literal, because a citation carrying this package's own
folder name resolves only in the host that happens to use that name.**

## The delivery rule — the thing most specs get wrong

**The BODY becomes the system prompt. Frontmatter is configuration, not instruction.** A directive
written into frontmatter governs nothing at invocation, and it reads as governing.

**A subagent's startup context is a CLOSED list:**

| arrives | notes |
|---|---|
| the agent's own body as system prompt, plus environment details | never the full host system prompt |
| the delegation message | written by whoever spawned it |
| every level of the `CLAUDE.md` hierarchy, including project rules | Explore and Plan skip this; no field changes that |
| a git-status snapshot from the parent session's start | |
| **full content of every skill named in `skills:`** | the only agent-only, per-agent channel |
| a sibling roster | only when `SendMessage` is in tools and another agent is named |

**Never arrives:** the parent's conversation, its output style, its auto memory, any file it read —
and **no coordination surface**. A party that needs a shared file opens it.

## A SEAT and an INVOCABLE AGENT are different objects and only one has a letter

**A file under `.claude/agents/` is a bounded invocation, never a seat.** It has no letter, no board
record, no role document and no place in any reader set — and the `role` gate does not reach it,
because that gate derives its roster from the board's own `— ACTIVE` records rather than from the
agents directory.

| | seat | invocable agent |
|---|---|---|
| identity | a letter, allocated in `_agent-index.md` and reissued once its seat departs | a `name:`, resolved per invocation |
| declaration | a role document under the roles directory the configuration resolves, gated | its own body, which IS the system prompt |
| receives the board | yes, and reads it whole | **never** — only the `collab-status` projection, as injected context |
| ends its turn | never; it waits with a command | **always**, and returning is the contract |

**THE TURN-OWNING RULES INVERT RATHER THAN LAPSE.** *Never end a turn to wait*, *flow until the queue
is empty* and *quiet is not permission to report* all bind a seat. Written into an invocable agent's
body they forbid the one thing it exists to do. **An inert rule does nothing; an inverted one is
actively wrong while reading as governed**, which is why this distinction belongs at authoring time
rather than in a review.

**And the projection is the whole of what it knows about the board.** A blocker not named in that one
line does not exist for anything spawned, however loudly the board carries it.

## Fields whose behaviour is not what the name suggests

- **`initialPrompt`** applies only when the agent runs as the MAIN SESSION AGENT. **For a subagent
  invocation it does nothing** — it is scoped, not dropped, and a repair written there is inert for the
  invocation path.
- **`name` is the identity; the filename need not match it.** Hooks receive it as the agent type. A
  name containing `:` is not loaded at all.
- **`model` defaults to `inherit`** and is overridden by an environment variable and a per-invocation
  parameter before the frontmatter is consulted.
- **`skills:` preloads FULL content.** A skill with `disable-model-invocation: true` **cannot be
  preloaded** — the flag silently removes the channel.
- **`description` is the delegation trigger.** With `when_to_use` it is truncated at 1,536 characters
  in the listing, so the key case goes first.

## Tools are removed twice, and the second removal is silent

**Removed from every subagent** regardless of the `tools` field: `AskUserQuestion`, `EndConversation`,
`EnterPlanMode`, and `Agent` at the depth limit. **So a rule about how to ask the user is vacuous
inside a subagent** — it has no channel to one.

**A BACKGROUND subagent keeps every MCP tool and only these built-ins:** `Read`, `Grep`, `Glob`,
`Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`,
`ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`.

**Everything else is removed with no error**, whether inherited or explicitly listed, unless the list
resolves to nothing. **The same definition resolves to different tools in foreground and background** —
so a loop that depends on a tool outside that set works when run in the foreground and silently fails
to when backgrounded.

## Authoring rules that follow

1. **Put every binding instruction in the body.** Frontmatter for configuration only.
2. **Declare non-goals in the body**, where they arrive, and place them before the node that selects
   the work — a non-goal read after selection excludes nothing that has not already been paid for.
3. **Honour an ABSENT slot explicitly**, or do not name it. A gate written over a slot that may be
   ABSENT has no satisfiable state and **can only be met by fabricating its evidence**. Deriving the
   check list from the binding is correct; adding *or declared ABSENT* makes the check saturate.
4. **A check over a slot resolving ABSENT is NOT EMITTED**, rather than emitted with an escape clause.
5. **Never hardcode a runtime path in a contract that declares itself portable** — name a slot.
6. **State the trust anchor and every deviation.** Holding no position is a first-class output.

## Skills

**Content persists in context for the whole session once loaded**, so every line is a recurring cost
paid once per reader. Write standing instructions rather than one-time steps; the file is not re-read.

- `user-invocable: false` for background knowledge a person should not invoke directly.
- `allowed-tools` grants for the invoking turn only; the grant clears on the next message.
- `context: fork` runs the skill as a subagent with the SKILL.md content as the task — **meaningless
  for reference content, which carries no task.**
- Reference content runs inline; task content is usually `disable-model-invocation: true` and invoked
  by name — **which also forfeits preloading.**

## What a plugin changes

**Plugin subagents IGNORE `permissionMode`, `mcpServers` and `hooks`.** Packaging agents that rely on
any of those silently drops them. Standalone configuration is for project-specific work; a plugin is a
distribution mechanism.

## When a field appears not to take effect

Check delivery before checking correctness. **A spec edit is picked up within seconds without a
restart**, with two exceptions: a scope's `agents` directory that did not exist when the session
started, and a session launched with slash commands disabled. **A definition read before an edit
lands is stale for that invocation and passes every check on disk.**
