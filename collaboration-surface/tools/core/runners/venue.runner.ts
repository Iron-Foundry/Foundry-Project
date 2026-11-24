import { existsSync, readdirSync, rmSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { basename, dirname, resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

import { isResolved, projectRoot, slotText, surfacePath, surfacePrefix } from "../../../config/surface.config.ts";
import { activeSeats } from "../analyzers/board.analyzer.ts";
import { AGENDA, BLOCKING_SUFFIX, VENUE_ARCHIVE } from "../constants/blocking.constants.ts";
import { AGENT_INDEX } from "../constants/board.constants.ts";
import { CHECKLIST_CONCERN } from "../constants/checklist.constants.ts";
import {
    clauseLines,
    declaredSuccessor,
    DEFERRAL_ARROW,
    DEFERRED_SECTION,
    addressesSuccessor,
    receiverResolves,
    sectionBound,
    SIGN_OFF_BANNER,
    unarrivedDeferrals,
    venueInvariant,
} from "../validators/converge.validator.ts";
import { indexedLetters } from "../inspectors/index.inspector.ts";
import { letters, rosterLine } from "./converge.runner.ts";
import { fencedFlags } from "../predicates/fence.predicate.ts";
import { venueFieldsFrom } from "../validators/venue.validator.ts";
import { DISTRIBUTES_FIELD } from "../validators/converge.validator.ts";
import { readBoardContract } from "../readers/board.reader.ts";

const DEFERRED_HEADING = "## DEFERRED";

const PROTOCOL_BANNER = "═══════════════════ PROTOCOL (permanent) ═══════════════════";

const INHERITED_BANNER = "═══════════════════ INHERITED";

export interface RaiseOutcome {
    readonly code: number;
    readonly message: string;
    readonly raised: string | null;
}

function refusal(reason: string): RaiseOutcome {
    return { code: 2, message: `REFUSED  ${reason}\n`, raised: null };
}

const DIGITS = new Set("0123456789");

export function ordinalOf(name: string): string {
    for (const part of basename(name).split(".")) {
        if (part.length > 0 && DIGITS.has(part.charAt(0))) return part;
    }

    return "";
}

function inheritedBlock(predecessorName: string, clauses: readonly string[]): string {
    const ordinal = ordinalOf(predecessorName);
    const carried = clauses.map((clause) => `- ${clause}`).join("\n");

    return (
        `${INHERITED_BANNER} (from venue ${ordinal.length === 0 ? predecessorName : ordinal}) ═══════════════════\n\n` +
        "**These are questions the predecessor deliberately left open, carried here BY NAME because a question " +
        "deferred to a venue that does not exist is deferred to nobody.** Each names its origin and its receiver. " +
        "None is a finding — the findings extracted to the accumulator under their own class headings and none of " +
        "that travels.\n\n" +
        `${carried}\n\n`
    );
}

function unclaimedBlock(invariant: string): string {
    return (
        `${INHERITED_BANNER} (no venue defers to ${invariant}) ═══════════════════\n\n` +
        "**No venue on disk or in the archive defers a clause to this invariant, so the inherited set is EMPTY BY " +
        "DERIVATION rather than unstated.** A venue is raised at the position the SCHEDULE assigns and inherits " +
        "whatever a DEFERRAL sent here by name, and those are two questions with two answers — so a venue whose turn " +
        "arrives before anyone has deferred a question to it opens carrying nothing, which is a state a reader can " +
        "check rather than a blank a reader must interpret.\n\n" +
        `${RECORD_ABSENT}\n\n`
    );
}

function deferringVenues(
    directory: string,
    repoRoot: string,
    invariant: string,
): { names: string[]; clauses: string[] } {
    const names: string[] = [];
    const clauses: string[] = [];

    for (const root of [directory, resolve(repoRoot, VENUE_ARCHIVE)]) {
        if (!existsSync(root)) continue;

        for (const entry of readdirSync(root).sort()) {
            if (!entry.endsWith(BLOCKING_SUFFIX)) continue;

            const source = readSurface(resolve(root, entry), "utf8");
            const carried = clauseLines(source, DEFERRED_HEADING)
                .filter((line) => line.receiver === invariant)
                .map((line) => line.clause);

            if (carried.length === 0) continue;

            names.push(entry);
            clauses.push(...carried);
        }
    }

    return { names, clauses };
}

const AGENDA_MARK = "`";

const ROW_LEAD = "|";

const ROW_MARK = "|";

export function boundAuthority(repoRoot: string): string | null {
    if (!isResolved("convention", "venue_authority_concern")) return null;

    const concern = slotText("convention", "venue_authority_concern");
    const index = resolve(repoRoot, AGENT_INDEX);
    if (!existsSync(index)) return null;

    for (const line of readSurface(index, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(ROW_MARK) || !trimmed.includes(concern)) continue;

        const letter = trimmed.slice(1, trimmed.indexOf(ROW_MARK, 1)).trim();
        if (letter.length > 0) return letter;
    }

    return null;
}

export function seatedLetters(repoRoot: string): string[] {
    const board = resolve(repoRoot, surfacePath("board"));
    const index = resolve(repoRoot, AGENT_INDEX);

    return activeSeats(
        existsSync(board) ? readSurface(board, "utf8") : "",
        existsSync(index) ? readSurface(index, "utf8") : "",
    )
        .slice()
        .sort();
}

export function venueAuthority(repoRoot: string): string | null {
    const bound = boundAuthority(repoRoot);
    if (bound === null) return null;

    const seated = seatedLetters(repoRoot);
    if (seated.includes(bound)) return bound;

    return seated[0] ?? bound;
}

export function authorityRefusal(repoRoot: string, caller: string, act: string): string | null {
    const holder = venueAuthority(repoRoot);
    if (holder === null || holder === caller) return null;

    const bound = boundAuthority(repoRoot);
    const succeeded = bound !== null && bound !== holder;

    return (
        `REFUSED  ${act} is VENUE MANAGEMENT and one party holds it: ${holder} rather than ${caller}. A venue raised, a ` +
        "question moved out of a discussion, or an agenda row written by whoever happens to hold the form is a SCHEDULE " +
        "WITH SEVERAL AUTHORS, and the schedule is the one surface that cannot have them — the sequence stops being " +
        "derivable from any single reading and every seat's ordering is locally correct. Route it to " +
        `${holder}, who decides whether it lands and where.\n` +
        (succeeded
            ? `         THE AUTHORITY IS SUCCEEDED RATHER THAN BOUND: the index binds this concern to ${bound}, which is ` +
              "not seated, so it falls to the first ACTIVE seat in index order. AN AUTHORITY WHOSE HOLDER IS NOT RUNNING " +
              "IS AN ACT WITH NO PERMITTED PARTY, and every finding whose only repair is that act becomes permanently " +
              "undrainable — which is the state that teaches every reader to discount the colour. Succession keeps the " +
              "single-author property the restriction exists for, because it resolves to exactly one seat and derives it " +
              "from the index rather than from whoever reaches the form first.\n"
            : "")
    );
}

function siblingVenues(directory: string, repoRoot: string): string[] {
    const out: string[] = [];

    for (const root of [directory, resolve(repoRoot, VENUE_ARCHIVE)]) {
        if (!existsSync(root)) continue;
        for (const entry of readdirSync(root)) {
            if (entry.endsWith(BLOCKING_SUFFIX)) out.push(entry);
        }
    }

    return out;
}

const PLANNED_STATE = "planned";

function stateCellOf(row: string): string {
    const cells = row.split(ROW_LEAD);
    if (cells.length < 3) return "";

    const cell = (cells[cells.length - 2] ?? "").trim();
    if (!cell.startsWith(AGENDA_MARK)) return cell;

    const closes = cell.indexOf(AGENDA_MARK, 1);
    return closes === -1 ? cell.slice(1) : cell.slice(1, closes);
}

interface AgendaRow {
    readonly invariant: string;
    readonly ordinal: string;
    readonly planned: boolean;
}

export function agendaRows(agenda: string): AgendaRow[] {
    const out: AgendaRow[] = [];

    for (const line of agenda.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(ROW_LEAD)) continue;

        const opens = trimmed.indexOf(AGENDA_MARK);
        if (opens === -1) continue;

        const closes = trimmed.indexOf(AGENDA_MARK, opens + 1);
        if (closes === -1) continue;

        const invariant = trimmed.slice(opens + 1, closes).trim();
        if (invariant.length === 0 || out.some((row) => row.invariant === invariant)) continue;

        const cell = trimmed.indexOf(ROW_LEAD, 1);
        const ordinal = cell === -1 ? "" : trimmed.slice(1, cell).trim();

        out.push({ invariant, ordinal, planned: stateCellOf(trimmed).startsWith(PLANNED_STATE) });
    }

    return out;
}

export interface DisorderedRow {
    readonly invariant: string;
    readonly ordinal: string;
    readonly after: string;
}

const LETTER_SCALE = 100;

export function ordinalValue(ordinal: string): number | null {
    let digits = "";
    let cursor = 0;

    while (cursor < ordinal.length && ordinal.charAt(cursor) >= "0" && ordinal.charAt(cursor) <= "9") {
        digits += ordinal.charAt(cursor);
        cursor += 1;
    }

    if (digits.length === 0) return null;

    let suffix = 0;
    for (; cursor < ordinal.length; cursor += 1) {
        const char = ordinal.charAt(cursor);
        if (char < "a" || char > "z") return null;
        suffix = suffix * LETTER_SCALE + (char.charCodeAt(0) - "a".charCodeAt(0) + 1);
    }

    return Number(digits) + suffix / (LETTER_SCALE * LETTER_SCALE);
}

export function disorderedRows(agenda: string): DisorderedRow[] {
    const out: DisorderedRow[] = [];
    let held: { value: number; invariant: string } | null = null;

    for (const row of agendaRows(agenda)) {
        const value = ordinalValue(row.ordinal);
        if (value === null) continue;

        if (held !== null && value < held.value) {
            out.push({ invariant: row.invariant, ordinal: row.ordinal, after: held.invariant });
            continue;
        }

        held = { value, invariant: row.invariant };
    }

    return out;
}

export function agendaOrdinalOf(agenda: string, invariant: string): string {
    return agendaRows(agenda).find((row) => row.invariant === invariant)?.ordinal ?? "";
}

export function agendaInvariants(agenda: string): string[] {
    return agendaRows(agenda).map((row) => row.invariant);
}

export function plannedInvariants(agenda: string): string[] {
    return agendaRows(agenda)
        .filter((row) => row.planned)
        .map((row) => row.invariant);
}

export function admissibleInvariants(agenda: string, venues: readonly string[]): string[] {
    return agendaRows(agenda)
        .filter((row) => row.planned && !venues.some((venue) => venue.includes(row.invariant)))
        .map((row) => row.invariant);
}

export function nextUnraised(agenda: string, venues: readonly string[]): string | null {
    return admissibleInvariants(agenda, venues)[0] ?? null;
}

const RECORD_ABSENT = "—";

const LIST_MARKER = "- ";

const GATE_HEADING = "## Gate";

const RECORD_CLOSE = "└─── END AGENT ";

const OPEN_QUESTIONS_HEADING = "Open questions";

interface BoardAnchor {
    readonly at: number;
    readonly leads: boolean;
}

function boardAnchor(source: string): BoardAnchor | null {
    const lines = source.split("\n");
    const fenced = fencedFlags(source);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
        if (fenced[index] === true) continue;
        const trimmed = (lines[index] ?? "").trim();
        if (!trimmed.startsWith(RECORD_CLOSE)) continue;
        if (trimmed.includes("<")) continue;
        return { at: index + 1, leads: true };
    }

    const questions = lines.findIndex(
        (line, index) => fenced[index] !== true && line.trim().startsWith(OPEN_QUESTIONS_HEADING),
    );
    return questions === -1 ? null : { at: questions, leads: false };
}

