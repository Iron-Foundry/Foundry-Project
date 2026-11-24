import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { contentIsImmutable, surfacePrefix, surfaceRoot } from "../../config/surface.config.ts";
import { cyclesIn } from "../core/analyzers/graph.analyzer.ts";
import { BOARD_PATH } from "../core/constants/board.constants.ts";
import { AXIS_DOCUMENTS, UPSTREAM_ROOTS } from "../core/constants/path.constants.ts";
import { referencesIn, type Reference } from "../core/matchers/reference.matcher.ts";
import { readDocument } from "../core/readers/document.reader.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding, Remediation } from "../core/types/segment.types.ts";
import type { TaxonomyData } from "../core/types/taxonomy.types.ts";

function rootsOf(repoRoot: string, taxonomy: TaxonomyData): ReadonlySet<string> {
    const roots = new Set<string>();

    for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) roots.add(entry.name);
    }

    for (const entry of readdirSync(surfaceRoot(), { withFileTypes: true })) {
        if (entry.isDirectory()) roots.add(entry.name);
    }

    for (const folder of taxonomy.concernFolders) roots.add(folder);
    for (const members of Object.values(taxonomy.containers)) {
        for (const member of members) roots.add(member);
    }
    for (const members of Object.values(taxonomy.specialContainers)) {
        for (const member of members) roots.add(member);
    }

    return roots;
}

function namesInTree(target: string, roots: ReadonlySet<string>, candidates: number): boolean {
    if (candidates > 0) return true;

    const slash = target.indexOf("/");
    return slash !== -1 && roots.has(target.slice(0, slash));
}

function resolvesAgainstAncestor(path: string, target: string, existing: ReadonlySet<string>): boolean {
    let directory = dirname(path);

    while (directory.length > 0 && directory !== ".") {
        if (existing.has(`${directory}/${target}`)) return true;

        const cut = directory.lastIndexOf("/");
        if (cut === -1) break;
        directory = directory.slice(0, cut);
    }

    return existing.has(`${directory}/${target}`);
}

function settledTarget(context: RuleContext, target: string, existing: ReadonlySet<string>): string | null {
    if (existing.has(target)) return target;
    if (existsSync(resolve(context.repoRoot, target))) return target;

    const prefix = surfacePrefix();
    const prefixed = prefix.length === 0 ? target : `${prefix}/${target}`;
    return existsSync(resolve(context.repoRoot, prefixed)) ? prefixed : null;
}

function recordEdge(edges: Map<string, Set<string>>, from: string, to: string): void {
    if (from === to) return;
    if (!to.endsWith(".md")) return;

    const cited = edges.get(from) ?? new Set<string>();
    cited.add(to);
    edges.set(from, cited);
}

function remediate(reference: Reference, path: string, candidate: string | null): Remediation {
    if (candidate !== null) {
        return {
            action: "rename",
            from: reference.target,
            to: candidate,
            target: path,
            deterministic: true,
            decide: null,
        };
    }

    return {
        action: "rename",
        from: reference.target,
        to: null,
        target: path,
        deterministic: false,
        decide:
            "the referenced file does not exist and no single file in the tree carries its basename — " +
            "locate the intended target, or drop the reference if what it pointed at is gone",
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "taxonomy",
    reads: [...AXIS_DOCUMENTS, BOARD_PATH],
    readsTree:
        "a reference resolves against the whole tree rather than against the readable path set — it may " +
        "point at a binary, a generated artifact or a directory none of which the run hands to a rule — so " +
        "this rule reaches past the context by construction",
    invariant:
        "every in-tree reference in a governed document and on the coordination board resolves to a file that exists, and no set of documents cites itself in a closed loop",
    extensions: [".md"],
    kinds: ["unresolved", "citationCycle"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const edges = new Map<string, Set<string>>();

        const existing = new Set(context.paths);
        const roots = rootsOf(context.repoRoot, context.taxonomy);
        const byBasename = new Map<string, string[]>();
        for (const path of context.paths) {
            const name = basename(path);
            const list = byBasename.get(name) ?? [];
            list.push(path);
            byBasename.set(name, list);
        }

        const reachable = new Set(context.paths);
        for (const axis of AXIS_DOCUMENTS) {
            if (!context.paths.includes(axis) && !existsSync(resolve(context.repoRoot, axis))) continue;
            reachable.add(axis);
        }

        if (existsSync(resolve(context.repoRoot, BOARD_PATH))) reachable.add(BOARD_PATH);

        const skippedAsImmutableContent: string[] = [];

        for (const path of reachable) {
            if (UPSTREAM_ROOTS.some((root) => path.startsWith(root))) continue;
            if (contentIsImmutable(path)) {
                skippedAsImmutableContent.push(path);
                continue;
            }
            const document = readDocument(path, context.read(path));

            for (const segment of document.segments) {
                for (const reference of referencesIn(segment)) {
                    const settled = settledTarget(context, reference.target, existing);
                    if (settled !== null) {
                        recordEdge(edges, path, settled);
                        continue;
                    }

                    if (resolvesAgainstAncestor(path, reference.target, existing)) continue;

                    const candidates = byBasename.get(basename(reference.target)) ?? [];
                    if (!namesInTree(reference.target, roots, candidates.length)) continue;

                    const candidate = candidates.length === 1 ? (candidates[0] ?? null) : null;

                    findings.push({
                        rule: "reference/unresolved",
                        path,
                        line: reference.line,
                        locus: reference.locus,
                        stack: [
                            { check: "scheme", resolved: "in-tree" },
                            { check: "rootRelative", resolved: "absent" },
                            { check: "documentRelative", resolved: "absent" },
                            { check: "basenameCandidates", resolved: String(candidates.length) },
                        ],
                        actual: reference.target,
                        expected: candidate,
                        remediation: remediate(reference, path, candidate),
                        healed: false,
                    });
                }
            }
        }

        const cycles = cyclesIn(edges);
        for (const cycle of cycles) {
            const entry = cycle[0] ?? "";
            findings.push({
                rule: "reference/citationCycle",
                path: entry,
                line: 1,
                locus: cycle.join(" > "),
                stack: [
                    { check: "graph", resolved: String(edges.size) },
                    { check: "cycleLength", resolved: String(cycle.length) },
                ],
                actual: `${cycle.join(" > ")} > ${entry}`,
                expected: null,
                remediation: {
                    action: "none",
                    from: entry,
                    to: null,
                    target: entry,
                    deterministic: false,
                    decide: "a closed citation loop has no entry point, so a reader following the graph to understand the subject is returned to where they started and no document in the loop is the one that states the thing. Break it by deciding which document OWNS the subject and making the others cite it one-way — never by deleting a citation to satisfy the count, because the loop is a statement that ownership was never settled",
                },
                healed: false,
            });
        }

        return {
            findings,
            healed: [],
            derivations: {
                reached: [...reachable].filter((path) => !skippedAsImmutableContent.includes(path)).sort(),
                skippedAsImmutableContent: skippedAsImmutableContent.sort(),
                citing: [...edges.keys()].sort(),
                cycles: cycles.map((cycle) => cycle.join(" > ")),
            },
        };
    },
};
