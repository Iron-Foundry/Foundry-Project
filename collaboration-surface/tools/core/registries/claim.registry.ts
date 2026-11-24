import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { isResolved, slotCount } from "../../../config/surface.config.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const CLAIMS = "run.claims";

const TAIL = ".claim.generated.json";

const UNKNOWN = "unknown";

const WHOLE = "whole";

const NO_PROCESS = "ESRCH";

const LIVENESS_PROBE = 0;

export interface RunClaim {
    readonly id: string;
    readonly scope: string;
    readonly at: number;
    readonly agent: string;
    readonly pid: number;
    readonly host: string;
}

function claimRoot(repoRoot: string): string {
    return join(repoRoot, GENERATED_DIR, CLAIMS);
}

function keyOf(agent: string, at: number): string {
    let held = "";
    for (const character of agent) {
        const lower = character >= "a" && character <= "z";
        const upper = character >= "A" && character <= "Z";
        const digit = character >= "0" && character <= "9";
        held += lower || upper || digit ? character : "-";
    }
    return `${held}-${String(at)}`;
}

function liveWindow(): number | null {
    if (!isResolved("convention", "run_live_window_ms")) return null;
    return slotCount("convention", "run_live_window_ms");
}

function textOf(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

export function heldClaims(repoRoot: string): RunClaim[] {
    const root = claimRoot(repoRoot);
    if (!existsSync(root)) return [];

    const out: RunClaim[] = [];
    for (const entry of readdirSync(root)) {
        if (!entry.endsWith(TAIL)) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(join(root, entry), "utf8"));
        } catch {
            out.push({ id: entry, scope: UNKNOWN, at: 0, agent: UNKNOWN, pid: 0, host: UNKNOWN });
            continue;
        }

        if (typeof parsed !== "object" || parsed === null) continue;
        const record = parsed as { scope?: unknown; at?: unknown; agent?: unknown; pid?: unknown; host?: unknown };
        out.push({
            id: entry.slice(0, entry.length - TAIL.length),
            scope: textOf(record["scope"], UNKNOWN),
            at: typeof record["at"] === "number" ? record["at"] : 0,
            agent: textOf(record["agent"], UNKNOWN),
            pid: typeof record["pid"] === "number" ? record["pid"] : 0,
            host: textOf(record["host"], UNKNOWN),
        });
    }

    return out;
}

export interface ClaimStanding {
    readonly decision: "proceed" | "yield";
    readonly covering: readonly string[];
    readonly overlapping: readonly string[];
    readonly incomplete: readonly string[];
    readonly message: string | null;
}

function covers(held: string, mine: string): boolean {
    return held === WHOLE || held === mine;
}

export function writeSetsOverlap(held: string, mine: string): boolean {
    return held === WHOLE || mine === WHOLE || held === mine;
}

export function witnessedGone(claim: Pick<RunClaim, "pid" | "host">): boolean {
    if (claim.pid <= 0) return false;
    if (claim.host === UNKNOWN || claim.host !== hostname()) return false;

    try {
        process.kill(claim.pid, LIVENESS_PROBE);
        return false;
    } catch (raised) {
        return codeOf(raised) === NO_PROCESS;
    }
}

function stillRunning(claim: RunClaim, at: number, window: number | null): boolean {
    if (witnessedGone(claim)) return false;

    const age = claim.at === 0 ? -1 : at - claim.at;
    return window !== null && age !== -1 && Math.abs(age) < window;
}

export function codeOf(error: unknown): string {
    if (typeof error !== "object" || error === null || !("code" in error)) return "";

    const code = error.code;
    return typeof code === "string" ? code : "";
}

