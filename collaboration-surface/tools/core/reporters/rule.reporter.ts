import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { decodeScope, encodeScope } from "../transformers/scope.transformer.ts";
import type { Stage } from "../types/rule.types.ts";
import type { Finding, Verdict } from "../types/segment.types.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

export interface RuleReport {
    readonly rule: string;
    readonly mechanism?: string;
    readonly stage: Stage;
    readonly invariant: string;
    readonly verdict: Verdict;
    readonly scope: string;
    readonly authoritative: boolean;
    readonly scanned: number;
    readonly healed: readonly string[];
    readonly findings: readonly Finding[];
    readonly derivations?: unknown;
}

export interface StageSummary {
    readonly stage: Stage;
    readonly rule: string;
    readonly invariant: string;
    readonly findings: number;
    readonly healed: number;
    readonly bypassed: boolean;
}

export interface PipelineReport {
    readonly tool: "govern";
    readonly verdict: Verdict;
    readonly registered: number;
    readonly agent: string;
    readonly at: number;
    readonly scope: string;
    readonly authoritative: boolean;
    readonly scanned: number;
    readonly bypassed: boolean;
    readonly mutated: boolean;
    readonly mode: "healing" | "held";
    readonly written: readonly string[];
    readonly escaped: readonly string[];
    readonly unfulfilled: readonly string[];
    readonly stages: readonly StageSummary[];
    readonly reports: readonly string[];
    readonly findings: readonly Finding[];
    readonly moved: readonly string[];
    readonly derivations: Record<string, unknown>;
}

const TRANSIENT_WRITE_CODES: ReadonlySet<string> = new Set(["UNKNOWN", "EBUSY", "EPERM"]);

const WRITE_ATTEMPTS = 5;

const WRITE_PAUSE_MS = 50;

function transientCode(error: unknown): string | null {
    if (typeof error !== "object" || error === null || !("code" in error)) return null;

    const code = error.code;
    return typeof code === "string" && TRANSIENT_WRITE_CODES.has(code) ? code : null;
}

function pause(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function withTransientRetry(act: () => void, wait: (ms: number) => void = pause): number {
    for (let attempt = 1; ; attempt += 1) {
        try {
            act();
            return attempt;
        } catch (error) {
            if (attempt >= WRITE_ATTEMPTS || transientCode(error) === null) throw error;
            wait(WRITE_PAUSE_MS * attempt);
        }
    }
}

function write(repoRoot: string, name: string, body: unknown): string {
    const target = join(repoRoot, GENERATED_DIR, name);
    mkdirSync(dirname(target), { recursive: true });
    const text = `${JSON.stringify(body, null, 2)}\n`;
    withTransientRetry(() => {
        writeSurface(target, text);
    });
    return target;
}

export function ruleReportName(ruleId: string): string {
    return `${ruleId}.report.generated.json`;
}

export function writeRuleReport(repoRoot: string, ruleId: string, report: RuleReport): string {
    return write(repoRoot, ruleReportName(ruleId), report);
}

export const AGGREGATE_REPORT = "pipeline.report.generated.json";

const CHANNEL_LEAD = "pipeline.";

const CHANNEL_TAIL = ".report.generated.json";

export function channelReportName(scope: string): string {
    return `${CHANNEL_LEAD}${encodeScope(scope)}${CHANNEL_TAIL}`;
}

export function channelScopeOf(name: string): string | null {
    if (!name.startsWith(CHANNEL_LEAD) || !name.endsWith(CHANNEL_TAIL)) return null;

    const encoded = name.slice(CHANNEL_LEAD.length, name.length - CHANNEL_TAIL.length);
    if (encoded.length === 0) return null;

    return decodeScope(encoded);
}

export function supersedingRun(repoRoot: string, at: number): number {
    const target = join(repoRoot, GENERATED_DIR, AGGREGATE_REPORT);
    if (!existsSync(target)) return 0;

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(target, "utf8"));
    } catch {
        return 0;
    }

    if (typeof parsed !== "object" || parsed === null) return 0;

    const stamp = (parsed as Record<string, unknown>)["at"];
    if (typeof stamp !== "number" || stamp <= at) return 0;

    return stamp;
}

const JOIN_POLL_MS = 500;

const JOIN_LIMIT_MS = 600000;

function publishedAfter(repoRoot: string, at: number): Record<string, unknown> | null {
    const target = join(repoRoot, GENERATED_DIR, AGGREGATE_REPORT);
    if (!existsSync(target)) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(target, "utf8"));
    } catch {
        return null;
    }

    if (typeof parsed !== "object" || parsed === null) return null;

    const record = parsed as Record<string, unknown>;
    const stamp = record["at"];

    return typeof stamp === "number" && stamp >= at ? record : null;
}

export async function joinLiveRun(repoRoot: string, at: number): Promise<{ message: string; code: number }> {
    const deadline = at + JOIN_LIMIT_MS;

    for (;;) {
        const published = publishedAfter(repoRoot, at);

        if (published !== null) {
            const verdict = typeof published["verdict"] === "string" ? published["verdict"] : "unknown";
            const agent = typeof published["agent"] === "string" ? published["agent"] : "an undeclared caller";
            const scope = typeof published["scope"] === "string" ? published["scope"] : "unknown";
            const findings = Array.isArray(published["findings"]) ? published["findings"].length : 0;

            return {
                code: verdict === "pass" ? 0 : 1,
                message:
                    `${verdict.toUpperCase()}  the run this call joined has published: scope ${scope}, taken by ${agent}, ` +
                    `${String(findings)} finding(s). THIS IS THAT RUN'S RESULT RATHER THAN A SECOND MEASUREMENT — the ` +
                    "report is overwritten on every run, so it is the tree's current truth and there is exactly one of " +
                    `it. Read ${AGGREGATE_REPORT} for the derivations\n`,
            };
        }

        if (Date.now() > deadline) {
            return {
                code: 2,
                message:
                    "ABANDONED  the run this call joined did not publish inside the join window, so it produced no " +
                    "verdict and this call has none to read out. A crash leaves neither a pass nor a fail; the next " +
                    "caller reaps the dead claim and measures the tree itself\n",
            };
        }

        await new Promise((resolve) => setTimeout(resolve, JOIN_POLL_MS));
    }
}

export function writePipelineReport(repoRoot: string, report: PipelineReport): string | null {
    if (!report.authoritative) return null;
    if (supersedingRun(repoRoot, report.at) !== 0) return null;

    return write(repoRoot, AGGREGATE_REPORT, report);
}
