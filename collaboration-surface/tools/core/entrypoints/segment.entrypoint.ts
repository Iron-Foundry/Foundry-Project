import { resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

import { projectRoot } from "../../../config/surface.config.ts";
import { GENERATED_DIR, NODE_MODULES, NO_FIX_FLAG } from "../constants/path.constants.ts";
import { readSource, toPosix, walk } from "../iterators/file.iterator.ts";
import { matchAll } from "../matchers/segment.matcher.ts";
import { isStringMap } from "../predicates/schema.predicate.ts";
import { readDocument } from "../readers/document.reader.ts";
import { readJson } from "../readers/json.reader.ts";
import { type Report, toEditRecords, toHitRecords, verdictOf, writeReport } from "../reporters/segment.reporter.ts";
import {
    applyEdits,
    editsFromFieldPrefixes,
    editsFromFieldValues,
    editsFromInlinePrefixes,
    editsFromInlines,
    type RenameMap,
} from "../transformers/segment.transformer.ts";
import type { Edit, Finding, Hit, SegmentPattern } from "../types/segment.types.ts";

const REPO_ROOT = projectRoot();

export const RESTATES: readonly string[] = [
    "mutation_preview_first",
    "healing_is_default_in_every_entrypoint",
    "pattern_references_verified_after_rename",
];

const IGNORED = [
    NODE_MODULES,
    ".git",
    GENERATED_DIR,
    "cache",
    "logs",
    "crashes",
    "settings.json",
    "settings.local.json",
];

const REFERENCE_FIELDS = ["see", "source", "intel", "action", "detect", "canon", "digest"] as const;

const PATTERNS: SegmentPattern[] = [
    { id: "record-cross-reference", predicates: [{ kind: "field", keyEquals: "see" }] },
    { id: "record-source-pointer", predicates: [{ kind: "field", keyEquals: "source", valueStartsWith: "local:" }] },
    { id: "import-directive", predicates: [{ inlineKind: "import-path" }] },
    {
        id: "record-header",
        predicates: [
            { kind: "heading", depthEquals: 3 },
            { kind: "field", keyEquals: "type" },
        ],
    },
];

interface Args {
    readonly scan: string | null;
    readonly renameMap: string | null;
    readonly apply: boolean;
    readonly patternId: string | null;
}

function parseArgs(argv: readonly string[]): Args {
    let scan: string | null = null;
    let renameMap: string | null = null;
    let apply = true;
    let patternId: string | null = null;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--scan") scan = argv[i + 1] ?? null;
        else if (arg === "--rename") renameMap = argv[i + 1] ?? null;
        else if (arg === "--pattern") patternId = argv[i + 1] ?? null;
        else if (arg === NO_FIX_FLAG) apply = false;
    }

    return { scan, renameMap, apply, patternId };
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const root = resolve(REPO_ROOT, args.scan ?? ".claude");

    const files = walk({ root, ignored: IGNORED, extensions: [".md", ".ts"] });

    const patterns = args.patternId === null ? PATTERNS : PATTERNS.filter((p) => p.id === args.patternId);

    const mapPath = args.renameMap;
    const map: RenameMap =
        mapPath === null ? {} : readJson(readSource(resolve(REPO_ROOT, mapPath)), isStringMap, mapPath, "RenameMap");

    const hits: Hit[] = [];
    const edits: Edit[] = [];
    const findings: Finding[] = [];
    const byExtension: Record<string, number> = {};

    for (const file of files) {
        const relPath = toPosix(REPO_ROOT, file);
        const dot = relPath.lastIndexOf(".");
        const ext = dot === -1 ? "(none)" : relPath.slice(dot);
        byExtension[ext] = (byExtension[ext] ?? 0) + 1;

        const document = readDocument(relPath, readSource(file));

        for (const hit of matchAll(document, patterns)) hits.push(hit);

        if (args.renameMap !== null) {
            for (const edit of editsFromInlines(document, map, ["link-target", "inline-code", "import-path"])) {
                edits.push(edit);
            }
            for (const key of REFERENCE_FIELDS) {
                for (const edit of editsFromFieldValues(document, key, map)) edits.push(edit);
            }
            for (const edit of editsFromFieldPrefixes(document, REFERENCE_FIELDS, map)) edits.push(edit);
            for (const edit of editsFromInlinePrefixes(document, map, ["link-target", "inline-code"])) {
                edits.push(edit);
            }
        }
    }

    const rejected: Edit[] = [];

    if (args.renameMap !== null && args.apply) {
        const byPath = new Map<string, Edit[]>();
        for (const edit of edits) {
            const list = byPath.get(edit.path) ?? [];
            list.push(edit);
            byPath.set(edit.path, list);
        }

        for (const [relPath, fileEdits] of byPath) {
            const absolute = resolve(REPO_ROOT, relPath);
            const result = applyEdits(readSource(absolute), fileEdits);
            for (const bad of result.rejected) rejected.push(bad);
            if (result.rejected.length === 0) writeSurface(absolute, result.text);
        }
    }

    for (const bad of rejected) {
        findings.push({
            rule: "segment/editOverlap",
            path: bad.path,
            line: 0,
            locus: `bytes ${bad.start}..${bad.end}`,
            stack: [
                { check: "applyEdits", resolved: "right-to-left" },
                { check: "boundary", resolved: `edit end ${bad.end} crossed a prior edit start` },
            ],
            actual: bad.reason,
            expected: null,
            remediation: {
                action: "split",
                from: bad.reason,
                to: null,
                target: bad.path,
                deterministic: false,
                decide: "two rename-map entries resolve to overlapping spans in this file — narrow one key so the spans are disjoint, then re-run",
            },
            healed: false,
        });
    }

    const report: Report = {
        tool: "segment",
        verdict: verdictOf(findings, rejected),
        scanned: files.length,
        findings,
        hits: toHitRecords(hits),
        edits: toEditRecords(edits),
        rejected: toEditRecords(rejected),
        coverage: { roots: [toPosix(REPO_ROOT, root) || "."], filesByExtension: byExtension },
    };

    const target = writeReport(REPO_ROOT, "segment", report);

    process.stdout.write(
        `${report.verdict.toUpperCase()}  scanned=${report.scanned} hits=${report.hits.length} ` +
            `edits=${report.edits.length} rejected=${report.rejected.length}\n` +
            `report: ${toPosix(REPO_ROOT, target)}\n` +
            (args.renameMap !== null && !args.apply ? `rehearsal only — rerun without ${NO_FIX_FLAG} to write\n` : ""),
    );

    process.exit(report.verdict === "pass" ? 0 : 1);
}

main();
