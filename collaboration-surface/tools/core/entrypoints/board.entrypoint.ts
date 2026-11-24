import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

import { historyPath, projectRoot, surfacePath, surfacePrefix } from "../../../config/surface.config.ts";
import { activeSeats } from "../analyzers/board.analyzer.ts";
import { isItemId, ITEM_KINDS, READ_FIELD, stampOf } from "../formatters/board.formatter.ts";
import { authorOf, healRequested, runMark, unmarkedReaders } from "../runners/mark.runner.ts";
import { letters } from "../runners/converge.runner.ts";
import { NOT_READ_FIELD } from "../runners/venue.runner.ts";
import { AGENDA_PLAN, BLOCKING_SUFFIX, VENUE_ARCHIVE, VENUE_TEMPLATE } from "../constants/blocking.constants.ts";
import { AGENT_REQUIRED_TEXT, HELP_TEXT } from "../constants/board.constants.ts";
import { NO_FIX_FLAG } from "../constants/path.constants.ts";
import { forgedBoundaries } from "../predicates/marker.predicate.ts";
import { releaseAgent, releaseWaiter } from "../registries/board.registry.ts";
import { forgetAgent, readFieldMark, readSnapshot, writeFieldMark } from "../registries/snapshot.registry.ts";
import { changesSince } from "../reporters/board.reporter.ts";
import { unreadEcho, unreadSince } from "../resolvers/snapshot.resolver.ts";
import { duplicateTwinOf, itemSpans, openVenues, surfaceEntries, type ItemSpan } from "../resolvers/sweep.resolver.ts";
import { runAgendaRow } from "../runners/agenda.runner.ts";
import { filedNotice, runClosure, runEntry, runExtend, runRepair } from "../runners/archive.runner.ts";
import { declaredDistributions } from "../validators/converge.validator.ts";
import { ACKNOWLEDGED, EMPTY_EXTRACTION, EXTRACTION_KIND } from "../validators/archive.validator.ts";
import {
    unknownArguments,
    unshareableOperations,
    unsuppliedOperands,
    writesNothing,
} from "../validators/entrypoint.validator.ts";
import { bindSeat, runIndex, runSeats, runTransition } from "../runners/index.runner.ts";
import { callerProcess } from "../registries/process.registry.ts";
import { raiseLocalSurfaces, runSurfaceRaise } from "../runners/surface.runner.ts";
import { runHalf } from "../runners/conduct.runner.ts";
import { runTask } from "../runners/task.runner.ts";
import { discoverRules } from "../registries/rule.registry.ts";
import { runRole } from "../runners/role.runner.ts";
import { runFixture } from "../runners/fixture.runner.ts";
import { runMember } from "../runners/member.runner.ts";
import { runSweep } from "../runners/sweep.runner.ts";
import { admitWaiter, runBarrier } from "../coordinators/board.coordinator.ts";
import { runCompression, runField, runItem } from "../runners/board.runner.ts";

const RAISE_FORMS: readonly [string, { template: string; root: string; concern: string }][] = [
    ["--model", { template: "model_template", root: "models", concern: "model" }],
    ["--finding", { template: "finding_template", root: "findings", concern: "finding" }],
    ["--distribute", { template: "planning_template", root: "planning", concern: "checklist" }],
];

export const RESTATES: readonly string[] = [
    "a_venue_accumulates_and_the_board_is_swept",
    "the_handler_removes_the_item",
    "removal_declares_its_extraction",
    "a_position_is_posted_through_the_tool",
    "board_is_current_truth_only",
    "template_is_the_contract_not_a_copy_of_it",
];
import { runReadMark, runSignature } from "../runners/converge.runner.ts";
import {
    authorityRefusal,
    runArrive,
    runDefer,
    runInherit,
    runRaise,
    runRecord,
    runRelocate,
    runRetire,
    runRoster,
    runRetract,
    runSuccessor,
} from "../runners/venue.runner.ts";

const EXCLUSIVE_OPERATIONS: readonly string[] = [
    "--raise",
    "--relocate",
    "--retire",
    "--inherit",
    "--roster",
    "--agenda",
    "--append",
    "--repair",
    "--extract",
    "--fixture",
    "--member",
    "--role",
    "--half",
    "--task",
    "--mark",
    "--transition",
    "--index",
    "--record",
    "--retract",
    "--successor",
    "--defer",
    "--arrive",
    "--model",
    "--finding",
    "--distribute",
    "--barrier",
];

const COMPOSABLE_OPERATIONS: readonly string[] = [
    "--item",
    "--field",
    "--read",
    "--sign",
    "--closes",
    "--withdraw",
    "--compress",
];

const SELF_REHEARSING: Readonly<Record<string, string>> = {
    "--closes":
        "runs the closure's own refusals, computes the outcome, and reports what WOULD BE removed rather than removing it — so a dry run of this act shows what it would refuse as well as what it would write",
    "--withdraw":
        "runs the withdrawal's own refusals — the author test and the extraction reference — and reports which item WOULD be removed rather than removing it",
    "--compress":
        "resolves the field, takes a witness read, and reports which field WOULD go before any extraction happens, which is the whole reason a party looks before compressing",
    "--retire":
        "computes the retirement, its citations and its live set, and reports the outcome under a would-be label rather than moving anything",
    "--model": "reaches its own act and returns rehearsed from inside it, having run every refusal the raise runs",
    "--finding": "reaches its own act and returns rehearsed from inside it, having run every refusal the raise runs",
    "--distribute": "reaches its own act and returns rehearsed from inside it, having run every refusal the raise runs",
};

const OPERANDS: readonly string[] = [
    "--agent",
    "--because",
    "--body",
    "--body-file",
    "--discharge",
    "--establishes",
    "--establishes-file",
    "--extracted",
    "--file",
    "--help",
    "--item-file",
    "--kind",
    "--lead",
    "--no-wait",
    "--observer",
    "--planned",
    "--ref",
    "--seat",
    "--seats",
    "--statement",
    "--to",
    "--value",
];

const KNOWN_ARGUMENTS: readonly string[] = [
    ...EXCLUSIVE_OPERATIONS,
    ...COMPOSABLE_OPERATIONS,
    ...OPERANDS,
    NO_FIX_FLAG,
];

const VENUE_ACTS: ReadonlyArray<readonly [string, string]> = [
    ["--raise", "raising a successor venue"],
    ["--relocate", "relocating a venue to the venue root"],
    ["--retire", "retiring a spent distribution into the planning archive"],
    ["--inherit", "recomputing a venue's inherited section"],
    ["--roster", "resolving a venue's roster from the active seats"],
    ["--defer", "deferring a question out of a venue"],
    ["--retract", "retracting a deferred question"],
    ["--arrive", "carrying deferred clauses into a successor"],
    ["--agenda", "writing a row into the agenda"],
];
import { venueFieldsFrom } from "../validators/venue.validator.ts";
import { boardRecords } from "../analyzers/board.analyzer.ts";

