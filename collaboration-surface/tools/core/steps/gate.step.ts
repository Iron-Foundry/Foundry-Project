import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { surfacePath, surfaceRoot } from "../../../config/surface.config.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { writeRuleReport } from "../reporters/rule.reporter.ts";
import { runTool } from "../runners/process.runner.ts";
import type { StepOptions, StepOutcome } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

const COMMAND = "npm";

const ARGS = ["run", "--silent", "gates"];

const REPORT = "gate.report.generated.json";

const INVARIANT = "every registered rule is proven to fire on a violation and to accept a clean input";

const DECIDE =
    "a rule nobody has watched fail is indistinguishable from one that cannot fail, and this repository " +
    "has shipped four gates that passed because they scanned nothing; declare a fixture pair — one sample " +
    "the rule must report and one it must accept — so the proof is an artifact rather than a ritual repeated " +
    "from memory each time the rule is touched";

interface Outcome {
    readonly rule: string;
    readonly state: string;
    readonly detail: string;
}

function unfixturedFrom(repoRoot: string): string[] {
    const path = resolve(repoRoot, GENERATED_DIR, REPORT);
    if (!existsSync(path)) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(path, "utf8"));
    } catch {
        return [];
    }

    if (typeof parsed !== "object" || parsed === null) return [];
    const held = (parsed as { unfixturedKinds?: unknown }).unfixturedKinds;
    if (!Array.isArray(held)) return [];

    return held.filter((kind): kind is string => typeof kind === "string");
}

function unfixturedFinding(kind: string): Finding {
    const rule = kind.slice(0, kind.indexOf("/"));

    return {
        rule: "gate/unfixturedKind",
        path: `${surfacePath("rules")}/${rule}.rule.ts`,
        line: 0,
        locus: kind,
        stack: [
            { check: "emitted", resolved: kind },
            { check: "fixturePair", resolved: "none declares this kind" },
        ],
        actual: `${kind} is emitted and no fixture pair declares it`,
        expected: "a sample the kind must report and one it must accept, or a written exemption",
        remediation: {
            action: "declare",
            from: kind,
            to: null,
            target: `${surfacePath("core")}/fixtures/gate.fixture.ts`,
            deterministic: false,
            decide:
                "a rule proven at RULE granularity says nothing about the kinds it can emit — a pair covering one " +
                "kind leaves every other kind of that rule unobserved, which is how a detector ships having only " +
                "ever been seen to stay quiet. Declare the pair, or declare the exemption with the reason a " +
                "synthetic sample cannot hold the construct",
        },
        healed: false,
    };
}

function isOutcome(value: unknown): value is Outcome {
    if (typeof value !== "object" || value === null) return false;

    const candidate = value as { rule?: unknown; state?: unknown; detail?: unknown };
    return (
        typeof candidate.rule === "string" &&
        typeof candidate.state === "string" &&
        typeof candidate.detail === "string"
    );
}

function outcomesFrom(repoRoot: string): Outcome[] {
    const path = resolve(repoRoot, GENERATED_DIR, REPORT);
    if (!existsSync(path)) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(path, "utf8"));
    } catch {
        return [];
    }

    if (typeof parsed !== "object" || parsed === null) return [];
    const held = (parsed as { outcomes?: unknown }).outcomes;
    if (!Array.isArray(held)) return [];

    return held.filter(isOutcome);
}

function gateFinding(outcome: Outcome): Finding {
    return {
        rule: `gate/${outcome.state}`,
        path: `${surfacePath("rules")}/${outcome.rule}.rule.ts`,
        line: 0,
        locus: outcome.rule,
        stack: [
            { check: "fixturePair", resolved: outcome.state },
            { check: "detail", resolved: outcome.detail },
        ],
        actual: outcome.detail,
        expected: "a fixture pair the rule fires on and accepts",
        remediation: {
            action: "declare",
            from: outcome.rule,
            to: null,
            target: `${surfacePath("core")}/fixtures/gate.fixture.ts`,
            deterministic: false,
            decide: DECIDE,
        },
        healed: false,
    };
}

export const KINDS: readonly string[] = ["gate/unfixturedKind", "gate/silent", "gate/noisy", "gate/untested"];

export function gateStage(options: StepOptions): StepOutcome {
    if (options.bypass.includes("gates")) {
        return {
            findings: [],
            stage: { stage: "meta", rule: "gates", invariant: INVARIANT, findings: 0, healed: 0, bypassed: true },
        };
    }

    const run = runTool(surfaceRoot(), "gates", COMMAND, INVARIANT, ARGS);

    const outcomes = outcomesFrom(options.repoRoot);

    const findings =
        outcomes.length === 0
            ? [
                  gateFinding({
                      rule: "gates",
                      state: "unproven",
                      detail:
                          "the proof run produced no outcomes, so no rule has been shown to fire — a step whose " +
                          `own invocation failed reports the same green as one where every pair passed: ${run.output.trim().slice(0, 300)}`,
                  }),
              ]
            : [
                  ...outcomes
                      .filter((outcome) => outcome.state !== "proven" && outcome.state !== "exempt")
                      .map(gateFinding),
                  ...unfixturedFrom(options.repoRoot).map(unfixturedFinding),
              ];

    writeRuleReport(options.repoRoot, "gates", {
        rule: "gates",
        stage: "meta",
        invariant: INVARIANT,
        verdict: findings.length === 0 ? "pass" : "fail",
        scope: options.scope,
        authoritative: options.authoritative,
        scanned: outcomes.length,
        healed: [],
        findings,
        derivations: {
            reached: outcomes.map((outcome) => outcome.rule),
            provenKinds: outcomes
                .filter((outcome) => outcome.state === "proven")
                .map((outcome) => `${outcome.rule}: ${outcome.detail}`),
            skippedAsExemptByDerivation: outcomes
                .filter((outcome) => outcome.state === "exempt")
                .map((outcome) => `${outcome.rule}: ${outcome.detail}`),
            unfixturedKinds: unfixturedFrom(options.repoRoot),
        },
    });

    return {
        findings,
        stage: {
            stage: "meta",
            rule: "gates",
            invariant: INVARIANT,
            findings: findings.length,
            healed: 0,
            bypassed: false,
        },
    };
}