export function runRecord(options: {
    readonly repoRoot: string;
    readonly target: string;
    readonly absolute: string;
    readonly agent: string;
}): RaiseOutcome {
    const onVenue = options.target.endsWith(BLOCKING_SUFFIX);

    if (!existsSync(options.absolute))
        return refusal(`${options.target} does not exist, so there is nothing to raise a record on`);

    const source = readSurface(options.absolute, "utf8");

    if (source.includes(`AGENT ${options.agent} `)) {
        return {
            code: 0,
            raised: options.target,
            message:
                `CLEAR  AGENT ${options.agent} already carries a record on ${options.target}, so the raise is a no-op — a ` +
                "second record for one seat is two spans under one key, which disables every operation the fence exists for.\n",
        };
    }

    const templateSlot = onVenue ? "venue_template" : "board_template";
    const templatePath = resolve(options.repoRoot, surfacePath(templateSlot));
    if (!existsSync(templatePath)) {
        return refusal(
            `the ${onVenue ? "venue" : "board"} template does not exist, so the record's field set would be composed from ` +
                "nothing — and a record carrying a guessed schema fails the walk that derives the real one on every run",
        );
    }

    const template = readSurface(templatePath, "utf8");
    const fields = onVenue ? venueFieldsFrom(template) : [...readBoardContract(template).agentFields];
    if (fields.length === 0) {
        return refusal(
            `the ${onVenue ? "venue" : "board"} template declares no record fields, so a raise would compose an empty ` +
                "record that satisfies every schema check vacuously — the field set is DERIVED here rather than carried, " +
                "precisely so this refuses",
        );
    }

    const lines = source.split("\n");
    const anchor: BoardAnchor | null = onVenue
        ? { at: lines.findIndex((line) => line.trim().startsWith(GATE_HEADING)), leads: false }
        : boardAnchor(source);
    if (anchor === null || anchor.at === -1) {
        return refusal(
            `${options.target} carries no anchor to place a record against, so the raise would guess a position in a ` +
                "surface it did not author. A FENCED LINE IS NEVER AN ANCHOR: a specimen is a record mentioned, and a " +
                "record placed beside one lands where every reader that resolves records skips it",
        );
    }
    const at = anchor.at;

    const record = [
        ...(anchor.leads ? [""] : []),
        `┌─── AGENT ${options.agent} ─── one writer: ${options.agent} · others cite, never edit · anchored EDIT only, never a whole-file WRITE`,
        `Agent ${options.agent} — ACTIVE`,
        ...fields.map((field) => `  ${field}:${" ".repeat(Math.max(1, 8 - field.length))}${RECORD_ABSENT}`),
        `└─── END AGENT ${options.agent}`,
        ...(anchor.leads ? [] : [""]),
    ];

    const written = [...lines.slice(0, at), ...record, ...lines.slice(at)].join("\n");

    const witness = readSurface(options.absolute, "utf8");
    if (witness !== source) {
        return {
            code: 2,
            raised: null,
            message:
                `CONTENDED  ${options.target} moved between the read and the write, so the record was not raised — re-run ` +
                "and the field set is re-derived against the current template and the current surface.\n",
        };
    }

    writeSurface(options.absolute, written);

    return {
        code: 0,
        raised: options.target,
        message:
            `RECORD  AGENT ${options.agent} raised on ${options.target} carrying ${String(fields.length)} declared ` +
            `field(s): ${fields.join(", ")}. THE FIELD SET IS DERIVED FROM THE ${onVenue ? "VENUE" : "BOARD"} TEMPLATE rather than carried here, so ` +
            "a field added to the template arrives in the next record with no edit to this form. Each field carries the " +
            "declared-absence marker rather than a blank, because a blank states nothing where the marker states that this " +
            "seat has none — and the fields are then the seat's own to rewrite in place.\n",
    };
}

