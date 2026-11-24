import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

import {
    departureOf,
    readSeatProcesses,
    sameProcess,
    writeSeatProcesses,
    type SeatProcess,
} from "../registries/process.registry.ts";

const ROW = "| ";

const SECTION = "═";

const SECTION_WORD = "INDEX";

const ACTIVE_STATE = "ACTIVE";

const INACTIVE_STATE = "INACTIVE";

const ATTRIBUTION = "> ";

const ROLE_TAIL = ".role.md";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const LOWER = "abcdefghijklmnopqrstuvwxyz";

export const SEAT_STATES: readonly string[] = ["ACTIVE", "INACTIVE", "INVOKED"];

export interface TransitionRequest {
    readonly absolute: string;
    readonly letter: string;
    readonly state: string;
    readonly by: string;
    readonly warrant: string | null;
}

function rowLetter(line: string): string {
    const cells = line.split("|");
    return (cells[1] ?? "").trim();
}

function isAttributionOf(line: string, letter: string): boolean {
    return line.startsWith(`${ATTRIBUTION}${letter} moved to `);
}

function withoutAttribution(lines: readonly string[], at: number, letter: string): string[] {
    let end = at + 1;
    while (end < lines.length && isAttributionOf(lines[end] ?? "", letter)) end += 1;
    return [...lines.slice(0, at + 1), ...lines.slice(end)];
}

export function runTransition(request: TransitionRequest): IndexOutcome {
    const foreign = request.letter !== request.by;
    if (foreign && (request.warrant === null || request.warrant.trim().length === 0)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.by} is moving ${request.letter}, and a party changing ANOTHER party's state states ` +
                "its warrant. THE SELF-SCOPED FORM IS RIGHT FOR THE ORDINARY CASE and has no case for a seat that " +
                "departs without declaring: the state is then unchangeable by the only parties present, every edge " +
                "quantifying over active seats counts a party that cannot act, and the venue holds on a signature that " +
                "will never arrive. So a foreign transition is admitted and is never anonymous — the row records who " +
                "moved it and under what, because a state a peer wrote and a state its own seat wrote are otherwise the " +
                "same cell and no reader can tell which claim they are holding\n",
        };
    }

    if (!SEAT_STATES.includes(request.state)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.state} is not a declared seat state. THE SET IS CLOSED BECAUSE EVERY MECHANISM HERE ` +
                "READS IT: the reader set, the wait cap, the addressee resolution and the convergence quantifier all " +
                "derive from this column, so a value outside the set resolves in none of them while reading as a state " +
                "that exists — which is a row governed by nothing rather than a typo",
        };
    }

    const source = readSurface(request.absolute, "utf8");
    const at = source.split("\n").findIndex((line) => line.startsWith(ROW) && rowLetter(line) === request.letter);
    const lines = at === -1 ? source.split("\n") : withoutAttribution(source.split("\n"), at, request.letter);
    if (at === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.letter} carries no row in the index, so there is no state to move. A LETTER IS ` +
                "CLAIMED BY ADDING THE ROW RATHER THAN BY USING IT, and a transition on an unbound letter would write a " +
                "state for an identity nothing resolves — bind it first, which is the operation that makes every later " +
                "citation of that letter mean something",
        };
    }

    const cells = (lines[at] ?? "").split("|");
    if (cells.length < 5) {
        return {
            code: 2,
            message:
                "REFUSED  the row does not carry the declared columns, so the state column cannot be resolved by " +
                "position. The row shape is the contract every reader of this surface derives its columns from, and a " +
                "form guessing which cell is the state would write the role column on a row one cell short",
        };
    }

    const current = (cells[3] ?? "").trim();
    if (current === request.state) {
        return {
            code: 0,
            message:
                `CLEAR  ${request.letter} already reads ${request.state}, so this is a no-op rather than a refusal — ` +
                "the state a transition asks for already holds, and rewriting it in place would move nothing while " +
                "reporting a change",
        };
    }

    cells[3] = ` ${request.state} `;
    lines[at] = cells.join("|");

    if (foreign) {
        lines.splice(
            at + 1,
            0,
            `> ${request.letter} moved to ${request.state} by ${request.by} under ${String(request.warrant)}`,
        );
    }

    writeSurface(request.absolute, lines.join("\n"));

    return {
        code: 0,
        message:
            `STATE  ${request.letter} moved to ${request.state}${foreign ? ` BY ${request.by}, recorded beneath the row with its warrant` : ""}. THE STATE IS MOVED BY ` +
            "THE SEAT WHOSE LETTER IT IS, or by a peer that states its warrant, and it answers who is working right now — " +
            "every mechanism keyed on it re-derives the moment this row moves. The line beneath a row names the LAST " +
            "foreign mover only, so it is replaced on every transition rather than stacked. A SEAT LEAVING ALSO ENDS ITS " +
            "STANDING OBLIGATIONS, which is why the transition is a write path rather than a label: an active letter " +
            "owning no role document fails, so a retiring seat that cannot move its own row cannot discharge what its " +
            "state owes\n",
    };
}

