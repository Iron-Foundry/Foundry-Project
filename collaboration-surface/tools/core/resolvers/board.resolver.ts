import { blockOf } from "../transformers/board.transformer.ts";
import { ACTIVE_STATE, seatState } from "../analyzers/board.analyzer.ts";

const INACTIVE = "INACTIVE";
const AGENT_HEADING = "Agent ";

export function activeLetters(source: string, index: string): ReadonlySet<string> {
    const active = new Set<string>();
    const stateOf = seatState(index);

    for (const line of source.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(AGENT_HEADING)) continue;

        const rest = trimmed.slice(AGENT_HEADING.length).trim();
        const space = rest.indexOf(" ");
        const letter = space === -1 ? rest : rest.slice(0, space);
        if (letter.length === 0) continue;

        const marker = trimmed.includes(INACTIVE) ? INACTIVE : ACTIVE_STATE;
        if (stateOf(letter, marker) !== ACTIVE_STATE) continue;

        active.add(letter);
    }

    return active;
}

export interface SpanConflict {
    readonly overlapping: boolean;
    readonly added: readonly string[];
    readonly removed: readonly string[];
}

function spanLines(source: string, agent: string): string[] | null {
    const span = blockOf(source, agent);
    if (span === null) return null;

    return source.split("\n").slice(span.from - 1, span.to);
}

function difference(from: readonly string[], against: readonly string[]): string[] {
    const held = new Set(against);
    return from.filter((line) => !held.has(line) && line.trim().length > 0);
}

export function dropItemSpan(source: string, key: string): { text: string; removed: number } | null {
    const span = blockOf(source, key);
    if (span === null) return null;

    const lines = source.split("\n");
    const kept = [...lines.slice(0, span.from - 1), ...lines.slice(span.to)];

    return { text: kept.join("\n"), removed: lines.slice(span.from - 1, span.to).join("\n").length };
}

export function compareSpans(before: string, witness: string, agent: string): SpanConflict {
    const was = spanLines(before, agent);
    const now = spanLines(witness, agent);

    if (was === null || now === null) {
        return { overlapping: true, added: [], removed: [] };
    }

    const added = difference(now, was);
    const removed = difference(was, now);

    return { overlapping: added.length > 0 || removed.length > 0, added, removed };
}
