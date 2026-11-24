import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";

import { itemKindOf } from "../formatters/board.formatter.ts";
import { writeSurface } from "../writers/surface.writer.ts";
import { authorOf, closureText } from "../generators/board.generator.ts";
import { closureRefusal } from "../validators/archive.validator.ts";

export interface ClosureRequest {
    readonly absolute: string;
    readonly archive: string;
    readonly index: string;
    readonly closes: string;
    readonly agent: string | null;
    readonly ref: string | null;
}

export interface ClosureOutcome {
    readonly refusal: string | null;
    readonly author: string;
    readonly label: string;
    readonly acknowledged: boolean;
}

export const JUDGEMENT_KIND = "judgement";

const ENTRY_MARKER = "### ";

const ENTRY_LEADS = ["POPULATION:", "BOUNDARY:"];

function declaresLead(body: string, lead: string): boolean {
    return body.split("\n").some((line) => line.startsWith(lead));
}

export interface EntryRequest {
    readonly archive: string;
    readonly heading: string;
    readonly body: string;
}

export interface EntryOutcome {
    readonly message: string;
    readonly code: number;
}

const HEADING_WORD = new Set("abcdefghijklmnopqrstuvwxyz0123456789-");

export function filedHeadings(source: string): string[] {
    const out: string[] = [];

    for (const line of source.split("\n")) {
        if (!line.startsWith(ENTRY_MARKER)) continue;
        const heading = line.slice(ENTRY_MARKER.length).trim();
        if (heading.length > 0) out.push(heading);
    }

    return out;
}

export function namesAClass(heading: string): boolean {
    if (heading.length === 0) return false;

    for (const character of heading) {
        if (!HEADING_WORD.has(character)) return false;
    }

    return true;
}

export function classHeadings(source: string): string[] {
    return filedHeadings(source).filter((heading) => namesAClass(heading));
}

export function filedNotice(source: string): string {
    const filed = filedHeadings(source);
    const classes = filed.filter((heading) => namesAClass(heading));
    if (filed.length === 0) return "";

    const records = filed.length - classes.length;

    return (
        `\nCLASSES ALREADY FILED, published because THIS FORM ALREADY READ THEM: ${classes.join("; ")}.\n` +
        `THE SET IS PARTITIONED RATHER THAN RENAMED, AND ${records} HEADING(S) ARE HELD BACK AS RECORDS. A class heading ` +
        "is one kebab sentence and nothing else; a drained item's heading carries the item's identity and its delivery " +
        "state, which is a RECORD of one item rather than a class anybody could duplicate. Publishing both under one " +
        "label made the enumeration state more than it holds — the reading an author needs is whether a CLASS is already " +
        "held, and a record can never answer it. The count is derived here rather than the records listed, because a " +
        "list nobody can act on is what pushed the operand past reading.\n" +
        "THE LIST IS HANDED OVER RATHER THAN JUDGED. Whether two kebab sentences name ONE class is a reading a party " +
        "performs and no mechanism here decides, so this refuses nothing and shows what the duplicate test was already " +
        "holding — the one surface every drain refuses without is written by every party and READ by the removal path " +
        "alone, so the moment that would benefit from it is the moment nothing prompted it. An author shown the filed " +
        "set who files a near-duplicate anyway has made a decision a peer can contest; an author shown nothing has made " +
        "an oversight nobody can see, and only the first is answerable\n"
    );
}

