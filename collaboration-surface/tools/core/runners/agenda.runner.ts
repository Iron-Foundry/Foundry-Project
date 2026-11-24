import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

import { schedule, type SchedulePlan, type ScheduleState } from "../../../config/agenda.config.ts";
import { surfacePath, surfacePrefix } from "../../../config/surface.config.ts";
import { BLOCKING_SUFFIX, VENUE_ARCHIVE } from "../constants/blocking.constants.ts";
import { openVenues } from "../resolvers/sweep.resolver.ts";
import { letters } from "./converge.runner.ts";

export const SCHEDULE_HEADER = "| planned | invariant | what it must establish | state |";

export const SCHEDULE_RULE = "|---|---|---|---|";

const ROW_MARKER = "|";

const MARKED_FIELD = "READ AND AWAITING:";

const PLAN_TERMINATOR = "]);";

export interface AgendaRequest {
    readonly plan: string;
    readonly invariant: string;
    readonly establishes: string;
    readonly ordinal: string;
    readonly note: string;
}

export interface AgendaOutcome {
    readonly message: string;
    readonly code: number;
}

export interface ScheduleReading {
    readonly plan: SchedulePlan;
    readonly state: ScheduleState;
    readonly derived: boolean;
    readonly evidence: string;
}

function liveVenues(repoRoot: string): string[] {
    const prefix = surfacePrefix();
    const root = resolve(repoRoot, prefix);
    if (!existsSync(root)) return [];

    const entries = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => (prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`));

    return openVenues(entries, VENUE_ARCHIVE, BLOCKING_SUFFIX);
}

function archivedVenues(repoRoot: string): string[] {
    const root = resolve(repoRoot, surfacePath("venue_archive"));
    if (!existsSync(root)) return [];

    return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(BLOCKING_SUFFIX))
        .map((entry) => entry.name);
}

function hasMarkedLetter(repoRoot: string, venue: string): boolean {
    const absolute = resolve(repoRoot, venue);
    if (!existsSync(absolute)) return false;

    for (const line of readSurface(absolute, "utf8").split("\n")) {
        if (!line.startsWith(MARKED_FIELD)) continue;
        return letters(line, MARKED_FIELD).length > 0;
    }

    return false;
}

export function readSchedule(repoRoot: string): ScheduleReading[] {
    const live = liveVenues(repoRoot);
    const archived = archivedVenues(repoRoot);

    return schedule.map((plan) => {
        const onRoot = live.find((venue) => venue.includes(plan.invariant));
        if (onRoot !== undefined) {
            const marked = hasMarkedLetter(repoRoot, onRoot);
            return {
                plan,
                state: marked ? "open" : "created",
                derived: true,
                evidence: `${onRoot} stands at the active root and its roster carries ${marked ? "a marked letter" : "no marked letter"}`,
            };
        }

        const inArchive = archived.find((venue) => venue.includes(plan.invariant));
        if (inArchive !== undefined) {
            return { plan, state: "archived", derived: true, evidence: `${inArchive} resolves under the archive root` };
        }

        if (plan.declaredState !== undefined) {
            return { plan, state: plan.declaredState, derived: false, evidence: plan.declaredBecause ?? "" };
        }

        return { plan, state: "planned", derived: true, evidence: "neither listing holds a venue for it" };
    });
}

const CELL_BREAKS: ReadonlySet<string> = new Set(["\n", "\r", "\t", " "]);

export function oneLine(value: string): string {
    let out = "";
    let pending = false;

    for (const character of value) {
        if (CELL_BREAKS.has(character)) {
            pending = out.length > 0;
            continue;
        }

        if (pending) out += " ";
        pending = false;
        out += character;
    }

    return out;
}

function invariantCell(plan: SchedulePlan): string {
    const named = `\`${plan.invariant}\``;
    return plan.merged === undefined ? named : `${named} **merged with** \`${plan.merged}\``;
}

function stateCell(reading: ScheduleReading): string {
    const note = reading.plan.note;
    if (note === undefined || note.length === 0) return reading.state;

    return `\`${reading.state}\` — ${note}`;
}

export function renderSchedule(readings: readonly ScheduleReading[]): string[] {
    return [
        SCHEDULE_HEADER,
        SCHEDULE_RULE,
        ...readings.map(
            (reading) =>
                `| ${oneLine(reading.plan.ordinal)} | ${oneLine(invariantCell(reading.plan))} | ${oneLine(reading.plan.establishes)} | ${oneLine(stateCell(reading))} |`,
        ),
    ];
}

export interface TableBounds {
    readonly from: number;
    readonly to: number;
}

export function scheduleBounds(lines: readonly string[]): TableBounds | null {
    const from = lines.findIndex((line) => line.trim() === SCHEDULE_HEADER);
    if (from === -1) return null;

    let to = from;
    while (to + 1 < lines.length && (lines[to + 1] ?? "").trim().startsWith(ROW_MARKER)) to += 1;

    return { from, to };
}

export function healSchedule(source: string, rendered: readonly string[]): string | null {
    const lines = source.split("\n");
    const bounds = scheduleBounds(lines);
    if (bounds === null) return null;

    const held = lines.slice(bounds.from, bounds.to + 1);
    if (held.length === rendered.length && held.every((line, index) => line === rendered[index])) return null;

    return [...lines.slice(0, bounds.from), ...rendered, ...lines.slice(bounds.to + 1)].join("\n");
}

export function driftedRows(lines: readonly string[], readings: readonly ScheduleReading[]): ScheduleReading[] {
    const bounds = scheduleBounds(lines);
    if (bounds === null) return [];

    const rendered = renderSchedule(readings);
    const out: ScheduleReading[] = [];

    for (let index = 0; index < readings.length; index += 1) {
        const reading = readings[index];
        if (reading === undefined) continue;

        const at = bounds.from + 2 + index;
        if ((lines[at] ?? "").trim() === (rendered[index + 2] ?? "").trim()) continue;
        out.push(reading);
    }

    return out;
}

function planEntry(request: AgendaRequest): string {
    const fields = [
        `        ordinal: ${JSON.stringify(request.ordinal)},`,
        `        invariant: ${JSON.stringify(request.invariant)},`,
        `        establishes: ${JSON.stringify(request.establishes)},`,
    ];

    if (request.note.length > 0) fields.push(`        note: ${JSON.stringify(request.note)},`);

    return ["    {", ...fields, "    },"].join("\n");
}

export function runAgendaRow(request: AgendaRequest): AgendaOutcome {
    if (!existsSync(request.plan)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.plan} does not exist, so there is no authored plan to add a row to — the markdown ` +
                "table is a RENDERING of that plan and a row written into it is erased by the next run\n",
        };
    }

    const before = readSurface(request.plan, "utf8");

    if (schedule.some((row) => row.invariant === request.invariant)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.invariant} already stands in the plan — an invariant name is the row's key and three ` +
                "mechanisms resolve it, so a second row under one name makes every one of them ambiguous. Correct the " +
                "existing row in place, which is its author's own current-truth write\n",
        };
    }

    const lines = before.split("\n");
    let at = -1;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        if ((lines[index] ?? "").trim() === PLAN_TERMINATOR) {
            at = index;
            break;
        }
    }

    if (at === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.plan} carries no terminator for the plan, so this form has no position to write into ` +
                "and an append would place a row outside the declaration entirely\n",
        };
    }

    const written = [...lines.slice(0, at), planEntry(request), ...lines.slice(at)].join("\n");

    const witness = readSurface(request.plan, "utf8");
    if (witness !== before) {
        return {
            code: 2,
            message:
                `CONTENDED  ${request.plan} moved between the read and the write, so the row was not added — this surface ` +
                "is written by the seat set and by the operator, which is the concurrency a hand edit against it has " +
                "never been protected from\n",
        };
    }

    writeSurface(request.plan, written);

    return {
        code: 0,
        message:
            `ROW  ${request.invariant} added to the authored plan in ${request.plan}. THE FORM WRITES THE PLAN AND NEVER ` +
            "THE TABLE: the ordinal, the invariant and what a venue must establish are INTENT no tree holds, so they are " +
            "authored here; the STATE is an observation two directory listings already answer, so the form takes no state " +
            "operand and the column is computed on every run. A row appended to the markdown instead would be erased by " +
            "the next render, which is why this write goes to the plan and the rendering follows it.\n",
    };
}
