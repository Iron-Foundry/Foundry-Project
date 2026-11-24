import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { isResolved, slotCount, surfacePath } from "../../../config/surface.config.ts";
import { activeSeats } from "../analyzers/board.analyzer.ts";
import { currentWaiters, writeWaiters } from "../registries/board.registry.ts";
import { heldClaims } from "../registries/claim.registry.ts";
import { lastInteraction } from "../registries/snapshot.registry.ts";
import { barrierState } from "../runners/board.runner.ts";

export interface Admission {
    readonly id: string;
    readonly message: string;
    readonly code: number;
}

function livenessWindow(): number | null {
    if (!isResolved("convention", "run_live_window_ms")) return null;
    return slotCount("convention", "run_live_window_ms");
}

export function writingSeats(
    repoRoot: string,
    seats: readonly string[],
    parked: readonly string[],
    now: number,
): string[] {
    const window = livenessWindow();
    if (window === null) return [...seats];

    const held = new Set(parked);
    const running = new Set(heldClaims(repoRoot).map((claim) => claim.agent));

    return seats.filter((seat) => {
        if (held.has(seat)) return true;
        if (running.has(seat)) return true;

        const stamped = lastInteraction(repoRoot, seat);
        return stamped > 0 && now - stamped < window;
    });
}

function rosterOf(repoRoot: string, board: string, parked: readonly string[], now: number): number {
    if (!existsSync(board)) return 0;

    const index = resolve(repoRoot, surfacePath("agent_index"));
    const seated = activeSeats(readSurface(board, "utf8"), existsSync(index) ? readSurface(index, "utf8") : "");

    return writingSeats(repoRoot, seated, parked, now).length;
}

export function runBarrier(repoRoot: string, board: string, now: number): { message: string; code: number } {
    const waiting = currentWaiters(repoRoot, now);
    return barrierState(
        rosterOf(
            repoRoot,
            board,
            waiting.map((entry) => entry.agent),
            now,
        ),
        waiting.length,
    );
}

export function admitWaiter(
    repoRoot: string,
    board: string,
    request: { agent: string; target: string; timeout: number; now: number; pid: number },
): Admission {
    const waiting = currentWaiters(repoRoot, request.now);
    const agents = rosterOf(
        repoRoot,
        board,
        waiting.map((entry) => entry.agent),
        request.now,
    );

    if (agents > 0 && waiting.length >= agents - 1) {
        const solitary = waiting.length === 0;

        return {
            id: "",
            code: 3,
            message: solitary
                ? "BLOCKED  no peer is counted as able to write, so this wait would watch a surface nothing can change — " +
                  "and NO WRITE CLEARS IT, which is why it is stated apart from the parked case rather than sharing its " +
                  "instruction. The two states are opposite and one predicate covers both: every peer parked is a real " +
                  "condition a write discharges, and a solitary seat is a condition writing cannot touch. Carry on with " +
                  `your own work; the count is ${String(agents)} able to write and ${String(waiting.length)} waiting\n`
                : "BLOCKED  All other active agents are awaiting a collab update, please update the active collab file " +
                  `before awaiting as content has renewed and you need to respond\n         ${String(waiting.length)} ` +
                  `waiting of ${String(agents)} able to write\n`,
        };
    }

    const id = `${String(request.pid)}-${String(request.now)}`;
    writeWaiters(repoRoot, [...waiting, { id, agent: request.agent, expiresAt: request.now + request.timeout }]);

    return {
        id,
        code: 0,
        message:
            `WATCHING  ${request.target} for up to ${String(Math.round(request.timeout / 1000))}s ` +
            `(${String(waiting.length + 1)} of ${String(agents)} able to write are waiting)\n`,
    };
}