const REPO_ROOT = projectRoot();

const CHANGELOG = historyPath();

const AGENDA = surfacePath("agenda");

const NO_WAIT_FLAG = "--no-wait";

const DEFAULT_TARGET = surfacePath("board");
const SLOT_EXPIRY_MS = 3600000;
const POLL_MS = 1000;

const FLAG_LEAD = "--";

function argumentValue(flag: string): string | null {
    const at = process.argv.indexOf(flag);
    if (at === -1) return null;

    const value = process.argv[at + 1];
    if (value === undefined || value.startsWith(FLAG_LEAD)) return null;
    return value;
}

function joinedValue(flag: string): string | null {
    const at = process.argv.indexOf(flag);
    if (at === -1) return null;

    const held: string[] = [];
    for (let index = at + 1; index < process.argv.length; index += 1) {
        const token = process.argv[index] ?? "";
        if (token.startsWith(FLAG_LEAD)) break;
        held.push(token);
    }

    return held.length === 0 ? null : held.join(" ");
}

function operandTokens(flag: string): number {
    const at = process.argv.indexOf(flag);
    if (at === -1) return 0;

    let held = 0;
    for (let index = at + 1; index < process.argv.length; index += 1) {
        if ((process.argv[index] ?? "").startsWith(FLAG_LEAD)) break;
        held += 1;
    }

    return held;
}

function modifiedAt(path: string): number | null {
    if (!existsSync(path)) return null;
    return statSync(path).mtimeMs;
}

function release(id: string): void {
    releaseWaiter(REPO_ROOT, id, Date.now());
}

async function sleep(ms: number): Promise<void> {
    await new Promise<void>((done) => {
        setTimeout(done, ms);
    });
}

function emit(outcome: { message: string; code: number; excised: readonly string[] }, label: string): number {
    process.stdout.write(outcome.message);
    for (const excerpt of outcome.excised) process.stdout.write(`  ${label}  ${excerpt}\n`);
    return outcome.code;
}

function siblingSurfaces(excluding: string): string[] {
    const out: string[] = [];
    const board = resolve(REPO_ROOT, DEFAULT_TARGET);

    if (board !== excluding && existsSync(board)) out.push(readSurface(board, "utf8"));

    const root = resolve(REPO_ROOT, surfacePrefix());
    if (!existsSync(root)) return out;

    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(BLOCKING_SUFFIX)) continue;

        const venue = resolve(root, entry.name);
        if (venue === excluding) continue;
        out.push(readSurface(venue, "utf8"));
    }

    for (const source of archivedSurfaces()) out.push(source);

    return out;
}

function selfRehearsingForms(): string[] {
    return Object.keys(SELF_REHEARSING);
}

function archivedSurfaces(): string[] {
    const out: string[] = [];
    const root = resolve(REPO_ROOT, surfacePath("venue_archive"));
    if (!existsSync(root)) return out;

    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(BLOCKING_SUFFIX)) continue;
        out.push(readSurface(resolve(root, entry.name), "utf8"));
    }

    return out;
}

function resolveTarget(named: string): string {
    if (existsSync(resolve(REPO_ROOT, named))) return named;

    const prefix = surfacePrefix();
    const prefixed = prefix.length === 0 ? named : `${prefix}/${named}`;
    return existsSync(resolve(REPO_ROOT, prefixed)) ? prefixed : named;
}

function alreadyGone(absolute: string, marker: string): boolean {
    if (!isItemId(marker)) return false;
    if (!existsSync(absolute)) return true;

    const spans = itemSpans(readSurface(absolute, "utf8"));
    return !spans.some((span) => span.key === marker);
}

function heldReaders(absolute: string, closes: string): string[] {
    if (!existsSync(absolute)) return [];

    const source = readSurface(absolute, "utf8");
    const span = itemSpans(source).find((entry) => entry.key === closes);
    if (span === undefined) return [];

    const marker = source.split("\n")[span.from] ?? "";
    if (!marker.includes(READ_FIELD)) return [];

    const board = resolve(REPO_ROOT, DEFAULT_TARGET);
    const index = resolve(REPO_ROOT, surfacePath("agent_index"));
    const bound = existsSync(index) ? readSurface(index, "utf8") : "";
    const active = existsSync(board) ? activeSeats(readSurface(board, "utf8"), bound) : [];

    return unmarkedReaders(marker, span.to, active, authorOf(closes));
}

function closure(target: string, absolute: string, closes: string): number {
    if (alreadyGone(absolute, closes)) {
        process.stdout.write(
            `SETTLED  ${closes} is no longer on ${target}: the state this closure asked for already holds, so it ` +
                "is a no-op rather than a refusal. THIS CALL OBSERVED THE ITEM ABSENT AND OBSERVED NOTHING ELSE — it " +
                "cannot say who removed it or by which path, because both happened before it ran, so a clause here " +
                "naming a cause would be a claim this emitter has no operand for. A message states what the CALL FOUND " +
                "and never what PRODUCED it. Whoever removed it holds a receipt naming themselves; that receipt is the " +
                "operand, and this line is not\n",
        );
        return 0;
    }

    const held = heldReaders(absolute, closes);
    if (held.length > 0) {
        process.stdout.write(
            `REFUSED  ${closes} carries a per-recipient READ LEDGER and ${held.join(", ")} has not marked, so closing it ` +
                "now would deliver it to the closer and destroy it for every other party it names. AN ITEM IS REMOVED BY " +
                "ITS HANDLER AND GATED ON ITS READER SET, WHICH MAKES ANY ADDRESSEE ABLE TO CLOSE IT — correct while an " +
                "item asks for one act, and wrong for a change every named seat must hold, where the fastest reader would " +
                "leave a surface showing a handled item, no record of who read it, and parties running against something " +
                "they were never sent. Mark your own letter; the item drains when its LAST reader marks rather than its " +
                "first. The set is those NAMED AT ISSUE intersected with those ACTIVE now, because a departed party cannot " +
                "act and a party that arrived afterwards loads the surface fresh and was never sent the change\n",
        );
        return 2;
    }

    const ref = argumentValue("--ref");
    const outcome = runClosure({
        absolute,
        archive: resolve(REPO_ROOT, CHANGELOG),
        index: resolve(REPO_ROOT, surfacePath("agent_index")),
        closes,
        agent: argumentValue("--agent"),
        ref,
    });

    if (outcome.refusal !== null) {
        process.stdout.write(outcome.refusal);
        return 2;
    }

    const heal = healRequested(process.argv, NO_FIX_FLAG);
    const label = heal ? outcome.label : `would be ${outcome.label}`;

    if (ref === EMPTY_EXTRACTION) {
        const archive = resolve(REPO_ROOT, CHANGELOG);
        process.stdout.write(
            "DECLARING NOTHING DURABLE ASSERTS THE NEGATION OF THE HELD CLASS SET, so the set is published here exactly " +
                "as it is published to an author about to ADD to it. THE TWO ACTS ASK ONE QUESTION FROM OPPOSITE SIDES AND " +
                "ONLY ONE WAS ANSWERED: an author shown the filed classes who files a near-duplicate has made a decision a " +
                "peer can contest, and an author shown nothing who declares no class covers this item has made an " +
                "oversight nobody can see — and that one is the irreversible half, whose error destroys the evidence a " +
                "later reader would correct it from. The honest alternative is a LOOKUP rather than a judgement: search " +
                "the headings, open the one that fits, confirm its population says what this item said. Measured at two " +
                "reads, twice, against a permanent assertion only a party searching for an absence could ever " +
                `contradict.\n${existsSync(archive) ? filedNotice(readSurface(archive, "utf8")) : ""}`,
        );
    }

    if (outcome.acknowledged) {
        return removal(target, absolute, closes, outcome.author, ACKNOWLEDGED, heal, label);
    }

    return removal(target, absolute, closes, outcome.author, ref, heal, label);
}