export interface IndexRequest {
    readonly absolute: string;
    readonly role: string;
    readonly roles: string | null;
}

export interface IndexOutcome {
    readonly code: number;
    readonly message: string;
}

export interface IndexBinding extends IndexOutcome {
    readonly letter: string | null;
    readonly recycled: boolean;
}

interface IndexRow {
    readonly at: number;
    readonly letter: string;
    readonly state: string;
}

function rowsIn(lines: readonly string[]): IndexRow[] {
    const out: IndexRow[] = [];
    let opened = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const trimmed = line.trim();

        if (!opened) {
            if (trimmed.startsWith(SECTION) && trimmed.includes(SECTION_WORD)) opened = true;
            continue;
        }
        if (trimmed.startsWith(SECTION)) break;
        if (!line.startsWith(ROW)) continue;

        const cells = line.split("|");
        const letter = (cells[1] ?? "").trim();
        const first = letter.charAt(0);
        if (first < "A" || first > "Z") continue;

        out.push({ at: index, letter, state: (cells[3] ?? "").trim() });
    }

    return out;
}

function retireRoleDocuments(roles: string | null, letter: string): string[] {
    if (roles === null || !existsSync(roles)) return [];

    const tail = `.${letter.toLowerCase()}${ROLE_TAIL}`;
    const retired = readdirSync(roles).filter((entry) => entry.endsWith(tail));
    for (const entry of retired) rmSync(join(roles, entry), { force: true });

    return retired;
}

function candidates(): string[] {
    const out: string[] = [];

    for (const first of UPPER) out.push(first);
    for (const first of UPPER) {
        for (const second of LOWER) out.push(`${first}${second}`);
    }
    for (const first of UPPER) {
        for (const second of UPPER) {
            for (const third of LOWER) out.push(`${first}${second}${third}`);
        }
    }

    return out;
}

function shortestFree(taken: ReadonlySet<string>): string | null {
    for (const candidate of candidates()) {
        if (!taken.has(candidate)) return candidate;
    }

    return null;
}

export function runIndex(request: IndexRequest): IndexBinding {
    if (request.role.trim().length === 0) {
        return {
            code: 2,
            letter: null,
            recycled: false,
            message:
                "REFUSED  a row binds a letter to a ROLE and this call named none. The letter is the identity and the " +
                "role is what the letter MEANS, so a row without one resolves every citation that names that letter to " +
                "nothing. State the role as a CONCERN rather than as a task list: a concern survives the work changing " +
                "under it, and a task list is stale the first time its holder finishes something while still reading as " +
                "current\n",
        };
    }

    const source = readSurface(request.absolute, "utf8");
    const lines = source.split("\n");
    const rows = rowsIn(lines);

    const last = rows.at(-1);
    if (last === undefined) {
        return {
            code: 2,
            letter: null,
            recycled: false,
            message:
                "REFUSED  the index declares no row region, so this form has no boundary to append within and would " +
                "place a binding wherever the file happens to end. A surface takes this form by DECLARING the region " +
                "its rows occupy; one that does not is deliberately hand-written, where a reader meets the decision " +
                "rather than an absence\n",
        };
    }

    const held = new Set(rows.filter((row) => row.state !== INACTIVE_STATE).map((row) => row.letter));
    const letter = shortestFree(held);
    if (letter === null) {
        return {
            code: 2,
            letter: null,
            recycled: false,
            message:
                "REFUSED  every identity in the allocation scheme is held by an ACTIVE or INVOKED row, so there is no " +
                "letter to issue — an INACTIVE row is reissued before a longer identity is minted, so this state means " +
                "the scheme is genuinely full rather than cluttered with departed seats\n",
        };
    }

    const bound = `| ${letter} | ${request.role.trim()} | ${ACTIVE_STATE} |`;
    const freed = rows.find((row) => row.letter === letter);

    if (freed === undefined) {
        writeSurface(
            request.absolute,
            [...lines.slice(0, last.at + 1), bound, ...lines.slice(last.at + 1)].join("\n"),
        );

        return {
            code: 0,
            letter,
            recycled: false,
            message:
                `ROW  ${letter} bound to its role in the index, ACTIVE. THE LETTER IS CLAIMED BY ADDING THE ROW RATHER ` +
                "THAN BY USING IT, so this precedes the first write to every other surface — writing under an unindexed " +
                "letter reads as governed and resolves to nothing, and so does every citation later written against it. " +
                "The identity is ALLOCATED rather than chosen: the shortest letter no ACTIVE or INVOKED row holds\n",
        };
    }

    const previous = (lines[freed.at] ?? "").split("|")[2]?.trim() ?? "";
    const rewritten = withoutAttribution(lines, freed.at, letter);
    rewritten[freed.at] = bound;
    writeSurface(request.absolute, rewritten.join("\n"));

    const retired = retireRoleDocuments(request.roles, letter);

    return {
        code: 0,
        letter,
        recycled: true,
        message:
            `ROW  ${letter} REISSUED to its new role, ACTIVE. Its previous holder (${previous}) reads INACTIVE, so the ` +
            "letter returns to the pool and the shortest free identity is the one issued — a departed seat frees its " +
            "letter rather than pushing every later seat further down the scheme. " +
            (retired.length === 0
                ? "The previous holder left no role document. "
                : `The previous holder's role document (${retired.join(", ")}) is deleted, so raise this seat's own with --role before its first edit. `) +
            `THE BOARD RECORD UNDER ${letter} IS INHERITED AS IT STANDS: rewrite its Owns and Status with --field before ` +
            `anything else, and read its Flags — an item written by or addressed to ${letter} now resolves to this seat\n`,
    };
}

