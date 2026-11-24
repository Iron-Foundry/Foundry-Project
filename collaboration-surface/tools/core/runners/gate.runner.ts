import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { type GateFixture } from "../fixtures/gate.fixture.ts";
import { discoverFixtures } from "../registries/fixture.registry.ts";
import { discoverRules } from "../registries/rule.registry.ts";
import { judge, judgeBranch, unsuppliedReads } from "../validators/gate.validator.ts";
import type { GateOutcome } from "../validators/gate.validator.ts";

export type { GateOutcome } from "../validators/gate.validator.ts";

export interface RunnerReport {
    readonly outcomes: readonly GateOutcome[];
    readonly branches: readonly GateOutcome[];
    readonly proven: number;
    readonly exempt: number;
    readonly untested: number;
    readonly failed: number;
    readonly branchesProven: number;
    readonly branchesOpen: number;
    readonly unfixturedKinds: readonly string[];
    readonly kindVerdicts: Readonly<Record<string, string>>;
    readonly movedVerdicts: { readonly kinds: readonly string[]; readonly bound: string };
    readonly treeLoadedReads: { readonly fixtures: readonly string[]; readonly bound: string };
    readonly kindScope: { readonly declaredKinds: number; readonly rules: number; readonly bound: string };
}

const GATE_REPORT = "gate.report.generated.json";

export function verdictKey(rule: string, kind: string | undefined): string {
    return kind === undefined ? rule : `${rule}/${kind}`;
}

const CLEAR_STATES = ["proven", "exempt"];

export function worstOf(held: string | undefined, arriving: string): string {
    if (held === undefined) return arriving;
    if (!CLEAR_STATES.includes(held)) return held;
    return arriving;
}

export function publishedKinds(repoRoot: string): string[] {
    return Object.keys(priorKindVerdicts(repoRoot));
}

function priorKindVerdicts(repoRoot: string): Record<string, string> {
    const path = resolve(repoRoot, GENERATED_DIR, GATE_REPORT);
    if (!existsSync(path)) return {};

    try {
        const parsed: unknown = JSON.parse(readSurface(path, "utf8"));
        if (typeof parsed !== "object" || parsed === null) return {};

        const held = (parsed as Record<string, unknown>)["kindVerdicts"];
        if (typeof held !== "object" || held === null) return {};

        const out: Record<string, string> = {};
        for (const [kind, state] of Object.entries(held as Record<string, unknown>)) {
            if (typeof state === "string") out[kind] = state;
        }
        return out;
    } catch {
        return {};
    }
}

