import { indexedStates } from "../inspectors/index.inspector.ts";
import { fencedFlags } from "../predicates/fence.predicate.ts";

const AGENT_PREFIX = "Agent ";
const BROADCAST_META = "to:*";
const DIRECTED_OPENER = "To ";

const BROADCAST_OPENER = "To ALL";

export interface AddressingSite {
    readonly line: number;
    readonly opener: string;
}

export function unresolvedAddressing(source: string): AddressingSite[] {
    const lines = source.split("\n");
    const out: AddressingSite[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        if (!(lines[index] ?? "").includes(BROADCAST_META)) continue;

        const text = (lines[index + 1] ?? "").trim();
        if (!text.startsWith(DIRECTED_OPENER)) continue;
        if (text.startsWith(BROADCAST_OPENER)) continue;

        out.push({ line: index + 1, opener: text.slice(0, 24) });
    }

    return out;
}

export function activeAgents(board: string, index: string): number {
    return activeSeats(board, index).length;
}

const OPEN_MARKER = "┌";
const CLOSE_MARKER = "└";
const MARKER_AGENT = "AGENT ";
const MARKER_END = "END AGENT ";

const ORDINAL_SEPARATOR = "-";

const FIELD_INDENT = "  ";

export interface Delimiter {
    readonly agent: string;
    readonly open: boolean;
    readonly line: number;
}

function agentAfter(text: string, marker: string): string | null {
    const at = text.indexOf(marker);
    if (at === -1) return null;

    let cursor = at + marker.length;
    let out = "";
    while (cursor < text.length) {
        const char = text.charAt(cursor);
        if (char < "A" || char > "Z") break;
        out += char;
        cursor += 1;
    }

    if (out.length === 0) return null;

    while (cursor < text.length) {
        const char = text.charAt(cursor);
        if (char < "a" || char > "z") break;
        out += char;
        cursor += 1;
    }

    if (text.charAt(cursor) !== ORDINAL_SEPARATOR) return out;

    let ordinal = "";
    cursor += 1;
    while (cursor < text.length) {
        const char = text.charAt(cursor);
        if (char < "0" || char > "9") break;
        ordinal += char;
        cursor += 1;
    }

    return ordinal.length === 0 ? out : `${out}${ORDINAL_SEPARATOR}${ordinal}`;
}

interface MarkerSite {
    readonly agent: string | null;
    readonly open: boolean;
    readonly line: number;
}

function markerSites(source: string): MarkerSite[] {
    const out: MarkerSite[] = [];
    const lines = source.split("\n");
    const fenced = fencedFlags(source);

    for (let index = 0; index < lines.length; index += 1) {
        if (fenced[index] === true) continue;
        const line = (lines[index] ?? "").trim();

        if (line.startsWith(OPEN_MARKER) && line.includes(MARKER_AGENT)) {
            out.push({ agent: agentAfter(line, MARKER_AGENT), open: true, line: index + 1 });
            continue;
        }

        if (line.startsWith(CLOSE_MARKER) && line.includes(MARKER_END)) {
            out.push({ agent: agentAfter(line, MARKER_END), open: false, line: index + 1 });
        }
    }

    return out;
}

export function delimitersIn(source: string): Delimiter[] {
    return markerSites(source).flatMap((site) =>
        site.agent === null ? [] : [{ agent: site.agent, open: site.open, line: site.line }],
    );
}

export function unparsedDelimiters(source: string): number[] {
    return markerSites(source)
        .filter((site) => site.agent === null)
        .map((site) => site.line);
}

export function enclosingRecord(source: string): (line: number) => string | null {
    const spans: { agent: string; from: number; to: number }[] = [];
    const open = new Map<string, number>();

    for (const delimiter of delimitersIn(source)) {
        if (delimiter.open) {
            open.set(delimiter.agent, delimiter.line);
            continue;
        }
        const from = open.get(delimiter.agent);
        if (from === undefined) continue;
        open.delete(delimiter.agent);
        spans.push({ agent: delimiter.agent, from, to: delimiter.line });
    }

    return (line: number): string | null => {
        let held: string | null = null;
        let width = Number.MAX_SAFE_INTEGER;

        for (const span of spans) {
            if (line < span.from || line > span.to) continue;
            const size = span.to - span.from;
            if (size >= width) continue;
            width = size;
            held = span.agent;
        }

        return held;
    };
}

