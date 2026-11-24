import { existsSync, linkSync, unlinkSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";

import { boardRecords } from "../analyzers/board.analyzer.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const NEEDS_FIELD = "Needs";

const ABSENT = "—";

export const TOOL_STAMP = "[written by the sign form]";

export interface SignRequest {
    readonly target: string;
    readonly absolute: string;
    readonly agent: string;
    readonly text: string;
}

export interface SignOutcome {
    readonly message: string;
    readonly code: number;
}

function signOffLine(lines: readonly string[], agent: string): number {
    const opener = `${agent}:`;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (!line.startsWith(opener)) continue;
        if (line.length > opener.length && (line[opener.length] ?? "") !== " ") continue;
        return index;
    }

    return -1;
}

const SIGN_OFF_HEADING = "SIGN-OFF";

const OWNER_ROW = "owner:";

const PLACEHOLDER = "<unsigned>";

function holdsRecord(venue: string, agent: string): boolean {
    return boardRecords(venue).some((record) => record.kind === "agent" && record.label.endsWith(` ${agent}`));
}

function isSignOffRow(line: string): boolean {
    const cut = line.indexOf(":");
    if (cut <= 0) return false;

    for (let index = 0; index < cut; index += 1) {
        const character = line.charAt(index);
        if (character < "A" || character > "Z") return false;
    }

    return true;
}

function withSignOffRow(lines: readonly string[], agent: string): string[] | null {
    let banner = -1;
    let at = -1;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        if (banner === -1) {
            if (line.includes(SIGN_OFF_HEADING)) banner = index;
            continue;
        }
        if (isSignOffRow(line) || line.startsWith(OWNER_ROW)) at = index;
    }

    if (banner === -1) return null;

    const row = `${agent}:     ${PLACEHOLDER}`;
    if (at === -1) return [...lines.slice(0, banner + 1), "", row, ...lines.slice(banner + 1)];

    const insert = (lines[at] ?? "").startsWith(OWNER_ROW) ? at : at + 1;

    return [...lines.slice(0, insert), row, ...lines.slice(insert)];
}

function outstandingNeed(venue: string, agent: string): string {
    for (const record of boardRecords(venue)) {
        if (record.kind !== "agent") continue;
        if (!record.label.endsWith(` ${agent}`)) continue;

        const needs = record.fields.get(NEEDS_FIELD);
        if (needs === undefined) {
            return "the record declares no such field at all, so nothing states whether this seat has an outstanding need";
        }

        const stated = needs.trim();
        if (stated === ABSENT) return "";
        if (stated.length === 0) {
            return "the field is EMPTY, which states nothing — a declared absence is the marker and a blank makes an oversight indistinguishable from a seat with nothing outstanding";
        }

        return stated;
    }

    return "the venue carries no record for this seat, so there is no field to read a need from";
}

const NOT_READ = "NOT-READ:";

const AWAITING = "READ AND AWAITING:";

const TOKEN_BREAKS = new Set([" ", ",", "\t"]);

export function letters(line: string, opener: string): string[] {
    const out: string[] = [];

    let token = "";
    for (const character of `${line.slice(opener.length)} `) {
        if (!TOKEN_BREAKS.has(character)) {
            token += character;
            continue;
        }

        if (token.length > 0 && token !== ABSENT && !out.includes(token)) out.push(token);
        token = "";
    }

    return out;
}

export function rosterLine(opener: string, held: readonly string[]): string {
    const pad = opener === NOT_READ ? "        " : " ";
    return `${opener}${pad}${held.length === 0 ? ABSENT : held.join(" ")}`;
}

export function runArchiveMove(absolute: string, destination: string, target: string): SignOutcome {
    try {
        linkSync(absolute, destination);
    } catch (error) {
        return {
            message:
                `REFUSED  the archive move did not take, so ${target} stands untouched: ${String(error)}. The move ` +
                "CREATES the archived name and fails if it already exists, then removes the source — so an occupied " +
                "name is refused by the operation rather than by a prior test, and a failure at this point leaves the " +
                "venue exactly where it was rather than half-moved\n",
            code: 2,
        };
    }

    unlinkSync(absolute);

    return {
        message:
            `MOVED  ${target} into the archive whole. The extraction keeps the CONCLUSION and the archive keeps the ` +
            "REASONING, so a reader can still separate a ruling from a preference and see what was refuted on the way\n",
        code: 0,
    };
}

