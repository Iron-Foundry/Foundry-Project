import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";

import { READ_BUDGET_CHARS } from "../constants/board.constants.ts";
import { diffLines } from "../formatters/text.formatter.ts";
import { fencedFlags } from "../predicates/fence.predicate.ts";
import {
    pruneUnkeyedSnapshots,
    readSnapshot,
    recordDelivered,
    writeSnapshot,
} from "../registries/snapshot.registry.ts";
import { itemSpans } from "../resolvers/sweep.resolver.ts";

function keysAddressing(source: string, agent: string): string[] {
    const out: string[] = [];
    for (const span of itemSpans(source)) {
        if (span.to.length > 0 && !span.to.includes(agent)) continue;
        out.push(span.key);
    }
    return out;
}

const OPEN_MARKER = "┌";

function fencedTexts(source: string): Set<string> {
    const lines = source.split("\n");
    const flags = fencedFlags(source);
    const out = new Set<string>();

    for (let index = 0; index < lines.length; index += 1) {
        if (flags[index] !== true) continue;
        const text = (lines[index] ?? "").trim();
        if (text.length > 0) out.add(text);
    }

    return out;
}

function degradedDelivery(
    changes: readonly string[],
    agent: string,
    target: string,
    size: number,
    specimens: ReadonlySet<string>,
): string {
    const moved: string[] = [];

    for (const line of changes) {
        const at = line.indexOf(OPEN_MARKER);
        if (at === -1) continue;

        const fence = line.slice(at).trim();
        if (specimens.has(fence)) continue;
        moved.push(`  ${line.slice(0, 1)} ${fence}\n`);
    }

    const head =
        `SINCE AGENT ${agent} LAST LOOKED — ${String(changes.length)} changed line(s), ${String(size)} characters, ` +
        `which is past what one read consumes. THE DIFF IS DEGRADED RATHER THAN TRUNCATED: what a wait exists to ` +
        `deliver is WHAT MOVED, so every changed item is named below by its own fence and the BODIES are left in ` +
        `${target}, which is one read away and is the state rather than a rendering of it. A silent truncation would ` +
        `hand you a partial read that looks complete, which is the worse of the two failures — this hands you less and ` +
        `says so.\n`;

    if (moved.length === 0) {
        return (
            `${head}  No fenced item opened or closed in this window, so the change is inside existing records — ` +
            `read ${target} directly rather than a rendering of it.\n`
        );
    }

    return `${head}${moved.join("")}`;
}

export function changesSince(repoRoot: string, absolute: string, agent: string, target: string): string {
    if (!existsSync(absolute)) return "";

    const now = readSurface(absolute, "utf8");
    const seen = readSnapshot(repoRoot, agent, target);
    writeSnapshot(repoRoot, agent, target, now);
    pruneUnkeyedSnapshots(repoRoot);

    if (seen === null) {
        return `SNAPSHOT  first read for AGENT ${agent}; the next call reports everything that changed since\n`;
    }

    const changes = diffLines(seen, now);
    recordDelivered(repoRoot, agent, keysAddressing(now, agent));
    if (changes.length === 0) {
        return `UNCHANGED  nothing on ${target} moved since AGENT ${agent} last looked\n`;
    }

    const lines = [`SINCE AGENT ${agent} LAST LOOKED — ${String(changes.length)} changed line(s)\n`];
    for (const line of changes) lines.push(`  ${line}\n`);

    const rendered = lines.join("");
    if (rendered.length <= READ_BUDGET_CHARS) return rendered;

    return degradedDelivery(changes, agent, target, rendered.length, fencedTexts(now));
}
