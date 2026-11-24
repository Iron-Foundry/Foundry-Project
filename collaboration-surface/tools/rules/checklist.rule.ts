import { contentIsImmutable, regionAdmitsRewrite, slotList, surfacePrefix } from "../../config/surface.config.ts";
import { itemSpanFlags } from "../core/analyzers/board.analyzer.ts";
import { BLOCKING_SUFFIX, VENUE_ARCHIVE } from "../core/constants/blocking.constants.ts";
import { DECIDE, PLANNING_ROOTS } from "../core/constants/checklist.constants.ts";
import { activeSet, contractOf, countBreaches, inspectSurface } from "../core/coordinators/checklist.coordinator.ts";
import { declaresContract, taskBlocks } from "../core/validators/checklist.validator.ts";
import { declaredDistributions } from "../core/validators/converge.validator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function basenameOf(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? path : path.slice(slash + 1);
}

function directoryOf(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? "." : path.slice(0, slash);
}

export function planningSurfaces(paths: readonly string[]): string[] {
    return paths
        .filter((path) => path.endsWith(".md"))
        .filter((path) => PLANNING_ROOTS.includes(directoryOf(path)))
        .sort();
}

function isRewritable(path: string): boolean {
    return !contentIsImmutable(path);
}

function isUpstream(path: string): boolean {
    const prefix = surfacePrefix();

    for (const tail of slotList("surface", "upstream")) {
        const root = prefix.length === 0 ? tail : `${prefix}/${tail}`;
        if (path.startsWith(`${root}/`)) return true;
    }

    for (const root of slotList("project", "upstream_roots")) {
        if (path.startsWith(`${root}/`)) return true;
    }

    return false;
}

export function activeVenues(paths: readonly string[]): string[] {
    return paths
        .filter((path) => path.endsWith(BLOCKING_SUFFIX))
        .filter((path) => !path.startsWith(VENUE_ARCHIVE))
        .sort();
}

export function authoredSurfaces(paths: readonly string[]): string[] {
    return paths
        .filter((path) => path.endsWith(".md"))
        .filter((path) => !isUpstream(path))
        .filter(isRewritable)
        .sort();
}

