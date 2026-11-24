import { SURFACE_READ_CALLS } from "../readers/surface.reader.ts";
import { SURFACE_WRITE_CALLS } from "../writers/surface.writer.ts";

export interface RequestedOperation {
    readonly operation: string;
    readonly requested: boolean;
    readonly supplied: boolean;
    readonly refusal: string;
}

export function unsuppliedOperands(requested: readonly RequestedOperation[]): string[] {
    return requested.filter((entry) => entry.requested && !entry.supplied).map((entry) => entry.refusal);
}

const FLAG_LEAD = "--";

export function writesNothing(argv: readonly string[], flag: string, selfRehearsing: readonly string[]): boolean {
    if (!argv.includes(flag)) return false;

    for (const form of selfRehearsing) {
        if (argv.includes(form)) return false;
    }

    return true;
}

export function unknownArguments(argv: readonly string[], known: readonly string[]): string[] {
    const out: string[] = [];

    for (const token of argv) {
        if (!token.startsWith(FLAG_LEAD) || token.length === FLAG_LEAD.length) continue;

        const equals = token.indexOf("=");
        const flag = equals === -1 ? token : token.slice(0, equals);
        if (known.includes(flag) || out.includes(flag)) continue;

        out.push(flag);
    }

    return out;
}

export function unshareableOperations(requested: readonly string[], exclusive: readonly string[]): string[] {
    const held = requested.filter((flag) => exclusive.includes(flag));
    return held.length > 0 && requested.length > 1 ? held : [];
}

const READS: readonly string[] = ["readFileSync", ...SURFACE_READ_CALLS];

const WRITES: readonly string[] = ["writeFileSync", ...SURFACE_WRITE_CALLS];

const COMPARISONS = ["!==", "===", "!=", "=="];

export interface Mutation {
    readonly target: string;
    readonly line: number;
    readonly reads: number;
    readonly witnessed: boolean;
}

interface Event {
    readonly kind: "read" | "write";
    readonly target: string;
    readonly index: number;
    readonly line: number;
}

function isWordChar(char: string): boolean {
    if (char >= "a" && char <= "z") return true;
    if (char >= "A" && char <= "Z") return true;
    if (char >= "0" && char <= "9") return true;
    return char === "_" || char === "$";
}

function matchesAt(source: string, index: number, word: string): boolean {
    if (source.slice(index, index + word.length) !== word) return false;
    if (index > 0 && isWordChar(source.charAt(index - 1))) return false;
    return !isWordChar(source.charAt(index + word.length));
}

function argumentAt(source: string, after: number): string | null {
    let cursor = after;
    while (cursor < source.length && source.charAt(cursor) === " ") cursor += 1;
    if (source.charAt(cursor) !== "(") return null;

    cursor += 1;
    while (cursor < source.length && source.charAt(cursor) === " ") cursor += 1;

    let out = "";
    while (cursor < source.length && isWordChar(source.charAt(cursor))) {
        out += source.charAt(cursor);
        cursor += 1;
    }

    return out.length === 0 ? null : out;
}

function events(source: string): Event[] {
    const out: Event[] = [];
    let quote = "";
    let line = 1;

    for (let index = 0; index < source.length; index += 1) {
        const char = source.charAt(index);

        if (char === "\n") line += 1;

        if (quote !== "") {
            if (char === "\\") index += 1;
            else if (char === quote) quote = "";
            continue;
        }

        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            continue;
        }

        const read = READS.find((name) => matchesAt(source, index, name));
        const write = read === undefined ? WRITES.find((name) => matchesAt(source, index, name)) : undefined;
        const word = read ?? write;
        if (word === undefined) continue;

        const target = argumentAt(source, index + word.length);
        if (target !== null) out.push({ kind: read === undefined ? "write" : "read", target, index, line });

        index += word.length - 1;
    }

    return out;
}

function comparedBetween(source: string, from: number, to: number): boolean {
    const span = source.slice(from, to);
    for (const operator of COMPARISONS) {
        if (span.includes(operator)) return true;
    }
    return false;
}

export interface BranchOperand {
    readonly name: string;
    readonly line: number;
}

const BRANCH_MARKS = ["?", "if (", "&&", "||"];

function memberValue(trimmed: string): string {
    const colon = trimmed.indexOf(":");
    if (colon <= 0) return "";

    let value = trimmed.slice(colon + 1).trim();
    if (value.endsWith(",")) value = value.slice(0, value.length - 1).trim();

    for (const character of value) {
        const lower = character >= "a" && character <= "z";
        const upper = character >= "A" && character <= "Z";
        if (!lower && !upper) return "";
    }

    return value;
}

function memberKey(trimmed: string): string {
    const colon = trimmed.indexOf(":");
    if (colon <= 0) return "";

    const key = trimmed.slice(0, colon).trim();
    for (const character of key) {
        const lower = character >= "a" && character <= "z";
        const upper = character >= "A" && character <= "Z";
        if (!lower && !upper) return "";
    }

    return key;
}

function declaresCarrier(trimmed: string, carrier: string): boolean {
    const lead = `const ${carrier}`;
    if (!trimmed.startsWith(lead)) return false;

    const next = trimmed.charAt(lead.length);
    return next === " " || next === ":" || next === "=";
}

function reportCarrier(lines: readonly string[], reportCall: string): string {
    for (const line of lines) {
        const at = line.indexOf(`${reportCall}(`);
        if (at === -1) continue;

        const inside = line.slice(at + reportCall.length + 1);
        const close = inside.indexOf(")");
        if (close === -1) continue;

        const parts = inside.slice(0, close).split(",");
        const last = (parts[parts.length - 1] ?? "").trim();
        if (last.length > 0) return last;
    }

    return "";
}

