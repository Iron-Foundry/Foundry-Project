import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { slotList } from "../../../config/surface.config.ts";
import { SURFACE_ROOT } from "../constants/path.constants.ts";
import { walk, toPosix } from "../iterators/file.iterator.ts";
import { writeRuleReport } from "../reporters/rule.reporter.ts";
import type { StepOptions, StepOutcome } from "../types/rule.types.ts";
import { commentsOf, isAttribution, stripComments, type CommentSpan } from "../normalizers/source.normalizer.ts";
import { resolveArtifactRoots } from "../resolvers/artifact.resolver.ts";
import { writeRepair } from "../writers/repair.writer.ts";
import { loadTaxonomy } from "../resolvers/taxonomy.resolver.ts";

export const CODE_EXTENSIONS: readonly string[] = slotList("convention", "code_extensions");

const CODE_ROOTS = [SURFACE_ROOT];

export function isVendored(spans: readonly CommentSpan[]): boolean {
    const leading = spans[0];
    return leading !== undefined && isAttribution(leading.text);
}

export interface CleanedFile {
    readonly path: string;
    readonly removed: number;
    readonly kept: number;
}

export interface CleanResult {
    readonly files: readonly CleanedFile[];
    readonly reached: readonly string[];
    readonly refused: readonly string[];
    readonly removed: number;
    readonly kept: number;
    readonly scanned: number;
}

export function codeFiles(repoRoot: string): string[] {
    const taxonomy = loadTaxonomy();
    const roots: string[] = [...Object.keys(taxonomy.containers), ...Object.keys(taxonomy.specialContainers)];

    for (const root of resolveArtifactRoots(repoRoot, taxonomy)) {
        if (root.unresolved === null) roots.push(root.path);
    }
    for (const root of CODE_ROOTS) {
        if (existsSync(resolve(repoRoot, root))) roots.push(root);
    }

    const seen = new Set<string>();
    const out: string[] = [];

    for (const root of roots) {
        for (const file of walk({
            root: resolve(repoRoot, root),
            ignored: taxonomy.ignored,
            extensions: [...CODE_EXTENSIONS],
        })) {
            const relative = toPosix(repoRoot, file);
            if (seen.has(relative)) continue;
            seen.add(relative);
            out.push(relative);
        }
    }

    return out.sort();
}

const INVARIANT = "authored code carries no comments";

export function cleanStage(options: StepOptions): StepOutcome {
    if (options.bypass.includes("clean")) {
        return {
            findings: [],
            stage: { stage: "meta", rule: "clean", invariant: INVARIANT, findings: 0, healed: 0, bypassed: true },
        };
    }

    const cleaned = cleanSources(options.repoRoot, options.fix, options.scope);

    writeRuleReport(options.repoRoot, "clean", {
        rule: "clean",
        stage: "meta",
        invariant: INVARIANT,
        verdict: "pass",
        scope: options.scope,
        authoritative: options.authoritative,
        scanned: cleaned.scanned,
        healed: cleaned.files.map((file) => `${file.path}: ${String(file.removed)} removed`),
        findings: [],
        derivations: {
            reached: [...cleaned.reached],
            refusedAsOutsideDeclaredScope: [...cleaned.refused],
            containment:
                "every repair passes the restricted writer, which refuses a path outside the scope this run DECLARED — " +
                "so containment is answered at one function rather than by a witness nobody holds for a repair scattered " +
                "across source, and a refusal is reported here rather than the write landing and being reported afterwards",
        },
    });

    return {
        findings: [],
        stage: {
            stage: "meta",
            rule: "clean",
            invariant: INVARIANT,
            findings: 0,
            healed: cleaned.files.length,
            bypassed: false,
        },
    };
}

export function cleanSources(repoRoot: string, apply: boolean, declared = ""): CleanResult {
    const files: CleanedFile[] = [];
    const refused: string[] = [];
    let removed = 0;
    let kept = 0;

    const paths = codeFiles(repoRoot);

    for (const path of paths) {
        const absolute = resolve(repoRoot, path);
        const source = readSurface(absolute, "utf8");
        const spans = commentsOf(path, source);
        if (spans.length === 0) continue;
        if (isVendored(spans)) continue;

        const result = stripComments(source, spans);
        if (result.removed === 0) continue;

        if (apply && result.text !== source) {
            const outcome = writeRepair({ repoRoot, declared }, path, result.text);
            if (!outcome.written) {
                refused.push(path);
                continue;
            }
        }

        files.push({ path, removed: result.removed, kept: result.kept });
        removed += result.removed;
        kept += result.kept;
    }

    return { files, reached: paths, refused, removed, kept, scanned: paths.length };
}
