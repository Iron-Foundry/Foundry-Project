import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { lifetimeOf, type Lifetime } from "../../../config/surface.config.ts";
import { delimitersIn } from "../analyzers/board.analyzer.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { readSource } from "../iterators/file.iterator.ts";
import { ruleReportName, writeRuleReport } from "../reporters/rule.reporter.ts";
import type { StepOptions, StepOutcome } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

const STEP = "snapshot";

export const KINDS: readonly string[] = [`${STEP}/shortenedGovernedSurface`, `${STEP}/frozenSurfaceWritten`];

const REPORT = ruleReportName(STEP);

const MARKDOWN = ".md";

const INVARIANT =
    "a surface whose declared lifetime forbids removal never loses a member between runs, and one whose declared mutability is frozen never changes at all, decided by comparing the current extent against the extent this comparison itself retained rather than by any property of the surface's name or path";

const RECORD_ANCHOR = "record";

type Verdict = "unchanged" | "shortened" | "relocated" | "first-seen" | "not-comparable";

interface Extent {
    readonly lifetime: string;
    readonly anchors: readonly string[];
    readonly mark: string;
}

const MARK_SEED = 5381;

const MARK_SHIFT = 33;

const MARK_MODULUS = 4294967296;

function markOf(source: string): string {
    let held = MARK_SEED;
    for (const character of source) held = (held * MARK_SHIFT + character.charCodeAt(0)) % MARK_MODULUS;
    return String(held);
}

interface Retained {
    readonly range: string;
    readonly anchorKinds: readonly string[];
    readonly surfaces: Readonly<Record<string, Extent>>;
}

const ANCHOR_KINDS: readonly string[] = [RECORD_ANCHOR];

function sameKinds(held: readonly string[]): boolean {
    if (held.length !== ANCHOR_KINDS.length) return false;
    for (const kind of ANCHOR_KINDS) if (!held.includes(kind)) return false;
    return true;
}

function anchorsOf(path: string, source: string): string[] {
    if (!path.endsWith(MARKDOWN)) return [];

    const out: string[] = [];
    for (const delimiter of delimitersIn(source)) {
        if (!delimiter.open) continue;
        out.push(`${RECORD_ANCHOR}:${delimiter.agent}`);
    }

    return out;
}

function markedElsewhere(
    mark: string,
    prior: Readonly<Record<string, Extent>>,
    current: ReadonlyMap<string, Extent>,
): string | null {
    if (mark.length === 0) return null;

    for (const [path, extent] of current) {
        if (prior[path] !== undefined) continue;
        if (extent.mark === mark) return path;
    }

    return null;
}

function forbidsRemoval(declared: Lifetime): boolean {
    return declared.removal === "none";
}

function isFrozen(declared: Lifetime): boolean {
    return declared.mutability === "frozen";
}

function lifetimeLabel(declared: Lifetime): string {
    return `${declared.retention} · ${declared.mutability} · ${declared.removal}`;
}

function retainedFrom(repoRoot: string): Retained | null {
    const path = resolve(repoRoot, GENERATED_DIR, REPORT);
    if (!existsSync(path)) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(path, "utf8"));
    } catch {
        return null;
    }

    if (typeof parsed !== "object" || parsed === null) return null;
    const derivations = (parsed as { derivations?: unknown }).derivations;
    if (typeof derivations !== "object" || derivations === null) return null;

    const held = (derivations as { retainedExtent?: unknown }).retainedExtent;
    if (typeof held !== "object" || held === null) return null;

    const range = (held as { range?: unknown }).range;
    const surfaces = (held as { surfaces?: unknown }).surfaces;
    const kinds = (held as { anchorKinds?: unknown }).anchorKinds;
    if (typeof range !== "string") return null;
    if (typeof surfaces !== "object" || surfaces === null) return null;

    const anchorKinds = Array.isArray(kinds) ? kinds.filter((one): one is string => typeof one === "string") : [];

    const out: Record<string, Extent> = {};
    for (const [path_, value] of Object.entries(surfaces as Record<string, unknown>)) {
        if (typeof value !== "object" || value === null) continue;
        const declared = (value as { lifetime?: unknown }).lifetime;
        const anchors = (value as { anchors?: unknown }).anchors;
        const mark = (value as { mark?: unknown }).mark;
        if (typeof declared !== "string") continue;
        if (!Array.isArray(anchors)) continue;
        out[path_] = {
            lifetime: declared,
            anchors: anchors.filter((one): one is string => typeof one === "string"),
            mark: typeof mark === "string" ? mark : "",
        };
    }

    return { range, anchorKinds, surfaces: out };
}

