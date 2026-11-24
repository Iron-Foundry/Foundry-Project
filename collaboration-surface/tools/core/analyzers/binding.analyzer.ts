export interface SlotUse {
    readonly name: string;
    readonly line: number;
}

function isSlotChar(char: string): boolean {
    return (
        (char >= "a" && char <= "z") ||
        (char >= "A" && char <= "Z") ||
        (char >= "0" && char <= "9") ||
        char === "_" ||
        char === "."
    );
}

export const RESOLUTION_STATES = ["RESOLVED", "ABSENT", "DEFERRED"] as const;

export type Resolution = (typeof RESOLUTION_STATES)[number];

export function slotStates(source: string): Map<string, Resolution> {
    const out = new Map<string, Resolution>();
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        let state: Resolution | undefined;
        let at = line.length;
        for (const candidate of RESOLUTION_STATES) {
            const found = line.indexOf(candidate);
            if (found === -1 || found >= at) continue;
            at = found;
            state = candidate;
        }
        if (state === undefined) continue;

        for (const use of slotsIn(line)) {
            if (out.has(use.name)) continue;
            out.set(use.name, state);
        }
    }

    return out;
}

const WILDCARD_SLOT = ".*}";

export function enumeratesVocabulary(line: string): boolean {
    return line.includes(WILDCARD_SLOT);
}

export function slotsIn(source: string): SlotUse[] {
    const out: SlotUse[] = [];
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        for (let cursor = 0; cursor < line.length; cursor += 1) {
            if (line[cursor] !== "{") continue;

            let end = cursor + 1;
            while (end < line.length && isSlotChar(line[end] ?? "")) end += 1;
            if (line[end] !== "}") continue;
            if (end === cursor + 1) continue;

            out.push({ name: line.slice(cursor, end + 1), line: index + 1 });
            cursor = end;
        }
    }

    return out;
}
