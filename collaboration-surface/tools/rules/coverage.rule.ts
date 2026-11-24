import { isResolved, slotCount, slotList } from "../../config/surface.config.ts";
import { RULE_ROOT } from "../core/constants/layer.constants.ts";
import { AXIS_DOCUMENTS, PRINCIPLE_CATALOG } from "../core/constants/path.constants.ts";
import { DIGEST_ROOT } from "../core/constants/template.constants.ts";
import { walkPrinciples } from "../core/readers/architecture.reader.ts";
import { readDeclaredRules, type DeclaredRule } from "../core/readers/rule.reader.ts";
import { identityOf } from "../core/registries/rule.registry.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";
import { checkableHalves, inspectDigests, UNBUILT_HALF } from "../core/validators/coverage.validator.ts";
import { stepEmittedIds } from "../core/validators/governance.validator.ts";

const DIGESTS = DIGEST_ROOT;

const RULE_SOURCES = RULE_ROOT;

const UNGATED = "none";

const CONDUCT = "conduct";

const CONDUCT_REGISTRY = `${DIGEST_ROOT}conduct.rule.md`;

const SLOT_SEPARATOR = ".";

const SECTIONS = ["project", "surface", "convention", "limits", "execution"] as const;

const UNREACHED_FAILS = isResolved("convention", "unreached_gate_fails")
    ? slotCount("convention", "unreached_gate_fails") !== 0
    : false;

function conditionalSlot(slug: string): { section: string; name: string; reached: boolean } | null {
    if (!isResolved("convention", "conditional_gates")) return null;

    for (const entry of slotList("convention", "conditional_gates")) {
        const space = entry.indexOf(" ");
        if (space <= 0 || entry.slice(0, space) !== slug) continue;

        const path = entry.slice(space + 1).trim();
        const dot = path.indexOf(SLOT_SEPARATOR);
        if (dot <= 0) continue;

        const section = path.slice(0, dot);
        const name = path.slice(dot + 1);
        const known = SECTIONS.find((one) => one === section);
        if (known === undefined) continue;

        return { section, name, reached: isResolved(known, name) };
    }

    return null;
}

