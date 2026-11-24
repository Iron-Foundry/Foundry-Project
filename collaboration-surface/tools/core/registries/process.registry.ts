import { existsSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { slotText } from "../../../config/surface.config.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";
import { witnessedGone } from "./claim.registry.ts";

const SEATS = "process.seats.generated.json";

export interface SeatProcess {
    readonly pid: number;
    readonly host: string;
    readonly at: number;
}

function seatsPath(repoRoot: string): string {
    return join(repoRoot, GENERATED_DIR, SEATS);
}

function isSeatProcess(value: unknown): value is SeatProcess {
    if (typeof value !== "object" || value === null) return false;

    const candidate = value as { pid?: unknown; host?: unknown; at?: unknown };
    return typeof candidate.pid === "number" && typeof candidate.host === "string" && typeof candidate.at === "number";
}

export function callerProcess(at: number): SeatProcess | null {
    const held = Number(process.env[slotText("execution", "session_process_variable")] ?? "");
    if (!Number.isInteger(held) || held <= 0) return null;

    return { pid: held, host: hostname(), at };
}

export function readSeatProcesses(repoRoot: string): Map<string, SeatProcess> {
    const out = new Map<string, SeatProcess>();
    const path = seatsPath(repoRoot);
    if (!existsSync(path)) return out;

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(path, "utf8"));
    } catch {
        return out;
    }

    if (typeof parsed !== "object" || parsed === null) return out;

    for (const [letter, entry] of Object.entries(parsed)) {
        if (isSeatProcess(entry)) out.set(letter, entry);
    }

    return out;
}

export function writeSeatProcesses(repoRoot: string, seats: ReadonlyMap<string, SeatProcess>): void {
    const ordered: Record<string, SeatProcess> = {};
    for (const letter of [...seats.keys()].sort()) {
        const entry = seats.get(letter);
        if (entry !== undefined) ordered[letter] = entry;
    }

    mkdirSync(join(repoRoot, GENERATED_DIR), { recursive: true });
    writeSurface(seatsPath(repoRoot), `${JSON.stringify(ordered, null, 2)}\n`);
}

export function sameProcess(left: SeatProcess, right: SeatProcess): boolean {
    return left.pid === right.pid && left.host === right.host;
}

export function departureOf(entry: SeatProcess | undefined): string | null {
    if (entry === undefined) return "no session process is bound to it";
    if (witnessedGone(entry)) return `its session process ${String(entry.pid)} on ${entry.host} is gone`;
    return null;
}
