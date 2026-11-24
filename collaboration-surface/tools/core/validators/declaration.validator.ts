import { lifetime } from "../../../config/surface.config.ts";

const DECLARE = "function ";

const OPEN = "(";

const BODY_OPEN = "{";

const BODY_CLOSE = "}";

export interface AxisConsumer {
    readonly name: string;
    readonly line: number;
    readonly asserted: string;
    readonly read: readonly string[];
}

function axisNames(): string[] {
    return Object.keys(lifetime.values);
}

function axisValues(axis: string): readonly string[] {
    for (const [name, values] of Object.entries(lifetime.values)) {
        if (name === axis) return values;
    }
    return [];
}

function lowered(text: string): string {
    let out = "";
    for (const character of text) {
        const code = character.charCodeAt(0);
        out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : character;
    }
    return out;
}

const STEM = 5;

function assertedAxis(name: string): string | null {
    const held = lowered(name);

    for (const axis of axisNames()) {
        const stem = lowered(axis).slice(0, STEM);
        if (stem.length > 0 && held.includes(stem)) return axis;

        for (const value of axisValues(axis)) {
            const word = lowered(value).split("-").join("");
            if (word.length > 0 && held.includes(word)) return axis;
        }
    }

    return null;
}

const QUOTES = new Set(['"', "'", "`"]);

function quotedAt(line: string, index: number): boolean {
    let open = "";

    for (let cursor = 0; cursor < index; cursor += 1) {
        const character = line.charAt(cursor);
        if (!QUOTES.has(character)) continue;
        if (open.length === 0) open = character;
        else if (open === character) open = "";
    }

    return open.length > 0;
}

function declaredNameAt(line: string): string | null {
    const at = line.indexOf(DECLARE);
    if (at === -1) return null;
    if (quotedAt(line, at)) return null;

    const rest = line.slice(at + DECLARE.length);
    const open = rest.indexOf(OPEN);
    if (open <= 0) return null;

    const name = rest.slice(0, open).trim();
    return name.length === 0 || name.includes(" ") ? null : name;
}

function bodyOf(lines: readonly string[], from: number): string {
    let depth = 0;
    let seen = false;
    let out = "";

    for (let index = from; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        out += `${line}\n`;

        for (const character of line) {
            if (character === BODY_OPEN) {
                depth += 1;
                seen = true;
            }
            if (character === BODY_CLOSE) depth -= 1;
        }

        if (seen && depth <= 0) return out;
    }

    return out;
}

export function axisConsumers(source: string, reaches: readonly string[]): AxisConsumer[] {
    const out: AxisConsumer[] = [];
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const name = declaredNameAt(lines[index] ?? "");
        if (name === null) continue;

        const asserted = assertedAxis(name);
        if (asserted === null) continue;

        const body = bodyOf(lines, index);
        if (!reaches.some((token) => body.includes(token))) continue;

        const read = axisNames().filter((axis) => body.includes(`.${axis}`));
        out.push({ name, line: index + 1, asserted, read });
    }

    return out;
}

export function silentOnItsOwnAxis(consumer: AxisConsumer): boolean {
    return !consumer.read.includes(consumer.asserted);
}