export function runEntry(request: EntryRequest): EntryOutcome {
    if (!existsSync(request.archive)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.archive} does not exist, so an extraction would create the one file permitted to hold ` +
                "history — and a removal elsewhere refuses without a reference resolving into it, so creating it here would " +
                "make the first extraction its own authority\n",
        };
    }

    const before = readSurface(request.archive, "utf8");

    if (before.includes(`${ENTRY_MARKER}${request.heading}`)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.heading} already exists in ${request.archive} — this form APPENDS a new keyed entry and ` +
                "never edits one, because an existing entry is its author's current truth and a second party appending to it " +
                "asserts a measurement in their name. Extend it in place, or extract under a heading that names a different " +
                `class\n${filedNotice(before)}`,
        };
    }

    const missing = ENTRY_LEADS.filter((lead) => !declaresLead(request.body, lead));
    if (missing.length > 0) {
        return {
            code: 2,
            message:
                `REFUSED  the body declares no ${missing.join(" and no ")} clause AT THE START OF A LINE, so the entry ` +
                "would be written and then reach no later reader — the form that extends a clause resolves it by line, so a " +
                "lead sitting mid-paragraph is present to a substring test and absent to every mechanism that consumes it, " +
                "and the write lands unextendable on a surface that appends and never edits. A DECLARED SHAPE IS CHECKED BY " +
                "THE PREDICATE ITS CONSUMER USES, or the check certifies a property nothing downstream reads. THE OTHER " +
                "CAUSE IS A BODY THAT ARRIVED TRUNCATED: a multi-line argument split at a blank line reaches this form as " +
                "its first paragraph, and without this refusal the write SUCCEEDS and reports success. Pass the body whole, " +
                "with each declared clause opening its own line\n",
        };
    }

    const written = `${before.endsWith("\n") ? before : `${before}\n`}\n${ENTRY_MARKER}${request.heading}\n\n${request.body}\n`;

    const witness = readSurface(request.archive, "utf8");
    if (witness !== before) {
        return {
            code: 2,
            message:
                `CONTENDED  ${request.archive} moved between the read and the write, so the entry was not appended — an ` +
                "accumulator takes concurrent appends from every seat, and a write composed over content nobody has read is " +
                "the construct the witness exists to refuse. Re-run and the heading is re-checked against the current file\n",
        };
    }

    writeSurface(request.archive, written);

    return {
        code: 0,
        message:
            `ENTRY  ${request.heading} appended to ${request.archive}. THE ACCUMULATOR IS THE ONE SURFACE A MANDATED REMOVAL ` +
            "CANNOT PROCEED WITHOUT, so a hand write into it carries no witness and no refusal while every drain depends on " +
            "what it holds. This form appends and never edits, so an entry stays its author's, and it refuses a heading that " +
            `already resolves because a closure cites a heading by name and two entries under one name make every citation ambiguous.\n${filedNotice(before)}`,
    };
}

export function runRepair(request: { archive: string; heading: string }): EntryOutcome {
    if (!existsSync(request.archive)) {
        return { code: 2, message: `REFUSED  ${request.archive} does not exist, so there is no entry to repair\n` };
    }

    const before = readSurface(request.archive, "utf8");
    const lines = before.split("\n");
    const opens = lines.findIndex((line) => line.startsWith(`${ENTRY_MARKER}${request.heading}`));

    if (opens === -1) {
        return {
            code: 2,
            message: `REFUSED  ${request.heading} resolves to no entry in ${request.archive}\n${filedNotice(before)}`,
        };
    }

    const out: string[] = [];
    const promoted: string[] = [];
    let index = 0;

    for (const line of lines) {
        const inside = index > opens && !(index > opens && line.startsWith(ENTRY_MARKER));
        index += 1;

        if (!inside) {
            out.push(line);
            continue;
        }

        let held = line;
        let split = false;
        for (const lead of ENTRY_LEADS) {
            const at = held.indexOf(lead);
            if (at <= 0) continue;

            out.push(held.slice(0, at).trimEnd());
            held = held.slice(at);
            promoted.push(lead);
            split = true;
        }

        out.push(held);
        if (!split) continue;
    }

    if (promoted.length === 0) {
        return {
            code: 0,
            message:
                `CLEAR  every declared lead in ${request.heading} already opens its own line, so there is nothing to ` +
                "promote — this form repairs LINE POSITION and never content\n",
        };
    }

    const witness = readSurface(request.archive, "utf8");
    if (witness !== before) {
        return {
            code: 2,
            message: `CONTENDED  ${request.archive} moved between the read and the write, so the repair was not applied\n`,
        };
    }

    writeSurface(request.archive, out.join("\n"));

    return {
        code: 0,
        message:
            `REPAIRED  ${promoted.join(" and ")} in ${request.heading} now open their own lines. A DECLARED SHAPE IS ` +
            "CHECKED BY THE PREDICATE ITS CONSUMER USES: the form that extends a clause resolves it BY LINE, so a lead " +
            "sitting mid-paragraph is present to a substring test and absent to every mechanism that consumes it — the " +
            "entry reads complete and is unextendable. This moves the lead and changes no word, which is why it is a " +
            "repair rather than a rewrite: an entry is its author's claim and nothing here touches what it says. The " +
            "cause is an inline body arriving without its line structure, which the accumulator's own refusal now names " +
            "at the moment of writing rather than leaving to be found by the walk.\n",
    };
}

