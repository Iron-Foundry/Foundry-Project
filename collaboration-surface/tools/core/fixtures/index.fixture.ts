import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { hostname } from "node:os";
import { resolve } from "node:path";

import { activeSeats } from "../analyzers/board.analyzer.ts";
import { writingSeats } from "../coordinators/board.coordinator.ts";
import { claimStanding } from "../registries/claim.registry.ts";
import { activeSeatLetters, indexedLetters, indexedStates } from "../inspectors/index.inspector.ts";
import { runIndex, runSeats, runTransition } from "../runners/index.runner.ts";
import { readSeatProcesses, writeSeatProcesses, type SeatProcess } from "../registries/process.registry.ts";
import { writeSnapshot } from "../registries/snapshot.registry.ts";
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";

const INDEX = "probe-index.md";

const ROLES = "probe-roles";

const PRIOR_ROLE = `${ROLES}/prior.a.role.md`;

const NEIGHBOUR_ROLE = `${ROLES}/neighbour.b.role.md`;

const MARKED_ACTIVE = [
    "┌─── AGENT A ───",
    "Agent A — ACTIVE",
    "  Owns: a declared concern",
    "└─── END AGENT A",
    "",
].join("\n");

function derived(index: string): BranchObservation {
    const seats = activeSeats(MARKED_ACTIVE, index);
    return { seats: seats.length, holds: seats.includes("A") };
}

const REGIONED = [
    "# a probe index",
    "",
    "═══ INDEX ═══",
    "",
    "| letter | role | state |",
    "|---|---|---|",
    "| A | a declared concern | ACTIVE |",
    "",
    "═══ ALLOCATION ═══",
    "",
    "prose below the region",
    "",
].join("\n");

const NO_REGION = ["# a probe index", "", "| letter | role | state |", "| A | a declared concern | ACTIVE |", ""].join(
    "\n",
);

function indexing(root: string, seed: string, role: string): BranchObservation {
    const absolute = resolve(root, INDEX);
    const before = readSurface(absolute, "utf8");
    const outcome = runIndex({ absolute, role, roles: null });
    const after = readSurface(absolute, "utf8");

    return {
        code: outcome.code,
        changed: after !== before,
        letters: indexedLetters(after).letters.size,
        active: activeSeatLetters(after).length,
        seeded: seed.length > 0,
    };
}

function reissuing(root: string): BranchObservation {
    const absolute = resolve(root, INDEX);
    const outcome = runIndex({ absolute, role: "a fresh concern", roles: resolve(root, ROLES) });
    const after = readSurface(absolute, "utf8");

    return {
        code: outcome.code,
        letter: outcome.letter ?? "",
        recycled: outcome.recycled,
        letters: indexedLetters(after).letters.size,
        rebound: after.includes("| A | a fresh concern | ACTIVE |"),
        attributed: after.includes("> A moved to"),
        priorRole: existsSync(resolve(root, PRIOR_ROLE)),
        neighbourRole: existsSync(resolve(root, NEIGHBOUR_ROLE)),
    };
}

function exitedProcess(): number {
    return spawnSync(process.execPath, ["--version"]).pid ?? 0;
}

function probing(
    root: string,
    caller: string,
    callerPid: number | null,
    bound: Readonly<Record<string, number>>,
    claiming = false,
): BranchObservation {
    const seats = new Map<string, SeatProcess>();
    for (const [letter, pid] of Object.entries(bound)) seats.set(letter, { pid, host: hostname(), at: 1 });
    writeSeatProcesses(root, seats);

    const absolute = resolve(root, INDEX);
    const outcome = runSeats({
        absolute,
        repoRoot: root,
        caller,
        process: callerPid === null ? null : { pid: callerPid, host: hostname(), at: 2 },
        claiming,
    });
    const states = indexedStates(readSurface(absolute, "utf8"));
    const held = readSeatProcesses(root);

    return {
        code: outcome.code,
        a: states.get("A") ?? "",
        b: states.get("B") ?? "",
        boundA: held.get("A")?.pid === callerPid && callerPid !== null,
        boundB: held.has("B"),
        attributed: readSurface(absolute, "utf8").includes("by B under the process probe"),
    };
}

