import { mkdirSync, renameSync, rmdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

import { projectRoot } from "../../../config/surface.config.ts";
import { taxonomy } from "../../../config/taxonomy.config.ts";
import { GENERATED_DIR, NO_FIX_FLAG } from "../constants/path.constants.ts";
import { readSource, toPosix, walk } from "../iterators/file.iterator.ts";
import { hasFields, isCorpusMoveList } from "../predicates/schema.predicate.ts";
import { readDocument } from "../readers/document.reader.ts";
import { parseJson } from "../readers/json.reader.ts";
import { keyFromSymbol, nameParts, rawFacetOf, symbolOf } from "../resolvers/corpus.resolver.ts";
import { countBy, unresolvedFinding } from "../transformers/corpus.transformer.ts";
import { renameMapOf, rewriteReferences } from "../transformers/reference.transformer.ts";
import type { CorpusMove, CorpusRoot } from "../types/corpus.types.ts";
import type { Finding } from "../types/segment.types.ts";

const REPO_ROOT = projectRoot();
const CORPUS_ROOTS: Readonly<Record<string, CorpusRoot>> = taxonomy.corpusRoots;

const RMDIR_REFUSALS: ReadonlySet<string> = new Set(["ENOTEMPTY", "ENOENT", "EEXIST", "EBUSY"]);

export const RESTATES: readonly string[] = [
    "mutation_preview_first",
    "healing_is_default_in_every_entrypoint",
    "pattern_references_verified_after_rename",
    "born_conformant",
];

function isExpectedRmdirRefusal(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    if (!("code" in error)) return false;
    const code: unknown = error.code;
    return typeof code === "string" && RMDIR_REFUSALS.has(code);
}

function main(): void {
    if (process.argv.includes("--rewrite-refs")) {
        const reportPath = join(REPO_ROOT, GENERATED_DIR, "corpus.report.generated.json");
        const prior = parseJson(readSource(reportPath), reportPath);
        if (!hasFields(prior, ["moves"]) || !isCorpusMoveList(prior["moves"])) {
            throw new Error(`${reportPath} carries no readable moves list`);
        }
        const moves = prior["moves"];
        const rewritten = rewriteReferences(REPO_ROOT, renameMapOf(moves));
        process.stdout.write(`rewrote ${rewritten} references from ${moves.length} recorded moves\n`);
        return;
    }

    const apply = !process.argv.includes(NO_FIX_FLAG);

    const resolvedMoves: CorpusMove[] = [];
    const findings: Finding[] = [];

    for (const [rootName, config] of Object.entries(CORPUS_ROOTS)) {
        const rootAbs = resolve(REPO_ROOT, rootName);

        for (const file of walk({ root: rootAbs, ignored: [], extensions: [".md"] })) {
            const relPath = toPosix(REPO_ROOT, file);
            const document = readDocument(relPath, readSource(file));

            const insideSubtree = relPath.startsWith(`${rootName}/${config.filedUnder}/`);
            const name = relPath.slice(relPath.lastIndexOf("/") + 1);

            const rawFacet = rawFacetOf(document, config);
            const facet = rawFacet === null ? undefined : config.facetByValue[rawFacet];
            if (facet === undefined) {
                findings.push(
                    unresolvedFinding(
                        relPath,
                        "facet",
                        rawFacet ?? "absent",
                        `declare one of ${config.facetFields.join(", ")} carrying a value in the declared facet set`,
                    ),
                );
                continue;
            }

            let key: string | undefined;
            if (insideSubtree) {
                const symbol = symbolOf(document);
                if (symbol !== null) key = keyFromSymbol(symbol);
                if (key === undefined) {
                    findings.push(
                        unresolvedFinding(
                            relPath,
                            "symbol",
                            "absent",
                            "declare the canonical symbol as a level-2 heading",
                        ),
                    );
                    continue;
                }
            } else {
                key = nameParts(name)[0] ?? "";
                if (key.length === 0) {
                    findings.push(unresolvedFinding(relPath, "key", name, "name the file <key>.<facet>.md"));
                    continue;
                }
            }

            const segments = nameParts(name);
            const carriedVariant = segments.length >= 4 ? (segments[segments.length - 3] ?? null) : null;
            const originDir = relPath.slice(rootName.length + 1, relPath.lastIndexOf("/"));
            const variant = carriedVariant ?? config.variantByOrigin[originDir] ?? null;

            const filename = variant === null ? `${key}.${facet}.md` : `${key}.${variant}.${facet}.md`;
            const to = insideSubtree
                ? `${rootName}/${config.filedUnder}/${facet}/${filename}`
                : `${rootName}/${filename}`;

            if (to !== relPath) resolvedMoves.push({ from: relPath, to, facet, key, variant });
        }
    }

    const byTarget = new Map<string, string[]>();
    for (const move of resolvedMoves) {
        const list = byTarget.get(move.to) ?? [];
        list.push(move.from);
        byTarget.set(move.to, list);
    }
    for (const [target, sources] of byTarget) {
        if (sources.length < 2) continue;
        findings.push(
            unresolvedFinding(
                sources.join(" + "),
                "collision",
                target,
                "two files resolve to one name — give one a variant so the keys stay distinct",
            ),
        );
    }

    const blocked = findings.length > 0;
    const map = renameMapOf(resolvedMoves);

    let referencesRewritten = 0;

    if (apply && !blocked) {
        for (const move of resolvedMoves) {
            const fromAbs = resolve(REPO_ROOT, move.from);
            const toAbs = resolve(REPO_ROOT, move.to);
            mkdirSync(dirname(toAbs), { recursive: true });
            renameSync(fromAbs, toAbs);
        }

        for (const origin of Object.keys(CORPUS_ROOTS)) {
            const config = CORPUS_ROOTS[origin];
            if (config === undefined) continue;
            const nested = Object.keys(config.variantByOrigin).sort((a, b) => b.length - a.length);
            for (const dir of nested) {
                try {
                    rmdirSync(join(REPO_ROOT, origin, dir));
                } catch (error) {
                    if (!isExpectedRmdirRefusal(error)) throw error;
                }
            }
        }

        referencesRewritten = rewriteReferences(REPO_ROOT, map);
    }

    const report = {
        tool: "corpus",
        verdict: blocked ? "fail" : "pass",
        applied: apply && !blocked,
        resolved: resolvedMoves.length,
        byFacet: countBy(resolvedMoves, (m) => m.facet),
        byVariant: countBy(resolvedMoves, (m) => m.variant ?? "(none)"),
        referencesRewritten,
        findings,
        moves: resolvedMoves,
    };

    const target = join(REPO_ROOT, GENERATED_DIR, "corpus.report.generated.json");
    mkdirSync(dirname(target), { recursive: true });
    writeSurface(target, `${JSON.stringify(report, null, 2)}\n`);

    process.stdout.write(
        `${report.verdict.toUpperCase()}  resolved=${report.resolved} findings=${findings.length} ` +
            `${report.applied ? `applied, references rewritten=${referencesRewritten}` : "preview only"}\n` +
            `facets: ${JSON.stringify(report.byFacet)}\n` +
            `variants: ${JSON.stringify(report.byVariant)}\n` +
            `report: ${GENERATED_DIR}/corpus.report.generated.json\n` +
            (blocked ? "blocked — resolve the findings before applying\n" : "") +
            (!apply && !blocked ? `rehearsal only — rerun without ${NO_FIX_FLAG} to perform the moves\n` : ""),
    );

    process.exit(blocked ? 1 : 0);
}

main();
