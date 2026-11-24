import { delimitersIn } from "../analyzers/board.analyzer.ts";

export interface Compression {
    readonly text: string;
    readonly fields: number;
    readonly removed: number;
    readonly excised: readonly string[];
}

export interface Span {
    readonly from: number;
    readonly to: number;
}

export function blockOf(source: string, agent: string): Span | null {
    const markers = delimitersIn(source);
    const opens = markers.filter((mark) => mark.open && mark.agent === agent);
    const closes = markers.filter((mark) => !mark.open && mark.agent === agent);

    const open = opens[0];
    const close = closes[0];
    if (opens.length !== 1 || closes.length !== 1 || open === undefined || close === undefined) return null;
    if (open.line >= close.line) return null;

    return { from: open.line, to: close.line };
}

function isBlank(text: string): boolean {
    for (let i = 0; i < text.length; i += 1) {
        const character = text.charAt(i);
        if (character !== " " && character !== "\t" && character !== "\r") return false;
    }
    return true;
}

const EXCERPT = 90;

const LABEL_TERMINATORS: ReadonlySet<string> = new Set([":", " ", ""]);

function labelOffset(line: string, marker: string): number {
    const indent = line.length - line.trimStart().length;
    const rest = line.slice(indent);

    for (let i = 0; i < marker.length; i += 1) {
        if (rest[i] !== marker[i]) return -1;
    }

    return LABEL_TERMINATORS.has(rest.charAt(marker.length)) ? indent : -1;
}

export function compressBoard(source: string, marker: string): Compression {
    if (marker.length === 0) return { text: source, fields: 0, removed: 0, excised: [] };

    const lines = source.split("\n");
    const kept: string[] = [];
    const excised: string[] = [];
    let fields = 0;
    let removed = 0;

    for (const line of lines) {
        const at = labelOffset(line, marker);
        if (at === -1) {
            kept.push(line);
            continue;
        }

        fields += 1;
        removed += line.length - at;
        excised.push(line.slice(at, at + EXCERPT).trim());

        const head = line.slice(0, at);
        if (isBlank(head)) continue;
        kept.push(head);
    }

    return { text: kept.join("\n"), fields, removed, excised };
}
