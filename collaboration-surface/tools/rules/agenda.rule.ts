import { AGENDA } from "../core/constants/blocking.constants.ts";
import { writeAgendaIfUnmoved } from "../core/generators/agenda.generator.ts";
import {
    driftedRows,
    healSchedule,
    readSchedule,
    renderSchedule,
    scheduleBounds,
    type ScheduleReading,
} from "../core/runners/agenda.runner.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const DECIDE =
    "the ordinal, the invariant and what a venue must establish are INTENT no tree holds, so they stay authored " +
    "in the typed plan; the state is an OBSERVATION two directory listings already answer, so it is computed " +
    "and never transcribed. A hand-copied state goes stale in whichever direction nobody happened to correct — " +
    "and a row that reads one state while the tree holds another is the surface and the tree disagreeing on " +
    "exactly the fact the surface exists to publish. Author the plan; the column renders";

function finding(reading: ScheduleReading, line: number, held: string): Finding {
    return {
        rule: "agenda/transcribedState",
        path: AGENDA,
        line,
        locus: reading.plan.invariant,
        stack: [
            { check: "row", resolved: reading.plan.ordinal },
            { check: "derived", resolved: reading.state },
            { check: "evidence", resolved: reading.evidence },
        ],
        actual: held,
        expected: reading.state,
        remediation: {
            action: "declare",
            from: held,
            to: reading.state,
            target: AGENDA,
            deterministic: true,
            decide: DECIDE,
        },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant:
        "the schedule's authored plan and its observed state are separate halves, so a row's state renders from the tree rather than being copied into it",
    extensions: [],
    kinds: ["transcribedState", "tableAbsent"],
    heals: true,
    wholeScopeOnly: true,

    reads: [AGENDA],

    check(context: RuleContext, fix: boolean): RuleResult {
        if (!context.paths.includes(AGENDA)) {
            return {
                findings: [],
                healed: [],
                derivations: { agenda: "outside this run's path set", skippedAsOutOfScope: [AGENDA] },
            };
        }

        const source = context.read(AGENDA);
        const lines = source.split("\n");
        const bounds = scheduleBounds(lines);
        const readings = readSchedule(context.repoRoot);

        if (bounds === null) {
            return {
                findings: [
                    {
                        rule: "agenda/tableAbsent",
                        path: AGENDA,
                        line: 0,
                        locus: "ordering table",
                        stack: [{ check: "header", resolved: "absent" }],
                        actual: "the agenda carries no ordering table for the plan to render into",
                        expected: "the ordering table's declared header row",
                        remediation: {
                            action: "declare",
                            from: AGENDA,
                            to: null,
                            target: AGENDA,
                            deterministic: false,
                            decide: "the plan is authored and the table is its rendering, so a rendering with no region to land in leaves the plan unpublished — restore the header the render writes beneath, rather than re-authoring the rows",
                        },
                        healed: false,
                    },
                ],
                healed: [],
                derivations: { agenda: "present", table: "absent", rowsPlanned: readings.length },
            };
        }

        const drifted = driftedRows(lines, readings);
        const findings: Finding[] = [];
        const healed: string[] = [];

        if (drifted.length > 0) {
            const rendered = renderSchedule(readings);
            const written = healSchedule(source, rendered);

            const applied = fix && written !== null && writeAgendaIfUnmoved(context.repoRoot, source, written);

            if (applied) healed.push(AGENDA);
            else {
                for (const reading of drifted) {
                    const index = readings.indexOf(reading);
                    const at = bounds.from + 2 + index;
                    findings.push(finding(reading, at + 1, (lines[at] ?? "").trim()));
                }
            }
        }

        return {
            findings,
            healed,
            derivations: {
                agenda: "present",
                rowsWalked: readings.map((reading) => `${reading.plan.ordinal} → ${reading.state}`),
                derivedFromTheTree: readings
                    .filter((reading) => reading.derived)
                    .map((reading) => `${reading.plan.invariant}: ${reading.evidence}`),
                declaredRatherThanDerived: readings
                    .filter((reading) => !reading.derived)
                    .map((reading) => `${reading.plan.invariant}: ${reading.evidence}`),
                population:
                    "the ROWS of the typed plan, never the files this run hands the check — the plan is the " +
                    "authored half and the two directory listings are the observed one, so nothing here ranges " +
                    "over a handed set and no reached count is claimed. A row the plan does not carry is invisible " +
                    "to this walk by construction, which is the plan being the single declaration of the series " +
                    "rather than a scope that stopped reaching",
                notChecked:
                    "whether the authored half is RIGHT — the walk decides that a state matches the tree and " +
                    "says nothing about whether a row's invariant, its ordinal or what it must establish is the " +
                    "correct intent, which is the series' own judgement and is held by the seats. The ORDER of " +
                    "the rows is likewise the plan's own and is read by the ordering axis rather than here",
            },
        };
    },
};
