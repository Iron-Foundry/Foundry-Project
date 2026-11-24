import { contains, hasPrefix } from "../predicates/text.predicate.ts";
import type { Document, Hit, Segment, SegmentPattern, SegmentPredicate } from "../types/segment.types.ts";

function matchesOne(segment: Segment, predicate: SegmentPredicate): boolean {
    if (predicate.kind !== undefined && segment.kind !== predicate.kind) return false;
    if (predicate.depthEquals !== undefined && segment.depth !== predicate.depthEquals) return false;
    if (predicate.keyEquals !== undefined && segment.key !== predicate.keyEquals) return false;
    if (predicate.valueEquals !== undefined && segment.value !== predicate.valueEquals) return false;

    if (predicate.valueStartsWith !== undefined) {
        if (segment.value === undefined) return false;
        if (!hasPrefix(segment.value, predicate.valueStartsWith)) return false;
    }

    if (predicate.textContains !== undefined && !contains(segment.text, predicate.textContains)) return false;

    if (predicate.inlineKind !== undefined || predicate.inlineValueContains !== undefined) {
        let found = false;
        for (const inline of segment.inlines) {
            if (predicate.inlineKind !== undefined && inline.kind !== predicate.inlineKind) continue;
            if (predicate.inlineValueContains !== undefined && !contains(inline.value, predicate.inlineValueContains)) {
                continue;
            }
            found = true;
            break;
        }
        if (!found) return false;
    }

    return true;
}

export function matchPattern(document: Document, pattern: SegmentPattern): Hit[] {
    const hits: Hit[] = [];
    const width = pattern.predicates.length;
    if (width === 0) return hits;

    const segments = document.segments;
    const last = segments.length - width;

    for (let i = 0; i <= last; i += 1) {
        let ok = true;
        for (let k = 0; k < width; k += 1) {
            const segment = segments[i + k];
            const predicate = pattern.predicates[k];
            if (segment === undefined || predicate === undefined || !matchesOne(segment, predicate)) {
                ok = false;
                break;
            }
        }
        if (!ok) continue;

        const span = segments.slice(i, i + width);
        const first = span[0];
        const final = span[span.length - 1];
        if (first === undefined || final === undefined) continue;

        hits.push({
            patternId: pattern.id,
            path: document.path,
            index: i,
            segments: span,
            span: { start: first.start, end: final.end, line: first.line },
        });
    }

    return hits;
}

export function matchAll(document: Document, patterns: readonly SegmentPattern[]): Hit[] {
    const out: Hit[] = [];
    for (const pattern of patterns) {
        for (const hit of matchPattern(document, pattern)) out.push(hit);
    }
    return out;
}