export function unpublishedBranchOperands(source: string, runCall: string, reportCall: string): BranchOperand[] {
    const lines = source.split("\n");

    const branching = new Map<string, number>();
    const passed = new Map<string, number>();
    const published = new Set<string>();

    const carrier = reportCarrier(lines, reportCall);

    let inRun = false;
    let inReport = false;

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();

        if (carrier.length > 0 && declaresCarrier(trimmed, carrier)) inReport = true;

        if (trimmed.startsWith("const ") && BRANCH_MARKS.some((mark) => trimmed.includes(mark))) {
            const rest = trimmed.slice("const ".length);
            const stop = rest.indexOf(" ");
            const name = stop === -1 ? "" : rest.slice(0, stop);
            if (name.length > 0) branching.set(name, index + 1);
        }

        if (trimmed.includes(`${runCall}(`)) inRun = true;
        if (trimmed.includes(`${reportCall}(`)) inReport = true;

        if (inRun) {
            const value = memberValue(trimmed);
            if (value.length > 0 && !passed.has(value)) passed.set(value, index + 1);
        }

        if (inReport) {
            const key = memberKey(trimmed);
            if (key.length > 0) published.add(key);

            const value = memberValue(trimmed);
            if (value.length > 0) published.add(value);
        }

        if (trimmed.startsWith("}")) {
            inRun = false;
            inReport = false;
        }
    }

    const out: BranchOperand[] = [];
    for (const [name, line] of passed) {
        if (!branching.has(name) || published.has(name)) continue;
        out.push({ name, line });
    }

    return out;
}

export interface PresenceBackedGuard {
    readonly guard: string;
    readonly reader: string;
    readonly line: number;
    readonly chain: readonly string[];
}

function identifiersIn(text: string): string[] {
    const out: string[] = [];
    let quote = "";
    let held = "";

    for (let index = 0; index < text.length; index += 1) {
        const char = text.charAt(index);

        if (quote !== "") {
            if (char === "\\") index += 1;
            else if (char === quote) quote = "";
            continue;
        }

        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            if (held.length > 0) {
                out.push(held);
                held = "";
            }
            continue;
        }

        if (isWordChar(char)) {
            held += char;
            continue;
        }

        if (held.length > 0) {
            out.push(held);
            held = "";
        }
    }

    if (held.length > 0) out.push(held);
    return out;
}

function declarationBodies(lines: readonly string[]): Map<string, string> {
    const out = new Map<string, string>();

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();

        if (trimmed.startsWith("const ")) {
            const rest = trimmed.slice("const ".length);
            let name = "";
            for (const char of rest) {
                if (!isWordChar(char)) break;
                name += char;
            }
            const equals = trimmed.indexOf("=");
            if (name.length > 0 && equals !== -1 && !out.has(name)) out.set(name, trimmed.slice(equals + 1));
            continue;
        }

        const declares =
            trimmed.startsWith("function ") ||
            trimmed.startsWith("async function ") ||
            trimmed.startsWith("export function ") ||
            trimmed.startsWith("export async function ");
        if (!declares) continue;

        const open = trimmed.indexOf("function ") + "function ".length;
        let name = "";
        for (let cursor = open; cursor < trimmed.length; cursor += 1) {
            const char = trimmed.charAt(cursor);
            if (!isWordChar(char)) break;
            name += char;
        }
        if (name.length === 0 || out.has(name)) continue;

        let body = "";
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const next = lines[cursor] ?? "";
            if (next.startsWith("}")) break;
            body += `${next}\n`;
        }
        out.set(name, body);
    }

    return out;
}

export function presenceBackedMutationGuards(
    source: string,
    mutationFields: readonly string[],
    presenceReaders: readonly string[],
    depth: number,
): PresenceBackedGuard[] {
    const lines = source.split("\n");
    const bodies = declarationBodies(lines);
    const presence = new Set(presenceReaders);
    const fields = new Set(mutationFields);

    const roots = new Map<string, number>();
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();
        const key = memberKey(trimmed);
        if (key.length === 0 || !fields.has(key)) continue;

        const value = memberValue(trimmed);
        if (value.length > 0 && !roots.has(value)) roots.set(value, index + 1);
    }

    const out: PresenceBackedGuard[] = [];

    for (const [guard, line] of roots) {
        const seen = new Set<string>([guard]);
        let frontier: string[] = [guard];
        const chain: string[] = [guard];

        for (let level = 0; level < depth && frontier.length > 0; level += 1) {
            const next: string[] = [];

            for (const name of frontier) {
                const body = bodies.get(name);
                if (body === undefined) continue;

                for (const identifier of identifiersIn(body)) {
                    if (presence.has(identifier)) {
                        out.push({ guard, reader: identifier, line, chain: [...chain, identifier] });
                        next.length = 0;
                        frontier = [];
                        break;
                    }
                    if (seen.has(identifier)) continue;
                    seen.add(identifier);
                    if (bodies.has(identifier)) {
                        next.push(identifier);
                        chain.push(identifier);
                    }
                }

                if (frontier.length === 0) break;
            }

            if (frontier.length === 0) break;
            frontier = next;
        }
    }

    return out;
}

export function unwitnessedWrites(source: string): Mutation[] {
    const ordered = events(source);
    const out: Mutation[] = [];

    for (const event of ordered) {
        if (event.kind !== "write") continue;

        const priors = ordered.filter(
            (candidate) =>
                candidate.kind === "read" && candidate.target === event.target && candidate.index < event.index,
        );

        if (priors.length === 0) continue;

        const last = priors[priors.length - 1];
        const witnessed = priors.length >= 2 && last !== undefined && comparedBetween(source, last.index, event.index);

        if (!witnessed) {
            out.push({ target: event.target, line: event.line, reads: priors.length, witnessed });
        }
    }

    return out;
}
