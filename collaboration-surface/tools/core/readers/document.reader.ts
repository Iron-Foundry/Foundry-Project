import type { Document, Segment, SegmentKind } from "../types/segment.types.ts";
import { inlinesOf } from "./token.reader.ts";

export interface SourceLine {
    readonly text: string;
    readonly number: number;
}

const FENCE = "```";

const FRONTMATTER = "---";

export function unfencedLines(source: string): SourceLine[] {
    const out: SourceLine[] = [];
    const lines = source.split("\n");
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index] ?? "";

        if (text.startsWith(FENCE)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;

        out.push({ text, number: index + 1 });
    }

    return out;
}

function indentOf(line: string): number {
    let cursor = 0;
    while (cursor < line.length) {
        const char = line[cursor] ?? "";
        if (char !== " " && char !== "\t") break;
        cursor += 1;
    }
    return cursor;
}

function isBlank(line: string): boolean {
    return indentOf(line) === line.length;
}

function headingDepth(line: string): number {
    let depth = 0;
    while ((line[depth] ?? "") === "#") depth += 1;
    return depth;
}

function isListMarker(line: string, at: number): boolean {
    const char = line[at] ?? "";
    if ((char === "-" || char === "*") && (line[at + 1] ?? "") === " ") return true;

    let cursor = at;
    while ((line[cursor] ?? "") >= "0" && (line[cursor] ?? "") <= "9") cursor += 1;
    if (cursor === at) return false;
    return (line[cursor] ?? "") === "." && (line[cursor + 1] ?? "") === " ";
}

function fieldAt(line: string, from: number): { key: string; value: string } | null {
    const colon = line.indexOf(":", from);
    if (colon <= from) return null;

    const key = line.slice(from, colon);
    if (key.length === 0) return null;
    for (const char of key) {
        if (char === " " || char === "\t" || char === "`" || char === "|") return null;
    }

    let cursor = colon + 1;
    while ((line[cursor] ?? "") === " ") cursor += 1;

    return { key, value: line.slice(cursor).trimEnd() };
}

export function readDocument(path: string, source: string): Document {
    const segments: Segment[] = [];
    const lines = source.split("\n");

    let offset = 0;
    let fenced = false;
    let frontmatter = false;
    let frontmatterClosed = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const start = offset;
        const end = offset + line.trimEnd().length;
        const number = index + 1;
        offset += line.length + 1;

        const emit = (kind: SegmentKind, extra: Partial<Segment>): void => {
            segments.push({
                kind,
                text: line,
                start,
                end,
                line: number,
                inlines: fenced || kind === "fence-body" ? [] : inlinesOf(line, start, number),
                ...extra,
            });
        };

        if (line.startsWith(FENCE)) {
            emit(fenced ? "fence-close" : "fence-open", {});
            fenced = !fenced;
            continue;
        }
        if (fenced) {
            emit("fence-body", {});
            continue;
        }

        if (line.trimEnd() === FRONTMATTER && !frontmatterClosed) {
            if (!frontmatter && index === 0) {
                frontmatter = true;
                emit("frontmatter-open", {});
                continue;
            }
            if (frontmatter) {
                frontmatter = false;
                frontmatterClosed = true;
                emit("frontmatter-close", {});
                continue;
            }
        }

        if (isBlank(line)) {
            emit("blank", {});
            continue;
        }

        if (frontmatter) {
            const field = fieldAt(line, indentOf(line));
            if (field !== null) emit("frontmatter-field", { key: field.key, value: field.value });
            else emit("text", {});
            continue;
        }

        const depth = headingDepth(line);
        if (depth > 0 && (line[depth] ?? "") === " ") {
            emit("heading", { depth, key: line.slice(depth).trim() });
            continue;
        }

        const indent = indentOf(line);

        if ((line[indent] ?? "") === "|") {
            emit("table-row", {});
            continue;
        }

        if (isListMarker(line, indent)) {
            emit("list-item", {});
            continue;
        }

        const field = fieldAt(line, indent);
        if (field !== null) {
            emit("field", { key: field.key, value: field.value });
            continue;
        }

        emit("text", {});
    }

    return { path, source, segments };
}
