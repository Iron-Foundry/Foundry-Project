import { surfacePrefix } from "../../config/surface.config.ts";
import { localImports } from "../core/analyzers/graph.analyzer.ts";
import { LEAF_FOLDERS } from "../core/constants/layer.constants.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const CONFIG_ROOT = ((): string => {
    const prefix = surfacePrefix();
    return prefix.length === 0 ? "config/" : `${prefix}/config/`;
})();

const DECIDE =
    "a leaf is the innermost tier and imports only leaves, which is what keeps the dependency graph acyclic " +
    "at its base and stops domain vocabulary reaching the tier every other tier depends on. An import " +
    "climbing OUT of the leaf tier inverts that: the leaf now needs what needs it, so nothing can be read " +
    "or replaced without reading the layer above it. Move the shared value DOWN into a leaf, or move the " +
    "importing module UP out of the leaf tier — never satisfy it by widening what counts as a leaf";

function inLeafTier(path: string): boolean {
    for (const folder of LEAF_FOLDERS) {
        if (path.startsWith(folder)) return true;
    }
    return false;
}

function isSubstrate(path: string): boolean {
    return path.startsWith(CONFIG_ROOT);
}

export const rule: RuleDeclaration = {
    stage: "structure",
    jurisdiction: "all",
    invariant:
        "a module in the leaf tier imports only from the leaf tier or from the parameter surface beneath it, which depends on nothing in the tree and so cannot close a cycle",
    extensions: [".ts"],
    kinds: ["leafClimbsOut"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const known = new Set(context.paths);
        const reached: string[] = [];

        for (const path of context.paths) {
            if (!inLeafTier(path)) continue;
            reached.push(path);

            for (const imported of localImports(path, context.read(path), known)) {
                if (inLeafTier(imported)) continue;
                if (isSubstrate(imported)) continue;

                findings.push({
                    rule: "purity/leafClimbsOut",
                    path,
                    line: 1,
                    locus: imported,
                    stack: [
                        { check: "tier", resolved: "leaf" },
                        { check: "importedTier", resolved: "above" },
                    ],
                    actual: imported,
                    expected: null,
                    remediation: {
                        action: "none",
                        from: path,
                        to: null,
                        target: path,
                        deterministic: false,
                        decide: DECIDE,
                    },
                    healed: false,
                });
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                reached,
                skippedAsOutsideLeafTier: context.paths.filter((path) => !inLeafTier(path)),
                leafFolders: [...LEAF_FOLDERS],
            },
        };
    },
};