function successorPath(absolute: string, predecessor: string, invariant: string): { name: string; path: string } {
    const directory = dirname(absolute);
    const found = existsSync(directory)
        ? readdirSync(directory).find(
              (entry) =>
                  entry.startsWith(`${invariant}.`) &&
                  entry.endsWith(BLOCKING_SUFFIX) &&
                  entry !== basename(predecessor),
          )
        : undefined;

    const name = found ?? `${invariant}${BLOCKING_SUFFIX}`;
    return { name, path: resolve(directory, name) };
}

const SUCCESSOR_FIELD = "SUCCESSOR:";

export function runSuccessor(options: {
    readonly target: string;
    readonly absolute: string;
    readonly invariant: string;
}): RaiseOutcome {
    if (!options.target.endsWith(BLOCKING_SUFFIX)) {
        return refusal(
            "a successor is the invariant a VENUE feeds, so the target is a venue — the declaration is what the raise " +
                "reads to create the next file, and a field written anywhere else is read by nothing",
        );
    }

    if (!existsSync(options.absolute)) {
        return refusal(`${options.target} does not exist, so there is no venue to declare a successor for`);
    }

    const agendaPath = resolve(projectRoot(), AGENDA);
    const planned = plannedInvariants(existsSync(agendaPath) ? readSurface(agendaPath, "utf8") : "");

    if (!planned.includes(options.invariant)) {
        return refusal(
            `${options.invariant} is not an invariant the agenda carries in the PLANNED state, so declaring it here would ` +
                "put a venue on disk at an ordinal the schedule assigns to something else and displace the foreseen " +
                "invariant in every reading that goes by filename. THE DEPARTURE IS RECORDED IN THE AGENDA BEFORE THE " +
                "DECLARATION, which is one row and loses nothing, where a declaration recorded nowhere drops a subject " +
                "with every step having been correct",
        );
    }

    const before = readSurface(options.absolute, "utf8");
    const fenced = fencedFlags(before);
    const lines = before.split("\n");

    let at = -1;
    for (let index = 0; index < lines.length; index += 1) {
        if (fenced[index] === true) continue;
        if (!(lines[index] ?? "").trim().startsWith(SUCCESSOR_FIELD)) continue;
        at = index;
        break;
    }

    const declaration = `${SUCCESSOR_FIELD} ${options.invariant}`;
    let written: string;

    if (at !== -1) {
        written = [...lines.slice(0, at), declaration, ...lines.slice(at + 1)].join("\n");
    } else {
        let close = -1;
        let inside = false;
        for (let index = 0; index < lines.length; index += 1) {
            const trimmed = (lines[index] ?? "").trim();
            if (trimmed.startsWith("## ") && trimmed.includes("SUCCESSOR")) {
                inside = true;
                continue;
            }
            if (inside && trimmed.startsWith("## ")) break;
            if (inside && fenced[index] === true) close = index;
        }

        if (close === -1) {
            return refusal(
                `${options.target} declares no SUCCESSOR section, so a declaration written here would land where the ` +
                    "reader of this field does not look — and the edge then falls back to the chrono increment, which is " +
                    "an ordinal in a total order and cannot detect a violation it preserves",
            );
        }

        written = [...lines.slice(0, close + 1), "", declaration, ...lines.slice(close + 1)].join("\n");
    }

    const witness = readSurface(options.absolute, "utf8");
    if (witness !== before) {
        return {
            code: 2,
            raised: null,
            message:
                `CONTENDED  ${options.target} moved between the read and the write, so the successor was not declared — ` +
                "re-run and the agenda is re-checked against the current file\n",
        };
    }

    writeSurface(options.absolute, written);

    return {
        code: 0,
        raised: null,
        message:
            `SUCCESSOR  ${options.target} declares it feeds ${options.invariant}. THE DECLARATION IS UNFENCED AND THE ` +
            "SPECIMEN STAYS FENCED, because the reader of this field skips every fenced line — so a venue whose only " +
            "successor line sits inside the specimen declares NOTHING and the edge silently falls back to the ordinal. " +
            "The name is checked against the agenda at the moment it is written rather than at the raise, which is where " +
            "a departure is cheap to correct instead of a file on disk at somebody else's position.\n",
    };
}

