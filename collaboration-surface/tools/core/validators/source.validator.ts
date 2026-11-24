import { SURFACE_READ_CALLS } from "../readers/surface.reader.ts";
import { importedNames } from "./writer.validator.ts";

const FILESYSTEM_MODULE = `"node:${"fs"}"`;

const TREE_DECLARATION = "readsTree:";

const SCOPE_FIELD = `context.${"paths"}`;

const FILESYSTEM_READERS = ["readFileSync", "readdirSync", "existsSync", "statSync"];

function importsReadPrimitive(line: string): boolean {
    const names = importedNames(line);
    return SURFACE_READ_CALLS.some((name) => names.includes(name));
}

export interface SourceBreach {
    readonly locus: string;
    readonly actual: string;
    readonly decide: string;
    readonly resolved: string;
}

export function unscopedRead(source: string): SourceBreach | null {
    if (source.includes(TREE_DECLARATION)) return null;

    let imports = false;
    for (const raw of source.split("\n")) {
        const line = raw.trim();
        if (!line.startsWith("import ")) continue;

        if (importsReadPrimitive(line)) imports = true;
        if (!line.endsWith(`${FILESYSTEM_MODULE};`)) continue;

        for (const reader of FILESYSTEM_READERS) {
            if (line.includes(reader)) imports = true;
        }
    }

    if (!source.includes(SCOPE_FIELD)) {
        return {
            locus: "declared scope",
            actual: "the rule never reads the path set the run declares",
            decide:
                "a rule that builds its own file set cannot be narrowed, so `--scope` is inert for it while " +
                "the report states the run was narrowed; take the path set from the context and declare any " +
                "extra input in `reads`, so what the rule examined is what the run said it would examine",
            resolved: "ignores scope",
        };
    }

    if (!imports) return null;

    return {
        locus: "filesystem import",
        actual: "the rule reads the filesystem directly",
        decide:
            "declare the extra inputs in `reads` and take them through the context — a rule reaching past " +
            "the context is outside the scope the run declares, so a narrowed run scans it wholly while the " +
            "report states it was narrowed, and no synthetic input can reach it, which is why it cannot be " +
            "proven to fire. Where the question is genuinely about the tree rather than about file contents, " +
            "declare `readsTree` with the reason instead",
        resolved: "unscoped read",
    };
}