const TWO_SEATS = REGIONED.split("| A | a declared concern | ACTIVE |").join(
    "| A | a declared concern | ACTIVE |\n| B | a second concern | ACTIVE |",
);

const TWO_SEATS_A_INACTIVE = TWO_SEATS.split("| A | a declared concern | ACTIVE |").join(
    "| A | a declared concern | INACTIVE |",
);

const FREED = REGIONED.split("| A | a declared concern | ACTIVE |").join(
    "| A | a declared concern | INACTIVE |\n> A moved to INACTIVE by B under the process probe\n| B | a second concern | ACTIVE |\n| SAa | a bounded invocation | INVOKED |",
);

const HELD = REGIONED.split("| A | a declared concern | ACTIVE |").join(
    "| A | a declared concern | ACTIVE |\n| B | a second concern | INVOKED |\n| C | a third concern | INACTIVE |",
);

function moving(
    root: string,
    letter: string,
    state: string,
    by = letter,
    warrant: string | null = null,
): BranchObservation {
    const absolute = resolve(root, INDEX);
    const outcome = runTransition({ absolute, letter, state, by, warrant });
    const after = readSurface(absolute, "utf8");

    return {
        code: outcome.code,
        active: activeSeatLetters(after).length,
        letters: indexedLetters(after).letters.size,
        reads: after.includes(`| ${letter} | a declared concern | ${state} |`),
        attributed: after.includes(`moved to ${state} by ${by} under`),
    };
}

const INDEX_INACTIVE = REGIONED.split("| A | a declared concern | ACTIVE |").join(
    "| A | a declared concern | INACTIVE |",
);

