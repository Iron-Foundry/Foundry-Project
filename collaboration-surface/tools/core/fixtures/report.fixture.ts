import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { AGGREGATE_REPORT, channelReportName, withTransientRetry, writePipelineReport } from "../reporters/rule.reporter.ts";
import type { PipelineReport } from "../reporters/rule.reporter.ts";
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";

function report(scope: string, authoritative: boolean, moved: readonly string[], at = 2000): PipelineReport {
    return {
        tool: "govern",
        verdict: "pass",
        registered: 1,
        agent: "Z",
        at,
        scope,
        authoritative,
        scanned: 1,
        bypassed: false,
        mutated: false,
        mode: "held",
        written: [],
        escaped: [],
        unfulfilled: [],
        stages: [],
        reports: [],
        findings: [],
        moved: [...moved],
        derivations: {},
    };
}

function publishing(root: string, scope: string, authoritative: boolean, moved: readonly string[]): BranchObservation {
    writePipelineReport(root, report(scope, authoritative, moved));

    return {
        aggregate: existsSync(resolve(root, GENERATED_DIR, AGGREGATE_REPORT)),
        channel: existsSync(resolve(root, GENERATED_DIR, channelReportName(scope))),
    };
}

function superseding(root: string): BranchObservation {
    writePipelineReport(root, report("whole", true, [], 5000));
    writePipelineReport(root, report("whole", true, [], 1000));

    const held = JSON.parse(readSurface(resolve(root, GENERATED_DIR, AGGREGATE_REPORT), "utf8")) as { at?: unknown };

    return {
        aggregate: held.at === 5000,
        channel: existsSync(resolve(root, GENERATED_DIR, channelReportName("whole-superseded"))),
    };
}

function failingWith(code: string, failures: number): BranchObservation {
    let calls = 0;

    try {
        const attempts = withTransientRetry(
            () => {
                calls += 1;
                if (calls <= failures) throw Object.assign(new Error(code), { code });
            },
            () => undefined,
        );
        return { attempts, thrown: false };
    } catch {
        return { attempts: calls, thrown: true };
    }
}

export const REPORT_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "rule.reporter",
        branch: "a write refused twice by a transient platform lock, which lands on the third attempt rather than crashing the run and stranding its claim",
        seed: [],
        exercise: () => failingWith("UNKNOWN", 2),
        expect: { attempts: 3, thrown: false },
    },
    {
        subject: "rule.reporter",
        branch: "a write refused for a reason no retry can change, which raises on the first attempt rather than waiting on it",
        seed: [],
        exercise: () => failingWith("ENOENT", 1),
        expect: { attempts: 1, thrown: true },
    },
    {
        subject: "rule.reporter",
        branch: "a transient refusal that outlasts every attempt, which raises once the bound is spent rather than retrying without end",
        seed: [],
        exercise: () => failingWith("EBUSY", 99),
        expect: { attempts: 5, thrown: true },
    },
    {
        subject: "rule.reporter",
        branch: "a whole-scope run older than the aggregate on disk, which neither replaces a newer measurement nor writes a second file beside it — the older run STREAMS, because a report is overwritten so it is always the truth after a run and there is one of it",
        seed: [],
        exercise: (root) => superseding(root),
        expect: { aggregate: true, channel: false },
    },
    {
        subject: "rule.reporter",
        branch: "a whole-scope run whose read set MOVED, which is the whole-scope derivation with its standing withdrawn",
        seed: [],
        exercise: (root) => publishing(root, "whole", true, ["a-peer-surface.md"]),
        expect: { aggregate: true, channel: false },
    },
    {
        subject: "rule.reporter",
        branch: "a narrowed run, which writes NOTHING — not over the aggregate and not beside it, because a second document about the aggregate's subject under a key derived from how the run was invoked is accumulation",
        seed: [],
        exercise: (root) => publishing(root, "rule=surface", false, []),
        expect: { aggregate: false, channel: false },
    },
];
