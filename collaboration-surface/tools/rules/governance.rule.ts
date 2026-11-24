import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

import { RULE_ROOT } from "../core/constants/layer.constants.ts";
import { GENERATED_DIR, SURFACE_ROOT } from "../core/constants/path.constants.ts";
import { unsanctionedWriters } from "../core/validators/writer.validator.ts";
import { contains } from "../core/predicates/text.predicate.ts";
import { identityOf } from "../core/registries/rule.registry.ts";
import { DECLARATION_KEYS, STAGES } from "../core/types/rule.types.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";
import { containsInCode, declaresProperty, reachesRegexLiteral } from "../core/predicates/source.predicate.ts";
import {
    claimedReportIds,
    deleteReport,
    findingShapeGaps,
    isConstructShaped,
    missingReportIdentity,
    orphanReports,
    reportMissing,
    selfAuditedReports,
    unaccountedScopeGaps,
    unevaluableScopes,
    unrepairableLoci,
    withdrawnStandings,
} from "../core/validators/governance.validator.ts";
import { contentIsUnrepairable, lifetimeOf } from "../../config/surface.config.ts";
import { removeChannel, staleChannels } from "../core/validators/channel.validator.ts";
import { unscopedRead } from "../core/validators/source.validator.ts";

const REQUIRED_FINDING_FIELDS = ["rule", "path", "locus", "stack", "actual", "expected", "remediation", "healed"];

const RUN_ENTRIES = [`${SURFACE_ROOT}/tools/core/entrypoints/pipeline.entrypoint.ts`];

const SANCTIONED_WRITERS = [
    `${SURFACE_ROOT}/tools/core/writers/surface.writer.ts`,
    `${SURFACE_ROOT}/tools/core/writers/repair.writer.ts`,
    `${SURFACE_ROOT}/tools/core/reporters/rule.reporter.ts`,
    `${SURFACE_ROOT}/tools/core/reporters/segment.reporter.ts`,
    `${SURFACE_ROOT}/tools/core/registries/claim.registry.ts`,
    `${SURFACE_ROOT}/tools/core/registries/snapshot.registry.ts`,
    `${SURFACE_ROOT}/tools/core/validators/channel.validator.ts`,
    `${SURFACE_ROOT}/tools/core/validators/governance.validator.ts`,
];

const ITEM_KEY_SEPARATOR = "-";

function isItemKey(locus: string): boolean {
    const at = locus.indexOf(ITEM_KEY_SEPARATOR);
    if (at <= 0 || at === locus.length - 1) return false;

    for (let index = 0; index < at; index += 1) {
        const char = locus.charAt(index);
        if (char < "A" || char > "Z") return false;
    }

    for (let index = at + 1; index < locus.length; index += 1) {
        const char = locus.charAt(index);
        if (char < "0" || char > "9") return false;
    }

    return true;
}

function permanentSpan(reported: string, locus: string): boolean {
    if (!isItemKey(locus)) return false;
    return lifetimeOf(reported)?.retention === "accumulating";
}

const RULE_SELECTOR = "rule=";

const STAGE_SELECTOR = "stage=";

function channelScopeResolver(repoRoot: string, claimed: ReadonlySet<string>): (scope: string) => boolean {
    return (scope: string): boolean => {
        if (scope.startsWith(RULE_SELECTOR)) return claimed.has(scope.slice(RULE_SELECTOR.length));
        if (scope.startsWith(STAGE_SELECTOR)) {
            return STAGES.some((stage) => stage === scope.slice(STAGE_SELECTOR.length));
        }

        return existsSync(resolve(repoRoot, scope));
    };
}

