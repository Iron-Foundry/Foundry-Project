import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { basename, resolve } from "node:path";

import { surfacePath } from "../../../config/surface.config.ts";

import { fencedFlags } from "../predicates/fence.predicate.ts";

import { activeSeats, boardRecords } from "../analyzers/board.analyzer.ts";
import { BLOCKING_SUFFIX } from "../constants/blocking.constants.ts";

const SIGN_OFF_ABSENT = "—";

const NEEDS_FIELD = "Needs";

const DURABLE_FIELD = "Durable";

const INHERITED_HEADING = "INHERITED";

function isHeadingCharacter(character: string): boolean {
    if (character >= "a" && character <= "z") return true;
    if (character >= "0" && character <= "9") return true;
    return character === "-";
}

export function declaredHeading(field: string): string {
    return field.trim();
}

export function headingIsWhole(field: string): boolean {
    const trimmed = field.trim();
    if (trimmed.length === 0) return false;

    for (const character of trimmed) {
        if (!isHeadingCharacter(character)) return false;
    }

    return true;
}

export const CONVERGENCE_STEPS = [
    "needs",
    "signatures",
    "durable",
    "directives",
    "absorption",
    "inheritance",
    "successor",
] as const;

export const ARCHIVE_STEP = "archive";

export const DESTRUCTIVE_STEPS: readonly string[] = [...CONVERGENCE_STEPS, ARCHIVE_STEP];

export type ConvergenceStep = (typeof CONVERGENCE_STEPS)[number];

export interface Edge {
    readonly step: string;
    readonly edge: string;
    readonly holds: boolean;
    readonly detail: string;
}

const SUCCESSOR_FIELD = "SUCCESSOR:";

const DEFERRED_HEADING = "DEFERRED";

const DIRECTIVES_HEADING = "DIRECTIVES";

export function declaredSuccessor(venue: string): string {
    const fenced = fencedFlags(venue);
    const lines = venue.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        if (fenced[index] === true) continue;

        const trimmed = (lines[index] ?? "").trim();
        if (!trimmed.startsWith(SUCCESSOR_FIELD)) continue;

        const value = trimmed.slice(SUCCESSOR_FIELD.length).trim();
        return value.startsWith("<") ? "" : value;
    }

    return "";
}

const CLAUSE_ARROW = "→";

interface DeferredSection {
    readonly declared: boolean;
    readonly answered: boolean;
    readonly clauses: readonly string[];
}

function deferredClauses(venue: string): DeferredSection {
    const section = clauseSection(venue, DEFERRED_HEADING);
    return {
        declared: section.declared,
        answered: section.answered,
        clauses: section.lines.map((entry) => entry.clause),
    };
}

export interface StrandedDeferral {
    readonly clause: string;
    readonly receiver: string;
}

function receiverOf(line: string): string {
    const arrow = line.indexOf(CLAUSE_ARROW);
    if (arrow === -1) return "";

    const rest = line.slice(arrow + CLAUSE_ARROW.length).trim();
    const comma = rest.indexOf(",");
    return (comma === -1 ? rest : rest.slice(0, comma)).trim();
}

function unemphasised(text: string): string {
    let out = "";
    for (const character of text) {
        if (character === "*" || character === "`" || character === "_") continue;
        out += character;
    }
    return out.trim();
}

const BANNER = "═";

function isSectionBoundary(trimmed: string): boolean {
    return trimmed.startsWith("#") || trimmed.startsWith(BANNER);
}

export const DEFERRED_SECTION = DEFERRED_HEADING;

export const DEFERRAL_ARROW = CLAUSE_ARROW;

export function sectionBound(venue: string, heading: string): { from: number; to: number } | null {
    const lines = venue.split("\n");
    let from = -1;

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();
        if (!isSectionBoundary(trimmed)) continue;

        if (from === -1) {
            if (trimmed.includes(heading)) from = index;
            continue;
        }
        return { from, to: index };
    }

    return from === -1 ? null : { from, to: lines.length };
}

interface ClauseSection {
    readonly declared: boolean;
    readonly answered: boolean;
    readonly lines: readonly { clause: string; receiver: string }[];
}