function shortenedFinding(path: string, missing: readonly string[], declared: string): Finding {
    return {
        rule: `${STEP}/shortenedGovernedSurface`,
        path,
        line: 0,
        locus: missing[0] ?? path,
        stack: [
            { check: "declaredLifetime", resolved: declared },
            { check: "removalAuthority", resolved: "none" },
            { check: "priorExtent", resolved: "retained by the comparison that emits it" },
            { check: "absentNow", resolved: missing.join(" · ") },
        ],
        actual: `${path} carried members this run cannot find, and its declared removal authority is none`,
        expected: "every member the prior extent carried, still present",
        remediation: {
            action: "declare",
            from: path,
            to: null,
            target: path,
            deterministic: false,
            decide: "restore the members the prior extent carried, or state that the surface's declared lifetime is wrong and change the DECLARATION rather than the content — a surface whose removal authority is none has no party permitted to take a member out of it, so a member that has gone was taken by an operation the declaration forbids. THE COMPARISON IS THREE-VALUED AND ONLY ONE VALUE IS THIS FINDING: unchanged, shortened, and not-comparable are distinct states, and a run whose range differs from the retained one refuses to compute rather than reporting either of the first two, because a comparison across differing ranges answers a question nobody asked. A member that has MOVED under a frozen root is reported as relocated rather than as shortened, since leaving the active tree and leaving the repository are different operations and the extent can tell them apart",
        },
        healed: false,
    };
}

function frozenFinding(path: string, difference: readonly string[], declared: string): Finding {
    return {
        rule: `${STEP}/frozenSurfaceWritten`,
        path,
        line: 0,
        locus: difference[0] ?? path,
        stack: [
            { check: "declaredLifetime", resolved: declared },
            { check: "mutability", resolved: "frozen" },
            { check: "differenceKind", resolved: "any" },
            { check: "differing", resolved: difference.join(" · ") },
        ],
        actual: `${path} differs from the extent retained for it, and its declared mutability is frozen`,
        expected: "the extent retained for this surface, unchanged in either direction",
        remediation: {
            action: "declare",
            from: path,
            to: null,
            target: path,
            deterministic: false,
            decide: "revert the write, or change the DECLARATION that says this surface is frozen. A frozen surface needs no threshold and no shortening test, because its refusal is unconditional: any difference in either direction violates it, so an ADDITION fails here exactly as a removal does. That is why this member consults no extent to DECIDE — the decision is equality — and retains one only so that a difference is observable at all, which is the one thing no property of the surface itself can supply",
        },
        healed: false,
    };
}