export function runDefer(options: {
    readonly repoRoot: string;
    readonly target: string;
    readonly absolute: string;
    readonly clause: string;
    readonly receiver: string;
}): RaiseOutcome {
    if (!options.target.endsWith(BLOCKING_SUFFIX)) {
        return refusal(
            "a deferral is a question a VENUE leaves open, so the target is a venue — the clause lives at its origin and " +
                "arrives at the successor that venue declares, and a deferral written anywhere else has no edge to travel",
        );
    }

    if (!existsSync(options.absolute)) {
        return refusal(`${options.target} does not exist, so there is no open question to defer from it`);
    }

    if (options.clause === RECORD_ABSENT) {
        const held = readSurface(options.absolute, "utf8");
        const section = sectionBound(held, DEFERRED_SECTION);

        if (section === null) {
            return refusal(
                `${options.target} declares no ${DEFERRED_SECTION} section, so there is nothing to mark empty`,
            );
        }

        const standing = clauseLines(held, DEFERRED_SECTION);
        if (standing.length > 0) {
            return refusal(
                `${options.target} already defers ${String(standing.length)} clause(s), so it does not defer NOTHING — ` +
                    "recording the absent marker beside a clause would state two answers to one question, and the edge " +
                    "reading this section would take whichever it reached first",
            );
        }

        const lines = held.split("\n");
        const marked = [
            ...lines.slice(0, section.to),
            `${LIST_MARKER}${RECORD_ABSENT}`,
            ...lines.slice(section.to),
        ].join("\n");

        const witnessed = readSurface(options.absolute, "utf8");
        if (witnessed !== held) {
            return refusal(
                `${options.target} moved between the read and the write, so the absent marker was not recorded`,
            );
        }

        writeSurface(options.absolute, marked);

        return {
            code: 0,
            raised: null,
            message:
                `DEFERS NOTHING  ${options.target} records that it leaves no question open, written as a LIST LINE ` +
                "because the collector reads only lines carrying the list marker — a bare marker is visible to a reader " +
                "and invisible to the mechanism, which is the seeded-placeholder collapse arriving on the section that " +
                "decides what a successor inherits. THE THREE STATES ARE DISTINCT AND THIS IS THE THIRD: unfilled, a " +
                "clause list, and a recorded NONE. The convergence edge separates them, and until now only two had a form\n",
        };
    }

    if (options.receiver === options.clause) {
        return refusal(
            "a clause is never its own receiver — a deferral names a QUESTION and a DESTINATION, and a line whose two " +
                "operands are one string reads correctly to any human, joins on its name exactly as designed, and arrives " +
                "at nobody. Name the destination that will decide the question rather than the question again",
        );
    }

    const deferRoot = dirname(options.absolute);
    const siblingVenues = readdirSync(deferRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(BLOCKING_SUFFIX))
        .map((entry) => entry.name);
    const deferBoard = resolve(options.repoRoot, surfacePath("board"));
    const deferIndex = resolve(options.repoRoot, surfacePath("agent_index"));
    const deferAgenda = resolve(options.repoRoot, AGENDA);

    if (
        !receiverResolves(
            options.receiver,
            existsSync(deferBoard) ? readSurface(deferBoard, "utf8") : "",
            existsSync(deferIndex) ? readSurface(deferIndex, "utf8") : "",
            siblingVenues,
            plannedInvariants(existsSync(deferAgenda) ? readSurface(deferAgenda, "utf8") : ""),
        )
    ) {
        return refusal(
            `${options.receiver} resolves to no destination: a receiver is an ACTIVE SEAT, a venue raised on disk, or a ` +
                "row the schedule carries in the planned state, and one outside all three is a question deferred to " +
                "nobody with every edge still holding. THE RESOLUTION IS REFUSED AT THE WRITE RATHER THAN REPORTED AFTER " +
                "IT, because a venue ACCUMULATES: a clause that lands stands until convergence and travels into the " +
                "archive, so a finding produced afterwards names a line nothing is permitted to remove",
        );
    }

    const before = readSurface(options.absolute, "utf8");
    const bound = sectionBound(before, DEFERRED_SECTION);

    if (bound === null) {
        return refusal(
            `${options.target} declares no ${DEFERRED_SECTION} section, so a deferral written here would land in a ` +
                "section nobody created — and the collector reads clauses from that section alone, so it would be a " +
                "question deferred to nobody with every edge still holding",
        );
    }

    for (const { clause } of clauseLines(before, DEFERRED_SECTION)) {
        if (clause !== options.clause) continue;
        return refusal(
            `${options.target} already defers ${options.clause} — this form APPENDS a clause and never edits one, ` +
                "because the successor edge joins on the clause NAME and two lines under one name make every arrival " +
                "ambiguous. Defer a differently named question, or correct the existing line where it stands",
        );
    }

    const lines = before.split("\n");
    let at = bound.from;
    for (let index = bound.from + 1; index < bound.to && index < lines.length; index += 1) {
        if ((lines[index] ?? "").trim().startsWith("- ")) at = index;
    }
    if (at === bound.from) at = bound.to - 1;

    const written = [
        ...lines.slice(0, at + 1),
        `- ${options.clause} ${DEFERRAL_ARROW} ${options.receiver}`,
        ...lines.slice(at + 1),
    ].join("\n");

    const witness = readSurface(options.absolute, "utf8");
    if (witness !== before) {
        return refusal(
            `${options.target} moved between the read and the write, so the deferral was not appended — every seat ` +
                "writes its own clauses into one shared section, which is exactly the contention the witness exists for",
        );
    }

    writeSurface(options.absolute, written);

    return {
        code: 0,
        raised: options.clause,
        message:
            `DEFERRED  ${options.clause} → ${options.receiver} on ${options.target}. A DEFERRAL IS WRITTEN WHEN IT IS ` +
            "DEFERRED RATHER THAN AT CONVERGENCE: a venue that agrees to leave a question open and records it only in " +
            "its successor has put the operand at the destination, so the edge proving a deferral ARRIVES has nothing " +
            "to compare and holds over an empty set. THE ARROW AND ITS RECEIVER ARE ON ONE LINE because the collector " +
            "reads only the line carrying the list marker — a wrapped receiver is collected as none at all, which is " +
            "why this form composes the line rather than leaving it to be typed.\n",
    };
}

