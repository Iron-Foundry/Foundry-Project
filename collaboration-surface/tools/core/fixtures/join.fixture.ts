import { hostname } from "node:os";
import { resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { shellArgument } from "../formatters/invocation.formatter.ts";
import { filteredDeliveries, matchedSuites, type DeclaredSuite } from "../matchers/invocation.matcher.ts";
import { claimSuite } from "../registries/join.registry.ts";
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";

const HOME = "home";

const FRONTEND = "product/frontend";

const BACKEND = "product/backend";

const RECORD = `${GENERATED_DIR}/run.joins/suite.join.generated.json`;

const ABSENT_PID = 2147483646;

function suitesUnder(root: string): DeclaredSuite[] {
    return [
        { id: "workspace-verify", tree: resolve(root), command: "npm run verify" },
        { id: "frontend-test", tree: resolve(root, FRONTEND), command: "bun test" },
        { id: "frontend-typecheck", tree: resolve(root, FRONTEND), command: "bunx --package typescript@5.9 tsc" },
        { id: "backend-openapi", tree: resolve(root, BACKEND), command: "uv run openapi" },
    ];
}

function matching(root: string, command: string, cwd: string, caseless = false): BranchObservation {
    const found = matchedSuites(command, resolve(root, cwd), suitesUnder(root), resolve(root, HOME), caseless);
    return {
        ids: found.map((match) => match.id).join(" "),
        extra: found.map((match) => match.extra.join(" ")).join(" | "),
    };
}

const SURFACE = "surface";

const JOIN = `npm --prefix ${SURFACE} run join -- --suite workspace-verify`;

function filtering(root: string, command: string, cwd = "."): BranchObservation {
    const found = filteredDeliveries(command, resolve(root, cwd), resolve(root, SURFACE), resolve(root, HOME), false);
    return { filtered: found.length };
}

function recordOf(pid: number, at: number): string {
    return `${JSON.stringify({
        suite: "suite",
        args: [],
        agent: "peer",
        pid,
        host: hostname(),
        at,
        state: "running",
        exitCode: null,
        log: `suite.${String(at)}.join.generated.log`,
    })}\n`;
}

function claiming(root: string, args: readonly string[]): BranchObservation {
    const standing = claimSuite(root, { suite: "suite", args, agent: "caller", pid: process.pid, now: Date.now() });
    return standing === null ? { role: "busy", holder: "" } : { role: standing.role, holder: standing.record.agent };
}

export const JOIN_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "invocation.matcher",
        branch: "a bare suite command in the suite's own tree, which is the construct the guard exists to refuse — a second session starting it while a first runs measures the first run's edits",
        seed: [],
        exercise: (root) => matching(root, "npm run verify", "."),
        expect: { ids: "workspace-verify", extra: "" },
    },
    {
        subject: "invocation.matcher",
        branch: "a narrowed run reached through a directory change and carrying a redirection, which is the same suite: the extra arguments travel to the lock and the redirection does not, because the lock owns the output stream",
        seed: [],
        exercise: (root) => matching(root, `cd ${FRONTEND} && bun test src/a.test.ts 2>&1`, "."),
        expect: { ids: "frontend-test", extra: "src/a.test.ts" },
    },
    {
        subject: "invocation.matcher",
        branch: "the suite command in a DIFFERENT tree, which is not the declared suite and must pass — a guard keyed on the command text alone refuses every unrelated project that happens to run the same tool",
        seed: [],
        exercise: (root) => matching(root, "bun test", "."),
        expect: { ids: "", extra: "" },
    },
    {
        subject: "invocation.matcher",
        branch: "the lock's own invocation, which names a suite as an argument rather than running it and must pass, or the guard refuses the one route it points at",
        seed: [],
        exercise: (root) => matching(root, "npm --prefix surface run join -- --suite workspace-verify", "."),
        expect: { ids: "", extra: "" },
    },
    {
        subject: "invocation.matcher",
        branch: "a multi-word suite command with its trailing flag, where the prefix match must hold across every declared token",
        seed: [],
        exercise: (root) => matching(root, "bunx --package typescript@5.9 tsc --noEmit", FRONTEND),
        expect: { ids: "frontend-typecheck", extra: "--noEmit" },
    },
    {
        subject: "invocation.matcher",
        branch: "a working directory that differs from the declared tree only in letter case on a case-insensitive host, which is the same directory",
        seed: [],
        exercise: (root) => matching(root, "bun test", FRONTEND.toUpperCase(), true),
        expect: { ids: "frontend-test", extra: "" },
    },
    {
        subject: "invocation.matcher",
        branch: "a suite reached through the runner's own directory option rather than a directory change, which is the measured bypass — the command started the suite from another tree and the guard read the working directory alone",
        seed: [],
        exercise: (root) => matching(root, `uv run --directory ${BACKEND} openapi --check`, "."),
        expect: { ids: "backend-openapi", extra: "--check" },
    },
    {
        subject: "invocation.matcher",
        branch: "the runner's directory option written with an equals sign and before the subcommand, which relocates the run exactly as the spaced form does",
        seed: [],
        exercise: (root) => matching(root, `uv --directory=${BACKEND} run openapi`, "."),
        expect: { ids: "backend-openapi", extra: "" },
    },
    {
        subject: "invocation.matcher",
        branch: "a package script reached through the package manager's prefix option, which runs the suite in the prefixed tree",
        seed: [],
        exercise: (root) => matching(root, "npm --prefix ../.. run verify", FRONTEND),
        expect: { ids: "workspace-verify", extra: "" },
    },
    {
        subject: "invocation.matcher",
        branch: "a join piped into a line bound, which is the measured breach — the pipe kept the pass count and dropped every line above it, and the tool still reported success, so the reader could not know what the filter discarded",
        seed: [],
        exercise: (root) => filtering(root, `${JOIN} | tail -60`),
        expect: { filtered: 1 },
    },
    {
        subject: "invocation.matcher",
        branch: "a join whose output is redirected into a file, which diverts the delivery away from the reader exactly as a pipe does",
        seed: [],
        exercise: (root) => filtering(root, `${JOIN} > out.txt`),
        expect: { filtered: 1 },
    },
    {
        subject: "invocation.matcher",
        branch: "a join run from inside the surface with no prefix and piped, where the package is the working directory rather than a flag",
        seed: [],
        exercise: (root) => filtering(root, "npm run join -- --suite workspace-verify | grep passed", SURFACE),
        expect: { filtered: 1 },
    },
    {
        subject: "invocation.matcher",
        branch: "a join that merges its error stream into its output, which must pass — the merge delivers more to the reader rather than less, and refusing it would refuse the form the suite guard already sends through",
        seed: [],
        exercise: (root) => filtering(root, `${JOIN} 2>&1`),
        expect: { filtered: 0 },
    },
    {
        subject: "invocation.matcher",
        branch: "a join followed by a conditional command, which must pass — the next command runs after the join and reads none of its output",
        seed: [],
        exercise: (root) => filtering(root, `${JOIN} && echo done || echo failed`),
        expect: { filtered: 0 },
    },
    {
        subject: "invocation.matcher",
        branch: "a join argument whose quoted text carries a redirect character, which is a mention inside a value rather than a redirection and must pass",
        seed: [],
        exercise: (root) => filtering(root, `${JOIN} -- --only "a > b"`),
        expect: { filtered: 0 },
    },
    {
        subject: "invocation.matcher",
        branch: "a join script of ANOTHER package piped into a filter, which must pass — the guard owns this surface's delivery, and keying on the script name alone would refuse every unrelated package that names a script the same way",
        seed: [],
        exercise: (root) => filtering(root, "npm --prefix other run join | tail"),
        expect: { filtered: 0 },
    },
    {
        subject: "invocation.formatter",
        branch: "an argument carrying a space and a quote, which must reach the suite as ONE argument — joining arguments with spaces splits a step label into words and the suite runs a different narrowing than the one asked for",
        seed: [],
        exercise: () => ({ line: ["--only", 'Validate "operator" surfaces', "src/a.test.ts"].map(shellArgument).join(" ") }),
        expect: { line: '--only "Validate \\"operator\\" surfaces" src/a.test.ts' },
    },
    {
        subject: "join.registry",
        branch: "a suite nobody holds, which the caller takes and runs",
        seed: [],
        exercise: (root) => claiming(root, []),
        expect: { role: "hold", holder: "caller" },
    },
    {
        subject: "join.registry",
        branch: "a suite held by a LIVE process on this host, which the caller joins rather than starting a second run of",
        seed: [{ path: RECORD, text: recordOf(process.pid, Date.now()) }],
        exercise: (root) => claiming(root, []),
        expect: { role: "join", holder: "peer" },
    },
    {
        subject: "join.registry",
        branch: "a suite whose holder process is GONE, which left a running record and no verdict — the caller takes it over, or a crashed run would hold the suite until somebody deletes a file by hand",
        seed: [{ path: RECORD, text: recordOf(ABSENT_PID, Date.now()) }],
        exercise: (root) => claiming(root, []),
        expect: { role: "hold", holder: "caller" },
    },
];
