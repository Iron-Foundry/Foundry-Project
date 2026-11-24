import { at, endOfQuoted, isAttribution, type CommentSpan } from "../predicates/comment.predicate.ts";

export { isAttribution, type CommentSpan };

type Take = (source: string, cursor: number, spans: CommentSpan[]) => number;

function scanComments(source: string, quotes: readonly string[], take: Take): CommentSpan[] {
    const spans: CommentSpan[] = [];
    let cursor = 0;

    while (cursor < source.length) {
        const char = at(source, cursor);

        if (quotes.includes(char)) {
            cursor = endOfQuoted(source, cursor + 1, char);
            continue;
        }

        const next = take(source, cursor, spans);
        cursor = next > cursor ? next : cursor + 1;
    }

    return spans;
}

function toEndOfLine(source: string, start: number): number {
    let end = start;
    while (end < source.length && at(source, end) !== "\n") end += 1;
    return end;
}

function lineSpan(source: string, start: number, spans: CommentSpan[]): number {
    const end = toEndOfLine(source, start);
    spans.push({ start, end, text: source.slice(start, end) });
    return end;
}

export function typescriptComments(source: string): CommentSpan[] {
    return scanComments(source, ['"', "'", "`"], (text, cursor, spans) => {
        if (at(text, cursor) !== "/") return -1;

        const marker = at(text, cursor + 1);
        if (marker === "/") return lineSpan(text, cursor, spans);
        if (marker !== "*") return -1;

        let end = cursor + 2;
        while (end < text.length && !(at(text, end) === "*" && at(text, end + 1) === "/")) end += 1;
        end = Math.min(end + 2, text.length);
        spans.push({ start: cursor, end, text: text.slice(cursor, end) });
        return end;
    });
}

export interface StripResult {
    readonly text: string;
    readonly removed: number;
    readonly kept: number;
}

export function stripComments(source: string, spans: readonly CommentSpan[]): StripResult {
    const shebang = source.startsWith("#!");
    let text = source;
    let removed = 0;
    let kept = 0;

    for (let i = spans.length - 1; i >= 0; i -= 1) {
        const span = spans[i];
        if (span === undefined) continue;

        if (isAttribution(span.text)) {
            kept += 1;
            continue;
        }
        if (shebang && span.start === 0) {
            kept += 1;
            continue;
        }

        let from = span.start;
        while (from > 0 && (at(text, from - 1) === " " || at(text, from - 1) === "\t")) from -= 1;

        const atLineStart = from === 0 || at(text, from - 1) === "\n";
        let to = span.end;
        if (atLineStart && at(text, to) === "\n") to += 1;

        text = text.slice(0, from) + text.slice(to);
        removed += 1;
    }

    return { text, removed, kept };
}

export function hashComments(source: string): CommentSpan[] {
    return scanComments(source, ['"', "'"], (text, cursor, spans) =>
        at(text, cursor) === "#" ? lineSpan(text, cursor, spans) : -1,
    );
}

export function commentsOf(path: string, source: string): CommentSpan[] {
    if (path.endsWith(".ts")) return typescriptComments(source);
    if (path.endsWith(".toml")) return hashComments(source);
    if (path.endsWith(".json") || path.endsWith(".jsonc")) return typescriptComments(source);
    return [];
}
