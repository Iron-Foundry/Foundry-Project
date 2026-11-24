import { existsSync, statSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

import { BLOCKING_SUFFIX } from "../constants/blocking.constants.ts";
import { citedSurfaces, fencedItem, isItemId, nextOrdinal } from "../formatters/board.formatter.ts";
import { citedAbsolute } from "../validators/claim.validator.ts";
import { compareSpans, dropItemSpan, type SpanConflict } from "../resolvers/board.resolver.ts";
import { blockOf, compressBoard } from "../transformers/board.transformer.ts";
import { extractionRefusal } from "../validators/archive.validator.ts";
import { positionFieldLabels, SIGNED_LEAD } from "../validators/venue.validator.ts";
import { surfacePath } from "../../../config/surface.config.ts";

export interface CompressRequest {
    readonly target: string;
    readonly absolute: string;
    readonly marker: string;
    readonly agent: string | null;
    readonly extracted: string | null;
    readonly archive: string;
    readonly changelog: string;
    readonly heal: boolean;
}

export interface CompressOutcome {
    readonly message: string;
    readonly code: number;
    readonly excised: readonly string[];
    readonly write: string | null;
}

function refuse(message: string, code: number): CompressOutcome {
    return { message, code, excised: [], write: null };
}

function contended(target: string, agent: string, conflict: SpanConflict): CompressOutcome {
    const lines = [
        `CONTENDED  ${target}: AGENT ${agent}'s own record changed between read and write, ` +
            "so the operation was NOT replayed — re-derive it against the content below\n",
        ...conflict.added.map((line) => `  + ${line.trim().slice(0, 110)}\n`),
        ...conflict.removed.map((line) => `  - ${line.trim().slice(0, 110)}\n`),
    ];

    return { message: lines.join(""), code: 1, excised: [], write: null };
}

export interface ItemRequest {
    readonly target: string;
    readonly absolute: string;
    readonly agent: string;
    readonly text: string;
    readonly at: number;
    readonly kind: string;
    readonly archive: string;
    readonly siblings: readonly string[];
    readonly repoRoot: string;
}

const BOARD_ITEM_FIELD = "  Flags:";

const VENUE_ITEM_FIELD = "  Positions:";

function itemFieldFor(target: string): string {
    return target.endsWith(BLOCKING_SUFFIX) ? VENUE_ITEM_FIELD : BOARD_ITEM_FIELD;
}

export function barrierState(agents: number, parked: number): { message: string; code: number } {
    if (agents > 0 && parked >= agents - 1) {
        return {
            message:
                `HELD  ${String(parked)} of ${String(agents - 1)} peers parked; you are the only agent able to write. ` +
                "THE DENOMINATOR IS DERIVED FROM WHO IS ABLE TO WRITE RATHER THAN FROM WHO IS SEATED: a seat is counted " +
                "by holding a record and a row, and neither observes whether it is running, so a seat that stops " +
                "without moving its own row raises this threshold by one and every remaining party may park with " +
                "nobody left to write. A party is counted here where it is currently parked, which is liveness by " +
                "construction, or where it has touched a coordination surface inside the declared liveness window\n",
            code: 0,
        };
    }

    return {
        message:
            `OPEN  ${String(parked)} of ${String(agents - 1)} peers parked — an unparked agent can write ` +
            "concurrently, so an exclusive write is not held\n",
        code: 1,
    };
}

function kindEcho(kind: string): string {
    const selected =
        kind === "judgement"
            ? "it asks for a READING, so it closes by acknowledger with NO reference — there is nothing for one to point at"
            : "it asks for something that CAN EXIST, so it closes with a typed reference that must RESOLVE";

    return (
        `  kind:${kind} — ${selected}. THE KIND SELECTS THE CLOSURE AND THIS LINE IS WHERE THE TEST REACHES YOU: it was ` +
        "carried only in the refusal, which reaches an author who OMITS the field and never one who supplies it — measured " +
        "on a seat that copied the value off a peer marker, never met the test, and misclassified. If the line above does " +
        "not describe what you just wrote, the kind is wrong and the item is one edit from right\n"
    );
}

export function positionStructure(repoRoot: string, text: string): string[] {
    const template = resolve(repoRoot, surfacePath("venue_template"));
    if (!existsSync(template)) return [];

    const labels = positionFieldLabels(readSurface(template, "utf8"));
    const out: string[] = [];

    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        for (const label of labels) {
            if (out.includes(label)) continue;
            if (trimmed.startsWith(`${label}:`)) out.push(label);
        }
    }

    return out;
}