function clauseSection(venue: string, heading: string): ClauseSection {
    const lines: { clause: string; receiver: string }[] = [];
    let declared = false;
    let answered = false;
    let inside = false;

    for (const line of venue.split("\n")) {
        const trimmed = line.trim();

        if (isSectionBoundary(trimmed) && trimmed.includes(heading)) {
            inside = true;
            declared = true;
            continue;
        }
        if (inside && isSectionBoundary(trimmed)) {
            inside = false;
            continue;
        }
        if (!inside || !trimmed.startsWith("- ")) continue;

        const arrow = trimmed.indexOf(CLAUSE_ARROW);
        const clause = unemphasised(arrow === -1 ? trimmed.slice(2) : trimmed.slice(2, arrow));
        if (clause === SIGN_OFF_ABSENT) {
            answered = true;
            continue;
        }
        if (clause.length === 0 || clause.startsWith("<")) continue;

        answered = true;
        lines.push({ clause, receiver: receiverOf(trimmed) });
    }

    return { declared, answered, lines };
}

export function clauseLines(venue: string, heading: string): readonly { clause: string; receiver: string }[] {
    return clauseSection(venue, heading).lines;
}

export const DISTRIBUTES_FIELD = "DISTRIBUTES:";

const CLOSES_FIELD = "CLOSES:";

const OPEN_TASK = "- [ ]";

export interface Absorption {
    readonly checklist: string;
    readonly open: readonly string[];
    readonly closes: string;
    readonly declaring: readonly string[];
}

function isTaskId(token: string): boolean {
    if (token.length === 0) return false;

    let digits = 0;
    let dots = 0;
    for (const character of token) {
        if (character >= "0" && character <= "9") {
            digits += 1;
            continue;
        }
        if (character === ".") {
            dots += 1;
            continue;
        }
        return false;
    }

    return digits > 0 && dots > 0;
}

export function absorptionState(repoRoot: string, venueName: string): Absorption | null {
    const planning = resolve(repoRoot, surfacePath("planning"));
    if (!existsSync(planning)) return null;

    const declaring: string[] = [];
    let first: Absorption | null = null;

    for (const entry of readdirSync(planning)) {
        const path = resolve(planning, entry);
        const source = readSurface(path, "utf8");

        let declares = false;
        let closes = "";
        const open: string[] = [];

        for (const line of source.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith(DISTRIBUTES_FIELD) && trimmed.includes(venueName)) declares = true;
            if (trimmed.startsWith(CLOSES_FIELD)) closes = trimmed.slice(CLOSES_FIELD.length).trim();
            if (!trimmed.startsWith(OPEN_TASK)) continue;

            const id = trimmed.slice(OPEN_TASK.length).trim().split(" ")[0] ?? "";
            if (isTaskId(id)) open.push(id);
        }

        if (!declares) continue;

        declaring.push(entry);
        if (first !== null) continue;

        first = { checklist: entry, closes, open: open.filter((id) => id !== closes), declaring };
    }

    if (first === null) return null;

    return { ...first, declaring };
}

export interface Distribution {
    readonly path: string;
    readonly line: number;
    readonly declares: string;
}

export function declaredDistributions(surfaces: readonly string[], read: (path: string) => string): Distribution[] {
    const out: Distribution[] = [];

    for (const path of surfaces) {
        const lines = read(path).split("\n");

        for (let index = 0; index < lines.length; index += 1) {
            const trimmed = (lines[index] ?? "").trim();
            if (!trimmed.startsWith(DISTRIBUTES_FIELD)) continue;

            const declares = trimmed.slice(DISTRIBUTES_FIELD.length).trim();
            if (declares.length === 0 || declares.startsWith("<")) continue;
            out.push({ path, line: index + 1, declares });
        }
    }

    return out;
}

const AWAITING_LINE = "READ AND AWAITING:";

export function hasReadMark(venue: string): boolean {
    for (const line of venue.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(AWAITING_LINE)) continue;

        for (const token of trimmed.slice(AWAITING_LINE.length).split(" ")) {
            const letter = token.trim();
            if (letter.length === 0 || letter === SIGN_OFF_ABSENT) continue;
            return true;
        }
    }

    return false;
}