function checklistFinding(
    kind: string,
    path: string,
    line: number,
    locus: string,
    actual: string,
    expected: string,
): Finding {
    return {
        rule: `checklist/${kind}`,
        path,
        line,
        locus,
        stack: [
            { check: "checklist", resolved: basenameOf(path) },
            { check: kind, resolved: locus },
        ],
        actual,
        expected,
        remediation: {
            action: "declare",
            from: locus,
            to: null,
            target: path,
            deterministic: false,
            decide: DECIDE[kind] ?? kind,
        },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant:
        "a planning surface carries tasks and their contracts, current and future only, and one carrying the " +
        "checklist concern answers to the template's rendered contract — axes and ripple read at the phase level " +
        "because that is where the render emits them, whatever level the model attaches them to; and the " +
        "transcribed-count half binds EVERY authored surface rather than the planning ones alone, because a " +
        "surface stating how many of a derived set exists has copied a fact the pipeline computes wherever it " +
        "sits, with the frozen and upstream surfaces outside the population by derivation from their declared " +
        "lifetime rather than by a list, since a finding on a surface nothing may rewrite is a repair nobody can " +
        "reach",
    extensions: [".md"],
    kinds: [
        "notAChecklist",
        "gateUnnamed",
        "axesMissing",
        "rippleMissing",
        "genesisMissing",
        "precheckedGate",
        "contractIncomplete",
        "history",
        "literalCount",
        "phaseWithoutTask",
        "danglingBinding",
        "danglingReference",
        "duplicateId",
        "closureBeforeItsDependencies",
        "spentDistribution",
        "undeclaredDistribution",
    ],
    heals: false,
    wholeScopeOnly: true,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const derivations: Record<string, unknown> = {};

        const contract = contractOf(context.repoRoot);
        const active = activeSet(context);
        derivations["contract"] = contract;
        derivations["activeAgents"] = [...active];

        const authored = authoredSurfaces(context.paths);
        const planning = planningSurfaces(context.paths);
        derivations["countReached"] = authored;
        derivations["contractReached"] = planning;

        const withdrawn: Record<string, string> = {};

        for (const path of authored) {
            const source = context.read(path);
            const lines = source.split("\n");
            const sealed = regionAdmitsRewrite(path, "item") ? [] : itemSpanFlags(source);

            for (const breach of countBreaches(lines)) {
                const { kind, line, locus, actual, expected } = breach;

                if (sealed[line - 1] === true) {
                    withdrawn[`${path}:${String(line)}`] =
                        `${locus} sits inside an item span, and this surface declares that region APPEND-ONLY — ` +
                        "the remediation for this kind is a REWRITE, so a finding here offers the one operation the " +
                        "region forbids, to every party, on every run, forever. A report nobody can drain trains every " +
                        "reader to discount the colour and the cost lands on the findings beside it, so the standing is " +
                        "WITHDRAWN and the observation is published rather than raised";
                    continue;
                }

                findings.push(checklistFinding(kind, path, line, locus, actual, expected));
            }
        }

        derivations["withdrawnInSealedRegion"] = withdrawn;

        for (const path of planning) {
            const lines = context.read(path).split("\n");
            const report = inspectSurface(path, lines, contract, active);

            for (const breach of report.breaches) {
                const { kind, line, locus, actual, expected } = breach;
                findings.push(checklistFinding(kind, path, line, locus, actual, expected));
            }

            derivations[path] = report.derivations;
        }

        const live = activeVenues(context.paths);
        const distributions: string[] = [];
        const spent: string[] = [];

        const declaring = new Set(
            declaredDistributions(planning, (target) => context.read(target)).map((entry) => entry.path),
        );
        const undeclared: string[] = [];

        for (const path of planning) {
            if (declaring.has(path)) continue;

            const lines = context.read(path).split("\n");
            if (!declaresContract(taskBlocks(lines))) continue;

            undeclared.push(path);
            findings.push(
                checklistFinding(
                    "undeclaredDistribution",
                    path,
                    1,
                    basenameOf(path),
                    "this planning surface carries task rows and declares no distribution, so it is held to neither the phase contract nor the spent check — both key on that one declaration",
                    "the venue this surface distributes, declared in its own header, or the surface retired",
                ),
            );
        }

        derivations["undeclaredDistributions"] = undeclared;

        for (const { path, line, declares } of declaredDistributions(planning, (target) => context.read(target))) {
            distributions.push(`${path} · ${declares}`);
            if (live.some((venue) => venue.endsWith(declares))) continue;

            spent.push(`${path} · ${declares}`);
            findings.push(
                checklistFinding(
                    "spentDistribution",
                    path,
                    line,
                    declares,
                    `this planning surface declares ${declares} and the active tree holds no venue by that name, so its distribution is SPENT`,
                    "the surface retired where its dependencies allow, or its own header recording that it is spent and why",
                ),
            );
        }

        derivations["declaredDistributions"] = distributions;
        derivations["activeVenues"] = live;
        derivations["spentDistributions"] = spent;
        derivations["spentDistributionOperands"] =
            "both operands are DECLARED and neither is a reading of the surface's contents: the header naming a venue, " +
            "and the set of venue files in the active tree. A spent distribution is a STATE rather than an error — the " +
            "work it distributed is either built or blocked — so the finding names the two dispositions and decides " +
            "between them for nobody. What it answers is the question a reader opening the planning directory cannot: " +
            "which surface distributes a venue that is still being argued. A surface whose own retirement condition is " +
            "decidable and whose state nothing derives can only be closed by somebody remembering to look.";

        return { findings, healed: [], derivations };
    },
};
