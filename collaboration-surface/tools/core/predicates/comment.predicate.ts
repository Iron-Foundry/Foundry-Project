export interface CommentSpan {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

const ATTRIBUTION_MARKERS = [
    "SPDX-License-Identifier",
    "Copyright",
    "copyright",
    "CC BY-SA",
    "Bane's Lab",
    "License:",
    "Licence:",
    "MIT License",
    "BSD License",
    "All rights reserved",
] as const;

export function at(text: string, index: number): string {
    return text[index] ?? "";
}

export function isAttribution(text: string): boolean {
    for (const marker of ATTRIBUTION_MARKERS) {
        if (text.includes(marker)) return true;
    }
    return false;
}

export function endOfQuoted(source: string, start: number, quote: string): number {
    let cursor = start;
    while (cursor < source.length) {
        const char = at(source, cursor);
        if (char === "\\") {
            cursor += 2;
            continue;
        }
        cursor += 1;
        if (char === quote) return cursor;
    }
    return cursor;
}