export function runRetract(options: {
    readonly target: string;
    readonly absolute: string;
    readonly clause: string;
}): RaiseOutcome {
    if (!options.target.endsWith(BLOCKING_SUFFIX)) {
        return refusal("a deferral lives on a VENUE, so a retraction takes one — nothing else carries the clause set");
    }

    if (!existsSync(options.absolute)) {
        return refusal(`${options.target} does not exist, so there is no clause to retract`);
    }

    const before = readSurface(options.absolute, "utf8");
    const bound = sectionBound(before, DEFERRED_SECTION);

    if (bound === null) {
        return refusal(`${options.target} declares no ${DEFERRED_SECTION} section, so it defers nothing to retract`);
    }

    const lines = before.split("\n");
    let at = -1;
    for (let index = bound.from + 1; index < bound.to && index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();
        if (!trimmed.startsWith("- ")) continue;

        const arrow = trimmed.indexOf(DEFERRAL_ARROW);
        const clause = (arrow === -1 ? trimmed.slice(2) : trimmed.slice(2, arrow)).trim();
        if (clause === options.clause) at = index;
    }

    if (at === -1) {
        return refusal(
            `${options.target} defers no clause named ${options.clause} — a retraction takes the clause as its operand ` +
                "because the section holds one line per question and removing by anything else takes a line the caller " +
                "did not name",
        );
    }

    const written = [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n");

    const witness = readSurface(options.absolute, "utf8");
    if (witness !== before) {
        return refusal(
            `${options.target} moved between the read and the write, so the clause was not retracted — every seat writes ` +
                "its own clauses into one shared section, and a removal computed over content nobody has read takes a " +
                "line by position rather than by name",
        );
    }

    writeSurface(options.absolute, written);

    return {
        code: 0,
        raised: options.clause,
        message:
            `RETRACTED  ${options.clause} from ${options.target}. A DEFERRAL IS RETRACTED WHERE ITS QUESTION IS NO LONGER ` +
            "OPEN, which is the ONE removal an accumulating venue admits alongside a directive discharge — a position is " +
            "an ARGUMENT and stands, a deferral is a QUESTION and ends when it is answered. Carrying a clause whose work " +
            "has landed sends its receiver looking for work that does not exist, which is the stranded deferral inverted: " +
            "a receiver that resolves and an operand that has evaporated. The extraction reference is mandatory and " +
            "resolving for the same reason every removal here requires one.\n",
    };
}

export function runArrive(options: { readonly predecessor: string; readonly absolute: string }): RaiseOutcome {
    if (!options.predecessor.endsWith(BLOCKING_SUFFIX)) {
        return refusal(
            "an arrival carries a clause FROM a venue into the successor that venue declares, so the target names the " +
                "predecessor — the clause set and the destination are both read from it, and an arrival with no " +
                "predecessor would carry a question nothing deferred",
        );
    }

    if (!existsSync(options.absolute)) {
        return refusal(
            `${options.predecessor} does not exist, so nothing defers a clause and nothing declares a successor`,
        );
    }

    const source = readSurface(options.absolute, "utf8");
    const invariant = declaredSuccessor(source);

    if (invariant.length === 0) {
        return refusal(
            "the predecessor declares no successor invariant outside a fence, so a deferred clause has no destination — " +
                "and a clause carried into a guessed one arrives at a venue nobody's predecessor points at",
        );
    }

    const { name, path } = successorPath(options.absolute, options.predecessor, invariant);

    if (!existsSync(path)) {
        return refusal(
            `${name} does not exist, so the successor is unraised and an arrival would create it from nothing — raise it ` +
                "first, which reads the template once and carries every clause deferred at that moment",
        );
    }

    const witnessed = readSurface(path, "utf8");

    if (!witnessed.includes(INHERITED_BANNER)) {
        return refusal(
            `${name} carries no inherited section, so an arrival has no anchor and would have to guess a position in a ` +
                "surface it did not author",
        );
    }

    const addressed = unarrivedDeferrals(source, witnessed);
    const missing = addressed.filter((entry) => addressesSuccessor(entry.receiver, name));
    const elsewhere = addressed.filter((entry) => !addressesSuccessor(entry.receiver, name));

    if (missing.length === 0 && elsewhere.length > 0) {
        return {
            code: 0,
            raised: null,
            message:
                `HELD  ${String(elsewhere.length)} clause(s) stay at their origin because their RECEIVER is not ${name}: ` +
                `${elsewhere.map((entry) => `${entry.clause} → ${entry.receiver}`).join(", ")}. AN ARRIVAL ROUTES BY EACH ` +
                "CLAUSE'S OWN RECEIVER RATHER THAN BY THE VENUE'S DECLARATION, because the two answer different questions: " +
                "the declaration says which venue this one FEEDS, and a receiver says where THIS question goes. Routing by " +
                "the declaration would deliver every clause to one venue whatever each names, so a question would land in " +
                "a discussion about a different subject, read by seats who never argued it — and a clause naming a SEAT " +
                "could not be delivered at all. A clause whose receiver is a seat or a row the schedule has not raised " +
                "stays where it was written, which is a destination a reader can follow rather than a delivery nobody " +
                "made.\n",
        };
    }

    if (missing.length === 0) {
        return {
            code: 0,
            raised: name,
            message:
                `SETTLED  every clause ${options.predecessor} defers already appears in ${name} by name, so the arrival is ` +
                "a no-op rather than a refusal — the operand the edge joins on is satisfied and there is nothing to carry.\n",
        };
    }

    const lines = witnessed.split("\n");
    let last = -1;
    let inside = false;

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();
        if (trimmed.startsWith(INHERITED_BANNER)) {
            inside = true;
            continue;
        }
        if (!inside) continue;
        if (trimmed.startsWith("- ")) last = index;
        if (last !== -1 && trimmed.startsWith("═") && !trimmed.startsWith(INHERITED_BANNER)) break;
    }

    if (last === -1) {
        return refusal(
            `${name} declares an inherited section carrying no clause, so an arrival has no member to append beside and ` +
                "the section's own shape is unstated — a clause placed into an empty section states its form by being " +
                "the first, which is a decision the raise takes rather than an append",
        );
    }

    const carried = missing.map((entry) => `- ${entry.clause} ${DEFERRAL_ARROW} ${entry.receiver}`);
    lines.splice(last + 1, 0, ...carried);

    const current = readSurface(path, "utf8");
    if (current !== witnessed) {
        return {
            code: 2,
            raised: null,
            message:
                `CONTENDED  ${name} moved between the read and the write, so the arrival is abandoned rather than applied ` +
                "over a concurrent write — re-run it and the clause set is recomputed against the current text.\n",
        };
    }

    writeSurface(path, lines.join("\n"));

    return {
        code: 0,
        raised: name,
        message:
            `ARRIVED  ${String(missing.length)} clause(s) carried from ${options.predecessor} into ${name}: ` +
            `${missing.map((entry) => entry.clause).join(", ")}. THE RAISE CARRIES THE CLAUSES THAT EXIST AT RAISE TIME ` +
            "and nothing carries the ones deferred afterwards, so a late deferral sits at its origin and arrives nowhere " +
            "— this is the second half of a deferral rather than an argument begun in a created venue, which is why it " +
            "writes the inherited section and never the roster. The clause set is computed by the SAME derivation the " +
            "successor edge joins on, so a clause this reports as carried is a clause that edge reports as arrived.\n",
    };
}

export const NOT_READ_FIELD = "NOT-READ:";

const AWAITING_FIELD = "READ AND AWAITING:";

export function rosterFor(repoRoot: string, marked: readonly string[]): { unread: string[]; read: string[] } {
    const board = resolve(repoRoot, surfacePath("board"));
    const index = resolve(repoRoot, surfacePath("agent_index"));

    const seats = activeSeats(
        existsSync(board) ? readSurface(board, "utf8") : "",
        existsSync(index) ? readSurface(index, "utf8") : "",
    );

    const read = seats.filter((letter) => marked.includes(letter));
    return { unread: seats.filter((letter) => !marked.includes(letter)), read };
}

