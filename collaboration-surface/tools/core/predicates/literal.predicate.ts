import { at, endOfQuoted } from "./comment.predicate.ts";

export interface Literal {
    readonly value: string;
    readonly line: number;
}

const QUOTES = ['"', "'", "`"];

export function stringLiterals(source: string): Literal[] {
    const out: Literal[] = [];
    let cursor = 0;
    let line = 1;

    for (; cursor < source.length; cursor += 1) {
        const char = at(source, cursor);
        if (char === "\n") line += 1;
        if (!QUOTES.includes(char)) continue;

        const opened = line;
        const end = endOfQuoted(source, cursor + 1, char);
        for (let i = cursor; i < end; i += 1) {
            if (at(source, i) === "\n") line += 1;
        }

        out.push({ value: source.slice(cursor + 1, Math.max(cursor + 1, end - 1)), line: opened });
        cursor = end - 1;
    }

    return out;
}