export function snapshotStage(options: StepOptions, paths: readonly string[]): StepOutcome {
    if (options.bypass.includes(STEP)) {
        return {
            findings: [],
            stage: { stage: "meta", rule: STEP, invariant: INVARIANT, findings: 0, healed: 0, bypassed: true },
        };
    }

    const current = new Map<string, Extent>();
    const frozen = new Set<string>();
    const frozenAnchors = new Set<string>();

    for (const path of paths) {
        const declared = lifetimeOf(path);
        if (declared === null) continue;
        if (!forbidsRemoval(declared) && !isFrozen(declared)) continue;

        const source = readSource(resolve(options.repoRoot, path));
        const anchors = anchorsOf(path, source);
        current.set(path, { lifetime: lifetimeLabel(declared), anchors, mark: markOf(source) });

        if (!isFrozen(declared)) continue;
        frozen.add(path);
        for (const anchor of anchors) frozenAnchors.add(anchor);
    }

    const retained = retainedFrom(options.repoRoot);
    const comparable = retained !== null && retained.range === options.scope && sameKinds(retained.anchorKinds);

    const findings: Finding[] = [];
    const verdicts: Record<string, Verdict> = {};
    const memberless: string[] = [];
    const renamed: string[] = [];

    if (!comparable) {
        for (const path of current.keys()) verdicts[path] = retained === null ? "first-seen" : "not-comparable";
    } else {
        for (const [path, prior] of Object.entries(retained.surfaces)) {
            const now = current.get(path);

            if (now === undefined) {
                if (prior.anchors.length === 0) {
                    const carried = markedElsewhere(prior.mark, retained.surfaces, current);
                    if (carried !== null) {
                        verdicts[path] = "relocated";
                        renamed.push(`${path} → ${carried}`);
                        continue;
                    }
                    verdicts[path] = "not-comparable";
                    memberless.push(path);
                    continue;
                }
                const stranded = prior.anchors.filter((anchor) => !frozenAnchors.has(anchor));
                if (stranded.length === 0) {
                    verdicts[path] = "relocated";
                    continue;
                }
                verdicts[path] = "shortened";
                findings.push(shortenedFinding(path, stranded, prior.lifetime));
                continue;
            }

            const held = new Set(now.anchors);
            const missing = prior.anchors.filter((anchor) => !held.has(anchor));

            if (now.lifetime !== prior.lifetime) {
                verdicts[path] = "not-comparable";
                continue;
            }

            if (frozen.has(path)) {
                const priorHeld = new Set(prior.anchors);
                const added = now.anchors.filter((anchor) => !priorHeld.has(anchor));
                const difference = [...missing, ...added];
                verdicts[path] = difference.length === 0 ? "unchanged" : "shortened";
                if (difference.length > 0) findings.push(frozenFinding(path, difference, prior.lifetime));
                continue;
            }

            if (missing.length === 0) {
                verdicts[path] = "unchanged";
                continue;
            }

            verdicts[path] = "shortened";
            findings.push(shortenedFinding(path, missing, prior.lifetime));
        }

        for (const path of current.keys()) {
            if (verdicts[path] === undefined) verdicts[path] = "first-seen";
        }
    }

    const surfaces: Record<string, Extent> = {};
    for (const [path, extent] of current) surfaces[path] = extent;

    if (retained !== null) {
        for (const [path, prior] of Object.entries(retained.surfaces)) {
            if (verdicts[path] !== "shortened") continue;
            surfaces[path] = prior;
        }
    }

    const carried: Retained =
        options.authoritative || retained === null
            ? { range: options.scope, anchorKinds: ANCHOR_KINDS, surfaces }
            : retained;

    writeRuleReport(options.repoRoot, STEP, {
        rule: STEP,
        stage: "meta",
        invariant: INVARIANT,
        verdict: findings.length === 0 ? "pass" : "fail",
        scope: options.scope,
        authoritative: options.authoritative,
        scanned: current.size,
        healed: [],
        findings,
        derivations: {
            retainedExtent: carried,
            memberlessAndAbsent: memberless,
            carriedToANewPath: renamed,
            markBound:
                "A MEMBERLESS SURFACE THAT IS ABSENT IS IDENTIFIED AS MOVED ONLY WHERE ITS CONTENT MARK IS CARRIED BY A PATH THE PRIOR EXTENT DID NOT HOLD, AND A MATCH IS PROOF RATHER THAN A GUESS. The mark is derived from the surface's own bytes, so an equal mark on a path that was not in the baseline is the same content under a new name — which is a move, decidable, with no candidate ranking and no nearest-neighbour reasoning anywhere in it. WHAT THIS RECOVERS IS EXACTLY ONE OF THE THREE COLLAPSED CASES AND THE OTHER TWO ARE UNCHANGED: a rename that preserves content is now named, while a rename that also edits the content, an archive and a deletion remain one undistinguished absence reported as not-comparable. So the published loss shrinks rather than closing, which is stated because a mechanism that recovers part of a gap reads as having closed it. The asymmetry is deliberate: a MATCH can only be produced by identical content, so this adds no verdict that could be wrong, and the absence of a match asserts nothing at all rather than asserting a deletion",
            appearanceBound:
                "A FILE APPEARING UNDER A FROZEN ROOT IS FIRST-SEEN RATHER THAN A DIFFERENCE, AND THAT IS CORRECT RATHER THAN A GAP — WHICH IS WORTH STATING BECAUSE THE OPPOSITE IS THE OBVIOUS READING. The comparison ranges over the surfaces the retained extent NAMES, so a path present now and absent from that extent has nothing to be compared against and is recorded as first-seen. The frozen axis therefore observes what happens to a surface it already tracks — a member added or removed — and never observes a surface ARRIVING. That is the right shape for this root, because an archive ACCRETES by design: a venue moving into it is the one operation the whole surface exists to receive, so a check firing on an appearance would report the correct operation as a defect on every convergence. WHAT IS GIVEN UP IS THE APPEARANCE THAT WAS NOT AN ARCHIVAL, and nothing here distinguishes the two — the discriminator is the PROVENANCE of the write rather than any property of the file, so it is not available to a comparison over extents. Published rather than left implicit, because a frozen declaration reads as forbidding every write and this mechanism observes only the ones that land inside a surface it already holds",
            memberlessBound:
                "A SURFACE WHOSE PRIOR EXTENT NAMED NO MEMBER AND WHICH IS ABSENT NOW IS REPORTED AS NOT-COMPARABLE, AND THAT IS A PUBLISHED LOSS OF COVERAGE RATHER THAN A CLEAN RESULT. Anchors are the only operand this comparison has, so a surface that carried none gives it nothing to compare: a rename, an archive and a deletion all present as the same absence, and every one of them is consistent with the extent. The earlier form called that case SHORTENED and named the PATH ITSELF as the missing member, which asserts that members went missing from a surface the extent recorded as holding none — a claim with no operand behind it, and one that fires on every ordinary rename of a surface nobody has written to yet. MEASURED on a successor venue raised under one ordinal and renumbered minutes later, where the honest reading is that the file moved and the false reading was that a governed surface lost content its declaration forbids anyone to remove. What is given up is the genuine deletion of a memberless governed surface, which this step no longer distinguishes from its rename; what is kept is that every finding it does emit names a member the prior extent actually held. The paths are published here so the case is loud rather than absent, and a mechanism that can tell the three apart resolves it by an operand other than anchors",
            measuredThisRun: { range: options.scope, anchorKinds: ANCHOR_KINDS, surfaces },
            comparability:
                "a comparison is taken only where the retained extent was measured over the SAME range AND under the SAME anchor kinds. The second operand is the one this walk learned by moving: narrowing what counts as a member made every retained extent report its dropped kind as a lost member, so a change to the DEFINITION of a member is a change of range by another name — and a comparison across two definitions produces a confident shortening on every surface at once, which is the loudest possible false positive from the smallest possible edit",
            reached: [...current.keys()],
            verdicts,
            comparedAgainst:
                retained === null ? "no prior extent — this run is the first that could take one" : retained.range,
            population:
                "every path in this run's scope whose DECLARED lifetime forbids removal or declares the surface frozen, resolved through the lifetime resolver rather than matched against a name — so a surface entering that class enters this population by a declaration edit and a surface leaving it leaves with no edit here, and a path the declaration does not reach contributes nothing rather than a passing comparison",
            anchorRange:
                "a member is addressed ONLY by an ALLOCATED id — the per-writer record fence, whose key a tool issues and other surfaces cite — because an allocated key is the one identity in this tree whose stability is enforced rather than conventional. EVERY AUTHORED IDENTITY WAS TRIED AND EACH FAILED THE SAME WAY, ON A LIVE MEMBER RATHER THAN IN ARGUMENT. A heading's identity IS its prose, so rewording a title reads as removing a member; measured on a title losing a prefix. A table row's identity is its first cell, which an author rewrites whenever the row's subject changes; measured on a row merged under the surface's own sanctioned insertion rule. Both are the same shape: a surface may declare mutability OWNER-REWRITABLE and removal NONE at once, which is a member whose IDENTITY may be rewritten while its CONTENT may not be removed, and no identity anchor can represent that state. A rename detector would be the wrong repair — matching a vanished key to a new one by position or by resemblance is the layout and heuristic pair this tree refuses — so the operand narrows instead. THE PRICE IS LARGE AND IS STATED RATHER THAN HIDDEN: only surfaces carrying per-writer records get member-level observation, which is the venues and the board; the accumulator, the agenda, the templates and every other declared surface fall back to a PATH-level extent, where losing the whole file is observed and losing one entry inside it is NOT. Recovering them needs an allocated id per entry, which is a change to those surfaces rather than to this comparison",
            persistence:
                "A SHORTENED SURFACE KEEPS ITS PRIOR EXTENT IN THE BASELINE rather than the extent that lost a member, so the finding STANDS until the member is restored. Accepting the shortened state would make the violation its own baseline, the next run would compare the loss against itself and report unchanged, and the refusal would be a one-run window on a surface whose whole declaration is that it never loses anything — a mechanism that observes the loss, records it correctly, and then forgets it. A RELOCATED surface leaves the baseline, because its members are now carried by the frozen path that received them and retaining both would report the move twice",
            retention:
                "the prior extent lives in THIS report and nowhere else, so it is an operand of the comparison that emits it rather than a record of the past — remove the comparison and the value stops being written. A NARROWED RUN CARRIES THE RETAINED EXTENT THROUGH UNCHANGED and publishes what it measured beside it under its own name, because a narrowed measurement written into the baseline is a report about a different subject wearing the same name — and the baseline it would replace is the only thing a later whole-scope run has to compare against, so the destruction would be performed by the cheapest and most correct-feeling action available",
        },
    });

    return {
        findings,
        stage: {
            stage: "meta",
            rule: STEP,
            invariant: INVARIANT,
            findings: findings.length,
            healed: 0,
            bypassed: false,
        },
    };
}