const DIRECTIVES_SECTION = "DIRECTIVES";

function isBoundaryLine(trimmed: string): boolean {
    return trimmed.startsWith("#") || trimmed.startsWith("═");
}

function discharge(target: string, absolute: string, clause: string): number {
    if (!target.endsWith(BLOCKING_SUFFIX)) {
        process.stdout.write(
            `REFUSED  no discharge on ${target}: a DIRECTIVE is a content class a prioritised discussion admits, ` +
                "so a surface that declares no directives section has nothing this operation can end\n",
        );
        return 2;
    }

    const ref = argumentValue("--ref");
    if (ref === null || ref.length === 0) {
        process.stdout.write(
            "REFUSED  a discharge names where its extraction landed: removal is auto-EXTRACTION-then-removal or it " +
                "is data loss, and a bare declaration cannot be falsified by anybody but its author. Pass --ref\n",
        );
        return 2;
    }

    const separator = ref.indexOf(":");
    const kind = separator === -1 ? "" : ref.slice(0, separator).trim();
    const member = separator === -1 ? "" : ref.slice(separator + 1).trim();

    if (kind !== EXTRACTION_KIND || member.length === 0) {
        process.stdout.write(
            `REFUSED  ${ref} is not a typed reference this operation resolves: a reference names its KIND before its ` +
                "member so the resolver is DISPATCHED rather than guessed, and the kind set is closed because an " +
                "unknown kind resolves vacuously and reads exactly like one that passed. An extraction lands in the " +
                "history accumulator, so the kind is changelog and the member is the heading it landed under\n",
        );
        return 2;
    }

    const archive = resolve(REPO_ROOT, CHANGELOG);
    if (!existsSync(archive) || !readSurface(archive, "utf8").includes(member)) {
        process.stdout.write(
            `REFUSED  the extraction reference ${ref} does not resolve, so this discharge would destroy the only ` +
                "durable record of what the directive asked for. The check decides PRESENCE and never fidelity, " +
                "because an extraction is a compression rather than a copy\n",
        );
        return 2;
    }

    const before = readSurface(absolute, "utf8");
    const lines = before.split("\n");
    const kept: string[] = [];
    let inside = false;
    let removed = 0;
    let dropping = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (isBoundaryLine(trimmed) && trimmed.includes(DIRECTIVES_SECTION)) {
            inside = true;
            kept.push(line);
            continue;
        }
        if (inside && isBoundaryLine(trimmed)) inside = false;

        if (inside && trimmed.startsWith("- ") && trimmed.includes(clause)) {
            removed += 1;
            dropping = true;
            continue;
        }

        if (dropping) {
            const continues = line.startsWith(" ") && trimmed.length > 0 && !trimmed.startsWith("- ");
            if (continues) continue;
            dropping = false;
        }

        kept.push(line);
    }

    if (removed === 0) {
        process.stdout.write(
            `SETTLED  no live directive on ${target} carries "${clause}": the state this discharge asked for ` +
                "already holds, so it is a no-op rather than a refusal\n",
        );
        return 0;
    }

    const witness = readSurface(absolute, "utf8");
    if (witness !== before) {
        process.stdout.write(
            `CONTENDED  ${target} moved between this read and its write, so the discharge is abandoned rather than ` +
                "written over a concurrent edit — re-read and repeat it\n",
        );
        return 2;
    }

    writeSurface(absolute, kept.join("\n"));
    process.stdout.write(
        `DISCHARGED  the directive carrying "${clause}" is removed from ${target}, its extraction resolving at ` +
            `${ref}. A directive carries retention DISCHARGED rather than the accumulating retention of the surface ` +
            "holding it: it is current from the moment it is written and ENDED by the completion of what it asked " +
            "for, so archiving one would preserve a standing order as though it were a claim somebody made\n",
    );
    return 0;
}

function removal(
    target: string,
    absolute: string,
    marker: string,
    agent: string | null,
    extracted: string | null,
    heal: boolean,
    label: string,
): number {
    return emit(
        runCompression({
            target,
            absolute,
            marker,
            agent,
            extracted,
            archive: resolve(REPO_ROOT, CHANGELOG),
            changelog: CHANGELOG,
            heal,
        }),
        label,
    );
}

function withdrawal(target: string, absolute: string, id: string): number {
    if (!isItemId(id)) {
        process.stdout.write(`REFUSED  ${id} is not an item id; --withdraw takes the id an item's own fence carries\n`);
        return 2;
    }

    if (alreadyGone(absolute, id)) {
        process.stdout.write(`SETTLED  ${id} is no longer on ${target}; nothing to withdraw\n`);
        return 0;
    }

    const caller = argumentValue("--agent") ?? "";
    const author = authorOf(id);
    if (author !== caller) {
        process.stdout.write(
            `REFUSED  ${id} is written by ${author}, not by ${caller}. A WITHDRAWAL IS AN AUTHOR TAKING BACK ITS OWN ` +
                "REQUEST once the request is moot — the author is the one party that knows the request is " +
                "moot, which is the same reason a handler removes what it handled. An item addressed to you closes with " +
                "--closes once you handle it; an item neither written by you nor addressed to you is not yours to remove\n",
        );
        return 2;
    }

    const ref = argumentValue("--ref");
    const typed = ref === EMPTY_EXTRACTION || (ref ?? "").startsWith(`${EXTRACTION_KIND}:`);
    if (ref === null || !typed) {
        process.stdout.write(
            `REFUSED  --withdraw requires --ref naming where the item's durable half landed: ${EXTRACTION_KIND}:<heading>, ` +
                `or ${EMPTY_EXTRACTION} where it carries nothing durable. A withdrawn item leaves the board the same way a ` +
                "handled one does, so extraction precedes removal on both paths\n",
        );
        return 2;
    }

    const heal = healRequested(process.argv, NO_FIX_FLAG);
    return removal(target, absolute, id, caller, ref, heal, heal ? `withdrawn by ${caller}` : `would be withdrawn by ${caller}`);
}