export async function runGates(repoRoot: string): Promise<RunnerReport> {
    const registry = await discoverRules(repoRoot);
    const fixtures = await discoverFixtures(repoRoot);
    const byRule = new Map<string, GateFixture[]>();
    const declared = fixtures.gates;
    for (const fixture of declared) {
        const held = byRule.get(fixture.rule) ?? [];
        held.push(fixture);
        byRule.set(fixture.rule, held);
    }

    const outcomes: GateOutcome[] = [];
    const exposed: string[] = [];
    const verdicts: Record<string, string> = {};
    const prior = priorKindVerdicts(repoRoot);

    for (const registered of registry.rules) {
        const held = byRule.get(registered.id);
        if (held === undefined || held.length === 0) {
            outcomes.push({
                rule: registered.id,
                state: "untested",
                detail: "no fixture pair declares what this rule must fire on and must accept",
            });
            continue;
        }

        for (const fixture of held) {
            const missing = unsuppliedReads(registered.declaration, fixture);
            if (missing.length === 0) continue;
            exposed.push(`${verdictKey(registered.id, fixture.kind)}: ${missing.join(", ")}`);
        }

        const judged = held.map((fixture) => judge(registered.id, registered.declaration, repoRoot, fixture));
        for (let index = 0; index < held.length; index += 1) {
            const fixture = held[index];
            const outcome = judged[index];
            if (fixture === undefined || outcome === undefined) continue;
            const key = verdictKey(registered.id, fixture.kind);
            verdicts[key] = worstOf(verdicts[key], outcome.state);
        }

        const broken = judged.find((outcome) => outcome.state !== "proven" && outcome.state !== "exempt");
        if (broken !== undefined) {
            outcomes.push(broken);
            continue;
        }

        outcomes.push({
            rule: registered.id,
            state: judged[0]?.state ?? "proven",
            detail: judged.map((outcome) => outcome.detail).join(" · "),
        });
    }

    const exposedKinds = new Set(exposed.map((entry) => entry.slice(0, entry.indexOf(":"))));
    const movedVerdicts: string[] = [];
    for (const [kind, state] of Object.entries(verdicts)) {
        const was = prior[kind];
        if (was === undefined || was === state) continue;
        movedVerdicts.push(
            `${kind}: ${was} → ${state}${exposedKinds.has(kind) ? " · this kind's fixture leaves a declared read to the tree" : ""}`,
        );
    }

    const branches = fixtures.branches.map((fixture) => judgeBranch(fixture));

    let proven = 0;
    let exempt = 0;
    let untested = 0;
    let failed = 0;
    for (const outcome of outcomes) {
        if (outcome.state === "proven") proven += 1;
        else if (outcome.state === "exempt") exempt += 1;
        else if (outcome.state === "untested") untested += 1;
        else failed += 1;
    }

    const fixtured = new Set(
        declared.filter((one) => one.kind !== undefined).map((one) => `${one.rule}/${String(one.kind)}`),
    );
    const declaredKinds = registry.rules
        .flatMap((entry) => entry.declaration.kinds.map((kind) => `${entry.id}/${kind}`))
        .sort();
    const unfixturedKinds = declaredKinds.filter((kind) => !fixtured.has(kind));

    const branchesProven = branches.filter((outcome) => outcome.state === "proven").length;

    return {
        outcomes,
        branches,
        proven,
        exempt,
        untested,
        failed,
        branchesProven,
        branchesOpen: branches.length - branchesProven,
        unfixturedKinds,
        kindVerdicts: verdicts,
        movedVerdicts: {
            kinds: movedVerdicts,
            bound:
                "each entry names a kind whose verdict DIFFERS from the previous run's. The prior verdict is retained " +
                "BY this comparison and consumed by it, which is what makes it an operand rather than a diary — remove " +
                "the comparison and the value stops being written. IT IS THE DELIVERY HALF OF THE TREE-LOADED-READS " +
                "POPULATION: that list is correct and reaches only a reader who already suspects what it would tell " +
                "them, because the defect it describes is a proof changing verdict when ANOTHER party edits an " +
                "unrelated file — so the reader who needs it has just been handed a result they cannot explain and no " +
                "signal saying this is that case. A moved verdict names the case AT THE MOMENT IT OCCURS, and where the " +
                "moved kind also leaves a declared read to the tree the entry says so, which is the explanation beside " +
                "the signal. Movement is also the discriminator the artifact cannot carry: deliberate reliance is " +
                "stable and a forgotten sibling is exactly what moves when unrelated work lands",
        },
        treeLoadedReads: {
            fixtures: exposed,
            bound:
                "each entry names a fixture whose rule declares a read the fixture does not supply, so the certifier " +
                "loads it FROM THE REAL TREE and that half of the proof ranges over content the fixture never declared. " +
                "THIS IS PUBLISHED RATHER THAN FAILED, and the reason is measured rather than assumed: the same " +
                "comparison as a failing check names most of the fixture population, because a rule that DERIVES its " +
                "schema from a contract surface is meant to be proven against the real contract — so a red here would " +
                "fire on the correct pattern and the incorrect one alike, which is a check that punishes the right " +
                "answer. What it cannot separate is a fixture relying on a contract deliberately from one that supplied " +
                "a sibling and forgot this member, and nothing in either artifact distinguishes them. The measured harm " +
                "is real: a fixture in this shape changes verdict when unrelated work lands, so its failure is triggered " +
                "by another party's edit and presents as a flake with no attributable cause. The list is the population " +
                "a reader checks when a proof moves for no reason it can find",
        },
        kindScope: {
            declaredKinds: declaredKinds.length,
            rules: registry.rules.length,
            bound:
                "every kind is DECLARED by the check that emits it and read from the registry, so the population " +
                "has no spelling to miss, no quote style to prefer, no delegation depth to bound and no " +
                "attribution to guess. THE PRIOR MECHANISM RECOVERED THIS SET BY MATCHING SOURCE TEXT, and a " +
                "check composing its kind as a template literal matched none of its forms — so the subtraction " +
                "that reports an unfixtured kind ranged over an empty population for those checks and could " +
                "never report a gap for one, publishing a zero whose own greenness was the evidence that what it " +
                "measured was working. A DECLARATION CAN STILL BE WRONG and the direction is the honest one: a " +
                "kind a check emits and does not declare is unproven and unreported, which is the same silence " +
                "as before for that one kind, while the population is now stated per check rather than inferred " +
                "for all of them. What closes that residue is the declaration and the emission sharing one " +
                "operand, which is a further change on the emitting sites rather than a bound on this one",
        },
    };
}
