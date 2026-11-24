import { unfencedLines } from "./document.reader.ts";

export interface RecordEntry {
    readonly id: string;
    readonly line: number;
    readonly keys: Readonly<Record<string, string>>;
}

export interface RecordDocument {
    readonly shape: string;
    readonly records: readonly RecordEntry[];
}

export function readRecordDocument(source: string): RecordDocument {
    const records: RecordEntry[] = [];
    let current: { id: string; line: number; keys: Record<string, string> } | null = null;
    let shape = "typed";
    let frontmatter = false;

    for (const { text: line, number } of unfencedLines(source)) {
        if (line === "---") {
            if (number === 1) frontmatter = true;
            else if (frontmatter) frontmatter = false;
            continue;
        }
        if (frontmatter) {
            if (line.startsWith("records:")) shape = line.slice("records:".length).trim();
            continue;
        }

        if (line.startsWith("### ")) {
            if (current !== null) records.push(current);
            current = { id: line.slice(4).trim(), line: number, keys: {} };
            continue;
        }
        if (current === null) continue;
        if (line.startsWith("#")) {
            records.push(current);
            current = null;
            continue;
        }

        const colon = line.indexOf(":");
        if (colon <= 0) continue;
        const key = line.slice(0, colon);
        if (key.includes(" ")) continue;
        current.keys[key] = line.slice(colon + 1).trim();
    }

    if (current !== null) records.push(current);
    return { shape, records };
}

export function citedIds(value: string): string[] {
    const out = new Set<string>();
    let token = "";

    for (let i = 0; i <= value.length; i += 1) {
        const char = i < value.length ? (value[i] ?? "") : " ";
        const isWord = (char >= "A" && char <= "Z") || (char >= "0" && char <= "9") || char === "-";

        if (isWord) {
            token += char;
            continue;
        }

        if (token.includes("-") && token.length > 4) {
            let digits = 0;
            let letters = 0;
            for (const part of token) {
                if (part >= "0" && part <= "9") digits += 1;
                if (part >= "A" && part <= "Z") letters += 1;
            }
            if (digits >= 2 && letters >= 2) out.add(token);
        }
        token = "";
    }

    return [...out];
}