export function runItem(request: ItemRequest): CompressOutcome {
    if (!existsSync(request.absolute)) {
        return refuse(`ABSENT  ${request.target} does not exist\n`, 2);
    }

    const before = readSurface(request.absolute, "utf8");
    const span = blockOf(before, request.agent);

    if (span === null) {
        return refuse(`REFUSED  no single delimited block for AGENT ${request.agent}\n`, 2);
    }

    const lines = before.split("\n");
    const field = itemFieldFor(request.target);
    const at = lines.findIndex((line, index) => index >= span.from && line.startsWith(field));

    if (at === -1 || at >= span.to) {
        return refuse(
            `REFUSED  AGENT ${request.agent} declares no ${field.trim()} field to append to on ${request.target} — ` +
                "the field an item lands in belongs to the SURFACE's own schema, so a board record holds directed " +
                "items and a venue record holds positions; copying one surface's field set into the other is what " +
                "makes a discussion describe ownership\n",
            2,
        );
    }

    if (!request.target.endsWith(BLOCKING_SUFFIX)) {
        const carried = positionStructure(request.repoRoot, request.text);
        if (carried.length > 1) {
            return refuse(
                `REFUSED  this item carries a POSITION's own declared structure — ${carried.join(", ")} — and its target ` +
                    "is the SWEPT surface. AN ARGUMENT BELONGS IN THE VENUE AND THIS SURFACE IS NOT ONE: a board is " +
                    "current-truth-only and is drained, so a position landing here is read by every party every round " +
                    "until the sweep deletes the reasoning it exists to hold. THE FORM DEFAULTS TO THIS SURFACE, which " +
                    "is why the rule has never had an observer at the one moment it binds — an invocation that names no " +
                    "surface reports success, allocates an id and echoes correctly, because every other property the " +
                    "form measures is satisfied. Name the venue with the file operand. THE FIELD LABELS ARE DERIVED " +
                    "FROM THE VENUE TEMPLATE rather than listed here, so a schema gaining a field is matched with no " +
                    "edit to this refusal, and the signature line is excluded because an item on either surface carries " +
                    "one\n",
                2,
            );
        }
    }

    if (request.target.endsWith(BLOCKING_SUFFIX) && !request.text.includes(SIGNED_LEAD)) {
        return refuse(
            `REFUSED  this position carries no ${SIGNED_LEAD} line, and on a venue that is the ONE STRUCTURAL MARK a ` +
                "truncated body loses. AN ARGUMENT BOUNDARY CANNOT BE OBSERVED FROM INSIDE THIS PROCESS: a body cut " +
                "before it arrives reaches the argument vector already short, carrying no mark, no fragment and no " +
                "length anomaly a check could read — a one-paragraph body is the normal case. What a cut body DOES lose " +
                "is the end of itself, and a position declares its end by signing. So the signature is the detection " +
                "the boundary hides, and it fires on exactly the loss while passing every intact position. If the body " +
                "is whole and simply unsigned, sign it; if it is short, it was cut at a blank line and belongs in the " +
                "file form or on standard input, which carry line structure an argument cannot\n",
            2,
        );
    }

    const archive = existsSync(request.archive) ? readSurface(request.archive, "utf8") : "";
    const key = `${request.agent}-${String(nextOrdinal([before, ...request.siblings], request.agent, archive))}`;
    const cited = citedSurfaces(request.text)
        .map((path) => ({ path, absolute: citedAbsolute(request.repoRoot, path) }))
        .filter((entry) => entry.absolute !== null)
        .map((entry) => ({ path: entry.path, at: statSync(entry.absolute ?? "").mtimeMs }));

    const fenced = fencedItem(key, request.text, request.at, request.kind, cited);

    const written = [...lines.slice(0, at + 1), ...fenced, ...lines.slice(at + 1)].join("\n");

    const witness = readSurface(request.absolute, "utf8");
    if (witness === before) {
        writeSurface(request.absolute, written);
        return {
            message: `ITEM  ${key} appended to ${request.target}\n${kindEcho(request.kind)}`,
            code: 0,
            excised: [],
            write: written,
        };
    }

    const conflict = compareSpans(before, witness, request.agent);
    if (conflict.overlapping) return contended(request.target, request.agent, conflict);

    return runItem({ ...request });
}

export interface FieldRequest {
    readonly target: string;
    readonly absolute: string;
    readonly agent: string;
    readonly field: string;
    readonly text: string;
}

const FIELD_COLUMN = 9;

function fieldKeyAt(line: string): string {
    if (!line.startsWith("  ") || line.charAt(2) === " ") return "";

    const trimmed = line.trim();
    const colon = trimmed.indexOf(":");
    if (colon <= 0) return "";

    const key = trimmed.slice(0, colon);
    return key.includes(" ") ? "" : key;
}