export function itemSpanFlags(source: string): boolean[] {
    const flags: boolean[] = [];
    for (let index = 0; index < source.split("\n").length; index += 1) flags.push(false);

    let openAt = -1;
    let openKey = "";

    for (const mark of delimitersIn(source)) {
        if (mark.agent.indexOf(ORDINAL_SEPARATOR) === -1) continue;

        if (mark.open) {
            if (openAt === -1) {
                openAt = mark.line;
                openKey = mark.agent;
            }
            continue;
        }

        if (openAt === -1 || mark.agent !== openKey) continue;

        for (let index = openAt; index < mark.line - 1; index += 1) flags[index] = true;
        openAt = -1;
        openKey = "";
    }

    return flags;
}

export type RecordKind = "agent" | "gate";

export interface BoardRecord {
    readonly kind: RecordKind;
    readonly label: string;
    readonly state: string;
    readonly line: number;
    readonly fields: ReadonlyMap<string, string>;
}

const HEADINGS: Readonly<Record<string, RecordKind>> = { Agent: "agent", Gate: "gate" };

function headingOf(line: string): { kind: RecordKind; label: string; state: string } | null {
    const trimmed = line.trim();
    const space = trimmed.indexOf(" ");
    if (space === -1) return null;

    const word = trimmed.slice(0, space);
    const kind = HEADINGS[word];
    if (kind === undefined) return null;

    const rest = trimmed.slice(space + 1);
    const dash = rest.indexOf("—");
    const label = dash === -1 ? rest.trim() : rest.slice(0, dash).trim();
    if (label.length === 0 || label.length > 24) return null;

    const state = dash === -1 ? "" : rest.slice(dash + 1).trim();

    return { kind, label: `${word} ${label}`, state };
}

function fieldOf(line: string): { key: string; value: string } | null {
    if (!line.startsWith(FIELD_INDENT)) return null;
    if (line.charAt(FIELD_INDENT.length) === " ") return null;

    const trimmed = line.trim();
    const colon = trimmed.indexOf(":");
    if (colon <= 0) return null;

    const key = trimmed.slice(0, colon).trim();
    if (key.includes(" ")) return null;

    return { key, value: trimmed.slice(colon + 1).trim() };
}

function closesRecord(line: string, label: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith(CLOSE_MARKER)) return false;

    const marks = trimmed.indexOf(MARKER_END);
    if (marks === -1) return false;

    const named = trimmed.slice(marks + MARKER_END.length).trim();
    const space = label.indexOf(" ");
    const letter = space === -1 ? label : label.slice(space + 1).trim();

    return named === letter;
}

export function boardRecords(source: string): BoardRecord[] {
    const out: BoardRecord[] = [];
    const lines = source.split("\n");
    const fenced = fencedFlags(source);
    const inItem = itemSpanFlags(source);

    let current: { kind: RecordKind; label: string; state: string; line: number; fields: Map<string, string> } | null =
        null;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        if (fenced[index] === true) continue;
        if (inItem[index] === true) continue;
        if (line.trim().startsWith("#") || line.trim().startsWith("-")) continue;

        const heading = headingOf(line);
        if (heading !== null) {
            if (current !== null) out.push({ ...current, fields: current.fields });
            current = {
                kind: heading.kind,
                label: heading.label,
                state: heading.state,
                line: index + 1,
                fields: new Map(),
            };
            continue;
        }

        if (current === null) continue;

        if (closesRecord(line, current.label)) {
            out.push({ ...current, fields: current.fields });
            current = null;
            continue;
        }

        const field = fieldOf(line);
        if (field === null) continue;

        current.fields.set(field.key, field.value);
    }

    if (current !== null) out.push({ ...current, fields: current.fields });

    return out;
}

export const ACTIVE_STATE = "ACTIVE";

export function seatState(index: string): (letter: string, marker: string) => string {
    const bound = indexedStates(index);
    const allocating = index.trim().length > 0;

    return (letter: string, marker: string): string => {
        if (!allocating) return marker;
        return bound.get(letter) ?? "";
    };
}

export function activeSeats(board: string, index: string): string[] {
    const out: string[] = [];
    const stateOf = seatState(index);

    for (const record of boardRecords(board)) {
        if (record.kind !== "agent") continue;

        const letter = record.label.slice(AGENT_PREFIX.length).trim();
        if (letter.length === 0) continue;

        if (stateOf(letter, record.state) !== ACTIVE_STATE) continue;

        out.push(letter);
    }

    return out;
}