export function claimStanding(repoRoot: string, scope: string, at: number, agent: string): ClaimStanding {
    const root = claimRoot(repoRoot);
    const mine = keyOf(agent, at);

    mkdirSync(root, { recursive: true });
    const entry = { scope, at, agent, pid: process.pid, host: hostname() };
    writeSurface(join(root, `${mine}${TAIL}`), `${JSON.stringify(entry, null, 2)}\n`);

    const others = heldClaims(repoRoot).filter((claim) => claim.id !== mine);

    if (others.length === 0)
        return { decision: "proceed", covering: [], overlapping: [], incomplete: [], message: null };

    const window = liveWindow();
    const running: RunClaim[] = [];
    const live: string[] = [];
    const dead: string[] = [];
    const reaped: string[] = [];
    const covering: string[] = [];
    const overlapping: string[] = [];

    for (const claim of others) {
        const age = claim.at === 0 ? -1 : at - claim.at;
        const stated = `${claim.scope} by ${claim.agent}${age === -1 ? "" : ` ${String(Math.round(age / 1000))}s ago`}`;
        if (stillRunning(claim, at, window)) {
            running.push(claim);
            live.push(stated);
            if (covers(claim.scope, scope)) covering.push(stated);
            if (writeSetsOverlap(claim.scope, scope)) overlapping.push(stated);
        } else {
            dead.push(stated);
            reaped.push(claim.id);
            rmSync(join(root, `${claim.id}${TAIL}`), { force: true });
        }
    }

    const yields = running.some((claim) => {
        if (claim.at !== at) return claim.at < at;
        return claim.agent < agent;
    });

    const lines: string[] = [];

    if (live.length > 0) {
        lines.push(
            `${yields ? "THIS RUN YIELDS" : "THIS RUN PROCEEDS"} — ${String(live.length)} run(s) IN FLIGHT: ${live.join("; ")}. ` +
                "THE ORDER IS DECIDED BY THE START STAMP WITH THE SEAT LETTER BREAKING AN EXACT TIE, so the claim is " +
                "WRITTEN BEFORE THE SET IS READ: read-then-write lets two simultaneous starters each see an empty other " +
                "set and both proceed, which is the lost write the whole declaration exists to prevent. Writing first " +
                "means each sees the other, and comparing the two stamps gives mutual exclusion with no lock, no wait " +
                "and no new field — both operands are already in the entry. THE CLAIM SET IS THE IN-FLIGHT DECLARATION AND " +
                "IT IS KEYED PER RUN, so a second caller reads what every other run covers rather than one scalar the " +
                "last starter overwrote. A caller wanting the ANSWER reads that run's report when it publishes rather " +
                "than starting a second measurement of the same tree; a caller wanting a REPAIR waits, because two " +
                "healing runs over one write set is the lost-write construct with a gate's authority",
        );
    }

    if (dead.length > 0) {
        lines.push(
            `${String(dead.length)} run(s) LEFT A CLAIM AND NO VERDICT: ${dead.join("; ")}. A dead run is discovered ` +
                "here, by the next caller, and nowhere else — a crash produces neither a pass nor a fail, so every " +
                "report older than it describes a tree it never finished measuring and nothing else on disk says so. " +
                "THE DISCOVERY IS ALSO THE DISPOSITION AND THESE CLAIMS ARE REAPED: a claim reported and left standing " +
                "is announced to every later caller forever, so the same crash is re-reported indefinitely while the " +
                "state it describes is unchanged and unrepairable — which is a finding nobody can drain, on the one " +
                "surface whose whole job is to say what is in flight NOW. The reap is safe because it fires only where " +
                "the claim is outside the declared live window and its process is not running, which is the same test " +
                "that decided it was dead; a claim that is merely OLD and still running stays, and its holder is " +
                "unaffected",
        );
    }

    return {
        decision: yields ? "yield" : "proceed",
        covering,
        overlapping,
        incomplete: dead,
        message: lines.length === 0 ? null : lines.join(" — "),
    };
}

export function releaseStanding(repoRoot: string, agent: string, at: number): string | null {
    if (agent.length === 0 || at <= 0) {
        return (
            "REFUSED  a release identifies the run it ends, and this call identified none. A DELETING PATH GUARDS BY " +
            "POSITIVE IDENTIFICATION AND FAILS CLOSED TOWARD KEEPING: an unidentified release is a caller that does not " +
            "know which run it is, and the correct answer to that is not a recursive remove of every live claim in the " +
            "repository. Releasing everything would delete the claims of runs still in flight — the exact surface every " +
            "mechanism here reads to decide whether to start a second measurement — so the claim of a party that never " +
            "called this would vanish because a party that did could not name itself"
        );
    }

    const root = claimRoot(repoRoot);
    if (!existsSync(root)) return null;

    rmSync(join(root, `${keyOf(agent, at)}${TAIL}`), { force: true });
    return null;
}
