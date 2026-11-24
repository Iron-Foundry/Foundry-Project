import { basename, dirname } from "node:path";

import { governedPath } from "../core/resolvers/taxonomy.resolver.ts";
import { checkNaming, checkPlacement, parseFilename } from "../core/validators/taxonomy.validator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding, Remediation } from "../core/types/segment.types.ts";
import { NAMING_CODES } from "../core/types/taxonomy.types.ts";
import type { TaxonomyData } from "../core/types/taxonomy.types.ts";

function remediate(code: string, path: string, name: string, parentFolder: string, data: TaxonomyData): Remediation {
    if (code === "concernMismatch") {
        const expected = data.folderToTag[parentFolder];
        const parsed = parseFilename(name, data);
        if (expected !== undefined && typeof parsed !== "string") {
            const variant = parsed.variant === null ? "" : `${parsed.variant}.`;
            return {
                action: "rename",
                from: name,
                to: `${parsed.subject}.${variant}${expected}.${parsed.ext}`,
                target: dirname(path),
                deterministic: true,
                decide: "both operands are computed and this still does NOT heal, which is a property of the OPERATION rather than of the derivation: renaming a file changes what every importer of it resolves, so the repair is not confined to the artifact the remediation names and applying it alone breaks the tree. A remediation heals where its effect is bounded by its own operands; this one is deterministic and unbounded, and the missing half is a reference rewrite this package does not perform. Take the rename and the importers together, by hand, in one change",
            };
        }
    }

    const decideBy: Record<string, string> = {
        unparsable:
            "name it <subject>[.<variant>].<concern>.<ext> — read the file, take the narrowest accurate concern, use a declared subject",
        subjectEqualsConcern:
            "the subject carries no information when it equals the concern — name what the file serves",
        undeclaredSlot:
            "work the vocabulary ladder: pick an existing word, else reason it by the is-a test, else the filename is wrong",
    };

    return {
        action: code === "undeclaredSlot" ? "declare" : "rename",
        from: name,
        to: null,
        target: path,
        deterministic: false,
        decide: decideBy[code] ?? `resolve naming code ${code}`,
    };
}

export const rule: RuleDeclaration = {
    stage: "structure",
    jurisdiction: "taxonomy",
    invariant: "every filename slot draws from its closed array and the concern tag matches the parent folder",
    extensions: [],
    kinds: [...NAMING_CODES],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const reached: string[] = [];
        const skippedAsOutsideJurisdiction: string[] = [];
        const skippedAsUnplaceable: string[] = [];

        for (const path of context.paths) {
            const governed = governedPath(path, context.taxonomy);
            if (governed === null) {
                skippedAsOutsideJurisdiction.push(path);
                continue;
            }

            const placement = checkPlacement(governed.root, governed.segments, context.taxonomy);
            if (!placement.ok || placement.foreign === true) {
                skippedAsUnplaceable.push(path);
                continue;
            }
            reached.push(path);

            const name = basename(path);
            const parentFolder = placement.concernFolder ?? "";
            const verdict = checkNaming(name, parentFolder, context.taxonomy);
            if (verdict.ok) continue;

            const remediation = remediate(verdict.code ?? "", path, name, parentFolder, context.taxonomy);

            findings.push({
                rule: `slot/${verdict.code}`,
                path,
                line: 0,
                locus: verdict.evidence,
                stack: [
                    { check: "jurisdiction", resolved: `root=${governed.root}` },
                    { check: "concernFolder", resolved: parentFolder },
                    { check: "naming", resolved: verdict.code ?? "fail" },
                ],
                actual: name,
                expected: remediation.to,
                remediation,
                healed: false,
            });
        }

        return { findings, healed: [], derivations: { reached, skippedAsOutsideJurisdiction, skippedAsUnplaceable } };
    },
};
