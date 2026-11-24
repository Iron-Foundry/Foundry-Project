import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { isResolved, slotCount } from "../../../config/surface.config.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";
import { codeOf, witnessedGone } from "./claim.registry.ts";

const JOINS = "run.joins";

const RECORD_TAIL = ".join.generated.json";

const LOG_TAIL = ".join.generated.log";

const MUTEX_TAIL = ".join.mutex";

const MUTEX_STALE_MS = 30000;

const EXISTS = "EEXIST";

const MISSING = "ENOENT";

const RUNNING = "running";

const FINISHED = "finished";

export type JoinState = typeof RUNNING | typeof FINISHED;

export interface JoinRecord {
    readonly suite: string;
    readonly args: readonly string[];
    readonly agent: string;
    readonly pid: number;
    readonly host: string;
    readonly at: number;
    readonly state: JoinState;
    readonly exitCode: number | null;
    readonly log: string;
}

export interface JoinRequest {
    readonly suite: string;
    readonly args: readonly string[];
    readonly agent: string;
    readonly pid: number;
    readonly now: number;
}

export type JoinStanding =
    | { readonly role: "hold"; readonly record: JoinRecord }
    | { readonly role: "join"; readonly record: JoinRecord };

export function joinRoot(repoRoot: string): string {
    return join(repoRoot, GENERATED_DIR, JOINS);
}

function recordFile(repoRoot: string, suite: string): string {
    return join(joinRoot(repoRoot), `${suite}${RECORD_TAIL}`);
}

function mutexDir(repoRoot: string, suite: string): string {
    return join(joinRoot(repoRoot), `${suite}${MUTEX_TAIL}`);
}

export function logFile(repoRoot: string, record: JoinRecord): string {
    return join(joinRoot(repoRoot), record.log);
}

function isTextList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function parseRecord(text: string): JoinRecord | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }

    if (typeof parsed !== "object" || parsed === null) return null;
    const held = parsed as Record<string, unknown>;

    const suite = held["suite"];
    const args = held["args"];
    const agent = held["agent"];
    const pid = held["pid"];
    const host = held["host"];
    const at = held["at"];
    const state = held["state"];
    const exitCode = held["exitCode"];
    const log = held["log"];

    if (typeof suite !== "string" || !isTextList(args) || typeof agent !== "string") return null;
    if (typeof pid !== "number" || typeof host !== "string" || typeof at !== "number") return null;
    if (state !== RUNNING && state !== FINISHED) return null;
    if (exitCode !== null && typeof exitCode !== "number") return null;
    if (typeof log !== "string") return null;

    return { suite, args, agent, pid, host, at, state, exitCode, log };
}

export function readRecord(repoRoot: string, suite: string): JoinRecord | null {
    const path = recordFile(repoRoot, suite);
    if (!existsSync(path)) return null;
    return parseRecord(readSurface(path, "utf8"));
}

function liveWindow(): number | null {
    if (!isResolved("convention", "run_live_window_ms")) return null;
    return slotCount("convention", "run_live_window_ms");
}

export function isLive(record: JoinRecord, now: number): boolean {
    if (record.state !== RUNNING) return false;
    if (record.host === hostname()) return !witnessedGone(record);

    const window = liveWindow();
    return window !== null && now - record.at < window;
}

function takeMutex(repoRoot: string, suite: string, now: number): boolean {
    const path = mutexDir(repoRoot, suite);
    try {
        mkdirSync(path);
        return true;
    } catch (raised) {
        if (codeOf(raised) !== EXISTS) throw raised;
    }

    try {
        if (now - statSync(path).mtimeMs > MUTEX_STALE_MS) rmSync(path, { recursive: true, force: true });
    } catch (raised) {
        if (codeOf(raised) !== MISSING) throw raised;
    }
    return false;
}

function dropMutex(repoRoot: string, suite: string): void {
    rmSync(mutexDir(repoRoot, suite), { recursive: true, force: true });
}

function storeRecord(repoRoot: string, record: JoinRecord): void {
    writeSurface(recordFile(repoRoot, record.suite), `${JSON.stringify(record, null, 2)}\n`);
}

function pruneLogs(repoRoot: string, suite: string, keep: readonly string[]): void {
    const lead = `${suite}.`;
    for (const entry of readdirSync(joinRoot(repoRoot))) {
        if (!entry.startsWith(lead) || !entry.endsWith(LOG_TAIL)) continue;
        if (keep.includes(entry)) continue;
        rmSync(join(joinRoot(repoRoot), entry), { force: true });
    }
}

export function claimSuite(repoRoot: string, request: JoinRequest): JoinStanding | null {
    mkdirSync(joinRoot(repoRoot), { recursive: true });
    if (!takeMutex(repoRoot, request.suite, request.now)) return null;

    try {
        const held = readRecord(repoRoot, request.suite);
        if (held !== null && isLive(held, request.now)) return { role: "join", record: held };

        const record: JoinRecord = {
            suite: request.suite,
            args: [...request.args],
            agent: request.agent,
            pid: request.pid,
            host: hostname(),
            at: request.now,
            state: RUNNING,
            exitCode: null,
            log: `${request.suite}.${String(request.now)}${LOG_TAIL}`,
        };

        storeRecord(repoRoot, record);
        pruneLogs(repoRoot, request.suite, held === null ? [record.log] : [record.log, held.log]);
        return { role: "hold", record };
    } finally {
        dropMutex(repoRoot, request.suite);
    }
}

export function finishSuite(repoRoot: string, record: JoinRecord, exitCode: number, now: number): boolean {
    if (!takeMutex(repoRoot, record.suite, now)) return false;

    try {
        const held = readRecord(repoRoot, record.suite);
        if (held === null || held.at !== record.at || held.pid !== record.pid) return true;

        storeRecord(repoRoot, { ...record, state: FINISHED, exitCode });
        return true;
    } finally {
        dropMutex(repoRoot, record.suite);
    }
}

export function sameArguments(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