export interface ExtendRequest {
    readonly archive: string;
    readonly heading: string;
    readonly lead: string;
    readonly body: string;
}

export function runExtend(request: ExtendRequest): EntryOutcome {
    if (!existsSync(request.archive)) {
        return { code: 2, message: `REFUSED  ${request.archive} does not exist, so there is no entry to extend\n` };
    }

    if (!ENTRY_LEADS.includes(request.lead)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.lead} is not a declared lead — this form extends a lead's own clause rather than an ` +
                `entry's prose, so the run it appends to is one a walk reads. Declared: ${ENTRY_LEADS.join(", ")}\n`,
        };
    }

    const before = readSurface(request.archive, "utf8");
    const lines = before.split("\n");
    const opens = lines.findIndex((line) => line.startsWith(`${ENTRY_MARKER}${request.heading}`));

    if (opens === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.heading} resolves to no entry in ${request.archive} — this form EXTENDS an existing ` +
                "clause and never creates one, because an entry appearing for the first time under a lead is a class stated " +
                `by its population rather than by itself\n${filedNotice(before)}`,
        };
    }

    let at = -1;
    for (let index = opens + 1; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (line.startsWith(ENTRY_MARKER)) break;
        if (line.startsWith(request.lead)) at = index;
        if (at !== -1 && line.trim().length === 0) break;
        if (at !== -1) at = index;
    }

    if (at === -1) {
        return { code: 2, message: `REFUSED  ${request.heading} declares no ${request.lead} clause to extend\n` };
    }

    const written = [...lines.slice(0, at + 1), request.body, ...lines.slice(at + 1)].join("\n");

    const witness = readSurface(request.archive, "utf8");
    if (witness !== before) {
        return {
            code: 2,
            message:
                `CONTENDED  ${request.archive} moved between the read and the write, so the clause was not extended — ` +
                "which is the whole of what this form adds over the hand write it replaces\n",
        };
    }

    writeSurface(request.archive, written);

    return {
        code: 0,
        message:
            `EXTENDED  ${request.lead} on ${request.heading} in ${request.archive}. THIS FORM GRANTS NO AUTHORITY THE HAND ` +
            "WRITE DID NOT ALREADY HAVE — the surface records no author, so nothing here can verify that the caller owns " +
            "the entry, and a party editing a peer's clause could always do it by hand. What it adds is the witness read " +
            "and the refusal on a concurrent change, which the hand write has never had on the surface holding the only " +
            "copy of every measurement. Ownership stays a discipline; the lost write stops being possible.\n",
    };
}

export function runClosure(request: ClosureRequest): ClosureOutcome {
    const carried = existsSync(request.archive) ? readSurface(request.archive, "utf8") : "";
    const source = readSurface(request.absolute, "utf8");
    const index = existsSync(request.index) ? readSurface(request.index, "utf8") : "";
    const text = closureText(request.closes, request.ref ?? "", source, request.agent ?? "", index);
    const kind = itemKindOf(source, request.closes);

    return {
        refusal: closureRefusal(request.closes, request.ref, request.agent, text, carried, kind),
        author: authorOf(request.closes),
        label: `handled by ${request.agent ?? ""}`,
        acknowledged: kind === JUDGEMENT_KIND,
    };
}
