import { ungatedRows } from "../core/analyzers/blocking.analyzer.ts";
import {
    BLOCKING_SUFFIX,
    RESOLUTION_HEADING,
    VENUE_ARCHIVE,
    VENUE_TEMPLATE,
} from "../core/constants/blocking.constants.ts";
import { unreadAuthors, unreadWhilePositionsStand } from "../core/validators/blocking.validator.ts";
import { historyPath, surfacePath } from "../../config/surface.config.ts";
import { BOARD_PATH } from "../core/constants/board.constants.ts";
import {
    absorptionState,
    convergenceEdges,
    declaredSuccessor,
    hasReadMark,
    strandedDeferrals,
} from "../core/validators/converge.validator.ts";
import { AGENDA } from "../core/constants/blocking.constants.ts";
import { agendaInvariants, agendaRows, disorderedRows, plannedInvariants } from "../core/runners/venue.runner.ts";
import { positionsOutsideRecords, venueSchemaGaps } from "../core/validators/venue.validator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function basenameOf(path: string): string {
    const cut = path.lastIndexOf("/");
    return cut === -1 ? path : path.slice(cut + 1);
}

function venueFiles(paths: readonly string[]): string[] {
    return paths
        .filter((path) => path.endsWith(BLOCKING_SUFFIX))
        .filter((path) => basenameOf(path).length > BLOCKING_SUFFIX.length)
        .sort();
}

function isArchived(path: string): boolean {
    return path.startsWith(VENUE_ARCHIVE);
}

