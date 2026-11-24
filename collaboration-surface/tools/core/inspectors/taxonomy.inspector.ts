import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import type { TaxonomyData } from "../types/taxonomy.types.ts";

export interface ForeignMarker {
    readonly evidence: string;
    readonly why: string;
}

export function isDirectory(repoRoot: string, relPath: string): boolean {
    const absolute = resolve(repoRoot, relPath);
    if (!existsSync(absolute)) return false;
    try {
        return statSync(absolute).isDirectory();
    } catch {
        return false;
    }
}

function isGroupingFolder(name: string, pairs: readonly (readonly string[])[]): boolean {
    for (const pair of pairs) {
        const open = pair[0] ?? "";
        const close = pair[1] ?? "";
        if (open.length === 0 || close.length === 0) continue;
        if (name.length > open.length + close.length && name.startsWith(open) && name.endsWith(close)) {
            return true;
        }
    }
    return false;
}

export function foreignMarkerIn(repoRoot: string, root: string, data: TaxonomyData): ForeignMarker | null {
    const pairs = data.foreignGrammar.groupingDelimiters;
    const manifestNames = data.foreignGrammar.ownershipManifests;
    const pending: string[] = [root];

    while (pending.length > 0) {
        const current = pending.pop();
        if (current === undefined) continue;

        let entries;
        try {
            entries = readdirSync(resolve(repoRoot, current), { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const childPath = `${current}/${entry.name}`;

            if (!entry.isDirectory()) {
                if (manifestNames.includes(entry.name)) {
                    return {
                        evidence: childPath,
                        why: `"${entry.name}" makes its directory a runtime-identified unit, so its name is an identifier another system resolves.`,
                    };
                }
                continue;
            }

            if (data.ignored.includes(entry.name)) continue;

            if (isGroupingFolder(entry.name, pairs)) {
                return {
                    evidence: childPath,
                    why: `"${entry.name}" is another grammar's grouping construct, which this one forbids outright.`,
                };
            }

            pending.push(childPath);
        }
    }

    return null;
}
