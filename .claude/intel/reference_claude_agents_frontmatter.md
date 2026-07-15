---
name: claude-agents-frontmatter
description: The Claude Code custom-agent/subagent YAML frontmatter contract — the supported fields, which are required, and each field's valid values and types. The reference the doc-arch agent-schema validator enforces.
type: reference
---

Anthropic’s current Claude Code documentation lists **16 supported YAML frontmatter fields** for custom agents/subagents. Only `name` and `description` are required. ([Claude][1])

| Field             | Required | Type / valid values                                                                                                                                                             |
| ----------------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            |      Yes | String using lowercase letters and hyphens. It is the agent’s actual identifier; the filename does not need to match.                                                           |
| `description`     |      Yes | String describing when Claude should delegate to the agent.                                                                                                                     |
| `tools`           |       No | Tool allowlist. Accepts available tool names and tool rules, such as `Read`, `Grep`, `Bash(git diff *)`, or MCP tool patterns. If omitted, the agent inherits all parent tools. |
| `disallowedTools` |       No | Tool denylist using the same syntax as `tools`. Takes precedence over `tools`.                                                                                                  |
| `model`           |       No | `inherit`, `sonnet`, `opus`, `haiku`, `fable`                                                                                                                                   |
| `permissionMode`  |       No | `default`, `manual`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, or `plan`. `manual` is an alias for `default` and requires Claude Code 2.1.200+.                    |
| `maxTurns`        |       No | Integer limiting the number of agentic turns. Anthropic does not document a specific numeric range.                                                                             |
| `skills`          |       No | YAML list of skill names to preload, such as `[api-conventions, testing]`.                                                                                                      |
| `mcpServers`      |       No | YAML list containing configured MCP server names or inline MCP definitions. Inline server types: `stdio`, `http`, `sse`, or `ws`.                                               |
| `hooks`           |       No | Mapping of lifecycle events to matcher groups and hook handlers. Handler types: `command`, `http`, `mcp_tool`, `prompt`, or `agent`.                                            |
| `memory`          |       No | `user`, `project`, or `local`.                                                                                                                                                  |
| `background`      |       No | Boolean. `true` forces the agent to run in the background; when omitted, Claude chooses.                                                                                        |
| `effort`          |       No | `low`, `medium`, `high`, `xhigh`, or `max`. Availability depends on the selected model. Default: inherit the session effort.                                                    |
| `isolation`       |       No | `worktree`. Omit the field for normal, non-worktree execution.                                                                                                                  |
| `color`           |       No | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, or `cyan`.                                                                                                        |
| `initialPrompt`   |       No | String automatically submitted as the first user turn when the agent runs as the main session through `--agent` or the `agent` setting.                                         |

The enumerated model, permission, memory, effort, isolation, color, and initial-prompt values above come directly from the supported-fields table. ([Claude][1])

### Tool values

`tools` and `disallowedTools` can be written as a comma-separated scalar:

```yaml
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
```

or as YAML lists:

```yaml
tools:
    - Read
    - Grep
    - Glob
    - Bash(git diff *)
```

Claude Code uses exact tool names such as `Agent`, `Bash`, `Edit`, `Glob`, `Grep`, `LSP`, `NotebookEdit`, `PowerShell`, `Read`, `Skill`, `WebFetch`, `WebSearch`, and `Write`. The available set can depend on version, platform, session state, and connected MCP servers. Tool restrictions also accept permission-rule syntax such as `ToolName(specifier)`. ([Claude][2])

For MCP tools, these forms are supported:

```yaml
tools:
    - mcp__github
    - mcp__github__*
```

```yaml
disallowedTools:
    - mcp__*
```

A tool in both `tools` and `disallowedTools` is denied. ([Claude][1])

Several UI/session-dependent tools are unavailable to normal subagents even when listed: `AskUserQuestion`, `EnterPlanMode`, `ScheduleWakeup`, and `WaitForMcpServers`; `ExitPlanMode` is available only when `permissionMode: plan`. ([Claude][1])

### Permission-mode behavior

| Value                | Behavior                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `default` / `manual` | Normal permission checking and prompts                                                     |
| `acceptEdits`        | Automatically accepts file edits and common filesystem operations in permitted directories |
| `auto`               | Uses Claude Code’s background command classifier                                           |
| `dontAsk`            | Automatically denies operations that would require a prompt                                |
| `bypassPermissions`  | Skips most permission prompts                                                              |
| `plan`               | Read-only planning and exploration                                                         |

A parent session running in `bypassPermissions`, `acceptEdits`, or `auto` can override the subagent’s requested mode. ([Claude][1])

### MCP server syntax

Reference an existing server:

```yaml
mcpServers:
    - github
    - slack
```

Define one inline:

```yaml
mcpServers:
    - playwright:
          type: stdio
          command: npx
          args:
              - -y
              - "@playwright/mcp@latest"
```

Inline definitions use the same schema as `.mcp.json`. Supported transport types are `stdio`, `http`, `sse`, and `ws`. ([Claude][1])

### Hooks syntax

```yaml
hooks:
    PreToolUse:
        - matcher: Bash
          hooks:
              - type: command
                command: ./scripts/validate-command.sh
                timeout: 30
```

All Claude Code hook events are supported in agent frontmatter. Hook handlers may use `command`, `http`, `mcp_tool`, `prompt`, or `agent`; matcher values can be exact strings, `|`/`,`-separated values, or JavaScript regular expressions depending on the characters used. ([Claude][3])

### Complete example

```markdown
---
name: code-reviewer
description: Reviews completed code changes for correctness, security, and maintainability
tools:
    - Read
    - Grep
    - Glob
    - Bash(git diff *)
disallowedTools:
    - Write
    - Edit
model: sonnet
permissionMode: dontAsk
maxTurns: 20
skills:
    - coding-standards
memory: project
background: true
effort: high
isolation: worktree
color: purple
hooks:
    PreToolUse:
        - matcher: Bash
          hooks:
              - type: command
                command: .claude/hooks/check-readonly-command.sh
---

You are a senior code reviewer.

Review the supplied changes for correctness, security vulnerabilities,
regressions, missing tests, and maintainability problems.
```

Two caveats:

1. For agents distributed through a plugin, `hooks`, `mcpServers`, and `permissionMode` are ignored for security reasons. ([Claude][1])
2. With `claude --agents '{...}'`, the JSON accepts the same configuration fields plus `prompt`; the JSON object key acts as the agent name, while `prompt` replaces the Markdown body. ([Claude][1])

[1]: https://code.claude.com/docs/en/sub-agents "Create custom subagents - Claude Code Docs"
[2]: https://code.claude.com/docs/en/tools-reference "Tools reference - Claude Code Docs"
[3]: https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"