function finding(kind: string, path: string, actual: string, expected: string, decide: string, anchor = ""): Finding {
    return {
        rule: `blocking/${kind}`,
        path,
        line: 1,
        locus: anchor.length === 0 ? path : anchor,
        stack: [
            { check: "blocking", resolved: path },
            { check: kind, resolved: actual },
        ],
        actual,
        expected,
        remediation: { action: "declare", from: path, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant: "an unresolved prioritised discussion blocks the build until it converges",
    extensions: [],
    kinds: [
        "concurrentVenues",
        "disorderedScheduleRow",
        "duplicateDistribution",
        "handPlacedPosition",
        "noExitCondition",
        "positionsBeforeRoster",
        "rosterContradiction",
        "strandedDeferral",
        "templateAbsent",
        "ungatedDecision",
        "unrecordedSuccessor",
        "unresolvedDiscussion",
        "venueSchemaDrift",
    ],
    heals: false,

    reads: [VENUE_TEMPLATE, AGENDA],

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const venues = venueFiles(context.paths);
        const open = venues.filter((path) => !isArchived(path));
        const skippedAsArchivedVenue = venues.filter(isArchived);

        if (open.length > 0 && !context.exists(VENUE_TEMPLATE)) {
            return {
                findings: [
                    finding(
                        "templateAbsent",
                        VENUE_TEMPLATE,
                        "the venue template the record schema derives from does not exist",
                        "a venue template declaring the record fields every venue answers to",
                        "the schema is DERIVED from the template on every run so this check cannot drift from the contract it enforces — and an absent template resolves that contract to an empty set, which passes every venue vacuously. A green over an unenforceable schema is worse than a red, so the template is raised rather than the check relaxed",
                    ),
                ],
                healed: [],
                derivations: { open },
            };
        }

        const template = context.exists(VENUE_TEMPLATE) ? context.read(VENUE_TEMPLATE) : "";
        const boardText = context.exists(BOARD_PATH) ? context.read(BOARD_PATH) : "";
        const indexPath = surfacePath("agent_index");
        const indexText = context.exists(indexPath) ? context.read(indexPath) : "";
        const agenda = context.exists(AGENDA) ? context.read(AGENDA) : "";

        for (const path of open) {
            const source = context.read(path);
            const opened = hasReadMark(source);

            findings.push(
                finding(
                    "unresolvedDiscussion",
                    path,
                    opened
                        ? `${path} is on disk and its roster carries a read mark, so its discussion is OPEN`
                        : `${path} is on disk and its roster carries no read mark, so it is CREATED and not opened — a successor raised before its predecessor archives, which the successor edge REQUIRES to exist by then`,
                    "the file deleted once every agent has added their share and the outcome is merged",
                    opened
                        ? "this discussion blocks every other item deliberately: it is prioritised, it needs considered input from each active agent, and the work downstream of it is shaped by its outcome. Add your share, converge, merge the result into the checklist, then delete the file — the gate clears itself and nothing else is needed"
                        : "this venue holds the build because it EXISTS rather than because anything is being argued in it, and both readings fail because the presence rule reads presence. Nothing is owed here until its predecessor leaves the active tree: a seat marks its letter then, and the finding becomes the open one above. Creating it early is REQUIRED rather than premature — the successor edge refuses a predecessor whose successor does not exist — so this finding is the cost of that ordering rather than a defect anybody introduced",
                ),
            );

            for (const author of unreadAuthors(source)) {
                findings.push(
                    finding(
                        "rosterContradiction",
                        path,
                        `${author} holds a position here and the roster marks ${author} unread`,
                        `${author} marked read, or ${author}'s positions absent`,
                        "a venue cannot both carry an agent's positions and record that agent as not having read it. The most likely cause is a whole-file write that replaced the roster without replacing the records, or the records without the roster — which destroys another author's work and reports success. Restore what the write dropped, then add positions by editing rather than by rewriting the venue",
                    ),
                );
            }

            const unopened = unreadWhilePositionsStand(source);
            if (unopened.length > 0) {
                findings.push(
                    finding(
                        "positionsBeforeRoster",
                        path,
                        `positions stand here while the roster marks ${unopened.join(", ")} unread`,
                        "every seat marked read before the first position lands",
                        "a venue states at its head that a seat marks its letter read and only THEN does the discussion open, so positions accumulating while any seat is unread are an argument running past the venue's own opening condition. The seats still unread inherit a discussion they had no part in and must either read it whole or write against a position set that already converged around them, and neither is the participation the roster exists to guarantee. The condition was stated to a READER at the top of the file and observed by nothing, which is how a two-seat argument reaches twenty positions with every check green. Mark read and take part, or hold the argument until the roster is complete — and where a venue is deliberately held, the hold is a fact about the venue rather than an instruction living outside the tree, since an instruction no surface carries reaches nobody who was not told",
                        unopened.join(", "),
                    ),
                );
            }

            for (const row of ungatedRows(source)) {
                findings.push(
                    finding(
                        "ungatedDecision",
                        path,
                        `${row.id} carries an empty gate cell at line ${String(row.line)}`,
                        `${row.id} naming the gate that enforces it, or an em dash stating none is owed`,
                        "the exit condition every venue declares is that a decision binding an artifact names its gate or is proven ungatable in writing, so a decision with neither does not close its question. An EMPTY cell is the failure and an em dash is a real answer — it states that this decision binds no artifact, which is a claim a reader can check. Leaving it blank reads as an oversight or as a decision nobody has assessed, and the two are indistinguishable from outside",
                    ),
                );
            }

            for (const gap of venueSchemaGaps(source, template)) {
                findings.push(
                    finding(
                        "venueSchemaDrift",
                        path,
                        gap.state === "absent"
                            ? `${gap.record} declares no ${gap.field}, which the venue template requires`
                            : `${gap.record} carries ${gap.field} which the venue template does not declare`,
                        `the field set the venue template declares: ${gap.declared.join(", ")}`,
                        "a venue's fields are its OWN and the board's do not transfer: a board answers who owns what and what is directed at whom, a venue answers where each seat stands and what it still needs before it can sign. The field set is DERIVED from the venue template on every run so this check cannot drift from it, and a venue carrying an ownership field is describing ownership in a document about a decision — which is what happens when a seat conforms the discussion to whatever the tool happened to require. AND A DECLARED FIELD LEFT OUT IS THE OPPOSITE DEFECT WITH THE SAME CAUSE: convergence is DERIVED from every active seat's remaining need, so a record omitting that field is not a seat with nothing outstanding — it is a seat whose position on the exit condition cannot be read at all, and a missing field and a satisfied one are the same silence to anyone counting",
                        `${gap.record} · ${gap.field}`,
                    ),
                );
            }

            for (const stray of positionsOutsideRecords(source)) {
                findings.push(
                    finding(
                        "handPlacedPosition",
                        path,
                        `position ${stray.key} sits outside every seat's record`,
                        "the position posted through the tool so it lands inside its author's own fenced record",
                        "a position outside every record has no fence, no id, no addressing and no compare-and-swap, so it is attributable to nobody and removable by nothing — and a venue full of them is a document where every seat writes anywhere. Post it with the tool naming this surface; if the tool refuses because a record is missing, raise the record from the venue template rather than writing the position by hand. The locus is the position's own CLAIM KEY rather than a line number, because a venue accumulates while the argument runs: a positional address is correct at emission and decays with the next write, so a later reader resolves it to whatever now sits there and gets a confident wrong answer instead of an error",
                        stray.key,
                    ),
                );
            }

            for (const stranded of strandedDeferrals(source, boardText, indexText, open, agendaInvariants(agenda))) {
                findings.push(
                    finding(
                        "strandedDeferral",
                        path,
                        stranded.receiver.length === 0
                            ? `the deferred clause ${stranded.clause} names no receiver`
                            : `the deferred clause ${stranded.clause} names ${stranded.receiver}, which resolves to no active seat and no venue`,
                        "each deferred clause naming a receiver that resolves to an active seat or to a venue on disk",
                        "a deferral is written when it is deferred BECAUSE the successor edge joins on it, and that edge takes the clause NAME and tests its arrival — it never touches the receiver. So a clause routed to a party that does not exist arrives in the successor by name, passes every existing check, and is inherited by nobody: the question is carried forward correctly and answered by no one, which is the state that reads exactly like a question in progress. The receiver resolves against the ACTIVE seats the board declares and the venues on disk, both derived rather than declared, so a seat going inactive re-points this on the next run with nothing to edit. A clause deliberately left for whoever later claims a scope names the venue that will hold it rather than an absent letter, because a note for a successor is legitimate and a route to nobody is not",
                        stranded.clause,
                    ),
                );
            }

            const declared = declaredSuccessor(source);
            if (declared.length > 0 && !agenda.includes(declared)) {
                findings.push(
                    finding(
                        "unrecordedSuccessor",
                        path,
                        `${path} declares the successor ${declared} and the agenda records no such invariant`,
                        "every declared successor appearing in the agenda, as its own planned row or merged into one",
                        "A SUCCESSOR IS DECLARED BY NAME RATHER THAN DERIVED FROM AN ORDINAL, deliberately, because the real edges are partial with forward dependencies — and the other half of that decision is that a declaration DEPARTING from the planned set displaces a subject. Every step is correct and the composition drops a question: the declaration is right, the raise is right, and the planned invariant it stepped past has no venue, no receiver and no live surface saying it is owed. Both operands are files and the comparison needs no judgement, so the only thing that has ever caught a departure is a seat noticing — which is the mechanism the agenda exists to replace. Record it there: a row of its own where the two subjects are separate, or MERGED into the planned row where a raised invariant and a planned one meet on the same operand, which consumes the insertion instead of letting it consume a position. The planned invariant keeps its place either way, because an ordinal in a filename is raise order and an agenda position is a row in the table",
                        declared,
                    ),
                );
            }

            if (source.includes(RESOLUTION_HEADING)) continue;

            findings.push(
                finding(
                    "noExitCondition",
                    path,
                    `${path} declares no exit condition`,
                    `a ${RESOLUTION_HEADING} section stating what makes the file deletable`,
                    "a blocker with no stated exit is an indefinite halt rather than a prioritised discussion; whoever raises one states the condition under which it is satisfied, so nobody has to guess whether it is finished",
                ),
            );
        }

        const opened = open.filter((path) => hasReadMark(context.read(path)));

        if (opened.length > 1) {
            for (const path of opened) {
                findings.push(
                    finding(
                        "concurrentVenues",
                        path,
                        `${String(opened.length)} venue files carry a read mark and are therefore OPEN: ${opened.join(", ")} — of the ${String(open.length)} venue files standing, the rest are created and unopened`,
                        "exactly one OPENED venue in the active tree, so the hold is serialised",
                        "A HOLD IS SERIALISED OR IT IS NOT A HOLD, AND THIS AXIS MEASURES OPENNESS FROM THE ROSTER RATHER THAN PRESENCE ON THE DISK. The two are different properties over different operands: presence says a file exists, openness says a seat has marked it read and the discussion has begun. A venue is CREATED at convergence and OPENED when its predecessor leaves, so a created-not-opened successor is the intended state of a series that carries a question forward — and an axis reading presence reports it as a violation of an invariant it does not breach. The operand is the roster line, which is where the created-versus-opened distinction is already recorded and checkable from the artifact rather than from a rule. WHAT THIS AXIS STILL DOES NOT REACH, STATED SO A GREEN IS NOT READ AS MORE THAN IT IS: the successor edge reads FILE EXISTENCE, so an early creation still discharges a brake by an act the roster says is not an opening — two mechanisms reading two operands for one concept, with only one of them corrected here. That remains a separate question about what the successor edge is FOR, and its own repair. Converge and archive the predecessor before a second venue is opened; a successor already created is left unmarked until it does",
                    ),
                );
            }
        }

        const convergence: Record<string, string> = {};
        const archivePath = historyPath();
        const archive = context.exists(archivePath) ? context.read(archivePath) : "";

        for (const path of open) {
            const cut = path.lastIndexOf("/");
            const name = cut === -1 ? path : path.slice(cut + 1);

            const absorption = absorptionState(context.repoRoot, name);
            if (absorption !== null && absorption.declaring.length > 1) {
                findings.push(
                    finding(
                        "duplicateDistribution",
                        path,
                        `${String(absorption.declaring.length)} planning surfaces declare that they distribute ${name}: ${absorption.declaring.join(", ")}`,
                        "exactly one planning surface declaring any one venue, so the work set is a single enumeration",
                        "A SEARCH THAT STOPS AT ITS FIRST MATCH REPORTS A COMPLETE ANSWER OVER A PARTIAL READ. The absorption ordering resolves the work set by scanning the planning root for a surface declaring this venue, and with more than one declaring it the resolution lands on whichever the directory listing yielded first — so every item enumerated on every other declaring surface is invisible to it, and the venue can satisfy absorption while outstanding work stands on a surface the walk never opened. Which one wins is then a property of the filesystem rather than a decision anyone took, and the failure is silent in the direction that CLEARS a gate, which is the worse of the two directions. The repair is collapse rather than selection: a fact declared twice is collapsed before anything compares it, because a mechanism paid on every run to choose between two declarations is a mechanism paid to detect a state that need not exist. Retire the superseded declaration or fold its items into the surviving one; a declaration naming a venue that has left the active tree is discharged and is deleted rather than annotated",
                        absorption.declaring.join(", "),
                    ),
                );
            }

            const plannedRows = plannedInvariants(agenda);
            for (const edge of convergenceEdges(
                context.repoRoot,
                path,
                context.read(path),
                boardText,
                indexText,
                archive,
                open,
                plannedRows,
            )) {
                convergence[`${name} · ${edge.edge}`] = edge.holds ? "holds" : `BLOCKS — ${edge.detail}`;
            }
        }

        for (const row of disorderedRows(agenda)) {
            findings.push(
                finding(
                    "disorderedScheduleRow",
                    AGENDA,
                    `the schedule row ${row.ordinal} sits after ${row.after}, which its own ordinal places before it`,
                    "every schedule row appearing in the order its own ordinal states, with a lettered ordinal sorting between its number and the next",
                    "A SCHEDULE ROW CARRIES TWO FACTS IN ONE COLUMN — the ordinal a raised file must take, and the POSITION in the table, which is the sequence. A LETTERED ordinal IS ITSELF A SEQUENCE CLAIM: it records the predecessor whose successor edge the row was declared under, so it states WHERE the row belongs rather than exempting it from belonging anywhere. What a letter is licensed to differ from is APPEND ORDER — a row inserted after later rows were already written sits at its own ordinal rather than at the end — and the comparison therefore ORDERS lettered ordinals rather than skipping them, sorting each between its own number and the next. SKIPPING THEM WAS INVISIBILITY IN BOTH DIRECTIONS rather than exemption: a skipped row is never reported and never updates the running baseline, so it can neither fail nor constrain anything after it. The repair is the row's own ordinal rather than an editor's preference: the ordinal is a claim its author wrote and the position is a consequence of where it was appended, so the ordinal is the tiebreak and the row moves to the place its own number implies. WHERE THAT MOVE IS HELD BY A STANDING DIRECTIVE the finding stands with the hold named beside it — an unreachable remediation is a mechanism defect only where nothing is scheduled to change the population, and a hold that lifts is exactly such a schedule",
                    row.invariant,
                ),
            );
        }

        return {
            findings,
            healed: [],
            derivations: {
                open,
                skippedAsArchivedVenue,
                convergence,
                scheduleOrder: agendaRows(agenda).map((row) => `${row.ordinal} ${row.invariant}`),
            },
        };
    },
};
