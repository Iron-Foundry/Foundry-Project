import { existsSync, statSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { relative, resolve, sep } from "node:path";

import type { ArtifactRootData, TaxonomyData } from "../types/taxonomy.types.ts";

export interface ArtifactRoot {
    readonly key: string;
    readonly path: string;
    readonly binding: string;
    readonly field: string;
    readonly unresolved: string | null;
}

function toPosix(root: string, path: string): string {
    const rel = relative(root, path);
    if (sep === "/") return rel;
    let out = "";
    for (let i = 0; i < rel.length; i += 1) out += rel[i] === sep ? "/" : rel[i];
    return out;
}

function readField(source: unknown, field: readonly string[]): string | null {
    let current: unknown = source;
    for (const key of field) {
        if (typeof current !== "object" || current === null) return null;
        current = (current as Record<string, unknown>)[key];
    }
    return typeof current === "string" ? current : null;
}

function isDirectory(absolute: string): boolean {
    if (!existsSync(absolute)) return false;
    try {
        return statSync(absolute).isDirectory();
    } catch {
        return false;
    }
}

function unresolved(key: string, data: ArtifactRootData, reason: string): ArtifactRoot {
    return { key, path: "", binding: data.binding, field: data.field.join("."), unresolved: reason };
}

export function resolveArtifactRoots(repoRoot: string, data: TaxonomyData): ArtifactRoot[] {
    const out: ArtifactRoot[] = [];

    for (const [key, entry] of Object.entries(data.artifactRoots)) {
        const bindingAbs = resolve(repoRoot, entry.binding);

        if (!existsSync(bindingAbs)) {
            out.push(unresolved(key, entry, `binding file ${entry.binding} does not exist`));
            continue;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(bindingAbs, "utf8"));
        } catch (error) {
            out.push(unresolved(key, entry, `binding file ${entry.binding} is not valid JSON: ${String(error)}`));
            continue;
        }

        const bound = readField(parsed, entry.field);
        if (bound === null) {
            out.push(unresolved(key, entry, `field ${entry.field.join(".")} is absent or not a string`));
            continue;
        }

        const boundAbs = resolve(repoRoot, bound);
        const boundRel = toPosix(repoRoot, boundAbs);

        if (boundRel.startsWith("..")) {
            out.push(unresolved(key, entry, `${entry.field.join(".")} resolves to ${bound}, outside the repository`));
            continue;
        }

        for (const subtree of entry.subtrees) {
            const path = boundRel.length === 0 ? subtree : `${boundRel}/${subtree}`;
            if (!isDirectory(resolve(repoRoot, path))) {
                out.push(unresolved(key, entry, `subtree ${path} does not exist`));
                continue;
            }
            out.push({ key, path, binding: entry.binding, field: entry.field.join("."), unresolved: null });
        }
    }

    return out;
}
