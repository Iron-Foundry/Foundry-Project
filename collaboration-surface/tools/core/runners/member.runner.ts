import { existsSync } from "node:fs";

import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

export interface MemberRequest {
    readonly target: string;
    readonly absolute: string;
    readonly heading: string;
    readonly body: string;
}

export interface MemberOutcome {
    readonly message: string;
    readonly code: number;
}

const MEMBER_MARKER = "## ";

const REGION_LEAD = "═";

const REGION_WORD = "ROWS";

function regionAt(lines: readonly string[]): number {
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (line.startsWith(REGION_LEAD) && line.includes(REGION_WORD)) return index;
    }
    return -1;
}

export function runMember(request: MemberRequest): MemberOutcome {
    if (!existsSync(request.absolute)) {
        return {
            code: 2,
            message: `ABSENT  ${request.target} does not exist, so there is no member region to append into\n`,
        };
    }

    const before = readSurface(request.absolute, "utf8");
    const lines = before.split("\n");
    const region = regionAt(lines);

    if (region === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.target} declares no member region, so this form has no boundary to stay beneath — and a ` +
                "keyed append with no declared region is a path for machine-writing the CONTRACT that states what a member " +
                "MEANS, which is worse than the hand write it replaces. A surface takes this form by declaring the region " +
                "its members live in; until it does, its members are deliberately hand-written and a reader meets that " +
                "decision rather than an absence\n",
        };
    }

    if (before.includes(`${MEMBER_MARKER}${request.heading}`)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.heading} already resolves in ${request.target} — this form APPENDS a new keyed member and ` +
                "never edits one, because a member is owned by the party that MEASURED it and a second party appending to it " +
                "asserts a measurement in their name. A later measurement of the same fact is a new member naming what moved, " +
                "or an edit by its own author\n",
        };
    }

    const written = `${before.endsWith("\n") ? before : `${before}\n`}\n${MEMBER_MARKER}${request.heading}\n\n${request.body}\n`;

    const witness = readSurface(request.absolute, "utf8");
    if (witness !== before) {
        return {
            code: 2,
            message:
                `CONTENDED  ${request.target} moved between the read and the write, so the member was not appended — the ` +
                "surface takes concurrent appends from every seat, and a write composed over content nobody has read is the " +
                "construct the witness exists to refuse. Re-run and the heading is re-checked against the current file\n",
        };
    }

    writeSurface(request.absolute, written);

    return {
        code: 0,
        message:
            `MEMBER  ${request.heading} appended to ${request.target}. IT LANDS BENEATH THE DECLARED REGION AND CANNOT REACH ` +
            "ABOVE IT: the half stating what a member IS, which fields describe it and who owns it, is not a member and takes " +
            "no append — a form able to write both would machine-write the statement that governs what its own writes mean. " +
            "The member is its author's: this form appends and never edits, and it refuses a heading that already resolves " +
            "because a citation names a member by its heading.\n",
    };
}
