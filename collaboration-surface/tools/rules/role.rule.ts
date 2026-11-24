import { AGENT_INDEX } from "../core/constants/board.constants.ts";
import { ROLE_ROOT, ROLE_TEMPLATE } from "../core/constants/template.constants.ts";
import { underRoots } from "../core/filters/scope.filter.ts";
import { activeSeatLetters } from "../core/inspectors/index.inspector.ts";
import { checkRoleCoverage, checkRoleShape } from "../core/inspectors/role.inspector.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function finding(path: string, kind: string, locus: string, actual: string, expected: string, decide: string): Finding {
    return {
        rule: `role/${kind}`,
        path,
        line: 1,
        locus,
        stack: [
            { check: "role", resolved: path },
            { check: kind, resolved: locus },
        ],
        actual,
        expected,
        remediation: { action: "declare", from: locus, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "taxonomy",
    invariant: "every role document carries the same section set and the same declared operands",
    extensions: [".md"],
    kinds: ["templateAbsent", "roleMissing", "roleFieldMissing", "roleSectionMissing", "measuredSectionUnfilled"],
    heals: false,
    wholeScopeOnly: true,

    reads: [AGENT_INDEX, ROLE_TEMPLATE],

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const scoped = underRoots(context.paths, [ROLE_ROOT]);

        if (!context.exists(ROLE_TEMPLATE)) {
            return {
                findings: [
                    finding(
                        ROLE_TEMPLATE,
                        "templateAbsent",
                        "role",
                        "the role template the section contract derives from does not exist",
                        "a role template carrying the frontmatter operands and the section headings every role document answers to",
                        "the contract is DERIVED from the template rather than transcribed into this check, so an absent template leaves the check with nothing to enforce — and a check resolving its contract to an empty set passes every document vacuously, which is the shape a green reports over a surface nobody governs. Raise the template rather than restoring a transcribed list",
                    ),
                ],
                healed: [],
                derivations: { roles: scoped.length, letters: [] },
            };
        }

        const template = context.read(ROLE_TEMPLATE);

        for (const path of scoped) {
            checkRoleShape(
                path,
                context.read(path),
                template,
                (kind, locus, actual, expected, decide) => finding(path, kind, locus, actual, expected, decide),
                findings,
            );
        }

        const letters = activeSeatLetters(context.read(AGENT_INDEX));
        checkRoleCoverage(
            letters,
            scoped,
            (kind, locus, actual, expected, decide) => finding(AGENT_INDEX, kind, locus, actual, expected, decide),
            findings,
        );

        return { findings, healed: [], derivations: { roles: scoped.length, letters } };
    },
};
