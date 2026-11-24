import { slotText, surfacePath, surfacePrefix } from "../../config/surface.config.ts";
import { underRoots } from "../core/filters/scope.filter.ts";
import { axisConsumers, silentOnItsOwnAxis } from "../core/validators/declaration.validator.ts";
import { UPSTREAM_ROOTS } from "../core/constants/path.constants.ts";

const AXIS_ADAPTER = slotText("project", "runtime_adapter");

const AXIS_GOVERNED = [
    `${surfacePath("pipeline")}/`,
    surfacePrefix().length === 0 ? AXIS_ADAPTER : `${surfacePrefix()}/${AXIS_ADAPTER}`,
];

const AXIS_REACHES = [
    "lifetimeOf(",
    "seededLifetimeOf(",
    "lifetime.declared",
    "declared.retention",
    "declared.mutability",
    "declared.removal",
];
import { inspectManifests } from "../core/inspectors/manifest.inspector.ts";
import { foreignMarkerIn, isDirectory } from "../core/inspectors/taxonomy.inspector.ts";
import { resolveArtifactRoots } from "../core/resolvers/artifact.resolver.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const SSOT = surfacePath("taxonomy_config");

function finding(kind: string, path: string, locus: string, decide: string): Finding {
    return {
        rule: `declaration/${kind}`,
        path: SSOT,
        line: 0,
        locus,
        stack: [
            { check: "declared", resolved: locus },
            { check: "onDisk", resolved: "absent" },
        ],
        actual: `${path} is declared but absent`,
        expected: null,
        remediation: { action: "declare", from: path, to: null, target: SSOT, deterministic: false, decide },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "meta",
    jurisdiction: "taxonomy",

    readsTree:
        "the invariant is that a declared root resolves to a directory that exists, and a declared " +
        "directory holding no files contributes no paths at all — so a path set cannot tell a root that " +
        "is declared and empty from one that is declared and absent, which is the case this rule exists " +
        "to catch",
    invariant: "every declared root, container, bucket and corpus root resolves to a directory on disk",
    extensions: [],
    kinds: [
        "missingRoot",
        "missingContainer",
        "missingCorpusSubtree",
        "missingUpstreamRoot",
        "foreignGrammarClaimed",
        "unresolvedArtifactRoot",
        "unreadAssertedAxis",
        "declaredRuntimeDependency",
        "unreachedDependency",
    ],
    heals: false,
    wholeScopeOnly: true,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const data = context.taxonomy;

        const roots = new Set<string>([
            ...Object.keys(data.containers),
            ...Object.keys(data.specialContainers),
            ...Object.keys(data.corpusRoots),
        ]);

        const resolvedRoots: string[] = [];
        const resolvedUpstream: string[] = [];

        for (const root of roots) {
            if (isDirectory(context.repoRoot, root)) {
                resolvedRoots.push(root);
                continue;
            }
            findings.push(
                finding(
                    "missingRoot",
                    root,
                    `root "${root}"`,
                    "create the root, or remove it from containers / specialContainers / corpusRoots — a root that does not exist governs nothing",
                ),
            );
        }

        for (const root of UPSTREAM_ROOTS) {
            const trimmed = root.endsWith("/") ? root.slice(0, -1) : root;
            if (isDirectory(context.repoRoot, trimmed)) {
                resolvedUpstream.push(trimmed);
                continue;
            }
            findings.push(
                finding(
                    "missingUpstreamRoot",
                    trimmed,
                    `upstream root "${trimmed}"`,
                    "create the tree, or remove it from the upstream declaration — an upstream root EXEMPTS its contents from the naming, tense and reference gates, so one that resolves to nothing exempts nothing while reading as a considered exclusion, and the next tree that lands under a similar name inherits an exemption nobody granted it",
                ),
            );
        }

        const declaredFolders: [string, readonly string[]][] = [
            ...Object.entries(data.containers),
            ...Object.entries(data.specialContainers),
        ];

        for (const [root, folders] of declaredFolders) {
            if (!isDirectory(context.repoRoot, root)) continue;
            for (const folder of folders) {
                const path = `${root}/${folder}`;
                if (isDirectory(context.repoRoot, path)) continue;
                findings.push(
                    finding(
                        "missingContainer",
                        path,
                        `"${folder}" under "${root}"`,
                        "create the folder, or drop it from the root's declared set — an undeclared-but-present folder fails placement, while a declared-but-absent one fails nothing at all",
                    ),
                );
            }
        }

        for (const [root, config] of Object.entries(data.corpusRoots)) {
            const path = `${root}/${config.filedUnder}`;
            if (isDirectory(context.repoRoot, path)) continue;
            findings.push(
                finding(
                    "missingCorpusSubtree",
                    path,
                    `filedUnder "${config.filedUnder}" of corpus root "${root}"`,
                    "create the subtree, or correct filedUnder — the facet filing check is skipped entirely when it resolves nowhere",
                ),
            );
        }

        for (const root of roots) {
            if (!isDirectory(context.repoRoot, root)) continue;
            const marker = foreignMarkerIn(context.repoRoot, root, data);
            if (marker === null) continue;
            findings.push({
                rule: "declaration/foreignGrammarClaimed",
                path: SSOT,
                line: 0,
                locus: `root "${root}"`,
                stack: [
                    { check: "declared", resolved: `root "${root}"` },
                    { check: "onDisk", resolved: "present" },
                    { check: "foreignGrammar", resolved: marker.evidence },
                ],
                actual: `${root} is declared, and holds ${marker.evidence}`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: root,
                    to: null,
                    target: SSOT,
                    deterministic: false,
                    decide: `${marker.why} Remove the declaration — a tree whose names are load-bearing elsewhere is governed on its own axis, never renamed to satisfy this grammar.`,
                },
                healed: false,
            });
        }

        for (const root of resolveArtifactRoots(context.repoRoot, data)) {
            if (root.unresolved === null) continue;
            findings.push({
                rule: "declaration/unresolvedArtifactRoot",
                path: SSOT,
                line: 0,
                locus: `artifactRoots "${root.key}"`,
                stack: [
                    { check: "binding", resolved: root.binding },
                    { check: "field", resolved: root.field },
                    { check: "resolved", resolved: "absent" },
                ],
                actual: root.unresolved,
                expected: null,
                remediation: {
                    action: "declare",
                    from: root.key,
                    to: null,
                    target: SSOT,
                    deterministic: false,
                    decide:
                        "repair the binding, or drop the artifact root — every content rule declaring this " +
                        "jurisdiction currently scans nothing and reports a pass for files it never opened",
                },
                healed: false,
            });
        }

        for (const manifestFinding of inspectManifests(context.repoRoot, data.ignored)) {
            findings.push(manifestFinding);
        }

        const axisInspected: string[] = [];

        for (const path of underRoots(context.paths, AXIS_GOVERNED)) {
            for (const consumer of axisConsumers(context.read(path), AXIS_REACHES)) {
                axisInspected.push(
                    `${path}:${consumer.name} asserts ${consumer.asserted}, reads ${consumer.read.join("+") || "no axis"}`,
                );
                if (!silentOnItsOwnAxis(consumer)) continue;

                findings.push({
                    rule: "declaration/unreadAssertedAxis",
                    path,
                    line: consumer.line,
                    locus: consumer.name,
                    stack: [
                        { check: "reachesLifetime", resolved: "yes" },
                        { check: "asserts", resolved: consumer.asserted },
                        { check: "reads", resolved: consumer.read.join("+") || "no axis" },
                    ],
                    actual: `${consumer.name} names the ${consumer.asserted} axis and never reads it, deciding from ${consumer.read.join(" and ") || "no declared axis"} instead`,
                    expected: `${consumer.name} reads the ${consumer.asserted} field its own identity asserts`,
                    remediation: {
                        action: "declare",
                        from: consumer.read.join("+") || "no axis",
                        to: consumer.asserted,
                        target: path,
                        deterministic: false,
                        decide: "the declared axes are INDEPENDENT by the model this tree governs itself by — no two are derivable from each other — so a predicate deciding one of them from the others takes a derivation the model states is unavailable, and it is wrong from its first line rather than by drifting. THE SCOPE IS A BODY SCAN RATHER THAN A SIGNATURE SCAN, DELIBERATELY: narrowing to functions whose PARAMETER TYPE is the declared record keys on the property the CORRECT members share, so it passes every true negative and never sees a predicate that resolves the record inside its own body, which is the shape this check exists for. The residue is a predicate naming NO axis while reading the wrong fields, invisible here and stated rather than gated weakly, because the general question is what a predicate is FOR and no surface holds that",
                    },
                    healed: false,
                });
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                declarationsWalked: resolvedRoots.length + resolvedUpstream.length,
                resolvedRoots,
                resolvedUpstream,
                axisInspected,
            },
        };
    },
};