export function runRoster(options: { readonly repoRoot: string; readonly name: string }): RaiseOutcome {
    if (!options.name.endsWith(BLOCKING_SUFFIX)) {
        return refusal(`${options.name} is not a venue, so it carries no roster to resolve`);
    }

    const absolute = resolve(options.repoRoot, surfacePrefix(), options.name);
    if (!existsSync(absolute)) {
        return refusal(
            `${options.name} does not stand at the venue root, so there is no roster to resolve — a venue elsewhere is ` +
                "relocated first",
        );
    }

    const before = readSurface(absolute, "utf8");
    const lines = before.split("\n");

    const unreadAt = lines.findIndex((line) => line.startsWith(NOT_READ_FIELD));
    const readAt = lines.findIndex((line) => line.startsWith(AWAITING_FIELD));

    if (unreadAt === -1 || readAt === -1) {
        return refusal(
            `${options.name} does not carry both roster lines, so the resolution has no span to write — a venue missing ` +
                "one of them states its read state nowhere rather than incompletely",
        );
    }

    const marked = letters(lines[readAt] ?? "", AWAITING_FIELD);
    const roster = rosterFor(options.repoRoot, marked);
    const seated = [...roster.unread, ...roster.read];
    const standing = letters(lines[unreadAt] ?? "", NOT_READ_FIELD).filter((letter) => seated.includes(letter));

    const regressing = roster.unread.filter((letter) => !standing.includes(letter));
    if (standing.length > 0 && regressing.length > 0) {
        return refusal(
            `${options.name} would have ${regressing.join(", ")} returned to the unread set, which no seat is on now — ` +
                "and a roster only ever moves a letter one way while a venue is open. THE FORM READS ITS MARKED SET FROM " +
                "THE MARKED LINE ALONE, so a line that has been lost — by a hand write, a truncation, or a form emitting " +
                "a separator its consumer cannot read — resolves to no marks and is indistinguishable from a venue nobody " +
                "has joined. This refuses the direction that can only be a loss, which is the one comparison available " +
                "without a second operand nothing here maintains",
        );
    }

    const written = [...lines];
    written[unreadAt] = rosterLine(NOT_READ_FIELD, roster.unread);
    written[readAt] = rosterLine(AWAITING_FIELD, roster.read);

    const composed = written.join("\n");
    if (composed === before) {
        return {
            code: 0,
            raised: options.name,
            message: `CLEAR  ${options.name} already carries a resolved roster, so this is a no-op rather than a rewrite\n`,
        };
    }

    const witness = readSurface(absolute, "utf8");
    if (witness !== before) {
        return refusal(`${options.name} moved between the read and the write, so the roster was NOT resolved`);
    }

    writeSurface(absolute, composed);

    return {
        code: 0,
        raised: options.name,
        message:
            `ROSTER  ${options.name} reads unread ${roster.unread.join(", ") || RECORD_ABSENT} and marked ` +
            `${roster.read.join(", ") || RECORD_ABSENT}. A MARK IS NEVER REMOVED BY THIS FORM: the marked set is read ` +
            "from the surface and only INTERSECTED with the seats that are active, so a letter that marked and then went " +
            "inactive leaves both lines rather than being re-listed as owing a read. The unread set is the active seats " +
            "MINUS the marked ones, which is a derivation rather than a copy — a placeholder surviving here is content " +
            "written for a reader sitting where a parser reads letters, so every seat's read state on this venue is " +
            "undecidable until it is resolved.\n",
    };
}

export function runInherit(options: { readonly repoRoot: string; readonly name: string }): RaiseOutcome {
    if (!options.name.endsWith(BLOCKING_SUFFIX)) {
        return refusal(`${options.name} is not a venue, so it carries no inherited section to recompute`);
    }

    const venueRoot = resolve(options.repoRoot, surfacePrefix());
    const absolute = resolve(venueRoot, options.name);

    if (!existsSync(absolute)) {
        return refusal(
            `${options.name} does not stand at the venue root, so there is nothing to amend — a venue elsewhere is ` +
                "relocated first, because amending a file at a path no walk reads repairs a surface nobody consults",
        );
    }

    const invariant = venueInvariant(options.name);
    const deferring = deferringVenues(venueRoot, options.repoRoot, invariant);
    const before = readSurface(absolute, "utf8");
    const lines = before.split("\n");

    const opens = lines.findIndex((line) => line.startsWith(INHERITED_BANNER));
    if (opens === -1) {
        return refusal(
            `${options.name} carries no inherited section, so this form has no span to replace — it AMENDS a generated ` +
                "block and never composes one into a surface that already holds an argument",
        );
    }

    let closes = opens + 1;
    while (closes < lines.length && !(lines[closes] ?? "").startsWith(PROTOCOL_BANNER)) closes += 1;

    if (closes >= lines.length) {
        return refusal(
            `${options.name} carries an inherited section with no protocol banner after it, so its span has no end and ` +
                "a replacement would consume whatever follows — including the positions this form exists to preserve",
        );
    }

    const block =
        deferring.clauses.length === 0
            ? unclaimedBlock(invariant)
            : inheritedBlock(deferring.names.join(", "), deferring.clauses);

    const written = [...lines.slice(0, opens), ...block.split("\n").slice(0, -1), ...lines.slice(closes)].join("\n");
    if (written === before) {
        return {
            code: 0,
            raised: options.name,
            message:
                `CLEAR  ${options.name} already carries the inherited section its deferrals derive, so this is a no-op ` +
                "rather than a rewrite — an amendment that always writes is indistinguishable from one that never checks\n",
        };
    }

    const witness = readSurface(absolute, "utf8");
    if (witness !== before) {
        return refusal(
            `${options.name} moved between the read and the write, so the inherited section was NOT amended — this form ` +
                "replaces a span inside a surface every seat is writing positions into, which is the one place a " +
                "read-transform-write loses somebody else's work silently",
        );
    }

    writeSurface(absolute, written);

    return {
        code: 0,
        raised: options.name,
        message:
            `INHERITED  ${options.name} now carries ${String(deferring.clauses.length)} clause(s) from ` +
            `${deferring.names.length === 0 ? "no venue deferring here" : deferring.names.join(", ")}. THE SPAN IS ` +
            "REPLACED AND NOTHING ELSE IS TOUCHED: the section runs from its own banner to the protocol banner, so " +
            "every record, position and roster line below it stands exactly as its author wrote it. A venue holding an " +
            "argument is AMENDED rather than rebuilt, which is the difference between repairing a generated block and " +
            "composing a fresh venue over the top of somebody's reasoning.\n",
    };
}

export function runRetire(options: {
    readonly repoRoot: string;
    readonly name: string;
    readonly declares: string;
    readonly live: readonly string[];
    readonly citedBy: readonly string[];
    readonly heal: boolean;
}): RaiseOutcome {
    const planning = surfacePath("planning");
    const source = `${planning}/${options.name}`;
    const absolute = resolve(options.repoRoot, source);

    if (!options.name.endsWith(CHECKLIST_CONCERN)) {
        return refusal(
            `${options.name} does not carry the planning concern, and this form retires a SPENT DISTRIBUTION — a mover ` +
                "taking any path would be a general move wearing one surface's name, which is the escape hatch every " +
                "other form here refuses",
        );
    }

    if (!existsSync(absolute)) {
        return refusal(
            `${source} does not exist, so this form has no source — a retirement names a file that exists, and a search ` +
                "finding nothing is a scope rather than a state",
        );
    }

    if (options.declares.length === 0) {
        return refusal(
            `${source} declares no distribution, so nothing here is SPENT — this form retires a surface whose venue has ` +
                "converged, and a planning surface distributing nothing was never in that population",
        );
    }

    if (options.live.some((venue) => venue.endsWith(options.declares))) {
        return refusal(
            `${source} distributes ${options.declares}, which is still OPEN in the active tree — its rows are the work ` +
                "that venue is being argued about, so retiring it now removes the surface tracking whether the outcome " +
                "was ever built. A distribution is spent when its venue has left, never when its rows look finished",
        );
    }

    const pinning = options.citedBy.filter((citer) => citer.length > 0);
    const before = readSurface(absolute, "utf8");
    const lines = before.split("\n");
    const at = lines.findIndex((line) => line.trim().startsWith(DISTRIBUTES_FIELD));

    if (at === -1) {
        return refusal(
            `${source} carries no declaration line to remove, so this form has no operand — the walk reports it spent ` +
                "from a field this file does not hold, which is a disagreement between two readings rather than a state " +
                "this form can change",
        );
    }

    const retired =
        `${lines[at]?.slice(0, (lines[at] ?? "").indexOf(DISTRIBUTES_FIELD))}RETIRED: this surface distributed a venue ` +
        `that has since converged, and the declaration is removed so no planning surface names a venue outside the ` +
        `active tree. THE FILE STAYS AT THIS PATH PERMANENTLY${pinning.length > 0 ? ` because ${String(pinning.length)} pathed citation(s) in FROZEN surfaces name it: ${pinning.join(", ")}` : " because a planning surface is named by its own venue's distribution section, which freezes when that venue archives"}` +
        `. A PATHED CITATION FROM A FROZEN SURFACE PINS ITS TARGET AGAINST THE TARGET'S OWN DECLARED LIFETIME: no party ` +
        `may edit a frozen file, so the update half of a move is unavailable and a move degrades into a disconnection — ` +
        `and nothing reports it, because the reference walk skips an immutable path as a citation SOURCE, correctly, ` +
        `since a finding on a surface nobody may repair is a report nobody can drain. So retirement is this EDIT and ` +
        `never a move or a deletion: the spent finding clears, the file stays, and every pointer keeps resolving.`;

    const written = [...lines.slice(0, at), retired, ...lines.slice(at + 1)].join("\n");

    if (!options.heal) {
        return {
            code: 0,
            raised: source,
            message:
                `PREVIEW  ${source} would have its declaration of ${options.declares} replaced by a RETIRED statement, ` +
                "and nothing else would change — no file moved, no file deleted, no byte of any frozen surface touched\n",
        };
    }

    if (readSurface(absolute, "utf8") !== before) {
        return refusal(`${source} changed between this form's read and its write, so nothing was written`);
    }

    writeSurface(absolute, written);

    return {
        code: 0,
        raised: source,
        message:
            `RETIRED  ${source} no longer declares a distribution, and the file stands at its path. RETIREMENT IS AN ` +
            "EDIT RATHER THAN A MOVE OR A DELETION, because a pathed citation from a FROZEN surface pins its target " +
            "against that target's own declared lifetime — the citer cannot be rewritten, so a move disconnects it and " +
            "nothing reports the breakage, since the walk that would skips immutable paths as citation sources. The " +
            "spent finding clears from the contents rather than from the location\n",
    };
}