function finding(kind: string, path: string, rule: DeclaredRule, actual: string, decide: string): Finding {
    return {
        rule: `coverage/${kind}`,
        path,
        line: rule.line,
        locus: rule.slug,
        stack: [
            { check: "declared", resolved: rule.slug },
            { check: "gate", resolved: rule.gate },
            { check: kind, resolved: "failed" },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: rule.slug, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "meta",
    jurisdiction: "taxonomy",
    invariant:
        "every declared rule across every governing surface carries a registered gate or a proven conduct claim, and an ungated rule fails",
    extensions: [".md", ".ts"],
    kinds: [
        "digestDeclares",
        "duplicateSlug",
        "unbuiltCheckableHalf",
        "undeclaredExpansion",
        "ungatedBacklog",
        "unknownGate",
        "unprovenConduct",
        "unreachedGate",
    ],
    heals: true,
    wholeScopeOnly: true,
    reads: PRINCIPLE_CATALOG === null ? AXIS_DOCUMENTS : [...AXIS_DOCUMENTS, PRINCIPLE_CATALOG],

    check(context: RuleContext, fix: boolean): RuleResult {
        const findings: Finding[] = [];
        const healed: string[] = [];
        const gated: { slug: string; gate: string; axis: string }[] = [];
        const ungated: { slug: string; axis: string; locked: boolean }[] = [];

        const conduct: { slug: string; axis: string; locked: boolean }[] = [];

        const conditional: { slug: string; slot: string; reached: boolean }[] = [];

        const digests = context.paths.filter((path) => path.startsWith(DIGESTS));

        const registered = new Set<string>();
        for (const path of context.paths) {
            if (!path.startsWith(RULE_SOURCES)) continue;
            registered.add(identityOf(path));
        }
        for (const id of stepEmittedIds(context.repoRoot)) registered.add(id);

        const registry = context.paths.includes(CONDUCT_REGISTRY) ? context.read(CONDUCT_REGISTRY) : "";

        const seen = new Map<string, string>();

        for (const path of AXIS_DOCUMENTS) {
            if (!context.paths.includes(path)) continue;
            const source = context.read(path);

            for (const declared of readDeclaredRules(source)) {
                const previous = seen.get(declared.slug);
                if (previous !== undefined) {
                    findings.push(
                        finding(
                            "duplicateSlug",
                            path,
                            declared,
                            `${declared.slug} is also declared in ${previous}`,
                            "the slug is the only rule identifier, so two declarations make a search resolve two different rules — merge them or rename one",
                        ),
                    );
                }
                seen.set(declared.slug, path);

                if (declared.gate === UNGATED) {
                    ungated.push({ slug: declared.slug, axis: path, locked: declared.locked });
                    findings.push(
                        finding(
                            "ungatedBacklog",
                            path,
                            declared,
                            `${declared.slug} declares gate: none`,
                            "an ungated rule is unfinished work rather than a status — register a gate that observes it, or declare gate: conduct and write the proof in the conduct registry stating what would have to become observable",
                        ),
                    );
                    continue;
                }

                if (declared.gate === CONDUCT) {
                    conduct.push({ slug: declared.slug, axis: path, locked: declared.locked });
                    if (registry.includes(`\`${declared.slug}\``)) continue;

                    findings.push(
                        finding(
                            "unprovenConduct",
                            path,
                            declared,
                            `${declared.slug} declares gate: conduct but ${CONDUCT_REGISTRY} carries no proof for it`,
                            `a conduct declaration is a claim that no artifact observes the rule, and an unproven claim is an escape hatch — state in ${CONDUCT_REGISTRY} what would have to be observable for it to be gated, or gate it`,
                        ),
                    );
                    continue;
                }

                gated.push({ slug: declared.slug, gate: declared.gate, axis: path });

                const needed = conditionalSlot(declared.slug);
                if (needed !== null) {
                    conditional.push({
                        slug: declared.slug,
                        slot: `${needed.section}.${needed.name}`,
                        reached: needed.reached,
                    });
                    if (!needed.reached && UNREACHED_FAILS) {
                        findings.push(
                            finding(
                                "unreachedGate",
                                path,
                                declared,
                                `${declared.slug} names gate "${declared.gate}", which registers, and its enforcing branch depends on ${needed.section}.${needed.name}, which does not resolve`,
                                "the rule is GATED-WHEN-RESOLVED and currently UNREACHED, which is a third state rather than either of the two: counting it plainly gated puts a zero-ungated total over a rule nothing enforces, and counting it plainly ungated makes a deployment permanently red on a finding whose only repair is acquiring a host. Resolve the slot the branch reads, or declare that an unreached gate does not fail here — which is the consumer's fact rather than this package's",
                            ),
                        );
                    }
                    continue;
                }

                if (registered.has(declared.gate)) continue;

                findings.push(
                    finding(
                        "unknownGate",
                        path,
                        declared,
                        `${declared.slug} names gate "${declared.gate}", which nothing in the pipeline registers`,
                        "register a check with that id, or declare gate: none — a rule naming a gate that does not exist reads as coverage while enforcing nothing. A gate is anything the ONE pipeline runs that emits a report and can fail the run, which is a registered rule OR a pipeline step: scoping the set to one of the two shapes that produce a verdict makes a real gate unnameable, and a transition nothing can spell stays undone however often it is noticed",
                    ),
                );
            }
        }

        const halves = checkableHalves(registry, registered);
        const unbuilt = halves.filter((half) => half.gate === UNBUILT_HALF);

        for (const half of unbuilt) {
            findings.push(
                finding(
                    "unbuiltCheckableHalf",
                    CONDUCT_REGISTRY,
                    { slug: half.slug, gate: UNBUILT_HALF, locked: false, line: half.line },
                    `${half.slug} declares a checkable half that no gate observes`,
                    "the entry states that this half is decidable from an artifact and that nothing decides it, which is enforcement debt rather than a settled question — build the check and name it here, or, if the comparison turns out not to be decidable after all, correct the entry so it claims only what is true. A half described in prose is visible to a reader and invisible to every count, which is how a named-but-unbuilt check sits outside the backlog forever while the roster reads as complete",
                ),
            );
        }

        const digestResult = inspectDigests(context.repoRoot, digests, new Set(seen.keys()), fix);
        for (const entry of digestResult.findings) findings.push(entry);
        for (const entry of digestResult.healed) healed.push(entry);
        const expanded = digestResult.expanded;

        const byGate: Record<string, number> = {};
        for (const entry of gated) byGate[entry.gate] = (byGate[entry.gate] ?? 0) + 1;

        const lockedUngated = ungated.filter((entry) => entry.locked);

        const walk =
            PRINCIPLE_CATALOG === null
                ? null
                : walkPrinciples(
                      context.read(PRINCIPLE_CATALOG),
                      digests.map((path) => context.read(path)),
                  );

        return {
            findings,
            healed,
            derivations: {
                registeredGates: [...registered].sort(),
                expanded,
                counts: {
                    declared: gated.length + conduct.length + ungated.length,
                    gated: gated.length,
                    conduct: conduct.length,
                    ungated: ungated.length,
                    lockedUngated: lockedUngated.length,
                    unbuiltCheckableHalves: unbuilt.length,
                },
                checkableHalvesObserved: halves.filter((half) => half.gate !== UNBUILT_HALF),
                checkableHalvesUnbuilt: unbuilt,
                byGate,
                gated,
                conduct,
                ungated,
                conditional,
                conditionalReading:
                    "a rule here names a REGISTERED gate whose enforcing branch depends on a slot, so it is GATED-WHEN-RESOLVED rather than gated or ungated. Where the slot resolves it is reached and enforced; where it does not, it is UNREACHED and counted in neither the gated total's claim nor the ungated backlog — because counting it gated puts a zero-ungated total over a rule nothing enforces, and counting it ungated makes a deployment permanently red on a finding whose only repair is acquiring a host. Whether an unreached gate FAILS is the consumer's declaration and is read from its own slot rather than guessed here",
                lockedUngated,
                principleWalk:
                    walk === null
                        ? {
                              state: "ABSENT",
                              meaning:
                                  "no principle catalog is declared, so the branch that walks one does not " +
                                  "run. A consumer treating an absent slot as a value manufactures a demand " +
                                  "nothing can satisfy, and a fabricated pass reads exactly like a real one",
                          }
                        : {
                              declared: walk.declared,
                              cited: walk.cited,
                              uncited: walk.uncited,
                              danglingCitations: walk.danglingCitations,
                              meaning:
                                  "citation measures whether the catalog has been WALKED at a decision point, never " +
                                  "whether a principle holds — an uncited record may already be satisfied by the tree " +
                                  "and a cited one may be cited without being enforced. It is a drainable worklist of " +
                                  "principles nothing has yet been reasoned against, not a count of unenforced ones",
                          },
            },
        };
    },
};
