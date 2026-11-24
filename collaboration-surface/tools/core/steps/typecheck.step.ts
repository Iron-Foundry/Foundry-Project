import { surfacePrefix, surfaceRoot } from "../../../config/surface.config.ts";
import { writeRuleReport } from "../reporters/rule.reporter.ts";
import { runTool } from "../runners/process.runner.ts";
import type { StepOptions, StepOutcome } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

export const KINDS: readonly string[] = ["typecheck/diagnostic", "typecheck/unavailable", "typecheck/unparsed"];

const COMMAND = "npm";

const ARGS = ["run", "--silent", "typecheck"];

function within(path: string): string {
    const prefix = surfacePrefix();
    return prefix.length === 0 ? path : `${prefix}/${path}`;
}

function parseDiagnostic(line: string): Finding | null {
    const open = line.indexOf("(");
    const close = line.indexOf(")", open);
    if (open <= 0 || close <= open) return null;

    const marker = line.indexOf("): error ");
    if (marker !== close) return null;

    const path = line.slice(0, open);
    const position = line.slice(open + 1, close);
    const comma = position.indexOf(",");
    const lineNumber = Number.parseInt(comma === -1 ? position : position.slice(0, comma), 10);
    const message = line.slice(marker + 9);

    const colon = message.indexOf(":");
    const code = colon === -1 ? "" : message.slice(0, colon);

    return {
        rule: "typecheck/diagnostic",
        path: within(path),
        line: Number.isNaN(lineNumber) ? 0 : lineNumber,
        locus: code.length > 0 ? code : "type",
        stack: [
            { check: "compiler", resolved: "tsc --noEmit" },
            { check: "diagnostic", resolved: code },
        ],
        actual: colon === -1 ? message : message.slice(colon + 1).trim(),
        expected: null,
        remediation: {
            action: "none",
            from: path,
            to: null,
            target: within(path),
            deterministic: false,
            decide: "the compiler states the mismatch; correct the type or the value so the two agree, never by widening to any",
        },
        healed: false,
    };
}

export interface TypecheckResult {
    readonly findings: readonly Finding[];
    readonly ran: boolean;
}

const INVARIANT = "the gate sources compile under the project's strict configuration";

const PROJECTS = ["tools/tsconfig.json"];

export function typecheckStage(options: StepOptions): StepOutcome {
    if (options.bypass.includes("typecheck")) {
        return {
            findings: [],
            stage: { stage: "meta", rule: "typecheck", invariant: INVARIANT, findings: 0, healed: 0, bypassed: true },
        };
    }

    const result = runTypecheck();

    writeRuleReport(options.repoRoot, "typecheck", {
        rule: "typecheck",
        stage: "meta",
        invariant: INVARIANT,
        verdict: result.findings.length === 0 ? "pass" : "fail",
        scope: options.scope,
        authoritative: options.authoritative,
        scanned: PROJECTS.length,
        healed: [],
        findings: result.findings,
        derivations: { compilerProjectsWalked: [...PROJECTS], ran: result.ran },
    });

    return {
        findings: result.findings,
        stage: {
            stage: "meta",
            rule: "typecheck",
            invariant: INVARIANT,
            findings: result.findings.length,
            healed: 0,
            bypassed: false,
        },
    };
}

export function runTypecheck(): TypecheckResult {
    const result = runTool(surfaceRoot(), "typecheck", COMMAND, INVARIANT, ARGS);

    if (result.exitCode === -1) {
        return {
            ran: false,
            findings: [
                {
                    rule: "typecheck/unavailable",
                    path: "package.json",
                    line: 0,
                    locus: "scripts.typecheck",
                    stack: [{ check: "process", resolved: result.output }],
                    actual: "the type checker could not be launched",
                    expected: null,
                    remediation: {
                        action: "none",
                        from: "typecheck",
                        to: null,
                        target: "package.json",
                        deterministic: false,
                        decide: "a gate that cannot run is a failure, never a skip — restore the script before trusting the run",
                    },
                    healed: false,
                },
            ],
        };
    }

    const findings: Finding[] = [];
    const output = result.output;

    for (const line of output.split("\n")) {
        const finding = parseDiagnostic(line.trim());
        if (finding !== null) findings.push(finding);
    }

    if (findings.length === 0 && result.exitCode !== 0) {
        findings.push({
            rule: "typecheck/unparsed",
            path: within("tools/tsconfig.json"),
            line: 0,
            locus: "tsc",
            stack: [{ check: "exit", resolved: String(result.exitCode) }],
            actual: output.trim().slice(0, 400),
            expected: null,
            remediation: {
                action: "none",
                from: "tsc",
                to: null,
                target: within("tools/tsconfig.json"),
                deterministic: false,
                decide: "the compiler failed without a recognisable diagnostic — read the output directly",
            },
            healed: false,
        });
    }

    return { findings, ran: true };
}