export function runRelocate(options: { readonly repoRoot: string; readonly name: string }): RaiseOutcome {
    if (!options.name.endsWith(BLOCKING_SUFFIX)) {
        return refusal(
            `${options.name} is not a venue, and this form relocates a VENUE — a mover that took any path would be a ` +
                "general move with a venue's name on it, which is the escape hatch every other form here refuses",
        );
    }

    const venueRoot = resolve(options.repoRoot, surfacePrefix());
    const destination = resolve(venueRoot, options.name);
    const stray = resolve(options.repoRoot, options.name);

    if (!existsSync(venueRoot)) {
        return refusal(
            "the venue root does not exist, so a relocation would CREATE the tree it claims to move within — a declared " +
                "root that resolves to nothing governs nothing while reading as coverage, and a mover that fills it in " +
                "hides exactly that",
        );
    }

    if (existsSync(destination)) {
        return refusal(
            `${options.name} already stands at the venue root, so there is nothing to relocate — and a mover that ` +
                "overwrote it would destroy an open argument to satisfy a path",
        );
    }

    if (!existsSync(stray)) {
        return refusal(
            `${options.name} is at neither the venue root nor the enclosing repository root, so this form has no source ` +
                "— a relocation names a file that exists and a search that finds nothing is a scope rather than a state",
        );
    }

    const carried = readSurface(stray, "utf8");
    writeSurface(destination, carried);

    const landed = readSurface(destination, "utf8");
    if (landed !== carried) {
        return refusal(
            `${options.name} did not arrive byte-identical, so the source is UNTOUCHED — a relocation that removed its ` +
                "source after a partial write would destroy the only copy of an argument, and the comparison is what " +
                "separates a move from a loss",
        );
    }

    rmSync(stray);

    return {
        code: 0,
        raised: options.name,
        message:
            `RELOCATED  ${options.name} from the enclosing repository root to the venue root, byte-identical and ` +
            "verified at the destination BEFORE the source was removed. A RELOCATION PRESERVES CONTENT AND A RAISE " +
            "COMPOSES IT, which is why an open venue holding positions takes this form and never a re-raise: a re-raise " +
            "builds a fresh venue from the template and the clauses that exist now, so every position written into the " +
            "misplaced file would be composed away by an operation that reports success. The inherited section and the " +
            "roster are separate repairs on the venue as it now stands, because a surface holding an argument is amended " +
            "rather than rebuilt.\n",
    };
}

const RECORD_OPEN = "┌─── AGENT ";

const RECORD_CLOSE_MARKER = "└─── END AGENT ";

const LETTER_SLOT = "<letter>";

const STATE_SLOT = "<ACTIVE | INACTIVE>";

const PLACEHOLDER_OPEN = "<";

export function recordSpecimen(template: string): string[] {
    const lines = template.split("\n");
    const opens = lines.findIndex((line) => line.trimStart().startsWith(RECORD_OPEN) && line.includes(LETTER_SLOT));
    if (opens === -1) return [];

    const open = lines[opens] ?? "";
    const indent = open.slice(0, open.length - open.trimStart().length);

    let closes = opens;
    while (closes < lines.length && !(lines[closes] ?? "").trimStart().startsWith(RECORD_CLOSE_MARKER)) closes += 1;
    if (closes >= lines.length) return [];

    return lines.slice(opens, closes + 1).map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line));
}

export function seatRecord(specimen: readonly string[], letter: string): string[] {
    return specimen.map((line) => {
        const named = line.split(LETTER_SLOT).join(letter).split(STATE_SLOT).join("ACTIVE");
        const cut = named.indexOf(PLACEHOLDER_OPEN);
        return cut === -1 ? named : named.slice(0, cut).trimEnd();
    });
}

