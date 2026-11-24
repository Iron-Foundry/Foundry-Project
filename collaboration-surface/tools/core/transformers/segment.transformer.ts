import type { Document, Edit, Inline } from "../types/segment.types.ts";

export interface RenameMap {
    readonly [from: string]: string;
}

export function editsFromInlines(document: Document, map: RenameMap, kinds: readonly Inline["kind"][]): Edit[] {
    const edits: Edit[] = [];

    for (const segment of document.segments) {
        for (const inline of segment.inlines) {
            if (!kinds.includes(inline.kind)) continue;
            const replacement = map[inline.value];
            if (replacement === undefined) continue;
            edits.push({
                path: document.path,
                start: inline.start,
                end: inline.end,
                replacement,
                reason: `${inline.kind}: ${inline.value} -> ${replacement}`,
            });
        }
    }

    return edits;
}

export function editsFromFieldValues(document: Document, key: string, map: RenameMap): Edit[] {
    const edits: Edit[] = [];

    for (const segment of document.segments) {
        if (segment.kind !== "field" && segment.kind !== "frontmatter-field") continue;
        if (segment.key !== key) continue;
        if (segment.value === undefined) continue;

        const replacement = map[segment.value];
        if (replacement === undefined) continue;

        const valueStart = segment.end - segment.value.length;
        edits.push({
            path: document.path,
            start: valueStart,
            end: segment.end,
            replacement,
            reason: `${key}: ${segment.value} -> ${replacement}`,
        });
    }

    return edits;
}

export function editsFromFieldPrefixes(document: Document, keys: readonly string[], map: RenameMap): Edit[] {
    const edits: Edit[] = [];

    for (const segment of document.segments) {
        if (segment.kind !== "field" && segment.kind !== "frontmatter-field") continue;
        if (segment.key === undefined || !keys.includes(segment.key)) continue;
        if (segment.value === undefined || segment.value.length === 0) continue;

        for (const from of Object.keys(map)) {
            const replacement = map[from];
            if (replacement === undefined) continue;
            if (segment.value.length <= from.length) continue;
            let matched = true;
            for (let i = 0; i < from.length; i += 1) {
                if (segment.value[i] !== from[i]) {
                    matched = false;
                    break;
                }
            }
            if (!matched) continue;

            const boundary = segment.value[from.length];
            if (boundary !== "#" && boundary !== " ") continue;

            const valueStart = segment.end - segment.value.length;
            edits.push({
                path: document.path,
                start: valueStart,
                end: valueStart + from.length,
                replacement,
                reason: `${segment.key} prefix: ${from} -> ${replacement}`,
            });
            break;
        }
    }

    return edits;
}

export function editsFromInlinePrefixes(document: Document, map: RenameMap, kinds: readonly Inline["kind"][]): Edit[] {
    const edits: Edit[] = [];

    for (const segment of document.segments) {
        for (const inline of segment.inlines) {
            if (!kinds.includes(inline.kind)) continue;
            if (map[inline.value] !== undefined) continue;

            for (const from of Object.keys(map)) {
                const replacement = map[from];
                if (replacement === undefined) continue;
                if (inline.value.length <= from.length) continue;
                let matched = true;
                for (let i = 0; i < from.length; i += 1) {
                    if (inline.value[i] !== from[i]) {
                        matched = false;
                        break;
                    }
                }
                if (!matched) continue;
                if (inline.value[from.length] !== "#") continue;

                edits.push({
                    path: document.path,
                    start: inline.start,
                    end: inline.start + from.length,
                    replacement,
                    reason: `${inline.kind} prefix: ${from} -> ${replacement}`,
                });
                break;
            }
        }
    }

    return edits;
}

export interface ApplyResult {
    readonly text: string;
    readonly applied: readonly Edit[];
    readonly rejected: readonly Edit[];
}

export function applyEdits(source: string, edits: readonly Edit[]): ApplyResult {
    const ordered = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);

    const applied: Edit[] = [];
    const rejected: Edit[] = [];
    let text = source;
    let boundary = source.length;

    for (const edit of ordered) {
        if (edit.end > boundary) {
            rejected.push(edit);
            continue;
        }
        if (edit.start < 0 || edit.end < edit.start || edit.end > text.length) {
            rejected.push(edit);
            continue;
        }
        text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
        applied.push(edit);
        boundary = edit.start;
    }

    return { text, applied, rejected };
}
