import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import type { BranchFixture, BranchObservation } from "../fixtures/converge.fixture.ts";
import type { GateFixture, Sample } from "../fixtures/gate.fixture.ts";
import { growFixtureTree } from "../generators/fixture.generator.ts";
import { loadTaxonomy } from "../resolvers/taxonomy.resolver.ts";
import type { RuleContext, RuleDeclaration } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

export interface GateOutcome {
    readonly rule: string;
    readonly state: "proven" | "exempt" | "untested" | "silent" | "noisy";
    readonly detail: string;
}

function disagreements(observed: BranchObservation, expected: BranchObservation): string[] {
    const out: string[] = [];
    const keys = new Set([...Object.keys(expected), ...Object.keys(observed)]);

    for (const key of keys) {
        const seen = observed[key];
        const wanted = expected[key];
        if (seen === wanted) continue;
        out.push(`${key} ${String(seen)} where ${String(wanted)} is declared`);
    }

    return out;
}

function rendered(observation: BranchObservation): string {
    return Object.entries(observation)
        .map(([key, value]) => `${key} ${String(value)}`)
        .join(" · ");
}

export function unsuppliedReads(declaration: RuleDeclaration, fixture: GateFixture): string[] {
    if (fixture.exempt !== undefined) return [];
    if (fixture.onDisk === true) return [];

    const declared = declaration.reads ?? [];
    if (declared.length === 0) return [];

    const supplied = new Set<string>();
    for (const sample of [...(fixture.fires ?? []), ...(fixture.passes ?? [])]) supplied.add(sample.path);
    if (supplied.size === 0) return [];

    return declared.filter((path) => !supplied.has(path));
}

export function judgeBranch(fixture: BranchFixture): GateOutcome {
    const tree = growFixtureTree(fixture.seed);

    let observed: BranchObservation;
    try {
        observed = fixture.exercise(tree.root);
    } catch (error) {
        return {
            rule: `${fixture.subject} · ${fixture.branch}`,
            state: "noisy",
            detail: `the branch threw rather than returning an outcome: ${String(error)}`,
        };
    } finally {
        tree.release();
    }

    const apart = disagreements(observed, fixture.expect);
    if (apart.length > 0) {
        return {
            rule: `${fixture.subject} · ${fixture.branch}`,
            state: "silent",
            detail:
                `the branch was exercised and its effect DISAGREES with what the fixture declares — ${apart.join(", ")}. ` +
                "A branch is proven by its effect on the tree rather than by the code it returns, because a message " +
                "reporting a refusal over a tree it already changed reads exactly like a refusal that changed nothing",
        };
    }

    return {
        rule: `${fixture.subject} · ${fixture.branch}`,
        state: "proven",
        detail: `EXERCISED in an isolated tree · ${rendered(observed)}`,
    };
}

function contextOf(id: string, repoRoot: string, samples: readonly Sample[], declared: readonly string[]): RuleContext {
    const held = new Map<string, string>();
    for (const sample of samples) held.set(sample.path, sample.text);

    for (const wanted of declared) {
        if (held.has(wanted)) continue;

        const absolute = resolve(repoRoot, wanted);
        if (!existsSync(absolute)) continue;
        held.set(wanted, readSurface(absolute, "utf8"));
    }

    return {
        id,
        repoRoot,
        taxonomy: loadTaxonomy(),
        paths: [...held.keys()],
        read: (path: string): string => held.get(path) ?? "",
        exists: (path: string): boolean => held.has(path) || existsSync(resolve(repoRoot, path)),
    };
}

function countFindings(
    id: string,
    declaration: RuleDeclaration,
    repoRoot: string,
    samples: readonly Sample[],
    kind: string | undefined,
    onDisk?: true,
): Finding[] | string {
    const tree = onDisk === true ? growFixtureTree(samples) : null;
    const root = tree === null ? repoRoot : tree.root;

    let result;
    try {
        result = declaration.check(contextOf(id, root, samples, declaration.reads ?? []), false);
    } catch (error) {
        return String(error);
    } finally {
        tree?.release();
    }

    if (kind === undefined) return [...result.findings];

    const wanted = `${id}/${kind}`;
    return result.findings.filter((found) => found.rule === wanted);
}

function fromDisk(id: string, root: string, paths: readonly string[], declared: readonly string[]): RuleContext {
    const known = [...new Set([...paths, ...declared])];

    return {
        id,
        repoRoot: root,
        taxonomy: loadTaxonomy(),
        paths: known,
        read: (path: string): string => {
            const absolute = resolve(root, path);
            return existsSync(absolute) ? readSurface(absolute, "utf8") : "";
        },
        exists: (path: string): boolean => existsSync(resolve(root, path)),
    };
}