function compress(target: string, absolute: string, marker: string): number {
    if (alreadyGone(absolute, marker)) {
        process.stdout.write(`SETTLED  ${marker} is no longer on ${target}; nothing to remove\n`);
        return 0;
    }

    const heal = healRequested(process.argv, NO_FIX_FLAG);
    return removal(
        target,
        absolute,
        marker,
        argumentValue("--agent"),
        argumentValue("--extracted"),
        heal,
        heal ? "removed" : "would remove",
    );
}

function barrier(): void {
    const outcome = runBarrier(REPO_ROOT, resolve(REPO_ROOT, DEFAULT_TARGET), Date.now());
    process.stdout.write(outcome.message);
    process.exit(outcome.code);
}

function deliverSince(absolute: string, named: string): void {
    process.stdout.write(changesSince(REPO_ROOT, absolute, argumentValue("--agent") ?? "", named));
}

const ECHOED_FIELDS = ["Status", "Flags"];

function workMovedPast(caller: string): boolean {
    const since = readFieldMark(REPO_ROOT, caller);

    for (const surface of [DEFAULT_TARGET, ...openVenues(surfaceEntries(REPO_ROOT), VENUE_ARCHIVE, BLOCKING_SUFFIX)]) {
        const absolute = resolve(REPO_ROOT, surface);
        if (!existsSync(absolute)) continue;

        const source = readSurface(absolute, "utf8");
        for (const span of itemSpans(source)) {
            if (authorOf(span.key) !== caller) continue;
            if (stampOf(source.split("\n")[span.from] ?? "") > since) return true;
        }
    }

    return false;
}

function ownClaimEcho(caller: string): string {
    if (!workMovedPast(caller)) return "";

    const board = resolve(REPO_ROOT, DEFAULT_TARGET);
    if (!existsSync(board)) return "";

    const record = boardRecords(readSurface(board, "utf8")).find(
        (held) => held.kind === "agent" && held.label.endsWith(` ${caller}`),
    );
    if (record === undefined) {
        return `YOUR CLAIM  no record on ${DEFAULT_TARGET} carries agent ${caller}, so nothing you write here is addressable to you and no peer can close an item you handled\n`;
    }

    const lines = ECHOED_FIELDS.map((field) => {
        const value = record.fields.get(field);
        if (value === undefined) return `  ${field}: ABSENT — the board declares no ${field} for this seat`;
        return `  ${field}: ${value.length > 200 ? `${value.slice(0, 200)}…` : value}`;
    });

    return `YOUR CLAIM ON ${DEFAULT_TARGET}, echoed because you just wrote elsewhere and nothing else prompts a seat to re-read its own record:\n${lines.join("\n")}\n  A board field is CURRENT TRUTH, so one describing work you have moved past manufactures a false belief in every seat that reads the board whole — which is every seat, every round. Correct it in place, or it stands.\n`;
}

function heldOn(source: string, active: readonly string[], span: ItemSpan): string[] {
    const marker = source.split("\n")[span.from] ?? "";
    if (!marker.includes(READ_FIELD)) return [];

    return unmarkedReaders(marker, span.to, active, authorOf(span.key));
}

function ownDischargeEcho(caller: string): string {
    const board = resolve(REPO_ROOT, DEFAULT_TARGET);
    if (!existsSync(board)) return "";

    const source = readSurface(board, "utf8");
    const index = resolve(REPO_ROOT, surfacePath("agent_index"));
    const bound = existsSync(index) ? readSurface(index, "utf8") : "";
    const active = activeSeats(source, bound);

    const owed: string[] = [];
    const closable: string[] = [];

    for (const span of itemSpans(source)) {
        if (authorOf(span.key) === caller) continue;

        const named = span.to.length === 0 ? active : span.to;
        if (!named.includes(caller)) continue;

        const held = heldOn(source, active, span);
        if (held.includes(caller)) owed.push(span.key);
        else if (held.length === 0) closable.push(span.key);
    }

    if (owed.length === 0 && closable.length === 0) return "";

    const lines = [
        owed.length === 0 ? "" : `  AWAITING YOUR MARK: ${owed.join(", ")}`,
        closable.length === 0 ? "" : `  CLOSABLE BY YOU NOW: ${closable.join(", ")}`,
    ].filter((line) => line.length > 0);

    return (
        "ITEMS WHOSE DISCHARGE YOU HOLD, echoed because the obligation to drain sits on the party that WROTE an item and " +
        "the permission to remove sits on the party it was written TO, so a seat is obliged to clear what it may not " +
        "touch and a peer holds that discharge with no signal that it does:\n" +
        `${lines.join("\n")}\n` +
        "  This is the CLOSURE'S OWN PREDICATE quantified over the board rather than over one item, so it cannot tell you " +
        "an item is yours to close and then be refused — a second derivation of one eligibility would disagree the moment " +
        "either moved, silently, in the direction that wastes the act. Extraction still precedes removal, and an item " +
        "standing here is a peer's field it cannot drain.\n"
    );
}

function openVenueEcho(caller: string, target: string): string {
    const open = openVenues(surfaceEntries(REPO_ROOT), VENUE_ARCHIVE, BLOCKING_SUFFIX);

    if (open.length === 0) return "";

    const lines = open.map((venue) => {
        if (venue === target) return `  ${venue} — the surface you are writing to`;

        const source = readSurface(resolve(REPO_ROOT, venue), "utf8");
        const unread = source.split("\n").find((line) => line.trim().startsWith(NOT_READ_FIELD));
        const held = unread === undefined ? [] : letters(unread, NOT_READ_FIELD);

        return `  ${venue} — ${held.includes(caller) ? "YOU ARE UNMARKED ON ITS ROSTER" : "you are marked"}`;
    });

    return (
        "THE OPEN DISCUSSION, echoed because a seat cannot NAME a surface it does not know exists — the wait reports what " +
        "changed on the surface it is GIVEN, so a seat unaware of a venue receives none of its diff and has one place left " +
        "where peers are certain to read it, which is the current-truth surface whose lifetime forbids holding an " +
        "argument. Accumulation there is the only addressable surface a seat can be sure of rather than a preference for " +
        `the wrong one:\n${lines.join("\n")}\n` +
        "  This is DERIVED from the active tree and the roster on each file, so it carries no second answer to a question " +
        "something else already answers and there is nothing here for anybody to maintain.\n"
    );
}

const GATING_FIELDS = ["Needs", "Durable"];

function ownVenueEcho(caller: string, absolute: string, target: string): string {
    if (!existsSync(absolute)) return "";

    const record = boardRecords(readSurface(absolute, "utf8")).find(
        (held) => held.kind === "agent" && held.label.endsWith(` ${caller}`),
    );
    if (record === undefined) {
        return `YOUR RECORD ON ${target}  no record carries agent ${caller}, so this venue holds no Needs, no Durable and no signature for you — and the convergence walk quantifies over all three\n`;
    }

    const lines = GATING_FIELDS.map((field) => {
        const value = record.fields.get(field);
        if (value === undefined) return `  ${field}: ABSENT — the record declares no ${field} field`;
        if (value.trim().length === 0)
            return `  ${field}: EMPTY — which states nothing, where the absent marker states a decision`;
        return `  ${field}: ${value.length > 160 ? `${value.slice(0, 160)}…` : value}`;
    });

    return `YOUR RECORD ON ${target}, echoed because these fields GATE THE CLOSURE of this venue — its move whole into the archive — and nothing else prompts a seat to re-read them:\n${lines.join("\n")}\n  The convergence walk reads them for every active seat, so one describing work you have moved past holds the venue or clears it wrongly — and every stale one found here was found by a peer or by a refusal rather than by its owner.\n`;
}