export const INDEX_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "board.analyzer",
        branch: "a board marker reading active against an index row reading inactive, where the maintained operand decides",
        seed: [{ path: INDEX, text: INDEX_INACTIVE }],
        exercise: () => derived(INDEX_INACTIVE),
        expect: { seats: 0, holds: false },
    },
    {
        subject: "board.analyzer",
        branch: "a board marker and an index row that agree, which every derived set reads exactly as it reads today",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: () => derived(REGIONED),
        expect: { seats: 1, holds: true },
    },
    {
        subject: "board.analyzer",
        branch: "a letter the allocating surface does not bind, where trusting its own marker would make an unallocated identity active on its own say-so",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: () => derived("| letter | role | state |\n"),
        expect: { seats: 0, holds: false },
    },
    {
        subject: "board.analyzer",
        branch: "an ABSENT allocating surface, which is a different state from one that binds nothing — there is no allocation to derive from, so the branch that would read one does not run and the marker stands",
        seed: [],
        exercise: () => derived(""),
        expect: { seats: 1, holds: true },
    },
    {
        subject: "index.runner",
        branch: "a seat moving its own row to a declared state, which every keyed mechanism re-derives from",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => moving(root, "A", "INACTIVE"),
        expect: { code: 0, active: 0, letters: 1, reads: true, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a seat moving ANOTHER seat's row with a warrant, which is the case the self-scoped form has none for — a seat that departs without declaring leaves a state only it may change, so every edge quantifying over active seats counts a party that cannot act and the discussion holds on a signature that will never arrive",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => moving(root, "A", "INACTIVE", "D", "the warrant"),
        expect: { code: 0, active: 0, letters: 1, reads: true, attributed: true },
    },
    {
        subject: "index.runner",
        branch: "the same foreign transition with NO warrant, which must refuse — a state a peer wrote and a state its own seat wrote are otherwise one cell, and no reader can tell which claim they are holding",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => moving(root, "A", "INACTIVE", "D"),
        expect: { code: 2, active: 1, letters: 1, reads: false, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a transition to a state outside the closed set, which would resolve in no reader of the column",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => moving(root, "A", "RESTING"),
        expect: { code: 2, active: 1, letters: 1, reads: false, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a transition on a letter the index does not bind, which would state a seat nothing resolves",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => moving(root, "Q", "INACTIVE"),
        expect: { code: 2, active: 1, letters: 1, reads: false, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a binding into a declared row region, which allocates the shortest free identity",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => indexing(root, REGIONED, "a second declared concern"),
        expect: { code: 0, changed: true, letters: 2, active: 2, seeded: true },
    },
    {
        subject: "index.runner",
        branch: "a binding against a surface declaring no row region, which has no boundary to append within",
        seed: [{ path: INDEX, text: NO_REGION }],
        exercise: (root) => indexing(root, NO_REGION, "a second declared concern"),
        expect: { code: 2, changed: false, letters: 1, active: 1, seeded: true },
    },
    {
        subject: "index.runner",
        branch: "a binding naming no role, which would resolve every citation of its letter to nothing",
        seed: [{ path: INDEX, text: REGIONED }],
        exercise: (root) => indexing(root, REGIONED, "   "),
        expect: { code: 2, changed: false, letters: 1, active: 1, seeded: true },
    },
    {
        subject: "index.runner",
        branch: "a binding when the shortest letter reads INACTIVE, which REISSUES that row in place rather than minting a longer identity, drops the previous holder's attribution line and deletes only that holder's role document",
        seed: [
            { path: INDEX, text: FREED },
            { path: PRIOR_ROLE, text: "a prior holder's role document\n" },
            { path: NEIGHBOUR_ROLE, text: "a neighbour's role document\n" },
        ],
        exercise: (root) => reissuing(root),
        expect: {
            code: 0,
            letter: "A",
            recycled: true,
            letters: 3,
            rebound: true,
            attributed: false,
            priorRole: false,
            neighbourRole: true,
        },
    },
    {
        subject: "index.runner",
        branch: "a binding that passes over ACTIVE and INVOKED rows and reissues the first INACTIVE one — the positive control, because a scheme that reissues every row has been shown to overwrite rather than to discriminate",
        seed: [{ path: INDEX, text: HELD }],
        exercise: (root) => {
            const outcome = runIndex({ absolute: resolve(root, INDEX), role: "a fresh concern", roles: null });
            return { code: outcome.code, letter: outcome.letter ?? "", recycled: outcome.recycled };
        },
        expect: { code: 0, letter: "C", recycled: true },
    },
    {
        subject: "index.runner",
        branch: "a seat moving its own row after a peer moved it, which replaces the peer's attribution line rather than leaving it to describe a state the row no longer reads",
        seed: [{ path: INDEX, text: FREED }],
        exercise: (root) => moving(root, "A", "ACTIVE"),
        expect: { code: 0, active: 2, letters: 3, reads: true, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "an ACTIVE seat with no bound session process, which the probe reads as departed and moves INACTIVE with its warrant recorded",
        seed: [{ path: INDEX, text: TWO_SEATS }],
        exercise: (root) => probing(root, "B", null, {}),
        expect: { code: 0, a: "INACTIVE", b: "ACTIVE", boundA: false, boundB: false, attributed: true },
    },
    {
        subject: "index.runner",
        branch: "an ACTIVE seat bound to a session process that has exited, which is reaped exactly as an unbound one is",
        seed: [{ path: INDEX, text: TWO_SEATS }],
        exercise: (root) => probing(root, "B", process.pid, { A: exitedProcess() }),
        expect: { code: 0, a: "INACTIVE", b: "ACTIVE", boundA: false, boundB: true, attributed: true },
    },
    {
        subject: "index.runner",
        branch: "an ACTIVE seat bound to a session process that is still running, which stays ACTIVE — the positive control, because a probe reaping every seat has been shown to empty the board rather than to find the departed",
        seed: [{ path: INDEX, text: TWO_SEATS }],
        exercise: (root) => probing(root, "B", null, { A: process.pid }),
        expect: { code: 0, a: "ACTIVE", b: "ACTIVE", boundA: false, boundB: false, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "an INACTIVE seat calling under a running session, which binds it and moves its own row back to ACTIVE",
        seed: [{ path: INDEX, text: TWO_SEATS_A_INACTIVE }],
        exercise: (root) => probing(root, "A", process.pid, { B: process.ppid }),
        expect: { code: 0, a: "ACTIVE", b: "ACTIVE", boundA: true, boundB: true, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a call under a letter already bound to a DIFFERENT running session, which refuses rather than letting two live sessions share one fence and one reader set",
        seed: [{ path: INDEX, text: TWO_SEATS }],
        exercise: (root) => probing(root, "A", exitedProcess(), { A: process.pid, B: process.pid }),
        expect: { code: 2, a: "ACTIVE", b: "ACTIVE", boundA: false, boundB: true, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a claim for a new letter from a session process that already holds an ACTIVE letter, which refuses — a cleared conversation keeps its process, and a second letter splits one session across two records while the forgotten one keeps reading ACTIVE",
        seed: [{ path: INDEX, text: TWO_SEATS }],
        exercise: (root) => probing(root, "Z", process.pid, { A: process.pid }, true),
        expect: { code: 2, a: "ACTIVE", b: "ACTIVE", boundA: true, boundB: false, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a call under an INACTIVE letter from a session process that already holds a different ACTIVE letter, which refuses rather than reactivating a second seat in one session",
        seed: [{ path: INDEX, text: TWO_SEATS_A_INACTIVE }],
        exercise: (root) => probing(root, "A", process.pid, { B: process.pid }),
        expect: { code: 2, a: "INACTIVE", b: "ACTIVE", boundA: false, boundB: true, attributed: false },
    },
    {
        subject: "index.runner",
        branch: "a claim for a new letter from a session process whose only letter reads INACTIVE, which passes — the positive control, because a check refusing every claim from a known process has been shown to lock a departed session out rather than to find a second seat",
        seed: [{ path: INDEX, text: TWO_SEATS_A_INACTIVE }],
        exercise: (root) => probing(root, "Z", process.pid, { A: process.pid, B: exitedProcess() }, true),
        expect: { code: 0, a: "INACTIVE", b: "INACTIVE", boundA: false, boundB: false, attributed: false },
    },
    {
        subject: "board.coordinator",
        branch: "a seated party that has touched a coordination surface just now, which is able to write and raises the threshold it should",
        seed: [],
        exercise: (root) => {
            writeSnapshot(root, "A", "a-surface.md", "held");
            return { able: writingSeats(root, ["A", "B"], [], Date.now()).join("") };
        },
        expect: { able: "A" },
    },
    {
        subject: "board.coordinator",
        branch: "a seated party currently PARKED, which is live by construction and counted whatever its last stamp says — the half a recency signal alone would drop, since a parked party stops stamping while it waits",
        seed: [],
        exercise: (root) => ({ able: writingSeats(root, ["A", "B"], ["B"], Date.now()).join("") }),
        expect: { able: "B" },
    },
    {
        subject: "board.coordinator",
        branch: "a seated party that has neither parked nor touched anything inside the declared window, which raises the threshold for nobody — the deadlock member, where a party counted by holding a row lets every remaining one park with nobody left to write",
        seed: [],
        exercise: (root) => ({ able: writingSeats(root, ["A", "B"], [], 0).join("") }),
        expect: { able: "" },
    },
    {
        subject: "board.coordinator",
        branch: "a seated party holding a LIVE RUN CLAIM and nothing else, which must be counted — liveness was measured by touching a coordination surface, which is the one activity a party deep in a build does not perform, so the longer it worked the more certainly it dropped out and the denominator fell to one, refusing every wait unconditionally while asserting that every peer was parked",
        seed: [],
        exercise: (root) => {
            claimStanding(root, "whole", 1, "B");
            return { able: writingSeats(root, ["A", "B"], [], 0).join("") };
        },
        expect: { able: "B" },
    },
];
