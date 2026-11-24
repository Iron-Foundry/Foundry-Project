import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { surfacePrefix } from "../../../config/surface.config.ts";
import { stampedCitations } from "../formatters/board.formatter.ts";

export function citedAbsolute(repoRoot: string, cited: string): string | null {
    for (const root of [resolve(repoRoot, surfacePrefix()), repoRoot]) {
        const absolute = resolve(root, cited);
        if (existsSync(absolute)) return absolute;
    }

    return null;
}

export interface Contention {
    readonly key: string;
    readonly cited: string;
    readonly stamped: number;
    readonly moved: number;
}

export interface FanIn {
    readonly cited: string;
    readonly citations: number;
    readonly contended: number;
}

const OPEN_MARKER = "┌─── AGENT ";

const MARKER_SEPARATOR = " ─── ";

export function markerKey(line: string): string {
    const at = line.indexOf(OPEN_MARKER);
    if (at === -1) return "";

    const rest = line.slice(at + OPEN_MARKER.length);
    const stop = rest.indexOf(MARKER_SEPARATOR);
    return stop === -1 ? "" : rest.slice(0, stop).trim();
}

export function contendedCitations(
    source: string,
    modified: (path: string) => number | null,
): { contended: Contention[]; fanIn: FanIn[] } {
    const contended: Contention[] = [];
    const counts = new Map<string, { citations: number; contended: number }>();

    for (const line of source.split("\n")) {
        const key = markerKey(line);
        if (key.length === 0) continue;

        for (const citation of stampedCitations(line)) {
            const held = counts.get(citation.path) ?? { citations: 0, contended: 0 };
            held.citations += 1;

            const now = modified(citation.path);
            if (now !== null && now > citation.at) {
                held.contended += 1;
                contended.push({ key, cited: citation.path, stamped: citation.at, moved: now });
            }

            counts.set(citation.path, held);
        }
    }

    const fanIn = [...counts.entries()]
        .map(([cited, held]) => ({ cited, citations: held.citations, contended: held.contended }))
        .sort((first, second) => (second.citations === first.citations ? 0 : second.citations - first.citations));

    return { contended, fanIn };
}