function finding(path: string, locus: string, actual: string, decide: string, resolved: string): Finding {
    return {
        rule: "governance/ruleContract",
        path,
        line: 0,
        locus,
        stack: [
            { check: "ruleSource", resolved: basename(path) },
            { check: "contract", resolved },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: actual, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "meta",
    jurisdiction: "taxonomy",
    invariant:
        "every rule source declares the full contract and emits findings in the machine-actionable shape, and every report on disk is claimed by something that emits it",
    extensions: [".ts"],
    kinds: [
        "ruleContract",
        "declarationContract",
        "orphanReport",
        "unsanctionedWriter",
        "staleChannel",
        "unevaluableScope",
        "unrepairableLocus",
        "matching",
    ],
    heals: true,
    wholeScopeOnly: true,

    readsTree:
        "a channel names the SCOPE its run declared, and whether that scope still resolves is a question about " +
        "the TREE rather than about any file's contents — a scope naming a subtree is answered by whether the " +
        "subtree is there, which no set of scanned file contents can decide. The reports this walk reads are " +
        "generated output and sit outside the governed path set by construction, so a rule reading only that " +
        "set would report a clean green over every report and every channel in the directory the pipeline " +
        "writes",

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const healed: string[] = [];

        const claimed = claimedReportIds(context.repoRoot);
        for (const name of orphanReports(context.repoRoot, claimed)) {
            deleteReport(context.repoRoot, name);
            healed.push(name);
            findings.push({
                rule: "governance/orphanReport",
                path: `${GENERATED_DIR}/${name}`,
                line: 0,
                locus: name,
                stack: [
                    { check: "reportShape", resolved: "declares rule and stage" },
                    { check: "claimedBy", resolved: "no rule declaration and no step emission" },
                ],
                actual: name,
                expected: null,
                remediation: {
                    action: "delete",
                    from: name,
                    to: null,
                    target: `${GENERATED_DIR}/${name}`,
                    deterministic: true,
                    decide: "",
                },
                healed: true,
            });
        }

        const known = new Set(context.paths.filter((path) => path.endsWith(".ts")));
        for (const breach of unsanctionedWriters(RUN_ENTRIES, known, context.read, SANCTIONED_WRITERS)) {
            findings.push({
                rule: "governance/unsanctionedWriter",
                path: breach.path,
                line: 0,
                locus: breach.member,
                stack: [
                    { check: "reachableFromARun", resolved: "yes" },
                    { check: "sanctionedWriter", resolved: "no" },
                ],
                actual: `${breach.path} writes the filesystem directly and a run reaches it`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: breach.member,
                    to: null,
                    target: breach.path,
                    deterministic: false,
                    decide:
                        "route the write through the restricted writer, which takes the scope this run DECLARED and " +
                        "refuses a path outside it — so containment is answered at one function rather than by a witness " +
                        "nobody holds for a repair scattered across source. A gate over a DIRECTORY reports a complete " +
                        "funnel while a module writes beneath it, which is why this ranges over what a run REACHES",
                },
                healed: false,
            });
        }

        for (const channel of staleChannels(context.repoRoot, channelScopeResolver(context.repoRoot, claimed))) {
            removeChannel(context.repoRoot, channel.name);
            healed.push(channel.name);
            findings.push({
                rule: "governance/staleChannel",
                path: `${GENERATED_DIR}/${channel.name}`,
                line: 0,
                locus: channel.scope,
                stack: [
                    { check: "channelShape", resolved: "names its scope and declares itself non-authoritative" },
                    { check: "scopeResolves", resolved: "no" },
                ],
                actual: channel.scope,
                expected: null,
                remediation: {
                    action: "delete",
                    from: channel.name,
                    to: null,
                    target: `${GENERATED_DIR}/${channel.name}`,
                    deterministic: true,
                    decide: "",
                },
                healed: true,
            });
        }

        for (const gap of unaccountedScopeGaps(context.repoRoot)) {
            findings.push({
                rule: gap.reached === -1 ? "governance/unusableOperand" : "governance/undeclaredExclusion",
                path: `${GENERATED_DIR}/${gap.report}`,
                line: 0,
                locus: gap.report,
                stack: [
                    { check: "handed", resolved: String(gap.handed) },
                    {
                        check: "reached",
                        resolved: gap.reached === -1 ? "declared, not enumerable" : String(gap.reached),
                    },
                    { check: "namedSkips", resolved: String(gap.named) },
                ],
                actual:
                    gap.reached === -1
                        ? "this report declares a reached operand that names no members, so the arithmetic skips it entirely"
                        : `${String(gap.handed - gap.reached - gap.named)} file(s) were handed to this check, not reached, and named in no skip list`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: gap.report,
                    to: null,
                    target: `${GENERATED_DIR}/${gap.report}`,
                    deterministic: false,
                    decide: "two counts in one report disagreeing means the check narrowed its own scope, and a narrowing nobody named is a blind spot rather than a decision. A count is evidence of coverage only over the surface the scan reached, so a report whose reached set is smaller than the set it was handed names every path it skipped and the class it skipped it under — then the arithmetic closes and a reader can audit the green. This axis reads REPORTS rather than rules, so it fires on any check that silently narrows, including the ones nobody has thought to suspect. AND THE TWO OPERANDS MUST BE COMMENSURABLE OR THE SUBTRACTION MEANS NOTHING: `reached` is unit-bearing and names members OF THE HANDED SET, so a check whose population is not the handed files — one walking rules, declarations or slots — publishes that population under a key naming its own unit and declares NO reached set. Claiming one in a foreign unit satisfies the disclosure and breaks the audit, which is a more expensive failure than the silence it replaces. AND A REACHED OPERAND THAT NAMES NO MEMBERS IS SKIPPED RATHER THAN COMPARED: a count answers how many and never WHICH, so nothing can be audited against it and the axis passes over the report in silence while the field reads as evidence — publish the members, or publish nothing under that key",
                },
                healed: false,
            });
        }

        for (const gap of unevaluableScopes(context.repoRoot)) {
            findings.push({
                rule: "governance/unevaluableScope",
                path: `${GENERATED_DIR}/${gap.report}`,
                line: 0,
                locus: gap.report,
                stack: [
                    { check: "handed", resolved: String(gap.handed) },
                    { check: "population", resolved: "none published" },
                ],
                actual: `${String(gap.handed)} were handed to this check and it publishes no population at all`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: gap.report,
                    to: null,
                    target: `${GENERATED_DIR}/${gap.report}`,
                    deterministic: false,
                    decide: "a comparison cannot be wrong while one of its operands does not exist, so a report publishing NO population sits in neither pass nor fail on the scope axis — it is UNEVALUABLE, and unevaluable reads exactly like covered because both are silent. The handed count alone is inherited from whatever handed it and asserts nothing the check itself measured. Publish the population the check actually walked: as `reached` where its members ARE the handed set, or under a key naming its own unit where they are not",
                },
                healed: false,
            });
        }

        for (const locus of unrepairableLoci(context.repoRoot, contentIsUnrepairable, permanentSpan)) {
            findings.push({
                rule: "governance/unrepairableLocus",
                path: `${GENERATED_DIR}/${locus.report}`,
                line: 0,
                locus: locus.target,
                stack: [
                    { check: "reportedBy", resolved: locus.rule },
                    { check: "unrepairableBy", resolved: locus.reason },
                ],
                actual:
                    locus.reason === "frozenTarget"
                        ? `${locus.rule} names a repair target whose declared mutability forbids the repair it computes`
                        : `${locus.rule} anchors to a span that is permanent by the declared retention of the surface holding it, so the surface accepts a write and the span the finding names does not`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: locus.target,
                    to: null,
                    target: `${GENERATED_DIR}/${locus.report}`,
                    deterministic: false,
                    decide:
                        "A FINDING'S LOCUS IS CONSUMED AS ITS REPAIR TARGET, and a surface whose declared mutability " +
                        "is frozen cannot receive one — so the finding names a repair nobody may perform. This is " +
                        "worse than a refusal rather than equivalent to it: a refusal produces a party who knows they " +
                        "are blocked, while a frozen target that is nonetheless writable produces a party who edits, " +
                        "is told the edit succeeded, watches the finding clear, and loses the repair at the next " +
                        "regeneration — a party who believes they are done. Name the SOURCE the target is derived " +
                        "from, where one exists, so the locus points where the repair belongs; withdraw the finding " +
                        "where no source exists, because a report nobody can drain teaches every reader to discount " +
                        "the colour and the cost lands on the findings beside it. THE LIFETIME IS DECLARED AND THE " +
                        "JOIN IS BETWEEN TWO OPERANDS THAT ALREADY EXIST, so this reads unchanged on the next surface " +
                        "class the configuration declares and needs no walk to learn a skip. AND THE SURFACE'S ANSWER IS " +
                        "THE WRONG OPERAND FOR A FINDING ANCHORED TO A SPAN: an accumulating surface ACCEPTS a write, so " +
                        "restating a claim by appending is performable and the surface reads as repairable — while the " +
                        "SPAN the finding names is permanent by the same lifetime that makes the surface appendable, so " +
                        "the original span still carries the defect and the finding still stands whatever anybody " +
                        "appends. The repair is reachable and the finding is unclearable, which are different properties, " +
                        "and only the span's mutability separates them",
                },
                healed: false,
            });
        }

        const sources = context.paths.filter((path) => contains(path, RULE_ROOT));

        for (const path of sources) {
            const source = context.read(path);

            if (containsInCode(source, "RegExp") || reachesRegexLiteral(source)) {
                findings.push({
                    ...finding(
                        path,
                        "matching",
                        "regular expression",
                        "match by tree traversal, token comparison or exact string — a hand-written scanner is the mechanism, and the test is the CALL FORM rather than a list of method names, because a name list reopens the moment the language adds a method that accepts a literal",
                        "regex banned",
                    ),
                    rule: "governance/matching",
                });
            }

            if (!contains(source, "export const rule")) {
                findings.push(
                    finding(
                        path,
                        "export",
                        "no exported rule declaration",
                        "export `const rule: RuleDeclaration` so the registry can discover it",
                        "missing export",
                    ),
                );
                continue;
            }

            const breach = unscopedRead(source);
            if (breach !== null) {
                findings.push(finding(path, breach.locus, breach.actual, breach.decide, breach.resolved));
            }

            for (const key of DECLARATION_KEYS) {
                if (!declaresProperty(source, key)) {
                    findings.push(
                        finding(
                            path,
                            key,
                            "absent",
                            `declare the required field "${key}" — an optional field is one the gate cannot check`,
                            "incomplete declaration",
                        ),
                    );
                }
            }

            for (const id of [identityOf(path)]) {
                if (reportMissing(context.repoRoot, id)) {
                    findings.push(
                        finding(
                            path,
                            id,
                            "no report on disk",
                            `run the pipeline so ${id} emits its report — the report is the re-readable state of a run, and a rule whose findings exist only in the moment of the run is unactionable the instant the process exits`,
                            "report absent",
                        ),
                    );
                }

                for (const field of missingReportIdentity(context.repoRoot, id)) {
                    findings.push(
                        finding(
                            path,
                            `${id}.report.${field}`,
                            "absent",
                            `every report states the run that wrote it — "${field}" is what lets a reader tell an authoritative whole-tree run from a narrowed diagnostic one, and a report that cannot be told apart from a narrowed run is evidence for a claim nobody verified`,
                            "report identity",
                        ),
                    );
                }

                if (isConstructShaped(id)) continue;
                findings.push(
                    finding(
                        path,
                        id,
                        "names an instance",
                        "a rule id names the construct it matches, never a path, vendor, filename or threshold — instances live as data the rule cites, so the id reads unchanged when the same shape recurs elsewhere",
                        "literal in id",
                    ),
                );
            }

            let declaresStage = false;
            for (const stage of STAGES) {
                if (contains(source, `"${stage}"`)) declaresStage = true;
            }
            if (!declaresStage) {
                findings.push(
                    finding(path, "stage", "unrecognised", `stage is one of ${STAGES.join(", ")}`, "unknown stage"),
                );
            }
        }

        for (const gap of findingShapeGaps(context.paths, context.read, REQUIRED_FINDING_FIELDS)) {
            findings.push(
                finding(
                    gap.path,
                    `finding.${gap.field}`,
                    "absent",
                    `every emitted finding carries "${gap.field}" — a finding without it is prose the next agent must re-derive`,
                    "finding shape",
                ),
            );
        }

        return {
            findings,
            healed,
            derivations: {
                ruleSourcesWalked: sources,
                reportsAudited: [...claimed].sort(),
                skippedAsNotARuleSource: context.paths.filter((path) => !contains(path, RULE_ROOT)),
                selfAudited: selfAuditedReports(context.repoRoot, context.id),
                identityContract:
                    "a check's identity is DERIVED from its filename subject and is declared nowhere, so the two-name divergence this walk once compared is unconstructible rather than absent. The comparison is not reported as passing, because a check whose members cannot exist is dead rather than green — what replaces it is the registry refusing any declaration that carries an id at all, which is the collapse the join was a substitute for",
                withdrawnStandings: withdrawnStandings(context.repoRoot),
                standingContract:
                    "a verdict carries a STANDING beside its value, and a report listed under withdrawnStandings read a surface that has CHANGED since the report was written — so that verdict describes a tree that has moved and is not authoritative to quote, while the verdict itself is untouched because declaring it a failure would assert a defect nothing observed. This is published as a DERIVATION rather than emitted as a finding, deliberately: on a surface several parties write continuously every report is stale within moments of any write, so a finding here would be red between every run and a permanent red teaches every reader to discount the colour — the cost landing on the findings beside it rather than on itself. The reader who needs this is the one about to QUOTE a verdict, and the honest mechanism hands them the standing rather than failing a build over a transient",
                selfAuditStanding:
                    "this check reads reports its own run writes, so the verdict on any report listed under selfAudited describes the PREVIOUS run of it — a first verdict after repairing this check is one run behind, and the second run is the one authoritative for that member. The lag is stated rather than excluded, because excluding a check from its own audit installs a blind spot shaped exactly like the thing being hidden",
            },
        };
    },
};
