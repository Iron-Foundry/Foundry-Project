import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { projectRoot } from "../../../config/surface.config.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { runGates } from "../runners/gate.runner.ts";
import { contradictedContracts } from "../validators/governance.validator.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const REPO_ROOT = projectRoot();

const REPORT = "gate.report.generated.json";

export const RESTATES: readonly string[] = ["gate_fires_before_it_is_trusted", "positive_control_precedes_trust"];

async function main(): Promise<void> {
    const report = await runGates(REPO_ROOT);

    for (const outcome of [...report.outcomes, ...report.branches]) {
        if (outcome.state === "proven" || outcome.state === "exempt") continue;
        process.stdout.write(`    ${outcome.state.padEnd(9)} ${outcome.rule.padEnd(16)} ${outcome.detail}\n`);
    }

    const reached = [...report.outcomes, ...report.branches].map((outcome) => outcome.rule);
    const derivations = {
        reached,
        scanned: reached.length,
        provenKinds: [...report.outcomes, ...report.branches]
            .filter((outcome) => outcome.state === "proven")
            .map((outcome) => `${outcome.rule}: ${outcome.detail}`),
        kindVerdictKeys: Object.keys(report.kindVerdicts),
        kindVerdictKeysFlat: Object.keys(report.kindVerdicts).filter((key) => !key.includes("/")),
        provenKindsNote:
            "PER-RULE PROSE and a SUMMARY, which is stated here because a reader joining an authored `rule/kind` " +
            "pairing against it would be parsing a sentence to decide a verdict. THE COMPOSITE-KEYED OPERAND IS " +
            "`kindVerdicts`, which carries every rule-and-kind pair with its own state and is what a pairing resolves " +
            "against — the outcome list collapses every kind of one rule into a single entry so its counts range over " +
            "RULES, and this array inherits that collapse. Two surfaces, two units, and only one of them answers a " +
            "question about a kind",
        branchesExercised: report.branches.map((outcome) => outcome.rule),
        skippedAsExemptByDerivation: report.outcomes
            .filter((outcome) => outcome.state === "exempt")
            .map((outcome) => `${outcome.rule}: ${outcome.detail}`),
        unfixturedKinds: report.unfixturedKinds,
    };

    const contradicted = contradictedContracts(derivations);
    if (contradicted.length > 0) {
        process.stdout.write(
            `REFUSED  this report states a property of its own key that its own contents contradict: ${contradicted.join("; ")}. ` +
                "A CONTRACT ABOUT AN ARRAY, BESIDE THAT ARRAY, IS A SELF-CONSISTENCY QUESTION rather than a claim needing " +
                "a second source — both operands are written by one producer into one file in one run, so the description " +
                "carries the same provenance as the data and a reader applying every discipline available finds two " +
                "statements of identical standing with nothing to prefer one. Measured: a contract asserting a set was " +
                "composite-keyed was published beside that set holding flat names, and a party opening the mechanism " +
                "rather than taking a claim was handed the false one inside four minutes. The write refuses rather than " +
                "publishing, because a briefly-wrong artifact leaves nothing behind to compare a reader's account " +
                "against\n",
        );
        process.exit(2);
    }

    mkdirSync(resolve(REPO_ROOT, GENERATED_DIR), { recursive: true });
    writeSurface(
        resolve(REPO_ROOT, GENERATED_DIR, REPORT),
        `${JSON.stringify({ tool: "gate", scanned: reached.length, ...report, derivations }, null, 2)}\n`,
    );

    for (const kind of report.unfixturedKinds) {
        process.stdout.write(
            `    unfixtured ${kind.padEnd(16)} this kind is emitted and no fixture pair declares it\n`,
        );
    }

    const open = report.failed + report.untested + report.unfixturedKinds.length + report.branchesOpen;
    const verdict = open > 0 ? "FAIL" : "PASS";
    process.stdout.write(
        `${verdict}  rules: proven=${String(report.proven)} exempt=${String(report.exempt)} ` +
            `untested=${String(report.untested)} failed=${String(report.failed)} · ` +
            `kinds: unfixtured=${String(report.unfixturedKinds.length)} · ` +
            `branches: proven=${String(report.branchesProven)} open=${String(report.branchesOpen)}\n` +
            `report: ${GENERATED_DIR}/${REPORT}\n`,
    );

    process.exit(open > 0 ? 1 : 0);
}

await main();
