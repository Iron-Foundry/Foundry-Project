import { unfencedLines } from "./document.reader.ts";

export interface DeclaredRule {
    readonly slug: string;
    readonly gate: string;
    readonly locked: boolean;
    readonly line: number;
}

const GATE_MARKER = "gate:";

const LOCKED_MARKER = "(LOCKED)";

function backtickedSlug(line: string): string | null {
    const open = line.indexOf("`");
    if (open === -1) return null;
    const close = line.indexOf("`", open + 1);
    if (close === -1) return null;
    const slug = line.slice(open + 1, close);
    return slug.length > 0 ? slug : null;
}

function gateOf(line: string): string | null {
    const marker = line.lastIndexOf(GATE_MARKER);
    if (marker === -1) return null;

    let value = "";
    for (let i = marker + GATE_MARKER.length; i < line.length; i += 1) {
        const char = line[i] ?? "";
        if (char === " " && value.length === 0) continue;
        const ok = (char >= "a" && char <= "z") || char === "-";
        if (!ok) break;
        value += char;
    }

    return value.length > 0 ? value : null;
}

function headingSlug(line: string): string | null {
    let cursor = 0;
    while ((line[cursor] ?? "") === "#") cursor += 1;
    if (cursor === 0) return null;
    while ((line[cursor] ?? "") === " ") cursor += 1;
    if ((line[cursor] ?? "") !== "`") return null;

    const close = line.indexOf("`", cursor + 1);
    if (close === -1) return null;

    const slug = line.slice(cursor + 1, close);
    if (slug.length === 0) return null;

    const tail = line.slice(close + 1).trim();
    if (tail.length > 0 && tail !== LOCKED_MARKER) return null;

    return slug;
}

export function readDeclaredRules(source: string): DeclaredRule[] {
    const out: DeclaredRule[] = [];

    let heading: string | null = null;
    let headingLocked = false;

    for (const { text: line, number } of unfencedLines(source)) {
        if (line.startsWith("#")) {
            heading = headingSlug(line);
            headingLocked = line.includes(LOCKED_MARKER);
            continue;
        }

        if (line.startsWith("- `")) {
            const slug = backtickedSlug(line);
            if (slug === null) continue;

            const gate = gateOf(line);
            if (gate === null) continue;

            out.push({ slug, gate, locked: line.includes(LOCKED_MARKER), line: number });
            continue;
        }

        if (heading === null) continue;

        const gate = gateOf(line);
        if (gate === null) continue;

        out.push({ slug: heading, gate, locked: headingLocked, line: number });
        heading = null;
    }

    return out;
}

export function readExpandedSlugs(source: string): { slug: string; line: number }[] {
    const out: { slug: string; line: number }[] = [];

    for (const { text, number } of unfencedLines(source)) {
        if (!text.startsWith("#")) continue;
        const slug = headingSlug(text);
        if (slug === null) continue;
        out.push({ slug, line: number });
    }

    return out;
}

export function stripGateDeclarations(source: string): string {
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        const marker = line.lastIndexOf(GATE_MARKER);
        if (marker === -1) continue;
        if (gateOf(line) === null) continue;

        let end = marker + GATE_MARKER.length;
        while ((line[end] ?? "") === " ") end += 1;
        while (end < line.length) {
            const char = line[end] ?? "";
            if (!((char >= "a" && char <= "z") || char === "-")) break;
            end += 1;
        }

        let start = marker;
        while (start > 0 && (line[start - 1] ?? "") === " ") start -= 1;
        if (start > 0 && (line[start - 1] ?? "") === "·") start -= 1;
        while (start > 0 && (line[start - 1] ?? "") === " ") start -= 1;

        lines[index] = line.slice(0, start) + line.slice(end);
    }

    return lines.join("\n");
}