export function unarrivedDeferrals(
    venue: string,
    successorText: string,
    successorName = "",
): readonly { clause: string; receiver: string }[] {
    return clauseLines(venue, DEFERRED_HEADING)
        .filter((entry) => addressesSuccessor(entry.receiver, successorName))
        .filter((entry) => !successorText.includes(entry.clause));
}

export function unoriginatedInheritance(venue: string, successorText: string): string[] {
    const deferred = clauseLines(venue, DEFERRED_HEADING).map((entry) => entry.clause);
    const out: string[] = [];

    for (const { clause } of clauseLines(successorText, INHERITED_HEADING)) {
        const shared = deferred.some((name) => name.includes(clause) || clause.includes(name));
        if (shared) continue;
        out.push(clause);
    }

    return out;
}

export function addressesSuccessor(receiver: string, successorName: string): boolean {
    if (receiver.length === 0 || successorName.length === 0) return false;
    return venueInvariant(successorName) === receiver;
}

export function venueInvariant(name: string): string {
    const stem = basename(name).endsWith(BLOCKING_SUFFIX)
        ? basename(name).slice(0, basename(name).length - BLOCKING_SUFFIX.length)
        : basename(name);
    const dot = stem.lastIndexOf(".");
    return dot === -1 ? stem : stem.slice(0, dot);
}

export function receiverResolves(
    receiver: string,
    board: string,
    index: string,
    venueNames: readonly string[],
    planned: readonly string[] = [],
): boolean {
    if (receiver.length === 0) return false;
    if (new Set(activeSeats(board, index)).has(receiver)) return true;
    if (venueNames.some((name) => venueInvariant(name) === receiver)) return true;
    return planned.includes(receiver);
}

export function strandedDeferrals(
    venue: string,
    board: string,
    index: string,
    venueNames: readonly string[],
    planned: readonly string[] = [],
): StrandedDeferral[] {
    const out: StrandedDeferral[] = [];

    for (const { clause, receiver } of clauseLines(venue, DEFERRED_HEADING)) {
        if (receiver === clause) {
            out.push({ clause, receiver });
            continue;
        }
        if (receiverResolves(receiver, board, index, venueNames, planned)) continue;
        out.push({ clause, receiver });
    }

    return out;
}

export const SIGN_OFF_BANNER = "═══════════════════ SIGN-OFF";

export function signOffSection(venue: string): string[] {
    const lines = venue.split("\n");
    const opens = lines.findIndex((line) => line.startsWith(SIGN_OFF_BANNER));
    return opens === -1 ? [] : lines.slice(opens + 1);
}

function signOffLines(venue: string): Map<string, string> {
    const out = new Map<string, string>();

    for (const line of signOffSection(venue)) {
        const colon = line.indexOf(":");
        if (colon <= 0 || colon > 4) continue;

        const letter = line.slice(0, colon).trim();
        if (letter.length === 0 || letter.length > 2) continue;

        const first = letter.charAt(0);
        if (first < "A" || first > "Z") continue;
        if (out.has(letter)) continue;

        out.set(letter, line.slice(colon + 1).trim());
    }

    return out;
}

export function venueRecords(venue: string): Map<string, ReadonlyMap<string, string>> {
    const out = new Map<string, ReadonlyMap<string, string>>();

    for (const record of boardRecords(venue)) {
        if (record.kind !== "agent") continue;
        out.set(record.label.slice("Agent ".length).trim(), record.fields);
    }

    return out;
}

function successorOf(target: string): string {
    const stem = target.slice(0, target.length - BLOCKING_SUFFIX.length);
    const dot = stem.lastIndexOf(".");
    if (dot === -1) return "";

    const ordinal = Number(stem.slice(dot + 1));
    if (!Number.isFinite(ordinal)) return "";

    return `${String(ordinal + 1)}${BLOCKING_SUFFIX}`;
}