function venueFieldLine(): string {
    const template = resolve(REPO_ROOT, VENUE_TEMPLATE);
    if (!existsSync(template)) {
        return `  The venue field set is unreadable: ${VENUE_TEMPLATE} resolves to nothing, so this surface can state no schema rather than stating a stale one.\n\n`;
    }

    const fields = venueFieldsFrom(readSurface(template, "utf8"));
    if (fields.length === 0) {
        return `  The venue template at ${VENUE_TEMPLATE} declares no record fields, so a venue raised from it accepts no item.\n\n`;
    }

    return `  Venue record fields, read from ${VENUE_TEMPLATE} on this invocation: ${fields.join(", ")}\n\n`;
}

function help(): void {
    process.stdout.write(HELP_TEXT);
    process.stdout.write(venueFieldLine());
    process.exit(0);
}

const TRAILING = new Set([" ", "\t", "\n", "\r"]);

function refuseFixedTarget(form: string, surface: string): void {
    if (!process.argv.includes("--file")) return;

    process.stdout.write(
        `REFUSED  ${form} writes ${surface} and nothing else, so the target flag does not apply to it — and a flag SILENTLY ` +
            "IGNORED cannot be told apart from one honoured, which means an invocation naming another surface lands on this " +
            "one, reports success, and shows only in the diff. That is not a documentation gap: every other form on this " +
            "entry point takes the target flag, so a caller passing it is applying the one flag the tool has for exactly " +
            "this. Drop the flag, or use the form whose target it selects\n",
    );
    process.exit(2);
}

const STDIN_OPERAND = "-";

function refuseForgedBoundary(body: string, flag: string): void {
    const forged = forgedBoundaries(body);
    if (forged.length === 0) return;

    const named = forged.map((entry) => `line ${String(entry.line)}: ${entry.text}`).join("; ");

    process.stdout.write(
        `REFUSED  ${flag} carries ${String(forged.length)} line(s) opening a BOUNDARY MARKER — ${named}. A BODY CANNOT ` +
            "CONTAIN A BOUNDARY BECAUSE BOUNDARIES ARE WHAT MAKE A SPAN REMOVABLE: one such line inverts or forges the " +
            "span state for everything after it, so a record's own closing marker reads as an opening, the next record's " +
            "opening reads as a closing, and every span derivation downstream shifts by one — and a PAIR of them is worse " +
            "rather than better, because a well-formed forged span inside another writer's record passes the pair check on " +
            "an even count. The refusal is the repair rather than a rewrite or an escape, since folding the line would " +
            "write something its author did not compose. A body needing to SHOW a marker writes it inline in a sentence, " +
            "which is what every position discussing one has done\n",
    );
    process.exit(2);
}

function textOperand(inlineFlag: string, fileFlag: string): string | null {
    const path = argumentValue(fileFlag);
    if (path === null) {
        const inline = joinedValue(inlineFlag);
        if (inline === null) return null;

        if (inline === STDIN_OPERAND) {
            const piped = readSurface(0, "utf8");
            if (piped.trim().length === 0) {
                process.stdout.write(
                    `REFUSED  ${inlineFlag} ${STDIN_OPERAND} reads the body from standard input and nothing arrived there. ` +
                        "A body handed through a pipe is governed by no quoting rule, which is why this path exists: an " +
                        "apostrophe ends a single-quoted argument, so a caller writing prose is otherwise pushed to stage it " +
                        "in a file and read it back, which is two invocations for one write and a file nobody wanted\n",
                );
                return null;
            }
            refuseForgedBoundary(piped, `${inlineFlag} ${STDIN_OPERAND}`);
            return piped;
        }

        process.stdout.write(
            `REFUSED  a BODY is never passed as an argument. ${inlineFlag} takes ${STDIN_OPERAND} with the text piped ` +
                `in, or ${fileFlag} naming a file this form reads. THE SPELLING IS REFUSED RATHER THAN THE CORRUPTION ` +
                "DETECTED, because the corruption cannot be detected: an apostrophe ends a quoted argument and the body " +
                "arrives in pieces, which an arity check catches — but a backtick or a dollar sign is SUBSTITUTED before " +
                "this process exists, so the text is executed or replaced and the body arrives as ONE well-formed " +
                "argument with content silently removed and no record of what it was. Every property a form can measure " +
                "is satisfied. So the only paths immune are the ones where the bytes never pass through interpolation at " +
                "all, and both already exist here. On an append-only surface the corruption is PERMANENT and the only " +
                `remedy is a second position restating the first. A FIELD value keeps its inline spelling — a field is a ` +
                "short carrier-side value and a body is payload, which is the same line that decides what carries a " +
                `schema. Tokens handed to ${inlineFlag}: ${String(operandTokens(inlineFlag))}\n`,
        );
        process.exit(2);
    }

    const from = resolve(REPO_ROOT, path);
    if (!existsSync(from)) {
        process.stdout.write(
            `REFUSED  ${fileFlag} names ${path} and nothing resolves there. THE FILE FORM EXISTS BECAUSE THE INLINE ONE ` +
                "CANNOT CARRY EVERY BODY: an operand assembled out of shell words is split by what the body CONTAINS — a " +
                "blank line, a quote — so the text arrives short, the form writes exactly what it was handed, and the write " +
                "reports success. Reading the operand from a file removes that site rather than detecting it, which is the " +
                "repair for a failure that can be made impossible instead of observed\n",
        );
        process.exit(2);
    }

    const raw = readSurface(from, "utf8");
    let end = raw.length;
    while (end > 0 && TRAILING.has(raw.charAt(end - 1))) end -= 1;

    const body = raw.slice(0, end);
    refuseForgedBoundary(body, fileFlag);
    return body;
}

