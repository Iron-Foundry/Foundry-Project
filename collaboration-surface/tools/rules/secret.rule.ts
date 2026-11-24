import { isResolved, slotText } from "../../config/surface.config.ts";
import { bearsSecret } from "../core/predicates/secret.predicate.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const BEARER: string | null = isResolved("project", "credential_bearer")
    ? slotText("project", "credential_bearer")
    : null;

const BEARER_NAME = BEARER === null ? "no declared bearer" : BEARER;

function basenameOf(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? path : path.slice(slash + 1);
}

function finding(path: string): Finding {
    return {
        rule: "secret/secretOutsideItsBearer",
        path,
        line: 0,
        locus: basenameOf(path),
        stack: [
            { check: "shape", resolved: "matched" },
            { check: "bearer", resolved: BEARER_NAME },
            { check: "location", resolved: "outside the bearer" },
        ],
        actual: `${path} carries a value matching the credential shape`,
        expected:
            BEARER === null
                ? "no artifact is declared to bear a credential, so none may carry one"
                : `the credential appears only in ${BEARER}`,
        remediation: {
            action: "move",
            from: path,
            to: null,
            target: path,
            deterministic: false,
            decide:
                BEARER === null
                    ? "no artifact here is declared to bear a credential — remove the value and read it from the environment at runtime; treat the copy as disclosed and rotate it, because an artifact that carried it once may have been distributed"
                    : `a credential has exactly one home and this is not it — remove the value from this artifact and read it from ${BEARER} at runtime; treat the copy as disclosed and rotate it, because an artifact that carried it once may have been distributed`,
        },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant: "a credential appears only in the single artifact declared to bear it",
    extensions: [],
    kinds: ["secretOutsideItsBearer"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const reached: string[] = [];
        const skippedAsDeclaredBearer: string[] = [];

        for (const path of context.paths) {
            if (BEARER !== null && basenameOf(path) === BEARER) {
                skippedAsDeclaredBearer.push(path);
                continue;
            }
            reached.push(path);

            if (bearsSecret(context.read(path))) findings.push(finding(path));
        }

        return { findings, healed: [], derivations: { reached, skippedAsDeclaredBearer, bearer: BEARER_NAME } };
    },
};
