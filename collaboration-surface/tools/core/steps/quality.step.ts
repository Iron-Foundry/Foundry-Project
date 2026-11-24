import { isResolved, projectRoot, slot, slotList, slotText, surfacePrefix } from "../../../config/surface.config.ts";
import { writeRuleReport } from "../reporters/rule.reporter.ts";
import { runTool } from "../runners/process.runner.ts";
import type { StepOptions, StepOutcome } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

const INVARIANT =
    "where the consumer declares a quality toolchain, the pipeline runs it as one stage rather than leaving a second chain to be remembered";

const STAGE = "meta";

const RULE = "quality";

export function declaredKinds(): string[] {
    return [`${RULE}/notDeclared`, ...slotList("execution", "quality_concerns").map((concern) => `${RULE}/${concern}`)];
}

function commandParts(): { readonly command: string; readonly leading: readonly string[] } {
    const declared = slotText("execution", "quality_command").split(" ");
    const command = declared[0] ?? "";
    return { command, leading: declared.slice(1) };
}

function absenceFinding(reason: string, locus: string): Finding {
    return {
        rule: `${RULE}/notDeclared`,
        path: "config/surface.config.ts",
        line: 0,
        locus,
        stack: [
            { check: "slot", resolved: slot("execution", "quality_command").state },
            { check: "concerns", resolved: String(slotList("execution", "quality_concerns").length) },
        ],
        actual: reason,
        expected: null,
        remediation: {
            action: "declare",
            from: locus,
            to: null,
            target: "config/surface.config.ts",
            deterministic: false,
            decide: "a consumer whose toolchain performs these checks declares the command and elects the concerns, and the stage then runs inside the one pipeline. A consumer with no such toolchain leaves it ABSENT and the stage does not exist — which is reported rather than passed, because a green over a check nobody ran is the state this package refuses to produce",
        },
        healed: false,
    };
}

function scanFinding(line: string, concern: string): Finding | null {
    const open = line.indexOf(":");
    if (open <= 0) return null;

    const path = line.slice(0, open);
    if (path.indexOf("/") === -1 && path.indexOf("\\") === -1) return null;

    const rest = line.slice(open + 1);
    const nextColon = rest.indexOf(":");
    const lineNumber = Number.parseInt(nextColon === -1 ? rest : rest.slice(0, nextColon), 10);

    return {
        rule: `${RULE}/${concern}`,
        path,
        line: Number.isNaN(lineNumber) ? 0 : lineNumber,
        locus: concern,
        stack: [{ check: "toolchain", resolved: concern }],
        actual: line.trim(),
        expected: null,
        remediation: {
            action: "none",
            from: concern,
            to: null,
            target: path,
            deterministic: false,
            decide: "a finding arriving from outside carries premises this package may not share, so it is TRIAGED before it is satisfied — one resting on a false premise is deleted rather than answered, and one naming a real defect is repaired here rather than by the tool that found it",
        },
        healed: false,
    };
}

export function qualityStage(options: StepOptions): StepOutcome {
    if (options.bypass.includes(RULE)) {
        return {
            findings: [],
            stage: { stage: STAGE, rule: RULE, invariant: INVARIANT, findings: 0, healed: 0, bypassed: true },
        };
    }

    const concerns = slotList("execution", "quality_concerns");
    const findings: Finding[] = [];

    if (!isResolved("execution", "quality_command")) {
        findings.push(absenceFinding("no quality toolchain is declared, so no external check runs", "quality_command"));
    } else if (concerns.length === 0) {
        findings.push(
            absenceFinding("a toolchain is declared and no concern is elected, so it runs nothing", "quality_concerns"),
        );
    } else {
        const { command, leading } = commandParts();
        const target = surfacePrefix();

        for (const concern of concerns) {
            const result = runTool(projectRoot(), `${RULE}:${concern}`, command, INVARIANT, [
                ...leading,
                concern,
                target,
            ]);

            if (result.exitCode === -1) {
                findings.push(
                    absenceFinding(`the declared toolchain could not be launched — ${result.output}`, concern),
                );
                continue;
            }

            for (const line of result.output.split("\n")) {
                const finding = scanFinding(line.trim(), concern);
                if (finding !== null) findings.push(finding);
            }
        }
    }

    const declaredOnly = findings.every((entry) => entry.rule === `${RULE}/notDeclared`);

    writeRuleReport(options.repoRoot, RULE, {
        rule: RULE,
        stage: STAGE,
        invariant: INVARIANT,
        verdict: declaredOnly ? "pass" : "fail",
        scope: options.scope,
        authoritative: options.authoritative,
        scanned: options.scanned,
        healed: [],
        findings,
        derivations: {
            concernsElected: [...concerns],
            commandState: slot("execution", "quality_command").state,
            bound: "the population of this step is the CONCERNS a consumer elects, never the files a run hands it — the toolchain is the consumer's and it decides its own scope, so a handed file count inherited from the pipeline asserts nothing this step measured. An empty reached set with the command ABSENT is the slot being honoured rather than a scope that stopped reaching, and stating it is what separates the two",
        },
    });

    return {
        findings: declaredOnly ? [] : findings,
        stage: {
            stage: STAGE,
            rule: RULE,
            invariant: INVARIANT,
            findings: declaredOnly ? 0 : findings.length,
            healed: 0,
            bypassed: false,
        },
    };
}