export interface SeatRequest {
    readonly absolute: string;
    readonly repoRoot: string;
    readonly caller: string;
    readonly process: SeatProcess | null;
    readonly claiming: boolean;
}

function indexStates(absolute: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const row of rowsIn(readSurface(absolute, "utf8").split("\n"))) out.set(row.letter, row.state);
    return out;
}

export function letterHeldBy(
    states: ReadonlyMap<string, string>,
    seats: ReadonlyMap<string, SeatProcess>,
    caller: SeatProcess,
    except: string | null,
): string | null {
    for (const [letter, bound] of seats) {
        if (letter === except || states.get(letter) !== ACTIVE_STATE) continue;
        if (sameProcess(bound, caller)) return letter;
    }
    return null;
}

function secondSeatRefusal(request: SeatRequest, held: string, pid: number): IndexOutcome {
    const asked = request.claiming ? "claim a new letter" : `write under ${request.caller}`;
    return {
        code: 2,
        message:
            `REFUSED  this session process ${String(pid)} already holds ${held}, which reads ACTIVE, and this call ` +
            `would ${asked}. A SESSION IS ONE SEAT: a second letter in one process splits its claims and its items ` +
            `across two records, and the letter it forgets keeps reading ACTIVE to every peer. A cleared conversation ` +
            `keeps its process, so it still holds ${held}: resume it with --agent ${held}. To hand ${held}'s concern ` +
            `elsewhere, move it with --transition INACTIVE first\n`,
    };
}

export function runSeats(request: SeatRequest): IndexOutcome {
    if (!existsSync(request.absolute)) return { code: 0, message: "" };

    const states = indexStates(request.absolute);
    const seats = readSeatProcesses(request.repoRoot);
    const lines: string[] = [];

    if (request.process !== null) {
        const held = letterHeldBy(states, seats, request.process, request.claiming ? null : request.caller);
        if (held !== null) return secondSeatRefusal(request, held, request.process.pid);
    }

    const own = states.get(request.caller);
    const seated = own === ACTIVE_STATE || own === INACTIVE_STATE;

    if (request.process !== null && seated && !request.claiming) {
        const held = seats.get(request.caller);
        if (held !== undefined && !sameProcess(held, request.process) && departureOf(held) === null) {
            return {
                code: 2,
                message:
                    `REFUSED  ${request.caller} is bound to session process ${String(held.pid)} on ${held.host}, which is ` +
                    `still running, and this call runs under process ${String(request.process.pid)}. A LETTER IS ONE ` +
                    "SEAT: two live sessions writing under it share a fence, a reader set and a snapshot, so each is " +
                    "handed the other's items and neither can tell which writes are its own. Claim a letter of your own " +
                    "with --index\n",
            };
        }

        seats.set(request.caller, request.process);

        if (own === INACTIVE_STATE) {
            runTransition({
                absolute: request.absolute,
                letter: request.caller,
                state: ACTIVE_STATE,
                by: request.caller,
                warrant: null,
            });
            lines.push(
                `SEAT  ${request.caller} is running under process ${String(request.process.pid)}, so its row reads ACTIVE again\n`,
            );
        }
    }

    for (const [letter, state] of states) {
        if (state !== ACTIVE_STATE || letter === request.caller) continue;

        const departure = departureOf(seats.get(letter));
        if (departure === null) continue;

        const moved = runTransition({
            absolute: request.absolute,
            letter,
            state: INACTIVE_STATE,
            by: request.caller,
            warrant: `the process probe, because ${departure}`,
        });
        if (moved.code !== 0) continue;

        seats.delete(letter);
        lines.push(
            `REAPED  ${letter} reads INACTIVE because ${departure}, so its letter is free for the next --index. A seat ` +
                "is ACTIVE while its session runs, and every invocation probes the rest, so a session that ends without " +
                "declaring stops holding a letter and stops counting in every reader set\n",
        );
    }

    const after = indexStates(request.absolute);
    for (const letter of [...seats.keys()]) {
        if (after.get(letter) !== ACTIVE_STATE) seats.delete(letter);
    }
    writeSeatProcesses(request.repoRoot, seats);

    return { code: 0, message: lines.join("") };
}

export function bindSeat(repoRoot: string, letter: string, bound: SeatProcess | null): void {
    if (bound === null) return;

    const seats = readSeatProcesses(repoRoot);
    seats.set(letter, bound);
    writeSeatProcesses(repoRoot, seats);
}