export function runRaise(options: {
    readonly repoRoot: string;
    readonly declared: string | null;
    readonly seats: readonly string[];
}): RaiseOutcome {
    const agendaPath = resolve(options.repoRoot, AGENDA);
    if (!existsSync(agendaPath)) {
        return refusal(
            "the agenda does not exist, so a raise has no schedule to follow and would create a file on a declaration " +
                "alone — which is the join whose absence puts a venue on disk at an ordinal the schedule assigns to " +
                "something else",
        );
    }

    const agenda = readSurface(agendaPath, "utf8");
    const venueRoot = resolve(options.repoRoot, surfacePrefix());
    const admissible = admissibleInvariants(agenda, siblingVenues(venueRoot, options.repoRoot));

    if (admissible.length === 0) {
        return refusal(
            "the agenda carries no planned invariant that is not already raised, so nothing is ADMISSIBLE — the schedule " +
                "decides what may be raised and a raise with an exhausted schedule would have to invent a subject. Add " +
                "the row, then raise",
        );
    }

    const named = options.declared !== null && options.declared.length > 0 ? options.declared : null;

    if (named !== null && !admissible.includes(named)) {
        return refusal(
            `${named} is not ADMISSIBLE: the agenda either does not carry it, does not carry it as planned, or a venue ` +
                `for it already exists. Admissible now: ${admissible.join(", ")}. THE QUESTION IS ADMISSIBILITY RATHER ` +
                "THAN IDENTITY WITH A COMPUTED NEXT, because the schedule declares a PARTIAL order — a row inserted by " +
                "directive sits where its subject belongs rather than where a walk would reach it, and a partial order " +
                "has no unique next. So a raise names any admissible row and the schedule refuses the rest; where no " +
                "name is given the first admissible row is taken, and its position in the table is a TIE-BREAK rather " +
                "than the answer",
        );
    }

    const invariant = named ?? admissible[0] ?? "";

    const undeclared = readdirSync(venueRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(BLOCKING_SUFFIX))
        .filter((entry) => declaredSuccessor(readSurface(resolve(venueRoot, entry.name), "utf8")).length === 0)
        .map((entry) => entry.name);

    if (undeclared.length > 0) {
        return refusal(
            `${undeclared.join(", ")} stands in the active tree declaring no successor, and raising now makes that ` +
                "declaration IMPOSSIBLE rather than merely late. TWO ORDERINGS COMPOSE HERE AND NOTHING JOINED THEM: a " +
                "successor is DECLARED while its agenda row is PLANNED, because the declaration is checked against that " +
                "state, and it is RAISED at convergence, which moves the row past planned. So declaring must precede " +
                "raising — and a raise taken first refuses the declaration afterwards on a row the raise itself moved, " +
                "which reads as a defect in the successor form rather than as an ordering the raise could have named. " +
                "Declare the successor on the open venue, then raise",
        );
    }

    const templatePath = resolve(options.repoRoot, surfacePath("venue_template"));
    if (!existsSync(templatePath)) {
        return refusal(
            "the venue template does not exist, so a raise would compose a venue from nothing and every check deriving " +
                "its schema from that template would hold vacuously over the result",
        );
    }

    const ordinal = agendaOrdinalOf(agenda, invariant);

    if (ordinal.length === 0) {
        return refusal(
            `the agenda carries ${invariant} and states no ordinal for it, so the raise has no position to name the file ` +
                "by. THE ORDINAL COMES FROM THE AGENDA ROW RATHER THAN FROM A FILE COUNT: a count and a schedule coincide " +
                "only while nothing is inserted, so a counted ordinal names a correctly-scheduled venue at the position " +
                "the schedule assigned to something else — measured twice on this tree, once as an off-agenda file and " +
                "once as a correctly-scheduled venue created at the wrong number. Fill the row's ordinal cell, then raise",
        );
    }

    const name = `${invariant}.${ordinal}${BLOCKING_SUFFIX}`;
    const destination = resolve(venueRoot, name);

    if (existsSync(destination)) {
        return refusal(
            `${name} already exists, so the raise would overwrite a venue rather than create one — a create is an edit ` +
                "until the path is proven absent, and this is the operation where that is skipped by reflex",
        );
    }

    const deferring = deferringVenues(venueRoot, options.repoRoot, invariant);
    const clauses = deferring.clauses;

    const template = readSurface(templatePath, "utf8");
    if (!template.includes(PROTOCOL_BANNER)) {
        return refusal(
            "the template carries no protocol banner, so the raise has no anchor to place the inherited section before " +
                "and would have to guess a position in a surface it did not author",
        );
    }

    const inherited =
        clauses.length === 0 ? unclaimedBlock(invariant) : inheritedBlock(deferring.names.join(", "), clauses);
    const composed = template.replace(PROTOCOL_BANNER, `${inherited}${PROTOCOL_BANNER}`);

    const participants = options.seats.length > 0 ? [...options.seats] : seatedLetters(options.repoRoot);

    const indexPath = resolve(options.repoRoot, AGENT_INDEX);
    const bound = indexedLetters(existsSync(indexPath) ? readSurface(indexPath, "utf8") : "").letters;
    const unbound = participants.filter((letter) => !bound.has(letter));

    if (unbound.length > 0) {
        return refusal(
            `${unbound.join(", ")} is named as a participant and the index binds no such letter, so the venue would ` +
                "carry a record under an identity every citation of it resolves to nothing through. A LETTER IS CLAIMED " +
                "BY ADDING ITS ROW rather than by being used, and the binding is written once and never rewritten — so " +
                "seating an unbound letter here spends nothing and breaks the one surface every later citation resolves " +
                "against. Add the index row naming what that letter's CONCERN is, then raise",
        );
    }

    const specimen = recordSpecimen(template);
    if (specimen.length === 0) {
        return refusal(
            "the template carries no fenced seat-record specimen, so the raise has no shape to unfence per participant " +
                "and would have to transcribe a schema the template already states — which is two copies of one contract " +
                "with nothing keeping them equal",
        );
    }

    const seated = participants.flatMap((letter) => [...seatRecord(specimen, letter), ""]);

    const raised = composed
        .split("\n")
        .flatMap((line) => {
            if (line.startsWith(SIGN_OFF_BANNER)) return [...seated, line];
            return [line];
        })
        .map((line) => {
            if (line.startsWith(NOT_READ_FIELD)) return rosterLine(NOT_READ_FIELD, participants);
            if (line.startsWith(AWAITING_FIELD)) return rosterLine(AWAITING_FIELD, []);
            return line;
        })
        .join("\n");

    writeSurface(destination, raised);

    return {
        code: 0,
        raised: name,
        message:
            `RAISED  ${name} from the template at the position the AGENDA assigns, seating ${participants.join(", ")} ` +
            `and carrying ${String(clauses.length)} ` +
            `inherited clause(s) from ${deferring.names.length === 0 ? "no venue deferring here" : deferring.names.join(", ")}. ` +
            "THE PARTICIPANTS ARE DECLARED RATHER THAN DERIVED, and a record is unfenced here for each so the tool can " +
            "write into it: a venue REFUSES every position without a per-writer record, and no form placed one, so every " +
            "seat hand-edited the surface whose whole point is that nobody hand-edits it. Deriving them from the ACTIVE " +
            "roster instead would seat whoever happens to be running, which is an observation where the participant set " +
            "is an INTENT — who should argue this — and a venue raised before its arguers exist would seat one seat and " +
            "converge against nobody. Each record's fields are left EMPTY rather than marked absent, because an empty " +
            "field blocks convergence and an absent marker reads as a seat with nothing to say. " +
            "A CLAUSE TRAVELS TO THE INVARIANT ITS DEFERRAL NAMES rather than to whatever a predecessor declared as its " +
            "successor: a venue's declared successor is what it FEEDS structurally, a deferral's receiver is where that " +
            "question is answered, and the two coincide only while every deferral points at the declared successor. THE " +
            "SCHEDULE " +
            "DECIDES WHAT IS RAISED AND A DEFERRAL DECIDES WHAT IS INHERITED, which are two questions with two " +
            "answers: they coincide for every venue until one is inserted, and a form reading one of them for both " +
            "refuses the schedule's own next row whenever they differ. THE VENUE IS CREATED AND NOT OPENED: the roster " +
            "carries every letter unread, which is the checkable form of that state, and a seat marks its letter only " +
            "once the predecessor leaves the active tree. The template is read ONCE here rather than copied by each " +
            "author, so a venue cannot inherit a form the template has moved past — which is the drift a hand copy " +
            "produces silently, at the one moment its reader is least equipped to notice.\n",
    };
}
