import { RULE_ROOT } from "../core/constants/layer.constants.ts";
import { ENTRYPOINT_ROOTS } from "../core/constants/path.constants.ts";
import { DIGEST_ROOT } from "../core/constants/template.constants.ts";
import { identityOf } from "../core/registries/rule.registry.ts";
import { publishedKinds } from "../core/runners/gate.runner.ts";
import { KINDS as GATE_KINDS } from "../core/steps/gate.step.ts";
import { declaredKinds as qualityKinds } from "../core/steps/quality.step.ts";
import { KINDS as SNAPSHOT_KINDS } from "../core/steps/snapshot.step.ts";
import { KINDS as TYPECHECK_KINDS } from "../core/steps/typecheck.step.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";
import { rosterRows, UNBUILT_HALF } from "../core/validators/coverage.validator.ts";
import { stepEmittedIds } from "../core/validators/governance.validator.ts";

const ROSTER = `${DIGEST_ROOT}conduct.rule.md`;

const STATED_CELLS = 5;

const NO_CHECKABLE_HALF = "—";

const PAIR_SEPARATOR = "/";

export const FAILING_QUESTIONS = ["no-declared-surface", "subject-is-an-act", "empty-population", "not-evaluable"];

export function corpusOf(
    cell: string,
    ruleIds: ReadonlySet<string>,
    stepIds: ReadonlySet<string>,
    commands: ReadonlySet<string>,
    certified: ReadonlySet<string>,
    stepKinds: ReadonlySet<string>,
): string {
    const out: string[] = [];

    for (const member of cell.split(" ").filter((held) => held.length > 0)) {
        if (FAILING_QUESTIONS.includes(member)) {
            out.push(`${member} → failing question`);
            continue;
        }

        if (member.includes(PAIR_SEPARATOR)) {
            const named = certified.has(member)
                ? "certified kind"
                : stepKinds.has(member)
                  ? "pipeline step kind"
                  : "unkeyed";
            out.push(`${member} → ${named}`);
            continue;
        }

        const sets: string[] = [];
        if (ruleIds.has(member)) sets.push("registered rule");
        if (stepIds.has(member)) sets.push("pipeline step");
        if (commands.has(member)) sets.push("entry-point command");

        out.push(`${member} → ${sets.length === 0 ? "unresolved" : sets.join(" and ")}`);
    }

    return out.join(", ");
}

export function observerResolves(cell: string, registered: ReadonlySet<string>, keyed: ReadonlySet<string>): boolean {
    const members = cell.split(" ").filter((member) => member.length > 0);
    if (members.length === 0) return false;

    if (members.some((member) => FAILING_QUESTIONS.includes(member))) {
        return members.length === 1;
    }

    for (const member of members) {
        const corpus = member.includes(PAIR_SEPARATOR) ? keyed : registered;
        if (!corpus.has(member)) return false;
    }

    return true;
}

function decideObserver(slug: string, cell: string): string {
    return (
        `${slug} names ${cell} as what observes its checkable half, and no registered check and no entry point ` +
        "carries that name. The cell's vocabulary is the set of things that OBSERVE — a registered check id, an " +
        "id the pipeline's own steps emit, or an entry point named by its command — plus the two markers, and " +
        "every member of the first three resolves against something derived on each run. So a cell naming an " +
        "observer that no longer resolves reads exactly like one that does: the entry states an enforcement " +
        "claim, a reader confirms it, and the set the claim is about says otherwise, with the disagreement " +
        "invisible from either side. Name the observer as the thing it actually resolves to, or move the cell " +
        "to the marker that states the half is unbuilt — and where an observer was renamed rather than " +
        "withdrawn, the cell follows the rename, since the name is the operand this join resolves against"
    );
}