export function runField(request: FieldRequest): CompressOutcome {
    if (!existsSync(request.absolute)) {
        return refuse(`ABSENT  ${request.target} does not exist\n`, 2);
    }

    const before = readSurface(request.absolute, "utf8");
    const span = blockOf(before, request.agent);

    if (span === null) {
        return refuse(`REFUSED  no single delimited block for AGENT ${request.agent}\n`, 2);
    }

    const lines = before.split("\n");
    const declared: string[] = [];
    let at = -1;

    for (let index = span.from; index < span.to && index < lines.length; index += 1) {
        const key = fieldKeyAt(lines[index] ?? "");
        if (key.length === 0) continue;

        declared.push(key);
        if (key === request.field) at = index;
    }

    if (at === -1) {
        return refuse(
            `REFUSED  AGENT ${request.agent} declares no ${request.field} field on ${request.target} — this form ` +
                "REWRITES a field the record already carries and never creates one, because the field SET belongs to " +
                `the surface's own template and a record acquires one by being raised from it. Declared here: ${declared.join(", ")}\n`,
            2,
        );
    }

    const indent = (lines[at] ?? "").slice(0, (lines[at] ?? "").indexOf(request.field));
    const label = `${indent}${request.field}:`;
    const written = [
        ...lines.slice(0, at),
        `${label}${" ".repeat(Math.max(1, FIELD_COLUMN - request.field.length - 1))}${request.text}`,
        ...lines.slice(at + 1),
    ].join("\n");

    if (written === before) {
        return {
            message: `CLEAR  ${request.field} already reads that on ${request.target}\n`,
            code: 0,
            excised: [],
            write: before,
        };
    }

    const witness = readSurface(request.absolute, "utf8");
    if (witness === before) {
        writeSurface(request.absolute, written);
        return {
            message:
                `FIELD  ${request.field} rewritten for AGENT ${request.agent} on ${request.target}. A record field is ` +
                "CURRENT TRUTH and is overwritten in place, so this form replaces rather than appends — which is why it " +
                "refuses a field the record does not already declare\n",
            code: 0,
            excised: [],
            write: written,
        };
    }

    const conflict = compareSpans(before, witness, request.agent);
    if (conflict.overlapping) return contended(request.target, request.agent, conflict);

    return runField({ ...request });
}

export function runCompression(request: CompressRequest): CompressOutcome {
    if (!existsSync(request.absolute)) {
        return refuse(`ABSENT  ${request.target} does not exist; nothing to compress\n`, 2);
    }

    if (request.agent === null) {
        return refuse(
            "REFUSED  --compress requires --agent <LETTER>: it deletes every field whose LABEL is the marker, " +
                "so unscoped it reaches into other agents' records and removes content it does not own\n",
            2,
        );
    }

    const carried = existsSync(request.archive) ? readSurface(request.archive, "utf8") : "";
    const refusal = extractionRefusal(request.changelog, request.extracted, carried);
    if (refusal !== null) return refuse(refusal, 2);

    const before = readSurface(request.absolute, "utf8");

    if (isItemId(request.marker)) {
        const dropped = dropItemSpan(before, request.marker);
        if (dropped === null) {
            return refuse(`REFUSED  item ${request.marker} has no single well-formed fence\n`, 2);
        }

        if (request.heal) {
            if (readSurface(request.absolute, "utf8") !== before) {
                return refuse(`CONTENDED  ${request.target} changed between read and write\n`, 1);
            }
            writeSurface(request.absolute, dropped.text);
        }

        return {
            message:
                `${request.heal ? "DROPPED" : "PREVIEW"}  item ${request.marker}, ` +
                `${String(dropped.removed)} bytes ${request.heal ? "deleted" : "would be deleted"}\n`,
            code: 0,
            excised: [request.marker],
            write: request.heal ? dropped.text : null,
        };
    }

    const span = blockOf(before, request.agent);

    if (span === null) {
        return refuse(
            `REFUSED  no single delimited block for AGENT ${request.agent}; ` +
                "compression has no owned span to act on\n",
            2,
        );
    }

    const lines = before.split("\n");
    const head = lines.slice(0, span.from);
    const body = lines.slice(span.from, span.to - 1);
    const tail = lines.slice(span.to - 1);

    const compressed = compressBoard(body.join("\n"), request.marker);
    if (compressed.fields === 0) {
        return refuse(`CLEAR  no field in ${request.target} carries that marker\n`, 0);
    }

    if (request.heal) {
        const witness = readSurface(request.absolute, "utf8");
        if (witness !== before) {
            const conflict = compareSpans(before, witness, request.agent);
            if (conflict.overlapping) return contended(request.target, request.agent, conflict);

            return runCompression({ ...request });
        }
    }

    const text = [...head, compressed.text, ...tail].join("\n");
    if (request.heal) writeSurface(request.absolute, text);

    return {
        message:
            `${request.heal ? "COMPRESSED" : "PREVIEW"}  ${String(compressed.fields)} field(s) in ` +
            `${request.target}, ${String(compressed.removed)} bytes ` +
            `${request.heal ? "deleted" : "would be deleted"}\n`,
        code: 0,
        excised: compressed.excised,
        write: request.heal ? text : null,
    };
}
