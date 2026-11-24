import { basename, dirname } from "node:path";

import { lifetimeOf, surfacePath } from "../../config/surface.config.ts";
import { BLOCKING_SUFFIX } from "../core/constants/blocking.constants.ts";
import { UPSTREAM_ROOTS } from "../core/constants/path.constants.ts";
import { governedPath } from "../core/resolvers/taxonomy.resolver.ts";
import { checkPlacement, parseFilename } from "../core/validators/taxonomy.validator.ts";
import { PLACEMENT_CODES } from "../core/types/taxonomy.types.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding, Remediation } from "../core/types/segment.types.ts";
import type { TaxonomyData } from "../core/types/taxonomy.types.ts";

function folderForTag(tag: string, data: TaxonomyData): string | null {
    for (const folder of data.concernFolders) {
        if (data.folderToTag[folder] === tag) return folder;
    }
    return null;
}

function remediate(code: string, path: string, name: string, data: TaxonomyData): Remediation {
    if (code === "looseFileAtRoot" || code === "parentNotConcern") {
        const parsed = parseFilename(name, data);
        if (typeof parsed !== "string") {
            const folder = folderForTag(parsed.concern, data);
            if (folder !== null) {
                return {
                    action: "move",
                    from: path,
                    to: `${dirname(path)}/${folder}/${name}`,
                    target: `${dirname(path)}/${folder}`,
                    deterministic: true,
                    decide: "both operands are computed and this still does NOT heal, which is a property of the OPERATION rather than of the derivation: moving a file changes what every importer of it resolves, so the repair is not confined to the artifact the remediation names and applying it alone breaks the tree. A remediation heals where its effect is bounded by its own operands; this one is deterministic and unbounded, and the missing half is a reference rewrite this package does not perform. Take the move and the importers together, by hand, in one change",
                };
            }
        }
        return {
            action: "classify",
            from: path,
            to: null,
            target: path,
            deterministic: false,
            decide: "read the file, name the narrowest accurate concern, then place it in that concern folder",
        };
    }

    const decideBy: Record<string, string> = {
        dottedFolder: "a folder carries one word and never a dot — choose the single word it is",
        undeclaredContainer:
            "work the container ladder: subject folder, concern folder, already grouped, or not source at all — only a new grouping axis earns a container",
        nestedInSpecial: "a bucket holds files and never folders — move the folder out or stop declaring the bucket",
        tooDeep: "relieve sideways: a collision takes the variant slot, breadth takes a sibling subject folder",
        roleOutOfOrder: "roles resolve container < subject < concern and are never revisited — reorder or drop a level",
    };

    return {
        action: "move",
        from: path,
        to: null,
        target: path,
        deterministic: false,
        decide: decideBy[code] ?? `resolve placement code ${code}`,
    };
}

export function isImmutable(path: string): boolean {
    const declared = lifetimeOf(path);
    if (declared === null) return false;

    return declared.mutability === "frozen" && declared.removal === "none";
}

export const rule: RuleDeclaration = {
    stage: "structure",
    jurisdiction: "taxonomy",
    invariant: "every governed file resolves through the ordered roles to a concern folder within the depth cap",
    extensions: [],
    kinds: [...PLACEMENT_CODES],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const reached: string[] = [];
        const skippedAsImmutable: string[] = [];
        const skippedAsUpstream: string[] = [];
        const skippedAsOutsideJurisdiction: string[] = [];
        const skippedAsBoundaryDocument: string[] = [];

        const board = surfacePath("board");

        for (const path of context.paths) {
            if (UPSTREAM_ROOTS.some((root) => path.startsWith(root))) {
                skippedAsUpstream.push(path);
                continue;
            }
            if (path === board) {
                skippedAsBoundaryDocument.push(path);
                continue;
            }
            if (isImmutable(path)) {
                skippedAsImmutable.push(path);
                continue;
            }
            const governed = governedPath(path, context.taxonomy);
            if (governed === null) {
                skippedAsOutsideJurisdiction.push(path);
                continue;
            }

            const name = basename(path);
            if (context.taxonomy.boundaryDocuments.includes(name) || name.endsWith(BLOCKING_SUFFIX)) {
                skippedAsBoundaryDocument.push(path);
                continue;
            }
            reached.push(path);
            const verdict = checkPlacement(governed.root, governed.segments, context.taxonomy, name);
            if (verdict.ok) continue;

            const remediation = remediate(verdict.code ?? "", path, name, context.taxonomy);

            findings.push({
                rule: `placement/${verdict.code}`,
                path,
                line: 0,
                locus: verdict.evidence,
                stack: [
                    { check: "jurisdiction", resolved: `root=${governed.root}` },
                    {
                        check: "segments",
                        resolved: governed.segments.length === 0 ? "(none)" : governed.segments.join("/"),
                    },
                    { check: "placement", resolved: verdict.code ?? "fail" },
                ],
                actual: path,
                expected: remediation.to,
                remediation,
                healed: false,
            });
        }

        return {
            findings,
            healed: [],
            derivations: {
                reached,
                skippedAsImmutable,
                skippedAsUpstream,
                skippedAsOutsideJurisdiction,
                skippedAsBoundaryDocument,
            },
        };
    },
};
