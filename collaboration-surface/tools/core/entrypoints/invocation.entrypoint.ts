import { readSurface } from "../readers/surface.reader.ts";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { suites } from "../../../config/join.config.ts";
import { projectRoot, surfaceRoot } from "../../../config/surface.config.ts";
import { shellArgument } from "../formatters/invocation.formatter.ts";
import {
    filteredDeliveries,
    matchedSuites,
    type DeclaredSuite,
    type SuiteMatch,
} from "../matchers/invocation.matcher.ts";

const STANDARD_INPUT = 0;

const SHELL_TOOL = "Bash";

const WINDOWS = "win32";

function field(record: unknown, key: string): unknown {
    return typeof record === "object" && record !== null ? (record as Record<string, unknown>)[key] : undefined;
}

function posix(path: string): string {
    let out = "";
    for (const character of path) out += character === "\\" ? "/" : character;
    return out;
}

function declared(): DeclaredSuite[] {
    const root = projectRoot();
    return Object.entries(suites).map(([id, declaration]) => ({
        id,
        tree: resolve(root, declaration.tree),
        command: declaration.command,
    }));
}

function instruction(match: SuiteMatch): string {
    const extra = match.extra.length === 0 ? "" : ` -- ${match.extra.map(shellArgument).join(" ")}`;
    return `npm --prefix "${posix(surfaceRoot())}" run join -- --suite ${match.id}${extra}`;
}

function refusal(matches: readonly SuiteMatch[]): string {
    const ids = matches.map((match) => match.id).join(", ");
    const commands = matches.map((match) => `  ${instruction(match)}`).join("\n");
    return (
        `This command runs the declared suite ${ids}. No two sessions run one suite at the same time, so a suite ` +
        "runs through the shared run lock. The lock starts the run when nobody holds it. When another session " +
        "is already running it, the lock waits for that run and hands back its output and exit code, so the " +
        `result is the same and the tree is measured once. Run this instead:\n${commands}\n` +
        "Add --agent <label> after the suite id to name this session to the others."
    );
}

function deliveryRefusal(clauses: readonly string[]): string {
    const listed = clauses.map((clause) => `  ${clause}`).join("\n");
    return (
        "This command sends the output of a run-lock join through a pipe or a redirect. The join delivers the " +
        "whole output of the suite, and a filter after it drops part of that output before anyone reads it. Run " +
        "the join with nothing after it and read its output whole. The run also keeps its whole output in a log " +
        `file, so a second read goes to that file instead of through a filter. The filtered command is:\n${listed}`
    );
}

function deny(reason: string): void {
    process.stdout.write(
        `${JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: reason,
            },
        })}\n`,
    );
}

function main(): void {
    const input: unknown = JSON.parse(readSurface(STANDARD_INPUT, "utf8"));
    if (field(input, "tool_name") !== SHELL_TOOL) return;

    const command = field(field(input, "tool_input"), "command");
    if (typeof command !== "string") return;

    const cwd = field(input, "cwd");
    const here = typeof cwd === "string" ? cwd : process.cwd();
    const caseless = process.platform === WINDOWS;

    const filtered = filteredDeliveries(command, here, surfaceRoot(), homedir(), caseless);
    if (filtered.length > 0) {
        deny(deliveryRefusal(filtered));
        return;
    }

    const matches = matchedSuites(command, here, declared(), homedir(), caseless);
    if (matches.length === 0) return;
    deny(refusal(matches));
}

main();
