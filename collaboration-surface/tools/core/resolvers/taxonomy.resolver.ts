import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { dirname, resolve } from "node:path";

import { surfacePrefix, surfaceRoot } from "../../../config/surface.config.ts";
import { taxonomy } from "../../../config/taxonomy.config.ts";
import type { TaxonomyData } from "../types/taxonomy.types.ts";

function derivedLetters(): string[] {
    const source = resolve(surfaceRoot(), taxonomy.derivedVariants.source);
    if (!existsSync(source)) return [];

    const out = new Set<string>();
    for (const line of readSurface(source, "utf8").split("\n")) {
        if (!line.startsWith("|")) continue;

        const cell = (line.split("|")[1] ?? "").trim();
        if (cell.length === 0) continue;

        let letters = true;
        for (const char of cell) {
            if ((char < "A" || char > "Z") && (char < "a" || char > "z")) letters = false;
        }

        if (letters) out.add(cell.toLowerCase());
    }

    return [...out];
}

function withinSurface(declared: Readonly<Record<string, readonly string[]>>): Record<string, readonly string[]> {
    const prefix = surfacePrefix();
    const out: Record<string, readonly string[]> = {};

    for (const [key, members] of Object.entries(declared)) {
        if (prefix.length === 0) {
            out[key] = members;
            continue;
        }
        out[key === "." ? prefix : `${prefix}/${key}`] = members;
    }

    return out;
}

export function loadTaxonomy(): TaxonomyData {
    const folderToTag: Record<string, string> = {};
    const folderToLayer: Record<string, string> = {};
    const concernFolders: string[] = [];
    const concernTags: string[] = [];

    for (const entry of taxonomy.concerns) {
        folderToTag[entry.folder] = entry.tag;
        folderToLayer[entry.folder] = entry.layer;
        concernFolders.push(entry.folder);
        concernTags.push(entry.tag);
    }

    return {
        containers: withinSurface(taxonomy.containers as unknown as Record<string, readonly string[]>),
        specialContainers: withinSurface(taxonomy.specialContainers as unknown as Record<string, readonly string[]>),
        foreignContainers: withinSurface(taxonomy.foreignContainers as unknown as Record<string, readonly string[]>),
        concernFolders,
        concernTags,
        folderToTag,
        folderToLayer,
        subjects: taxonomy.subjects,
        variants: taxonomy.variants,
        agentLetters: derivedLetters(),
        compoundMarkers: taxonomy.grammar.compoundMarkers,
        verificationMarkers: taxonomy.grammar.verificationMarkers,
        ignored: taxonomy.Ignored.foldersFiles,
        boundaryDocuments: taxonomy.boundaryDocuments,
        maxDepthFromRoot: taxonomy.grammar.maxDepthFromRoot,
        corpusRoots: taxonomy.corpusRoots,
        artifactRoots: taxonomy.artifactRoots,
        foreignGrammar: taxonomy.foreignGrammar as unknown as TaxonomyData["foreignGrammar"],
    };
}

export function rootOf(path: string, data: TaxonomyData): string | null {
    const roots = [...Object.keys(data.containers), ...Object.keys(data.specialContainers)];
    let best: string | null = null;
    for (const root of roots) {
        if (path === root || path.startsWith(`${root}/`)) {
            if (best === null || root.length > best.length) best = root;
        }
    }
    return best;
}

export interface GovernedPath {
    readonly root: string;
    readonly segments: readonly string[];
}

export function governedPath(path: string, data: TaxonomyData): GovernedPath | null {
    const root = rootOf(path, data);
    if (root === null) return null;

    const dir = dirname(path);
    const tail = dir === root ? "" : dir.slice(root.length + 1);
    return { root, segments: tail.length === 0 ? [] : tail.split("/") };
}
