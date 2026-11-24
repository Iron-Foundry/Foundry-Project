import { resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

import { AXIS_DOCUMENTS, NODE_MODULES, SURFACE_ROOT } from "../constants/path.constants.ts";
import { readSource, toPosix, walk } from "../iterators/file.iterator.ts";
import { REFERENCE_FIELDS } from "../matchers/reference.matcher.ts";
import { readDocument } from "../readers/document.reader.ts";
import {
    applyEdits,
    editsFromFieldPrefixes,
    editsFromFieldValues,
    editsFromInlinePrefixes,
    editsFromInlines,
    type RenameMap,
} from "./segment.transformer.ts";

const SCAN_ROOTS = [SURFACE_ROOT];

const ROOT_DOCUMENTS = AXIS_DOCUMENTS;

export interface Move {
    readonly from: string;
    readonly to: string;
}

export function renameMapOf(moves: readonly Move[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const move of moves) {
        map[move.from] = move.to;
        map[`local:${move.from}`] = `local:${move.to}`;
    }
    return map;
}

export function rewriteReferences(repoRoot: string, map: RenameMap): number {
    const files: string[] = [];

    for (const root of SCAN_ROOTS) {
        for (const file of walk({
            root: resolve(repoRoot, root),
            ignored: [NODE_MODULES],
            extensions: [".md", ".ts"],
        })) {
            files.push(file);
        }
    }
    for (const name of ROOT_DOCUMENTS) files.push(resolve(repoRoot, name));

    let count = 0;

    for (const file of files) {
        let source: string;
        try {
            source = readSource(file);
        } catch {
            continue;
        }

        const document = readDocument(toPosix(repoRoot, file), source);
        const edits = [
            ...editsFromInlines(document, map, ["link-target", "inline-code", "import-path"]),
            ...editsFromFieldPrefixes(document, REFERENCE_FIELDS, map),
            ...editsFromInlinePrefixes(document, map, ["link-target", "inline-code"]),
        ];
        for (const key of REFERENCE_FIELDS) {
            for (const edit of editsFromFieldValues(document, key, map)) edits.push(edit);
        }
        if (edits.length === 0) continue;

        const result = applyEdits(source, edits);
        if (result.rejected.length > 0) continue;
        writeSurface(file, result.text);
        count += result.applied.length;
    }

    return count;
}
