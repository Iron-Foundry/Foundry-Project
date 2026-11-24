import { projectRoot } from "../../../config/surface.config.ts";
import { GENERATED_DIR, NO_FIX_FLAG } from "../constants/path.constants.ts";
import { toPosix } from "../iterators/file.iterator.ts";
import { runPipeline } from "../orchestrators/pipeline.orchestrator.ts";
import {
    AGGREGATE_REPORT,
    joinLiveRun,
    supersedingRun,
    type PipelineReport,
    ruleReportName,
    writePipelineReport,
} from "../reporters/rule.reporter.ts";
import { claimStanding, releaseStanding } from "../registries/claim.registry.ts";
import { raiseLocalSurfaces } from "../runners/surface.runner.ts";
import { STAGES, type Stage } from "../types/rule.types.ts";

const REPO_ROOT = projectRoot();

export const RESTATES: readonly string[] = [
    "one_entry_point_staged_pipeline",
    "healing_is_default_in_every_entrypoint",
    "a_run_that_cannot_replace_the_aggregate_streams",
    "report_is_the_state",
];

function argValue(argv: readonly string[], flag: string): string | null {
    const index = argv.indexOf(flag);
    if (index === -1) return null;
    return argv[index + 1] ?? null;
}

function argList(argv: readonly string[], flag: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] !== flag) continue;
        const value = argv[i + 1];
        if (value === undefined) continue;
        let current = "";
        for (let k = 0; k < value.length; k += 1) {
            if (value[k] === ",") {
                if (current.length > 0) out.push(current);
                current = "";
                continue;
            }
            current += value[k];
        }
        if (current.length > 0) out.push(current);
    }
    return out;
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);

    const stageArg = argValue(argv, "--stage");
    const stage = stageArg !== null && STAGES.includes(stageArg as Stage) ? (stageArg as Stage) : null;

    const asked = !argv.includes(NO_FIX_FLAG);

    const declaredCaller = argValue(argv, "--agent");
    const runAgent = declaredCaller ?? "an undeclared caller";
    const runAt = Date.now();

    if (declaredCaller === null) {
        process.stdout.write(
            "UNATTRIBUTED  this run declares no caller, so its report names one nobody can ask about. A RUN IS NOT " +
                "REFUSED FOR THIS AND THAT IS DELIBERATE: it keys on none of the machinery a write keys on, so demanding " +
                "a caller would block a legitimate measurement to satisfy a symmetry with a different operation. What it " +
                "costs is attribution — a run is a shared measurement paid once by whoever changed the tree, and every " +
                "party reading its report consumes work they did not spend, so an unattributed one leaves the standing " +
                "claim and the concurrency record naming a party that cannot be reached. Pass --agent <LETTER> to " +
                "attribute it. THIS LINE EXISTS BECAUSE THE CAPABILITY WAS ALREADY HERE AND REACHED NOBODY: the flag was " +
                "accepted from the first run and announced by nothing, which is a mechanism whose consumer was never " +
                "built rather than a caller's oversight\n",
        );
    }

    const standing = claimStanding(REPO_ROOT, argValue(argv, "--scope") ?? "whole", runAt, runAgent);
    if (standing.message !== null) process.stdout.write(`OTHER RUNS  ${standing.message}\n`);

    const heal = asked && standing.overlapping.length === 0;

    if (asked && !heal) {
        process.stdout.write(
            `HEALING HELD  ${String(standing.overlapping.length)} LIVE run(s) write a set overlapping this one: ` +
                `${standing.overlapping.join("; ")}. So this run is report-only. A run MUTATES — the cleaning step, the ` +
                "formatter and every healing check write — so healing while ANOTHER RUN IS MID-WRITE takes an exclusive " +
                "resource without declaring it, and the cost lands on the party that was overwritten while both runs " +
                "report their own success. THE HOLD KEYS ON A WRITE BEING LIVE RATHER THAN ON A SEAT EXISTING: a seat " +
                "runs continuously by construction, so a predicate counting seats is PERMANENTLY true on any populated " +
                "board and makes healing unreachable rather than deferred — which strands every finding whose only " +
                "repair is the heal, on a walk nobody can drain. A live claim is the fact the hazard is actually about, " +
                "it clears when the other run publishes, and two runs over DISJOINT narrow scopes do not hold each " +
                "other at all. Take the repair once the overlapping run lands\n",
        );
    }

    if (standing.decision === "yield") {
        releaseStanding(REPO_ROOT, runAgent, runAt);
        process.stdout.write(
            "JOINED  a run whose write set overlaps a live one and whose start stamp is later does NOT re-run — it joins " +
                "the run already measuring this tree and reads out what that run publishes. TWO RUNS OVER ONE WRITE SET " +
                "IS THE LOST WRITE THE DECLARATION EXISTS TO PREVENT, and a second measurement of the same tree answers " +
                "a question the first is already answering. This run wrote no report and released its own claim; what " +
                "follows is the OTHER run's result, not a second one\n",
        );

        const joined = await joinLiveRun(REPO_ROOT, runAt);
        process.stdout.write(joined.message);
        process.exit(joined.code);
    }

    if (standing.covering.length > 0 && !heal) {
        releaseStanding(REPO_ROOT, runAgent, runAt);
        process.stdout.write(
            `COVERED  ${String(standing.covering.length)} live run(s) already measure this question: ${standing.covering.join("; ")}. ` +
                "A caller wanting an ANSWER joins by READING the published result rather than by starting a second " +
                "measurement of the same tree — joining is a read, so this run wrote nothing and released its own claim. " +
                "A caller wanting a REPAIR is not covered by an answer and is not skipped here, which is why this " +
                "branch asks whether the run heals rather than only whether a scope contains it. WHAT FOLLOWS IS THE " +
                "COVERING RUN'S RESULT: a caller does not re-run and does not go away to look later — the run already " +
                "measuring this tree is read out here, once it publishes\n",
        );

        const joined = await joinLiveRun(REPO_ROOT, runAt);
        process.stdout.write(joined.message);
        process.exit(joined.code);
    }

    if (heal) process.stdout.write(raiseLocalSurfaces(REPO_ROOT));

    const result = await runPipeline({
        repoRoot: REPO_ROOT,
        ruleId: argValue(argv, "--rule"),
        stage,
        scope: argValue(argv, "--scope"),
        bypass: argList(argv, "--bypass"),
        fix: heal,
    });

    const report: PipelineReport = {
        tool: "govern",
        verdict: result.findings.length === 0 ? "pass" : "fail",
        registered: result.registered,
        agent: runAgent,
        at: runAt,
        scope: result.scope,
        authoritative: result.authoritative,
        scanned: result.scanned,
        bypassed: result.bypassedAny,
        mutated: heal,
        mode: heal ? "healing" : "held",
        written: result.written,
        escaped: result.escaped,
        unfulfilled: result.unfulfilled,
        stages: result.stages,
        reports: result.stages.filter((s) => !s.bypassed).map((s) => `${GENERATED_DIR}/${ruleReportName(s.rule)}`),
        findings: result.findings,
        moved: result.moved,
        derivations: {
            stagesWalked: result.stages.filter((s) => !s.bypassed).map((s) => s.rule),
            stagesBypassed: result.stages.filter((s) => s.bypassed).map((s) => s.rule),
            priorRunIncomplete: standing.incomplete,
            movedByThisRun: result.movedByThisRun,
            healingHeldBy: standing.overlapping,
        },
    };

    if (result.escaped.length > 0) {
        process.stdout.write(
            `WROTE OUTSIDE ITS DECLARED SCOPE  ${result.escaped.join(", ")}. A RUN'S DECLARATION IS A CLAIM AND ITS ` +
                "WRITES ARE A FACT, so this is the one comparison here between a claim and an OBSERVATION — every other " +
                "question a run answers is a declaration against another declaration, which cannot catch a declaration " +
                "that is false. A run writing outside what it declared makes every concurrency argument resting on that " +
                "declaration unsound, because a party that read the claim and stayed clear of it was never clear at all\n",
        );
    }

    if (result.unfulfilled.length > 0) {
        process.stdout.write(
            `CLAIMED A WRITE THAT DID NOT HAPPEN  ${result.unfulfilled.join(", ")}. THIS IS THE WITNESSED HALF RATHER ` +
                "THAN THE PUBLISHED ONE: a run reporting what it healed is its own ACCOUNT, and an account satisfies a " +
                "party entitled to an ANSWER while a party entitled to a GUARANTEE needs the claim compared against " +
                "something outside the author. The stamp taken when each surface was read is that outside thing, so a " +
                "path this run says it repaired whose content never moved is a claim the tree contradicts — which no " +
                "amount of publishing the claim more clearly would ever catch\n",
        );
    }

    if (result.unresolvedScope !== undefined) {
        releaseStanding(REPO_ROOT, runAgent, runAt);
        process.stdout.write(
            `REFUSED  the scope ${result.unresolvedScope} resolved to NO PATH, so this run measured nothing and wrote no ` +
                "report. AN UNRESOLVABLE SCOPE AND A GENUINELY EMPTY ONE PRODUCE THE SAME RUN, which is why this refuses " +
                "rather than publishing: every walk narrows honestly to nothing, the verdict reads as a measurement, and a " +
                "reader cannot tell a scope that reached nothing from a population that held nothing. A report over a " +
                "scope that was never assembled is a verdict about a population that does not exist, and on this surface " +
                "the report IS the state. A scope is resolved against the REPOSITORY ROOT and walked as a directory, so a " +
                "path under a declared prefix is named with that prefix; the same tree named bare reaches nothing and " +
                "named with its prefix reaches its members\n",
        );
        process.exit(2);
    }

    const superseded = report.authoritative ? supersedingRun(REPO_ROOT, report.at) : 0;
    const target = writePipelineReport(REPO_ROOT, report);

    const lines = result.stages.map((s) => {
        const mark = s.bypassed ? "BYPASS" : s.findings === 0 ? "  pass" : "  FAIL";
        const detail = s.bypassed ? "skipped" : `${s.findings} findings, ${s.healed} healed`;
        return `  ${mark}  ${s.stage}/${s.rule}  ${detail}`;
    });

    process.stdout.write(
        `${report.verdict.toUpperCase()}  registered=${report.registered} scanned=${report.scanned} ` +
            `findings=${report.findings.length}\n` +
            (lines.length > 0 ? `${lines.join("\n")}\n` : "") +
            (report.bypassed ? "a bypassed run does not satisfy a completion claim\n" : "") +
            (result.movedByThisRun.length === 0
                ? ""
                : `REPAIRED WHILE READING  ${result.movedByThisRun.join(", ")}. THESE MOVED BECAUSE THIS RUN HEALED ` +
                  "THEM, AND A RUN'S OWN FOOTPRINT IS NOT CONTENTION: the standing withdrawal exists for a write this " +
                  "run did not make, so counting a repair the run performed and reported would make every HEALING run " +
                  "un-quotable — the more a run fixes the less its verdict may be believed, which inverts the " +
                  "mechanism. The set is named rather than silently subtracted, and one residual ambiguity is stated " +
                  "rather than hidden: a surface this run healed AND a peer also wrote is indistinguishable from one " +
                  "only this run healed, because after the repair the stamp is this run's either way\n") +
            (result.moved.length === 0
                ? ""
                : `CONTENDED  ${String(result.moved.length)} read surface(s) changed while this run was scanning, so its ` +
                  `verdict describes an interleaving rather than a state and is NOT authoritative — re-run once the peer ` +
                  `write has landed: ${result.moved.join(", ")}\n`) +
            (report.authoritative
                ? ""
                : `narrowed run (scope=${report.scope}): diagnostic only, and it writes NOTHING — not over the aggregate ` +
                  `and not beside it, so ${AGGREGATE_REPORT} still holds the last whole-scope derivation and remains the ` +
                  "only report there is\n") +
            (result.incomparable.length === 0
                ? ""
                : `NOT MEASURED  ${result.incomparable.join(", ")} — SKIPPED FOR TWO DIFFERENT REASONS THAT SHARE ONE ACTION, ` +
                  "stated apart because they decide different futures. A walk whose SUBJECTS come from a declared read and " +
                  "whose EVIDENCE comes from the scanned paths is NOT NARROWABLE: narrowing leaves every subject to be " +
                  "judged and removes the evidence that would clear it, so each fails for want of a thing the scope took " +
                  "away, and a run that scanned nothing cannot have found a defect in anything — that verdict is FALSE and " +
                  "can never be published narrowed. A walk that declares BOTH halves is SCOPE-INVARIANT: nothing shrinks, " +
                  "its findings are TRUE, and it reports on a population outside the jurisdiction this run declared — " +
                  "wrong in jurisdiction rather than in content, and publishable narrowed only by a run willing to say " +
                  "which population it measured. A walk that MUTATES from a root-derived set is skipped on a third ground " +
                  "again: skipping protects artifacts the scope never bounded, and its findings being honest does not " +
                  "make its deletions in-scope\n") +
            (superseded === 0
                ? ""
                : "SUPERSEDED  the aggregate carries a run that started AFTER this one, so this result is STREAMED and not " +
                  "written: replacing a newer whole-scope measurement with an older one is the lost write this tree " +
                  "refuses everywhere else, arriving on the artifact every seat is told to read. It is not written beside " +
                  "it either — a second file under a derived name is accumulation, and the report is overwritten so that " +
                  "after a run it is always the truth. There is one of it\n") +
            (target === null
                ? "STREAMED  this result is printed and NOT written. A report is OVERWRITTEN so it is always the truth " +
                  "after a run, so there is exactly one of it and its subject is the whole scope. A narrowed run measures " +
                  "a different question and would need a different name to sit beside it — which is a second document " +
                  "about the aggregate's subject under a key derived from how the run was invoked, and that is " +
                  "accumulation. The verdict above is the whole of what this run produced; the aggregate on disk is " +
                  "untouched and still holds the last whole-scope derivation\n"
                : `report: ${toPosix(REPO_ROOT, target)}\n`),
    );

    const unidentified = releaseStanding(REPO_ROOT, runAgent, runAt);
    if (unidentified !== null) process.stdout.write(`${unidentified}\n`);
    process.exit(report.verdict === "pass" ? 0 : 1);
}

void main();
