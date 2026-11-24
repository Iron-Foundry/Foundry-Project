import { delimitersIn } from "../analyzers/board.analyzer.ts";
import { fencedFlags } from "../predicates/fence.predicate.ts";
import { itemSpans } from "../resolvers/sweep.resolver.ts";

const POSITION_OPENER = "Position ";

const FIELD_INDENT = "  ";

export interface SchemaGap {
    readonly record: string;
    readonly field: string;
    readonly declared: readonly string[];
    readonly state: "undeclared" | "absent";
}

export function venueFieldsFrom(template: string): string[] {
    const lines = template.split("\n");
    const fenced = fencedFlags(template);
    const out: string[] = [];
    let inside = false;

    for (let index = 0; index < lines.length; index += 1) {
        if (fenced[index] !== true) continue;

        const line = lines[index] ?? "";
        const trimmed = line.trim();

        if (trimmed.startsWith("Agent ")) {
            inside = true;
            continue;
        }
        if (trimmed.startsWith("└───")) {
            inside = false;
            continue;
        }
        if (!inside || !line.startsWith(FIELD_INDENT)) continue;

        const colon = trimmed.indexOf(":");
        if (colon <= 0) continue;

        const field = trimmed.slice(0, colon).trim();
        if (field.includes(" ")) continue;
        if (!out.includes(field)) out.push(field);
    }

    return out;
}

function absentFields(record: string, seen: ReadonlySet<string>, declared: readonly string[]): SchemaGap[] {
    if (record.length === 0) return [];

    const out: SchemaGap[] = [];
    for (const field of declared) {
        if (seen.has(field)) continue;
        out.push({ record, field, declared, state: "absent" });
    }

    return out;
}

export function venueSchemaGaps(source: string, template: string): SchemaGap[] {
    const declared = venueFieldsFrom(template);
    if (declared.length === 0) return [];

    const lines = source.split("\n");
    const fenced = fencedFlags(source);
    const out: SchemaGap[] = [];
    let record = "";
    let seen = new Set<string>();

    for (let index = 0; index < lines.length; index += 1) {
        if (fenced[index] === true) continue;

        const line = lines[index] ?? "";
        const trimmed = line.trim();

        if (line.startsWith("Agent ")) {
            out.push(...absentFields(record, seen, declared));
            record = trimmed;
            seen = new Set<string>();
            continue;
        }
        if (line.startsWith("└───")) {
            out.push(...absentFields(record, seen, declared));
            record = "";
            seen = new Set<string>();
            continue;
        }
        if (record.length === 0 || !line.startsWith(FIELD_INDENT)) continue;
        if (line.startsWith(`${FIELD_INDENT} `)) continue;

        const colon = trimmed.indexOf(":");
        if (colon <= 0) continue;

        const field = trimmed.slice(0, colon).trim();
        if (field.includes(" ")) continue;
        if (declared.includes(field)) {
            seen.add(field);
            continue;
        }

        out.push({ record, field, declared, state: "undeclared" });
    }

    out.push(...absentFields(record, seen, declared));

    return out;
}

const CONTRADICTS_LEAD = "Contradicts:";

const FIELD_BLOCK_LEAD = "carries these fields";

export function positionFieldLabels(template: string): string[] {
    const lines = template.split("\n");
    const out: string[] = [];
    let open = false;

    for (const line of lines) {
        if (!open) {
            if (line.includes(FIELD_BLOCK_LEAD)) open = true;
            continue;
        }

        const trimmed = line.trim();
        const colon = trimmed.indexOf(":");
        const label = colon <= 0 ? "" : trimmed.slice(0, colon);

        let word = "";
        for (const char of label) {
            const upper = char >= "A" && char <= "Z";
            const lower = char >= "a" && char <= "z";
            if (!upper && !lower) {
                word = "";
                break;
            }
            word += char;
        }

        if (word.length === 0) {
            if (out.length > 0) break;
            continue;
        }

        if (word !== SIGNED_WORD) out.push(word);
    }

    return out;
}

const SIGNED_WORD = "Signed";

export const SIGNED_LEAD = "Signed:";

function isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
}

function citesOwnLetter(clause: string, letter: string): boolean {
    for (let index = 0; index < clause.length; index += 1) {
        if (clause.charAt(index) !== letter) continue;

        const before = index === 0 ? " " : clause.charAt(index - 1);
        if (before >= "A" && before <= "Z") continue;
        if (before >= "a" && before <= "z") continue;

        let cursor = index + 1;
        if (clause.charAt(cursor) === "-") cursor += 1;
        if (!isDigit(clause.charAt(cursor))) continue;

        return true;
    }

    return false;
}

export function selfCorrections(source: string): string[] {
    const lines = source.split("\n");
    const out: string[] = [];

    for (const span of itemSpans(source)) {
        const body = lines.slice(span.from, span.through).join(" ");

        const opens = body.indexOf(CONTRADICTS_LEAD);
        if (opens === -1) continue;

        const after = body.slice(opens + CONTRADICTS_LEAD.length);
        const stop = after.indexOf(SIGNED_LEAD);
        const clause = stop === -1 ? after : after.slice(0, stop);

        if (citesOwnLetter(clause, span.agent)) out.push(span.key);
    }

    return out;
}

export interface StrayPosition {
    readonly key: string;
    readonly line: number;
}

function claimKeyOf(line: string): string {
    const rest = line.slice(POSITION_OPENER.length);
    const dash = rest.indexOf(" —");
    const key = dash === -1 ? rest : rest.slice(0, dash);
    return key.trim();
}

export function positionsOutsideRecords(source: string): StrayPosition[] {
    const lines = source.split("\n");
    const fenced = fencedFlags(source);
    const marks = delimitersIn(source);
    const out: StrayPosition[] = [];

    let depth = 0;
    let cursor = 0;

    for (let index = 0; index < lines.length; index += 1) {
        while (cursor < marks.length && marks[cursor] !== undefined && (marks[cursor]?.line ?? 0) === index + 1) {
            depth += marks[cursor]?.open === true ? 1 : -1;
            cursor += 1;
        }

        if (fenced[index] === true) continue;
        if (depth > 0) continue;

        const line = lines[index] ?? "";
        if (!line.startsWith(POSITION_OPENER)) continue;

        out.push({ key: claimKeyOf(line), line: index + 1 });
    }

    return out;
}