function decide(slug: string): string {
    return (
        `${slug} carries no value in its third cell, so its enforcement half is UNSTATED rather than absent. ` +
        "The cell draws from a closed set of three and each member is a different claim: a registered gate id " +
        "names what OBSERVES the checkable half, the unbuilt marker states that the half is decidable and nobody " +
        "has built it, which is enforcement debt and belongs in a countable backlog, and the absent marker states " +
        "that the entry was assessed and has no checkable half at all. An EMPTY cell states none of the three, so " +
        "an oversight and a considered assessment read identically and the debt figure counts neither. Populate it " +
        "with the member the entry warrants. THIS CHECK READS PRESENCE AND CLAIMS NOTHING MORE: whether the value " +
        "is the RIGHT one is a walk over the entry against the four-question instrument, and whether it NAMES a " +
        "registered observer is decided by the coverage walk, which reads the rule sources this check does not"
    );
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant:
        "every entry in the conduct roster carries a third cell, so an unstated enforcement half is distinguishable from an assessed one",
    extensions: [],
    kinds: ["unstatedHalf", "unresolvedObserver"],
    heals: false,
    wholeScopeOnly: true,

    reads: [ROSTER],

    check(context: RuleContext): RuleResult {
        if (!context.paths.includes(ROSTER)) {
            return {
                findings: [],
                healed: [],
                derivations: { roster: "outside this run's path set", skippedAsOutOfScope: [ROSTER] },
            };
        }

        const rows = rosterRows(context.read(ROSTER));
        const unstated = rows.filter((row) => row.cells < STATED_CELLS || row.cell.length === 0);

        const ruleIds = new Set<string>();
        for (const path of context.paths) {
            if (!path.startsWith(RULE_ROOT)) continue;
            ruleIds.add(identityOf(path));
        }

        const emitted = [
            ...stepEmittedIds(context.repoRoot),
            ...GATE_KINDS,
            ...SNAPSHOT_KINDS,
            ...TYPECHECK_KINDS,
            ...qualityKinds(),
        ];
        const stepIds = new Set(emitted.filter((id) => !id.includes(PAIR_SEPARATOR)));
        const stepKinds = new Set(emitted.filter((id) => id.includes(PAIR_SEPARATOR)));

        const commands = new Set<string>();
        for (const path of context.paths) {
            const root = ENTRYPOINT_ROOTS.find((entry) => path.startsWith(entry));
            if (root === undefined) continue;
            const name = path.slice(root.length);
            const dot = name.indexOf(".");
            if (dot > 0) commands.add(name.slice(0, dot));
        }

        const registered = new Set<string>([...ruleIds, ...stepIds, ...commands]);
        const certified = new Set(publishedKinds(context.repoRoot));
        const keyed = new Set<string>([...certified, ...stepKinds]);

        const corpora: Record<string, string> = {};
        for (const row of rows) {
            if (row.cells < STATED_CELLS || row.cell.length === 0) continue;
            if (row.cell === UNBUILT_HALF || row.cell === NO_CHECKABLE_HALF) continue;
            if (!observerResolves(row.cell, registered, keyed)) continue;
            corpora[row.slug] = corpusOf(row.cell, ruleIds, stepIds, commands, certified, stepKinds);
        }

        const unresolved = rows.filter((row) => {
            if (row.cells < STATED_CELLS || row.cell.length === 0) return false;
            if (row.cell === UNBUILT_HALF || row.cell === NO_CHECKABLE_HALF) return false;
            return !observerResolves(row.cell, registered, keyed);
        });

        const findings: Finding[] = unstated.map((row) => ({
            rule: "conduct/unstatedHalf",
            path: ROSTER,
            line: row.line,
            locus: row.slug,
            stack: [
                { check: "row", resolved: row.slug },
                { check: "cell", resolved: "absent" },
            ],
            actual: `${row.slug} carries no third cell`,
            expected: null,
            remediation: {
                action: "declare",
                from: row.slug,
                to: null,
                target: ROSTER,
                deterministic: false,
                decide: decide(row.slug),
            },
            healed: false,
        }));

        for (const row of unresolved) {
            findings.push({
                rule: "conduct/unresolvedObserver",
                path: ROSTER,
                line: row.line,
                locus: row.slug,
                stack: [
                    { check: "row", resolved: row.slug },
                    { check: "cell", resolved: row.cell },
                    { check: "registered", resolved: "absent" },
                ],
                actual: `${row.slug} names ${row.cell} as its observer and no registered check carries that id`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: row.cell,
                    to: null,
                    target: ROSTER,
                    deterministic: false,
                    decide: decideObserver(row.slug, row.cell),
                },
                healed: false,
            });
        }

        return {
            findings,
            healed: [],
            derivations: {
                roster: "present",
                rows: rows.length,
                rosterRowsWalked: rows.map((row) => row.slug),
                unstated: unstated.map((row) => row.slug),
                unresolvedObserver: unresolved.map((row) => `${row.slug} → ${row.cell}`),
                registeredObservers: [...registered].sort(),
                observerCorpora: corpora,
                corpusBound:
                    "each resolving cell names which corpus every member came from, because the BARE namespace is two " +
                    "merged flat — a registered rule id and an entry-point command name are the same SHAPE, so the " +
                    "value's own form separates a keyed pair from a bare member and cannot separate the two bare kinds " +
                    "from each other. Measured on the roster: one token names a rule in one cell and a command in " +
                    "another, both correct and both resolving, with only the entry's prose telling a reader which. THE " +
                    "RESOLUTION ALREADY KNOWS — rule ids come from the rule sources and command names from the " +
                    "entry-point roots — so publishing it costs no authored vocabulary and asks nothing of an author, " +
                    "which is why it is done here rather than by typing the cell",
                population:
                    "the ROWS of one declared digest, never the files this run hands every check — so this report " +
                    "publishes its members under a key naming its own unit and declares no reached set at all. A " +
                    "reached count is a claim about members OF THE HANDED SET, and answering it in a foreign unit " +
                    "satisfies the disclosure while breaking the audit: the subtraction reads as a hundred skipped " +
                    "files when the check was never walking files. One file is opened and every row in it is walked, " +
                    "so there is nothing skipped and nothing to name",
                notChecked:
                    "whether the named observer is the RIGHT one for that half — the join decides that the id " +
                    "RESOLVES against the registered set and never that the check it names observes the property " +
                    "the entry describes, which is a reading of both. The registered set is the rule ids this run " +
                    "hands the check plus the ids the pipeline's own steps emit, which is the same set the coverage " +
                    "walk builds, plus every entry point named by its command — because an entry point that REFUSES " +
                    "a closure is a stronger observer than any registered check offers and carries no rule id, so a " +
                    "join over rule ids alone reports the strongest enforcement in the tree as unresolved. That case " +
                    "was measured on this check's first run against the real roster. A cell naming an emitted KIND " +
                    "rather than any of the three still resolves against nothing and is reported. This check ranges " +
                    "over every roster row for both axes and over nothing else",
            },
        };
    },
};