function healingOutcome(
    id: string,
    declaration: RuleDeclaration,
    fixture: GateFixture,
    samples: readonly Sample[],
): GateOutcome | null {
    const tree = growFixtureTree(samples);
    const declared = declaration.reads ?? [];
    const paths = samples.map((sample) => sample.path);

    try {
        const first = declaration.check(fromDisk(id, tree.root, paths, declared), true);
        if (first.healed.length === 0) {
            return {
                rule: id,
                state: "silent",
                detail:
                    `the healing fixture for ${fixture.kind ?? "any"} healed NOTHING — the rule declares that it heals and ` +
                    "its healing branch produced no repair on a sample built to need one, so the branch is unproven and a " +
                    "run reporting zero healed is indistinguishable from a run whose healer cannot fire",
            };
        }

        const second = declaration.check(fromDisk(id, tree.root, paths, declared), false);
        const wanted = fixture.kind === undefined ? null : `${id}/${fixture.kind}`;
        const left = wanted === null ? second.findings : second.findings.filter((found) => found.rule === wanted);
        if (left.length > 0) {
            return {
                rule: id,
                state: "noisy",
                detail:
                    `the healing fixture for ${fixture.kind ?? "any"} healed and the finding SURVIVED its own repair — ` +
                    `${String(left.length)} still stand after healing, so the fix does not converge and a fix that fails ` +
                    "its own check is not a fix",
            };
        }

        return null;
    } catch (error) {
        return { rule: id, state: "noisy", detail: `the healer threw rather than repairing: ${String(error)}` };
    } finally {
        tree.release();
    }
}

function misdirected(findings: readonly Finding[]): Finding | null {
    for (const found of findings) {
        if (found.remediation.deterministic) continue;
        if (found.remediation.target === found.path) continue;
        return found;
    }
    return null;
}

export function judge(id: string, declaration: RuleDeclaration, repoRoot: string, fixture: GateFixture): GateOutcome {
    const declaredFires = fixture.fires ?? [];
    const declaredPasses = fixture.passes ?? [];

    if (fixture.exempt !== undefined) {
        if (declaredFires.length > 0 || declaredPasses.length > 0) {
            return {
                rule: id,
                state: "noisy",
                detail: "the fixture declares an exemption and also declares samples, so the exemption is untested rather than impossible",
            };
        }
        return { rule: id, state: "exempt", detail: fixture.exempt };
    }

    if (fixture.heals !== undefined && declaredFires.length === 0 && declaredPasses.length === 0) {
        const healOnly = healingOutcome(id, declaration, fixture, fixture.heals);
        if (healOnly !== null) return healOnly;

        return {
            rule: id,
            state: "proven",
            detail:
                `kind ${fixture.kind ?? "any"} · HEALING-ONLY, which is the whole evidence available for a kind that ` +
                `cannot fire with healing OFF: HEALED ${fixture.heals.map((sample) => sample.path).join(", ")}, and the ` +
                "repair survived its own re-check — the heal is the firing member and the clean re-check is the accepting one",
        };
    }

    const fired = countFindings(id, declaration, repoRoot, declaredFires, fixture.kind, fixture.onDisk);
    const clean = countFindings(id, declaration, repoRoot, declaredPasses, fixture.kind, fixture.onDisk);

    if (typeof fired === "string" || typeof clean === "string") {
        const detail = typeof fired === "string" ? fired : String(clean);
        return { rule: id, state: "noisy", detail: `the rule threw on its fixture rather than reporting: ${detail}` };
    }

    if (fired.length === 0) {
        return {
            rule: id,
            state: "silent",
            detail:
                `the violating fixture for ${fixture.kind ?? "any"} produced no finding, so the rule cannot be ` +
                `shown to fire — samples: ${declaredFires.map((sample) => sample.path).join(", ")}`,
        };
    }
    if (clean.length > 0) {
        return {
            rule: id,
            state: "noisy",
            detail:
                `the clean fixture for ${fixture.kind ?? "any"} produced ${String(clean.length)} findings, so the ` +
                `rule fires on input it must accept — first: ${clean[0]?.rule ?? ""} at ${clean[0]?.path ?? ""}:${String(clean[0]?.line ?? 0)} — ${clean[0]?.actual ?? ""}`,
        };
    }

    const healing = fixture.heals === undefined ? null : healingOutcome(id, declaration, fixture, fixture.heals);
    if (healing !== null) return healing;

    const astray = misdirected(fired);
    if (astray !== null) {
        return {
            rule: id,
            state: "noisy",
            detail:
                `a judgement finding targets ${astray.remediation.target} while reporting ${astray.path} — ` +
                "a remediation naming an artifact other than the one in violation offers one branch of a " +
                "judgement as though it were the answer, and a consumer acts on the target rather than the decide",
        };
    }

    return {
        rule: id,
        state: "proven",
        detail:
            `kind ${fixture.kind ?? "any"} · FIRED ${String(fired.length)} finding(s) on ${declaredFires
                .map((sample) => sample.path)
                .join(", ")} · ACCEPTED ${declaredPasses.map((sample) => sample.path).join(", ")}` +
            (fixture.heals === undefined
                ? ""
                : ` · HEALED ${fixture.heals.map((sample) => sample.path).join(", ")} and the repair survived its own re-check`),
    };
}