export function runReadMark(request: SignRequest): SignOutcome {
    if (!existsSync(request.absolute)) {
        return { message: `REFUSED  ${request.target} does not exist, so there is no read roster to mark\n`, code: 2 };
    }

    const before = readSurface(request.absolute, "utf8");
    const lines = before.split("\n");

    const notReadAt = lines.findIndex((line) => line.startsWith(NOT_READ));
    const awaitingAt = lines.findIndex((line) => line.startsWith(AWAITING));

    if (notReadAt === -1 || awaitingAt === -1) {
        return {
            message:
                `REFUSED  ${request.target} carries no read roster — a venue declares which seats have not yet read it ` +
                "and which have, and a venue missing either line cannot record that anyone read it. Raise it from the " +
                "venue template rather than marking a roster nothing reads\n",
            code: 2,
        };
    }

    const pending = letters(lines[notReadAt] ?? "", NOT_READ).filter((letter) => letter !== request.agent);
    const done = letters(lines[awaitingAt] ?? "", AWAITING);

    if (done.includes(request.agent)) {
        return { message: `CLEAR  ${request.agent} is already marked as having read ${request.target}\n`, code: 0 };
    }

    const written = [...lines];
    written[notReadAt] = rosterLine(NOT_READ, pending);
    written[awaitingAt] = rosterLine(AWAITING, [...done, request.agent]);

    const witness = readSurface(request.absolute, "utf8");
    if (witness !== before) {
        return {
            message:
                `CONTENDED  ${request.target} changed between this read and this write, so the roster was not marked — ` +
                "read it again and mark against what it now says\n",
            code: 2,
        };
    }

    writeSurface(request.absolute, written.join("\n"));

    return {
        message:
            `READ  ${request.agent} marked on ${request.target}. The mark records that this seat was HANDED the venue, ` +
            "which is what a roster can carry — whether it was read is a turn nothing observes, so the roster's honest " +
            "claim is delivery rather than comprehension\n",
        code: 0,
    };
}

export function runSignature(request: SignRequest): SignOutcome {
    if (!existsSync(request.absolute)) {
        return {
            message: `REFUSED  ${request.target} does not exist, so there is no sign-off block to write\n`,
            code: 2,
        };
    }

    const before = readSurface(request.absolute, "utf8");
    const lines = before.split("\n");
    const at = signOffLine(lines, request.agent);

    if (at === -1) {
        if (!holdsRecord(before, request.agent)) {
            return {
                message:
                    `REFUSED  ${request.agent} holds no record on ${request.target}, so it was never convened by this venue ` +
                    "and has nothing to sign. A sign-off row is raised for a seat that is PARTY TO THIS ARGUMENT rather than " +
                    "for every seat that exists — board-activity and venue-participation are different memberships with " +
                    "different lifetimes, and raising a row from the first would make every venue hostage to every seat " +
                    "working anywhere in the tree\n",
                code: 2,
            };
        }

        const raised = withSignOffRow(lines, request.agent);
        if (raised === null) {
            return {
                message:
                    `REFUSED  ${request.target} declares no sign-off block, so there is no region a row can be raised into ` +
                    "— the block is what the closure edge reads, and a row written outside it is a signature nothing joins " +
                    "on\n",
                code: 2,
            };
        }

        const witnessed = readSurface(request.absolute, "utf8");
        if (witnessed !== before) {
            return {
                message: `CONTENDED  ${request.target} moved between the read and the write, so no row was raised\n`,
                code: 2,
            };
        }

        writeSurface(request.absolute, raised.join("\n"));

        return {
            message:
                `ROW  a sign-off row raised for ${request.agent} on ${request.target}. A SEAT JOINING AFTER THE RAISE HAS ` +
                "NO ROW, and the closure edge quantifies over seats that hold a record here — so a joiner could be counted " +
                "by the edge and unable to satisfy it, which is a refusal nobody can clear rather than an ordering anybody " +
                "can meet. The row is raised EMPTY: raising it is not signing it, and the signature is a second call " +
                "carrying what this seat agrees to\n",
            code: 0,
        };
    }

    const need = outstandingNeed(before, request.agent);
    if (need.length > 0) {
        return {
            message:
                `REFUSED  ${request.agent} states an outstanding need on ${request.target}, and an unmet need and a ` +
                "signature are contradictory claims by one party: signing says this seat agrees the outcome is complete " +
                `while the need says it is not. Clear the need or withdraw it, then sign — the need reads: ${need}\n`,
            code: 2,
        };
    }

    const signed = `${request.agent}:     ${request.text} ${TOOL_STAMP}`;
    if ((lines[at] ?? "") === signed) {
        return { message: `CLEAR  ${request.agent} already carries that signature on ${request.target}\n`, code: 0 };
    }

    const written = [...lines.slice(0, at), signed, ...lines.slice(at + 1)].join("\n");

    const witness = readSurface(request.absolute, "utf8");
    if (witness !== before) {
        return {
            message:
                `CONTENDED  ${request.target} changed between this read and this write, so the signature was not ` +
                "written — a signature is a claim about a state, and writing one over content nobody has read is the " +
                "construct the compare-and-swap exists to refuse. Read the surface again and sign against what it now says\n",
            code: 2,
        };
    }

    writeSurface(request.absolute, written);

    return {
        message:
            `SIGNED  ${request.agent} on ${request.target}, stamped as tool-written. THE STAMP IS DECISIVE IN ONE ` +
            "DIRECTION ONLY: a row without it was certainly not written by this form, and a row with it was written by " +
            "something that produced these bytes — which is this form or a seat typing the same characters. Nothing here " +
            "can prove the second did not happen, because proving authorship needs the write path instrumented and that " +
            "surface is outside this package; what the stamp removes is the state where a hand-written row and a " +
            "tool-written one are indistinguishable in BOTH directions\n",
        code: 0,
    };
}
