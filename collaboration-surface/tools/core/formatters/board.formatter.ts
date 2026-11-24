import { delimitersIn } from "../analyzers/board.analyzer.ts";

const INDENT = "           ";

const WRAP_WIDTH = 120;

const ORDINAL_SEPARATOR = "-";

const TO_PREFIX = "To ";

export const KIND_FIELD = "kind:";

export const ITEM_KINDS = ["artifact", "judgement"];

export const AT_FIELD = "at:";

export const TO_FIELD = "to:";

export const READ_FIELD = "read:";

const ADDRESS_PUNCTUATION = [",", ":", ";", "."];

function wrappedSegment(text: string, out: string[]): void {
    let line = "";

    for (const word of text.split(" ")) {
        if (line.length > 0 && line.length + word.length + 1 > WRAP_WIDTH) {
            out.push(`${INDENT}${line}`);
            line = word;
            continue;
        }
        line = line.length === 0 ? word : `${line} ${word}`;
    }

    if (line.length > 0) out.push(`${INDENT}${line}`);
}

function wrapped(text: string): string[] {
    const out: string[] = [];

    for (const segment of text.split("\n")) {
        if (segment.trim().length === 0) {
            out.push("");
            continue;
        }
        wrappedSegment(segment, out);
    }

    return out;
}

export function isItemId(text: string): boolean {
    const cut = text.indexOf(ORDINAL_SEPARATOR);
    if (cut <= 0 || cut === text.length - 1) return false;

    for (let i = 0; i < cut; i += 1) {
        const char = text.charAt(i);
        if (char < "A" || char > "Z") return false;
    }

    for (let i = cut + 1; i < text.length; i += 1) {
        const char = text.charAt(i);
        if (char < "0" || char > "9") return false;
    }

    return true;
}

function highestIn(text: string, agent: string): number {
    const prefix = `${agent}${ORDINAL_SEPARATOR}`;
    let highest = 0;
    let cursor = text.indexOf(prefix);

    while (cursor !== -1) {
        let end = cursor + prefix.length;
        while (end < text.length) {
            const char = text.charAt(end);
            if (char < "0" || char > "9") break;
            end += 1;
        }

        const ordinal = Number(text.slice(cursor + prefix.length, end));
        if (Number.isFinite(ordinal) && ordinal > highest) highest = ordinal;
        cursor = text.indexOf(prefix, end);
    }

    return highest;
}

export function nextOrdinal(sources: readonly string[], agent: string, archive: string): number {
    let highest = 0;

    for (const source of sources) {
        for (const mark of delimitersIn(source)) {
            if (!mark.agent.startsWith(`${agent}${ORDINAL_SEPARATOR}`)) continue;

            const ordinal = Number(mark.agent.slice(agent.length + 1));
            if (Number.isFinite(ordinal) && ordinal > highest) highest = ordinal;
        }
    }

    const archived = highestIn(archive, agent);
    return (archived > highest ? archived : highest) + 1;
}

export function addresseesOf(text: string): string[] {
    const opener = text.indexOf(TO_PREFIX);
    if (opener !== 0) return [];

    const out: string[] = [];
    for (const word of text.slice(TO_PREFIX.length).split(" ")) {
        let token = word;
        while (token.length > 0 && ADDRESS_PUNCTUATION.includes(token.slice(-1))) {
            token = token.slice(0, token.length - 1);
        }
        if (token.length === 1 && token >= "A" && token <= "Z") {
            out.push(token);
            continue;
        }
        if (token === "AND" || token === "and") continue;
        break;
    }

    return out;
}

export function itemKindOf(source: string, key: string): string {
    const opener = `┌─── AGENT ${key} ───`;

    for (const line of source.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(opener)) continue;

        const at = trimmed.indexOf(KIND_FIELD);
        if (at === -1) return "";

        const rest = trimmed.slice(at + KIND_FIELD.length);
        const stop = rest.indexOf(" ");
        return stop === -1 ? rest : rest.slice(0, stop);
    }

    return "";
}

export const CITES_FIELD = "cites:";

export function stampOf(marker: string): number {
    const at = marker.indexOf(AT_FIELD);
    if (at === -1) return 0;

    const rest = marker.slice(at + AT_FIELD.length);
    const stop = rest.indexOf(" ");
    const held = Number((stop === -1 ? rest : rest.slice(0, stop)).trim());

    return Number.isFinite(held) ? held : 0;
}

const REFERENCE_JOIN = "`: `";

const BACKTICK = "`";

export function citedSurfaces(text: string): string[] {
    const out: string[] = [];

    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(BACKTICK) || !trimmed.endsWith(BACKTICK)) continue;

        const join = trimmed.indexOf(REFERENCE_JOIN);
        if (join === -1) continue;

        const path = trimmed.slice(join + REFERENCE_JOIN.length, trimmed.length - 1).trim();
        if (path.length === 0 || path.includes(" ") || path.includes(",") || out.includes(path)) continue;

        out.push(path);
    }

    return out;
}

export function stampedCitations(marker: string): { path: string; at: number }[] {
    const at = marker.indexOf(CITES_FIELD);
    if (at === -1) return [];

    const rest = marker.slice(at + CITES_FIELD.length);
    const stop = rest.indexOf(" ");
    const held = stop === -1 ? rest : rest.slice(0, stop);

    const out: { path: string; at: number }[] = [];
    for (const entry of held.split(",")) {
        const mark = entry.lastIndexOf("@");
        if (mark <= 0) continue;

        const stamp = Number(entry.slice(mark + 1));
        if (!Number.isFinite(stamp)) continue;

        out.push({ path: entry.slice(0, mark), at: stamp });
    }

    return out;
}

export function citationStamp(cited: readonly { path: string; at: number }[]): string {
    if (cited.length === 0) return "";

    return ` ${CITES_FIELD}${cited.map((entry) => `${entry.path}@${String(entry.at)}`).join(",")}`;
}

export function fencedItem(
    key: string,
    text: string,
    at: number,
    kind: string,
    cited: readonly { path: string; at: number }[] = [],
): string[] {
    const to = addresseesOf(text);
    const meta =
        `${KIND_FIELD}${kind} ${AT_FIELD}${String(at)} ${TO_FIELD}${to.length === 0 ? "*" : to.join(",")}` +
        citationStamp(cited);

    return [`${INDENT}┌─── AGENT ${key} ─── ${meta}`, ...wrapped(text), `${INDENT}└─── END AGENT ${key}`];
}