async function main(): Promise<void> {
    const named = argumentValue("--file") ?? DEFAULT_TARGET;
    const target = resolveTarget(named);
    const absolute = resolve(REPO_ROOT, target);

    if (process.argv.includes("--help")) help();

    const caller = argumentValue("--agent");
    if (caller === null) {
        process.stdout.write(AGENT_REQUIRED_TEXT);
        process.exit(2);
    }

    const unknown = unknownArguments(process.argv.slice(2), KNOWN_ARGUMENTS);
    if (unknown.length > 0) {
        process.stdout.write(
            `REFUSED  ${unknown.join(", ")} ${unknown.length > 1 ? "are" : "is"} not an argument this tool reads. AN ` +
                "UNRECOGNISED ARGUMENT WAS ACCEPTED SILENTLY AND THE CALL ANSWERED THE WAIT UNCHANGED, so a caller could " +
                "not tell an UNWIRED form from a form that ran and did nothing — no receipt, no refusal, no effect, clean " +
                "exit. That state cost three seats a position each: one read a runner and concluded something swallowed a " +
                "recognised operation, one read a parser and answered the adjacent question, and one reasoned about a path " +
                "its own call never entered. A misspelling and an unwired form now both name themselves here. Nothing was " +
                `written. Declared: ${KNOWN_ARGUMENTS.join(" ")}\n`,
        );
        process.exit(2);
    }

    releaseAgent(REPO_ROOT, caller, Date.now());

    const requestedFlags = [...EXCLUSIVE_OPERATIONS, ...COMPOSABLE_OPERATIONS].filter((flag) =>
        process.argv.includes(flag),
    );
    const exclusive = unshareableOperations(requestedFlags, EXCLUSIVE_OPERATIONS);

    if (exclusive.length > 0) {
        process.stdout.write(
            `REFUSED  ${exclusive.join(" and ")} ${exclusive.length > 1 ? "are" : "is"} EXCLUSIVE and this call also ` +
                `requests ${requestedFlags.filter((flag) => !exclusive.includes(flag)).join(", ") || "another exclusive form"}. ` +
                "AN INVOCATION IS ONE UNIT AND AN EXCLUSIVE FORM RETURNS THE MOMENT IT COMPLETES, so a call combining one " +
                "with anything else performs the first and DISCARDS the rest while reporting success — which is worse than " +
                "the opposite ordering, because a non-zero exit on a landed write makes a caller re-read and a zero exit on " +
                "a dropped write makes a caller move on. The tell is a receipt naming fewer operations than the call " +
                "requested, and that is derivable here rather than after the fact. Nothing was written; invoke them " +
                "separately\n",
        );
        process.exit(2);
    }

    if (process.argv.includes("--barrier")) barrier();

    for (const [flag, act] of VENUE_ACTS) {
        if (!process.argv.includes(flag)) continue;

        const refused = authorityRefusal(REPO_ROOT, caller, act);
        if (refused === null) break;

        process.stdout.write(refused);
        process.exit(2);
    }

    if (writesNothing(process.argv, NO_FIX_FLAG, selfRehearsingForms())) {
        process.stdout.write(
            "REHEARSED  every operand of every requested operation was checked and NOTHING WAS WRITTEN. THE FLAG WAS " +
                "HONOURED BY ONE ACT AND SILENTLY IGNORED BY EVERY OTHER, which is the direction that costs: a caller " +
                "promised a dry run got a real write, on surfaces whose declared lifetime forbids removing what landed. " +
                "A flag a form DOCUMENTS and only some of its paths read is worse than one it does not offer, because the " +
                "caller reads the documentation and the form reports success. WHAT THIS DOES NOT CLAIM: that each act's " +
                "OWN refusals ran — the operand checks above cover every requested operation and an act's internal " +
                "refusal is reached only by performing it, so the bound is stated rather than left for a caller to " +
                "discover\n",
        );
        process.exit(0);
    }

    process.stdout.write(raiseLocalSurfaces(REPO_ROOT));

    const claiming = process.argv.includes("--index");
    const seats = runSeats({
        absolute: resolve(REPO_ROOT, surfacePath("agent_index")),
        repoRoot: REPO_ROOT,
        caller,
        process: callerProcess(Date.now()),
        claiming,
    });
    process.stdout.write(seats.message);
    if (seats.code !== 0) process.exit(seats.code);

    if (process.argv.includes("--raise")) {
        const named = joinedValue("--seats") ?? "";
        const seats = named
            .split(",")
            .flatMap((part) => part.split(" "))
            .map((part) => part.trim())
            .filter((part) => part.length > 0);

        const outcome = runRaise({ repoRoot: REPO_ROOT, declared: argumentValue("--raise"), seats });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const relocated = argumentValue("--relocate");
    if (relocated !== null) {
        const outcome = runRelocate({ repoRoot: REPO_ROOT, name: relocated });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const retired = argumentValue("--retire");
    if (retired !== null) {
        const planning = surfacePath("planning");
        const declared = declaredDistributions([`${planning}/${retired}`], (target) =>
            existsSync(resolve(REPO_ROOT, target)) ? readSurface(resolve(REPO_ROOT, target), "utf8") : "",
        );

        const frozen = resolve(REPO_ROOT, surfacePath("archive"));
        const citedBy = existsSync(frozen)
            ? readdirSync(frozen, { recursive: true, encoding: "utf8" })
                  .map((entry) => resolve(frozen, entry))
                  .filter((entry) => statSync(entry).isFile())
                  .filter((entry) => readSurface(entry, "utf8").includes(`${planning}/${retired}`))
            : [];

        const outcome = runRetire({
            repoRoot: REPO_ROOT,
            name: retired,
            declares: declared[0]?.declares ?? "",
            live: openVenues(surfaceEntries(REPO_ROOT), VENUE_ARCHIVE, BLOCKING_SUFFIX),
            citedBy,
            heal: healRequested(process.argv, NO_FIX_FLAG),
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const roster = argumentValue("--roster");
    if (roster !== null) {
        const outcome = runRoster({ repoRoot: REPO_ROOT, name: roster });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const inherits = argumentValue("--inherit");
    if (inherits !== null) {
        const outcome = runInherit({ repoRoot: REPO_ROOT, name: inherits });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const invariant = argumentValue("--agenda");
    if (invariant !== null) {
        refuseFixedTarget("--agenda", AGENDA);
        const establishes = textOperand("--establishes", "--establishes-file");
        if (establishes === null) {
            process.stdout.write(
                "REFUSED  --agenda names the invariant and --establishes says what that venue must establish; a row " +
                    "missing the second reads as a planned invariant nobody can act on. THERE IS NO STATE OPERAND: a " +
                    "row's state is an OBSERVATION two directory listings already answer, so it is computed on every " +
                    "run rather than supplied here, and a form accepting one would take a value the next render " +
                    "overwrites\n",
            );
            process.exit(2);
        }

        const outcome = runAgendaRow({
            plan: resolve(REPO_ROOT, AGENDA_PLAN),
            invariant,
            establishes,
            ordinal: argumentValue("--planned") ?? "—",
            note: joinedValue("--because") ?? "",
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const extend = argumentValue("--append");
    if (extend !== null) {
        refuseFixedTarget("--append", CHANGELOG);
        const lead = argumentValue("--lead");
        const body = textOperand("--body", "--body-file");
        if (lead === null || body === null) {
            process.stdout.write(
                "REFUSED  --append names the entry, --lead names which declared clause of it to extend, and --body or " +
                    "--body-file carries what is added; an append with no lead would place text in an entry's prose, which " +
                    "is the half no walk reads and the half its author wrote whole\n",
            );
            process.exit(2);
        }

        const outcome = runExtend({ archive: resolve(REPO_ROOT, CHANGELOG), heading: extend, lead, body });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const repaired = argumentValue("--repair");
    if (repaired !== null) {
        refuseFixedTarget("--repair", CHANGELOG);
        const outcome = runRepair({ archive: resolve(REPO_ROOT, CHANGELOG), heading: repaired });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const heading = argumentValue("--extract");
    if (heading !== null) {
        refuseFixedTarget("--extract", CHANGELOG);
        const body = textOperand("--body", "--body-file");
        if (body === null) {
            process.stdout.write(
                "REFUSED  --extract names the class heading a closure will cite and --body carries the entry beneath it; a " +
                    "heading with no body is a citation target that resolves to nothing, which is the state a reference " +
                    "resolving vacuously already describes\n",
            );
            process.exit(2);
        }

        const outcome = runEntry({ archive: resolve(REPO_ROOT, CHANGELOG), heading, body });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const pair = argumentValue("--fixture");
    if (pair !== null) {
        const body = textOperand("--body", "--body-file");
        if (body === null) {
            process.stdout.write(
                "REFUSED  --fixture names the rule-and-kind pair an entry proves and --body or --body-file carries its two " +
                    "halves — a fired sample naming its path and its text, and an accepted one. THE CONTENT IS THE " +
                    "AUTHOR'S JUDGEMENT AND THE PLACEMENT IS NOT: this form supplies the entry's position in the declared " +
                    "set and the compare-and-swap against a concurrent write, and it cannot know what violates a kind or " +
                    "what a correct member of its population looks like\n",
            );
            process.exit(2);
        }

        const outcome = runFixture({
            target,
            absolute,
            pair,
            body,
            witness: existsSync(absolute) ? readSurface(absolute, "utf8") : "",
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const member = argumentValue("--member");
    if (member !== null) {
        const body = textOperand("--body", "--body-file");
        if (body === null) {
            process.stdout.write(
                "REFUSED  --member names the heading a citation resolves a member by and --body or --body-file carries the " +
                    "member beneath it; a heading with no body is a citation target resolving to nothing, and on a surface " +
                    "whose members are MEASUREMENTS an empty one reads as a fact somebody took and did not state\n",
            );
            process.exit(2);
        }

        const outcome = runMember({ target, absolute, heading: member, body });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const concern = joinedValue("--role");
    if (concern !== null) {
        refuseFixedTarget("--role", surfacePath("roles"));

        const outcome = runRole({
            absolute: resolve(REPO_ROOT, `${surfacePath("roles")}/${concern.trim()}.${caller.toLowerCase()}.role.md`),
            template: resolve(REPO_ROOT, surfacePath("role_template")),
            letter: caller,
            concern: concern.trim(),
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    for (const [flag, slots] of RAISE_FORMS) {
        const subject = joinedValue(flag);
        if (subject === null) continue;

        refuseFixedTarget(flag, surfacePath(slots.root));

        const outcome = runSurfaceRaise({
            repoRoot: REPO_ROOT,
            templateSlot: slots.template,
            rootSlot: slots.root,
            subject,
            concern: slots.concern,
            rehearse: !healRequested(process.argv, NO_FIX_FLAG),
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const half = argumentValue("--half");
    if (half !== null) {
        refuseFixedTarget("--half", surfacePath("conduct_roster"));

        const registry = await discoverRules(REPO_ROOT);
        const outcome = runHalf({
            repoRoot: REPO_ROOT,
            target: surfacePath("conduct_roster"),
            slug: half,
            value: argumentValue("--observer") ?? "",
            registered: registry.rules.map((entry) => entry.id),
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const task = argumentValue("--task");
    if (task !== null) {
        const outcome = runTask({
            repoRoot: REPO_ROOT,
            target,
            id: task,
            statement: joinedValue("--statement") ?? "",
            owner: caller,
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const marked = argumentValue("--mark");
    if (marked !== null) {
        const outcome = runMark({ target, absolute, item: marked, agent: caller });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const transition = argumentValue("--transition");
    if (transition !== null) {
        refuseFixedTarget("--transition", surfacePath("agent_index"));

        const outcome = runTransition({
            absolute: resolve(REPO_ROOT, surfacePath("agent_index")),
            letter: argumentValue("--seat") ?? caller,
            state: transition,
            by: caller,
            warrant: argumentValue("--ref"),
        });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const indexed = joinedValue("--index");
    if (indexed !== null) {
        refuseFixedTarget("--index", surfacePath("agent_index"));

        const outcome = runIndex({
            absolute: resolve(REPO_ROOT, surfacePath("agent_index")),
            role: indexed,
            roles: resolve(REPO_ROOT, surfacePath("roles")),
        });
        if (outcome.letter !== null) {
            if (outcome.recycled) forgetAgent(REPO_ROOT, outcome.letter);
            bindSeat(REPO_ROOT, outcome.letter, callerProcess(Date.now()));
        }
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    if (process.argv.includes("--record")) {
        const outcome = runRecord({ repoRoot: REPO_ROOT, target, absolute, agent: caller });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const retract = argumentValue("--retract");
    if (retract !== null) {
        const outcome = runRetract({ target, absolute, clause: retract });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const successor = argumentValue("--successor");
    if (successor !== null) {
        const outcome = runSuccessor({ target, absolute, invariant: successor });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const defer = argumentValue("--defer");
    if (defer !== null) {
        const to = argumentValue("--to");
        if (to === null) {
            process.stdout.write(
                "REFUSED  --defer names the question this venue leaves open and --to names its receiver, a venue or an " +
                    "active seat; a clause with no receiver is collected with no destination at all, so the deferral is " +
                    "present, reads correctly to any human, and arrives at nobody\n",
            );
            process.exit(2);
        }

        const outcome = runDefer({ repoRoot: REPO_ROOT, target, absolute, clause: defer, receiver: to });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    if (process.argv.includes("--arrive")) {
        const outcome = runArrive({ predecessor: target, absolute });
        process.stdout.write(outcome.message);
        process.exit(outcome.code);
    }

    const item = textOperand("--item", "--item-file");
    const kind = argumentValue("--kind");

    const unsupplied = unsuppliedOperands([
        {
            operation: "--item",
            requested: item !== null,
            supplied: kind !== null && ITEM_KINDS.includes(kind),
            refusal:
                `--kind states which closure this item takes and must be one of ${ITEM_KINDS.join(" or ")}. THE ` +
                "KIND SELECTS THE CLOSURE, WHICH IS WHY IT BELONGS ON THE MARKER RATHER THAN IN THE PROSE: an ARTIFACT " +
                "item asks for something that can exist and closes with a typed reference that RESOLVES; a JUDGEMENT " +
                "item asks for a reading and closes by acknowledger with NO reference, because there is nothing for one " +
                "to point at. Every seat has been supplying this word at the head of a sentence, where the schema " +
                "declares it on the marker and where no dispatcher can read it — so the judgement path exists and has " +
                "never been reachable",
        },
        {
            operation: "--field",
            requested: argumentValue("--field") !== null,
            supplied: joinedValue("--value") !== null,
            refusal:
                "--field names WHICH field to rewrite and --value carries what it now reads; a rewrite with " +
                "no value would clear a field, and an emptied field states nothing where a declared absence marker " +
                "states that this seat has none — the two are different claims and only one is writable here",
        },
    ]);

    if (unsupplied.length > 0) {
        process.stdout.write(
            `REFUSED  ${unsupplied.join("\nREFUSED  ")}\nAN INVOCATION IS ONE UNIT: every operand of every requested ` +
                "operation is checked BEFORE any of them writes, because this entry point composes several independent " +
                "operations into one process and returns ONE status. A form that wrote as it went would land its first " +
                "operation, refuse on the second, and exit non-zero — so a caller reading the tail of its own output " +
                "concludes the invocation failed and retries, which DUPLICATES what already landed. Nothing was written\n",
        );
        process.exit(2);
    }

    if (item !== null && kind !== null) {
        const unread = existsSync(absolute)
            ? unreadSince(readSurface(absolute, "utf8"), readSnapshot(REPO_ROOT, caller, target), caller)
            : null;

        const outcome = runItem({
            target,
            absolute,
            agent: caller,
            text: item,
            at: Date.now(),
            kind,
            archive: resolve(REPO_ROOT, CHANGELOG),
            siblings: siblingSurfaces(absolute),
            repoRoot: REPO_ROOT,
        });
        process.stdout.write(outcome.message);
        if (outcome.code !== 0) process.exit(outcome.code);
        process.stdout.write(unreadEcho(unread, target));
        process.stdout.write(ownClaimEcho(caller));
        process.stdout.write(ownDischargeEcho(caller));
        process.stdout.write(openVenueEcho(caller, target));
        if (target.endsWith(BLOCKING_SUFFIX)) process.stdout.write(ownVenueEcho(caller, absolute, target));
    }

    const field = argumentValue("--field");
    const value = joinedValue("--value");
    if (field !== null && value !== null) {
        const outcome = runField({ target, absolute, agent: caller, field, text: value });
        process.stdout.write(outcome.message);
        if (outcome.code !== 0) process.exit(outcome.code);
        writeFieldMark(REPO_ROOT, caller, Date.now());
    }

    if (process.argv.includes("--read")) {
        const outcome = runReadMark({ target, absolute, agent: caller, text: "" });
        process.stdout.write(outcome.message);
        if (outcome.code !== 0) process.exit(outcome.code);
    }

    const signature = joinedValue("--sign");
    if (signature !== null) {
        const outcome = runSignature({ target, absolute, agent: caller, text: signature });
        process.stdout.write(outcome.message);
        if (outcome.code !== 0) process.exit(outcome.code);
    }

    let tidy = 0;
    const venue = target.endsWith(BLOCKING_SUFFIX);

    const marker = argumentValue("--compress");
    const closes = argumentValue("--closes");
    const withdrawn = argumentValue("--withdraw");

    const twin =
        venue && closes !== null && existsSync(absolute)
            ? duplicateTwinOf(readSurface(absolute, "utf8"), closes)
            : null;

    if (venue && closes !== null && twin !== null) {
        process.stdout.write(
            `ADMITTED  ${closes} is BYTE-IDENTICAL to ${twin} in the same record, so removing it destroys nothing: ` +
                "the argument survives in its twin, which is the one case an accumulating venue can safely admit. " +
                "Every other removal stays refused, because the refusal cannot tell an ARGUMENT from a COPY of one and " +
                "the single removal that destroys nothing was refused exactly like the one that would destroy " +
                "everything\n",
        );
    }

    if (venue && (marker !== null || withdrawn !== null || (closes !== null && twin === null))) {
        process.stdout.write(
            `REFUSED  no removal on ${target}: a VENUE ACCUMULATES until it converges, so a position is ` +
                "never drained, closed or compressed while the discussion is open — the venue is MOVED WHOLE INTO " +
                "THE ARCHIVE on convergence with its durable half extracted, never removed from the repository, and " +
                "removing one argument from an open discussion destroys exactly the dissent the record is supposed " +
                "to preserve\n",
        );
        process.exit(2);
    }

    const discharged = argumentValue("--discharge");
    if (discharged !== null) tidy = discharge(target, absolute, discharged) || tidy;

    if (marker !== null) tidy = compress(target, absolute, marker);

    if (closes !== null) tidy = closure(target, absolute, closes) || tidy;

    if (withdrawn !== null) tidy = withdrawal(target, absolute, withdrawn) || tidy;

    if (target.endsWith(BLOCKING_SUFFIX)) {
        process.stdout.write(
            `HELD  no sweep on ${target}: a VENUE ACCUMULATES until it converges, so every position stands ` +
                "until it has been read and signed. The board is current-truth-only and is swept; a discussion " +
                "is the opposite by construction, and draining one would delete the argument it exists to hold\n",
        );
    } else {
        process.stdout.write(runSweep(REPO_ROOT, absolute, CHANGELOG).message);
    }

    if (tidy !== 0 && item === null) process.exit(tidy);
    if (tidy !== 0) {
        process.stdout.write(
            "HELD  the drain refused and the POST landed: the message is the mandatory half and the tidy is the " +
                "optional one, so a failed removal never takes a peer's channel down with it\n",
        );
    }

    if (process.argv.includes(NO_WAIT_FLAG)) {
        deliverSince(absolute, target);
        process.exit(0);
    }

    const timeout = SLOT_EXPIRY_MS;

    const baseline = modifiedAt(absolute);
    if (baseline === null) {
        process.stdout.write(`ABSENT  ${target} does not exist; nothing to watch\n`);
        process.exit(2);
    }

    const now = Date.now();
    const admission = admitWaiter(REPO_ROOT, resolve(REPO_ROOT, DEFAULT_TARGET), {
        agent: caller,
        target,
        timeout,
        now,
        pid: process.pid,
    });

    process.stdout.write(admission.message);
    if (admission.code !== 0) process.exit(admission.code);

    const id = admission.id;
    const deadline = now + timeout;

    while (Date.now() < deadline) {
        await sleep(POLL_MS);

        const current = modifiedAt(absolute);
        if (current === null) {
            release(id);
            process.stdout.write(`REMOVED  ${target} was deleted while watching\n`);
            process.exit(2);
        }

        if (current !== baseline) {
            release(id);
            const waited = Math.round((timeout - (deadline - Date.now())) / 1000);
            process.stdout.write(`CHANGED  ${target} was updated after ${String(waited)}s\n`);
            deliverSince(absolute, target);
            process.exit(0);
        }
    }

    release(id);
    process.stdout.write(`QUIET  ${target} unchanged — no other agent wrote before this call was cut short\n`);
    deliverSince(absolute, target);
    process.exit(1);
}

await main();