export function convergenceEdges(
    repoRoot: string,
    target: string,
    venue: string,
    board: string,
    index: string,
    archive: string,
    siblings: readonly string[],
    plannedInvariants: readonly string[] = [],
): Edge[] {
    const records = venueRecords(venue);
    const convened = activeSeats(board, index);
    const letters = convened.filter((letter) => records.has(letter));
    const uncovened = convened.filter((letter) => !records.has(letter));

    const unstated = letters.filter((letter) => {
        const fields = records.get(letter);
        if (fields === undefined) return true;
        const needs = (fields.get(NEEDS_FIELD) ?? "").trim();
        return needs.length === 0;
    });

    const signatures = signOffLines(venue);
    const outstanding = letters.filter((letter) => {
        const signed = (signatures.get(letter) ?? "").trim();
        return signed.length === 0 || signed === SIGN_OFF_ABSENT;
    });

    const declaredHeadings: string[] = [];
    const undeclared: string[] = [];
    const unresolved: string[] = [];

    for (const letter of letters) {
        const fields = records.get(letter);
        const declared = fields !== undefined && fields.has(DURABLE_FIELD);
        const heading = (fields?.get(DURABLE_FIELD) ?? "").trim();

        if (!declared || heading.length === 0) {
            undeclared.push(letter);
            continue;
        }

        if (heading === SIGN_OFF_ABSENT) {
            declaredHeadings.push(`${letter} → none`);
            continue;
        }

        const named = declaredHeading(heading);
        declaredHeadings.push(named);
        if (!headingIsWhole(named) || !archive.includes(named)) unresolved.push(`${letter} → ${named}`);
    }

    const declared = declaredSuccessor(venue);
    const wanted = successorOf(target);
    const successor =
        declared.length > 0
            ? (siblings.find((name) => basename(name).startsWith(declared) && name !== target) ?? "")
            : (siblings.find((name) => name.endsWith(wanted) && name !== target) ?? "");
    const successorAbsolute = successor.length === 0 ? "" : resolve(repoRoot, successor);
    const successorText =
        successorAbsolute.length > 0 && existsSync(successorAbsolute) ? readSurface(successorAbsolute, "utf8") : "";
    const deferred = deferredClauses(venue);
    const unarrived = unarrivedDeferrals(venue, successorText, successor).map((entry) => entry.clause);
    const elsewhere = clauseLines(venue, DEFERRED_HEADING)
        .filter((entry) => successor.length > 0 && !addressesSuccessor(entry.receiver, successor))
        .map((entry) => `${entry.clause} → ${entry.receiver}`);
    const unoriginated = unoriginatedInheritance(venue, successorText);
    const liveDirectives = clauseLines(venue, DIRECTIVES_HEADING).map((entry) => entry.clause);
    const absorption = absorptionState(repoRoot, basename(target));
    const scheduled = declared.length > 0 && plannedInvariants.includes(declared);
    const successorHolds =
        deferred.declared &&
        deferred.answered &&
        (scheduled || (successor.length > 0 && successorText.includes(INHERITED_HEADING) && unarrived.length === 0));

    const convenedNobody =
        "THE SUBJECT SET IS EMPTY, SO THIS EDGE HOLDS OVER NOTHING AND IS REPORTED AS FAILING RATHER THAN AS PASSING. " +
        "Each of the three seat edges is computed as a FILTER over the convened set and holds when the filtered result " +
        "is empty — which is correct while the set has members and vacuous when it does not, so a venue no seat is " +
        "party to would report unanimous agreement with nothing signed, nothing stated and nothing declared. A vacuous " +
        "pass is worse than no check by the same argument that makes a saturating one worse: it is uniform by " +
        "construction and its own greenness is the evidence that what it measures is working. A venue convenes at least " +
        "one seat or it is not a discussion, so an empty subject set is a defect in the surface rather than a state to " +
        "clear";

    const vacuous = letters.length === 0;

    return [
        {
            step: "needs",
            edge: "every seat CONVENED BY THIS VENUE states its Needs in it",
            holds: !vacuous && unstated.length === 0,
            detail: vacuous
                ? convenedNobody
                : unstated.length === 0
                  ? `${String(letters.length)} convened seat(s) each carry a stated Needs${uncovened.length === 0 ? "" : `; ${uncovened.join(", ")} is board-active and holds no record here, so it was never party to this argument`}. BOARD-ACTIVITY AND VENUE-PARTICIPATION ARE DIFFERENT MEMBERSHIPS WITH DIFFERENT LIFETIMES AND THE QUANTIFIER IS THEIR INTERSECTION: board-active means a seat is working this repository and is addressable, changes when a seat arrives or leaves, and is owned by the board; venue-participation means a seat is party to THIS argument, is declared by holding a record here, is fixed when the venue is raised, and is owned by the venue. Importing the board's membership made every venue hostage to every seat existing anywhere in the tree, and it read a seat's CORRECT board state as absence — which asked that seat to write a false state so another surface's derivation came out right. A seat with no record was never convened and has nothing to state; a convened seat that has gone quiet still blocks, because its record is here and its fields are empty. THIS MESSAGE STATES WHAT THIS WALK COMPUTED AND NOTHING ABOUT ANY OTHER MECHANISM: a clause here describing what a neighbouring form does is prose its emitter never observed, and it arrives carrying a run's authority — which held a venue for a round across two seats when this line named a resolution the raise does not perform. What answers evasion is a question for whoever holds that form, established by invoking it`
                  : `no stated Needs from ${unstated.join(", ")} — an empty Needs is what convergence LOOKS like, and a seat with no record has not been asked`,
        },
        {
            step: "signatures",
            edge: "every active seat has signed its own positions",
            holds: !vacuous && outstanding.length === 0,
            detail: vacuous
                ? convenedNobody
                : outstanding.length === 0
                  ? "every active seat carries its own signature"
                  : `unsigned: ${outstanding.join(", ")} — nobody countersigns, so an unsigned seat is a seat that has not agreed. THE ABSENT MARKER IS A PLACEHOLDER HERE AND A DECLARED ANSWER IN THE DURABLE FIELD, AND THE ASYMMETRY IS DELIBERATE: the venue template SEEDS this block with that marker for every seat, so reading it as a refusal would make a freshly raised venue report unanimous dissent before anyone had read it. A seat that has read the outcome and REFUSES states that in its remaining-need field or in a position, where the refusal carries its reason and the walk holds against it — a signature answers signed or not, and a middle value on a binary verdict is the warning tier under another name`,
        },
        {
            step: "durable",
            edge: "every active seat's durable half is authored and resolves in the accumulator",
            holds: !vacuous && undeclared.length === 0 && unresolved.length === 0,
            detail: vacuous
                ? convenedNobody
                : undeclared.length === 0 && unresolved.length === 0
                  ? `every active seat declares an accumulator heading and each resolves: ${declaredHeadings.join(", ")}`
                  : [
                        undeclared.length === 0
                            ? ""
                            : `${undeclared.join(", ")} declare no Durable field at all — a DASH is a real answer stating this seat authored no distinct class and extracts as instances into another's heading, while an ABSENT field states nothing and makes an oversight indistinguishable from a decision`,
                        unresolved.length === 0
                            ? ""
                            : `declared but absent from the accumulator: ${unresolved.join(", ")}`,
                    ]
                        .filter((part) => part.length > 0)
                        .join("; ") +
                    " — the edge joins the active roster to the headings each seat names, because an accumulator heading is a kebab sentence naming the CLASS and never the episode, so searching the accumulator for this venue's name could never be satisfied by a correct extraction",
        },
        {
            step: "successor",
            edge: "every deferred question has a DESTINATION before this venue is moved to the archive — a successor carrying it by name, or a schedule holding the invariant it names",
            holds: successorHolds,
            detail:
                successorHolds && scheduled && successor.length === 0
                    ? `this venue declares it feeds "${declared}", which the schedule carries in the PLANNED state, so its deferred questions have a DESTINATION and the file arrives when the schedule reaches that row. THE EDGE JOINS A DESTINATION RATHER THAN A FILE, AND THAT IS THE DECIDED OPERAND: requiring a file forced a raise the moment a venue declared anything, which put a venue on disk at an ordinal the schedule assigned to something else — measured, and corrected by removing the file. A schedule row is a destination a reader can follow and a raise cannot be brought forward by a deferral, so the arrival obligation moves to raise time where the clause set is known rather than to convergence where the file does not exist yet`
                    : successorHolds
                      ? `${successor} exists and every clause ADDRESSED TO IT arrived by name${elsewhere.length === 0 ? "" : `; ${elsewhere.join(", ")} name a different receiver and travel there rather than here — a deferral's RECEIVER says where THIS question goes while the successor field says which venue this one FEEDS, and routing every clause by the declaration would land a question in a discussion about another subject, read by seats who never argued it`}: ${deferred.clauses.length === 0 ? "the section declares none deferred" : deferred.clauses.join(", ")}. THIS EDGE READS EXISTENCE RATHER THAN OPENNESS, AND THAT IS THE DECIDED OPERAND RATHER THAN AN ACCIDENT OF HOW IT WAS WRITTEN: its subject is whether a deferred question has a DESTINATION, and a created successor carrying the clause by name is that destination — a reader following the deferral finds it whether or not any seat has begun arguing there. Requiring openness instead would deadlock by construction, because a seat marks its letter on a successor only once its predecessor is ARCHIVED: the predecessor would wait for an opening that waits for the archive that waits for the predecessor. The concern that an early creation discharges a brake is real and belongs to the CONCURRENT-VENUES axis rather than here — that axis measures openness from the roster, so a created-not-opened successor satisfies this edge and raises nothing there, and the two mechanisms now read the two operands their own subjects need rather than one operand between them`
                      : !deferred.declared
                        ? `this venue declares no ${DEFERRED_HEADING} section, so the edge has ONE operand and cannot compare — an absent section and a section stating none deferred produce the identical hold, and a deferral written only into the successor's ${INHERITED_HEADING} section exists at its destination and was never recorded at its origin. Declare the section: list each clause, or state the absent marker to record that this venue defers nothing`
                        : !deferred.answered
                          ? `the ${DEFERRED_HEADING} section carries only the template's own seed line, which states NOTHING — a seeded section and a section answering none deferred are the same empty clause set to this edge, so the edge would hold over a question set nobody has decided and the hold would be a pass measuring nothing. The three states are distinct and only two of them are answers: the section is UNFILLED, or it lists each clause with its receiver, or it carries the absent marker to record that this venue defers nothing. This is the seeded-placeholder collapse the sign-off block already answers, arriving on the section that decides what the successor inherits`
                          : successor.length === 0 || !successorText.includes(INHERITED_HEADING)
                            ? `no successor carrying an ${INHERITED_HEADING} section${declared.length === 0 ? " and this venue declares none, so the edge fell back to the chrono increment — an ordinal is a position in a total order and cannot detect a violation it preserves" : `, and the invariant this venue DECLARES it feeds is "${declared}" which names no file here`} — creation and opening are two events, so a question deferred to a venue that does not exist yet is deferred to nobody and its absence surfaces after the work needing it is built`
                            : `the successor exists and these deferred clauses do not appear in it by name: ${unarrived.join(", ")} — the rule quantifies over CLAUSES and a check testing only for the heading is satisfied by an empty section, so both operands range over the same set or the rule is enforced at its weakest point`,
        },
        {
            step: "directives",
            edge: "every directive this venue received is DISCHARGED: the directives section carries no live line",
            holds: liveDirectives.length === 0,
            detail:
                liveDirectives.length === 0
                    ? "the directives section carries no live line, so no standing instruction travels into the archive"
                    : `undischarged: ${liveDirectives.join(", ")} — a directive is an INSTRUCTION rather than an argument, so it carries the OPPOSITE retention to the surface holding it: current from the moment it is written and ENDED by the completion of what it asked for, where a position stands until convergence and moves whole into the archive. Archiving an undischarged one preserves a standing order as though it were a claim somebody made, and every later reader inherits an instruction nobody is acting on. DISCHARGE IS TESTED AGAINST THE TREE RATHER THAN AGAINST AGREEMENT: every party having READ it is not discharge, what it asked for EXISTING is — the same test that decides whether a coordination item is absorbed — so a directive nobody can name an output for stays. The line is then REMOVED, and the removal declares where its durable half landed exactly as an absorbed item's does, because deletion is the discharge signal and a listed directive is undischarged by construction`,
        },
        {
            step: "absorption",
            edge: "the outcome is ABSORBED: the distribution checklist for this venue carries no open item",
            holds:
                absorption !== null &&
                absorption.declaring.length === 1 &&
                absorption.closes.length > 0 &&
                absorption.open.length === 0,
            detail:
                absorption === null
                    ? `no planning surface declares that it distributes ${basename(target)}, so the work this outcome implies has never been enumerated and the absorption stage has no operand. CONVERGENCE IS NOT THE END OF A VENUE — ABSORPTION IS: every other ordering here is satisfiable without a line of implementation, so a venue archived on signatures leaves a settled ruling, a clean gate and an unchanged tree, and the venue's own red is the LAST signal that work is outstanding. Distribute it: a planning surface naming this venue after the ${DISTRIBUTES_FIELD} field, one item per piece of work with its owner`
                    : absorption.declaring.length > 1
                      ? `${String(absorption.declaring.length)} planning surfaces declare that they distribute this venue: ${absorption.declaring.join(", ")} — so the work this outcome implies is enumerated in more than one place and no single one of them is the set. A SEARCH THAT STOPS AT ITS FIRST MATCH REPORTS A COMPLETE ANSWER OVER A PARTIAL READ: the edge would resolve against whichever surface the directory listing happened to yield first, every item on every other declaring surface would be invisible to it, and the venue could satisfy absorption while outstanding work stands on a surface the walk never opened. Which one wins would be a property of the filesystem rather than a decision anyone took, and the failure is silent in the direction that clears a gate. Collapse them to ONE declaration before comparing anything — a fact declared twice is collapsed rather than chosen between, because a mechanism paid to choose is a mechanism paid to detect a state that need not exist`
                      : absorption.closes.length === 0
                        ? `${absorption.checklist} distributes this venue and declares no ${CLOSES_FIELD} row, so the edge counts the row that PERFORMS the closure among the work the closure waits on — which makes it unsatisfiable by construction: the move cannot run until every row is gone and the move's own row cannot go until the move runs. A gate nobody can clear teaches every reader to discount its colour, so the closure row is DECLARED and excluded by identity rather than guessed from its wording`
                        : absorption.open.length === 0
                          ? `${absorption.checklist} distributes this venue and carries no open item besides its declared closure row ${absorption.closes}, so the outcome is in the tree rather than only in the argument`
                          : `${absorption.checklist} distributes this venue and still carries open items: ${absorption.open.join(", ")} — the walk holding is a PRECONDITION rather than authority to archive, and archiving here would clear the one visible signal at exactly the moment the outstanding work became the only thing left. A closed task is DELETED rather than ticked, so the remaining unchecked set IS the work. THE OPERAND IS THE TASK SET AND NEVER THE PHASE GATES: a phase gate ships unchecked by contract because it runs when the checklist is EXECUTED rather than when it is written, so counting one would make this edge unsatisfiable by construction — which is a refusal nobody can clear rather than an ordering anyone can meet`,
        },
        {
            step: "inheritance",
            edge: "every clause the successor inherits was deferred by this venue",
            holds: successor.length === 0 || unoriginated.length === 0,
            detail:
                successor.length === 0
                    ? "no successor exists, so there is no inherited set to compare and this edge has nothing to range over"
                    : unoriginated.length === 0
                      ? "every inherited clause appears in this venue's deferred set, so the two sections agree"
                      : `the successor inherits clauses this venue never deferred: ${unoriginated.join(", ")} — ONE DIRECTION OF A PAIRING IS DECORATIVE, and the arrival test is the one that reads as sufficient: it proves every deferral reaches its destination and says nothing about a destination carrying a question its origin answered or never raised. A clause living only in the successor puts the operand where the join cannot fail, so the question is inherited by name and was deferred by nobody — which is indistinguishable from a real deferral to every reader downstream. Either this venue defers it, and the sections agree, or the successor drops it because this venue closed it`,
        },
    ];
}

export function successorExists(repoRoot: string, target: string, siblings: readonly string[]): boolean {
    const wanted = successorOf(target);
    return siblings.some((name) => name.endsWith(wanted) && name !== target && existsSync(resolve(repoRoot, name)));
}
