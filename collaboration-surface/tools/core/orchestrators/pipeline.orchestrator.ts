import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { readSource, toPosix } from "../iterators/file.iterator.ts";
import { discoverRules } from "../registries/rule.registry.ts";
import { writeRuleReport } from "../reporters/rule.reporter.ts";
import { resolveScope } from "../resolvers/scope.resolver.ts";
import { loadTaxonomy } from "../resolvers/taxonomy.resolver.ts";
import { cleanStage } from "../steps/source.step.ts";
import { gateStage } from "../steps/gate.step.ts";
import { qualityStage } from "../steps/quality.step.ts";
import { snapshotStage } from "../steps/snapshot.step.ts";
import { typecheckStage } from "../steps/typecheck.step.ts";
import { STAGES, type RuleContext, type Stage, type StageResult } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

export interface RunOptions {
    readonly repoRoot: string;
    readonly ruleId: string | null;
    readonly stage: Stage | null;
    readonly scope: string | null;
    readonly bypass: readonly string[];
    readonly fix: boolean;
}

export type { StageResult };

export interface RunResult {
    readonly findings: readonly Finding[];
    readonly stages: readonly StageResult[];
    readonly scanned: number;
    readonly registered: number;
    readonly bypassedAny: boolean;
    readonly scope: string;
    readonly authoritative: boolean;
    readonly moved: readonly string[];
    readonly movedByThisRun: readonly string[];
    readonly written: readonly string[];
    readonly escaped: readonly string[];
    readonly unfulfilled: readonly string[];
    readonly incomparable: readonly string[];
    readonly unresolvedScope?: string;
}

const WHOLE_SCOPE = "whole";

function withinDeclaredScope(path: string, scope: string, handed: readonly string[]): boolean {
    if (scope === WHOLE_SCOPE) return true;
    return handed.includes(path);
}

export async function runPipeline(options: RunOptions): Promise<RunResult> {
    const narrowings: string[] = [];
    if (options.scope !== null) narrowings.push(`path=${options.scope}`);
    if (options.ruleId !== null) narrowings.push(`rule=${options.ruleId}`);
    if (options.stage !== null) narrowings.push(`stage=${options.stage}`);
    if (options.bypass.length > 0) narrowings.push(`bypassed=${options.bypass.join("+")}`);

    const scope = narrowings.length === 0 ? WHOLE_SCOPE : narrowings.join(" · ");
    const authoritative = narrowings.length === 0;

    const taxonomy = loadTaxonomy();
    const registry = await discoverRules(options.repoRoot);

    const findings: Finding[] = [...registry.findings];
    const written: string[] = [];
    const stages: StageResult[] = [];
    const incomparable: string[] = [];

    const { byJurisdiction } = resolveScope(options.repoRoot, taxonomy, options.scope);

    const paths = byJurisdiction.all;

    if (options.scope !== null && paths.length === 0) {
        return {
            findings: [],
            stages: [],
            written: [],
            escaped: [],
            unfulfilled: [],
            scanned: 0,
            registered: registry.rules.length,
            bypassedAny: false,
            scope,
            authoritative,
            moved: [],
            movedByThisRun: [],
            incomparable: [],
            unresolvedScope: options.scope,
        };
    }

    const cache = new Map<string, string>();
    const stamps = new Map<string, number>();

    const stampOf = (absolute: string): number => {
        if (!existsSync(absolute)) return 0;
        return statSync(absolute).mtimeMs;
    };

    const read = (path: string): string => {
        const hit = cache.get(path);
        if (hit !== undefined) return hit;

        const absolute = resolve(options.repoRoot, path);
        const source = readSource(absolute);
        cache.set(path, source);
        stamps.set(path, stampOf(absolute));
        return source;
    };

    for (const path of paths) {
        if (stamps.has(path)) continue;
        stamps.set(path, stampOf(resolve(options.repoRoot, path)));
    }

    let bypassedAny = false;

    const stepOptions = {
        repoRoot: options.repoRoot,
        bypass: options.bypass,
        fix: options.fix,
        scanned: paths.length,
        scope,
        authoritative,
    };

    const whole = options.ruleId === null && options.stage === null;
    const steps = whole ? [cleanStage, typecheckStage, qualityStage, gateStage] : [cleanStage];

    for (const step of steps) {
        const outcome = step(stepOptions);
        stages.push(outcome.stage);
        for (const finding of outcome.findings) findings.push(finding);
        if (outcome.stage.bypassed) bypassedAny = true;
    }

    const snapshot = snapshotStage(stepOptions, paths);
    stages.push(snapshot.stage);
    for (const finding of snapshot.findings) findings.push(finding);
    if (snapshot.stage.bypassed) bypassedAny = true;

    for (const stage of STAGES) {
        if (options.stage !== null && options.stage !== stage) continue;

        for (const registered of registry.rules) {
            const declaration = registered.declaration;
            if (declaration.stage !== stage) continue;
            if (options.ruleId !== null && options.ruleId !== registered.id) continue;

            if (options.bypass.includes(registered.id) || options.bypass.includes(stage)) {
                bypassedAny = true;
                stages.push({
                    stage,
                    rule: registered.id,
                    invariant: declaration.invariant,
                    findings: 0,
                    healed: 0,
                    bypassed: true,
                });
                continue;
            }

            const jurisdiction = byJurisdiction[declaration.jurisdiction];

            const scoped =
                declaration.extensions.length === 0
                    ? jurisdiction
                    : jurisdiction.filter((path) => {
                          for (const ext of declaration.extensions) {
                              if (path.length > ext.length && path.endsWith(ext)) return true;
                          }
                          return false;
                      });

            const declared = declaration.reads ?? [];
            const extra: string[] = [];
            for (const wanted of declared) {
                if (scoped.includes(wanted)) continue;
                if (!existsSync(resolve(options.repoRoot, wanted))) continue;
                extra.push(wanted);
            }

            const handed = extra.length === 0 ? scoped : [...scoped, ...extra];

            if (declaration.wholeScopeOnly === true && !authoritative) {
                incomparable.push(registered.id);
                stages.push({
                    stage: declaration.stage,
                    rule: registered.id,
                    invariant: declaration.invariant,
                    findings: 0,
                    healed: 0,
                    bypassed: true,
                });
                continue;
            }

            const context: RuleContext = {
                id: registered.id,
                repoRoot: options.repoRoot,
                taxonomy,
                paths: handed,
                read,
                exists: (path: string) => existsSync(resolve(options.repoRoot, path)),
            };
            const started = process.hrtime.bigint();
            const result = declaration.check(context, options.fix);
            const elapsed = Number((process.hrtime.bigint() - started) / 1000n) / 1000;

            writeRuleReport(options.repoRoot, registered.id, {
                rule: registered.id,
                mechanism: toPosix(options.repoRoot, registered.path),
                stage: declaration.stage,
                invariant: declaration.invariant,
                verdict: result.findings.length === 0 ? "pass" : "fail",
                scope,
                authoritative,
                scanned: handed.length,
                healed: result.healed,
                findings: result.findings,
                derivations: result.derivations,
            });

            for (const path of result.healed) written.push(path);
            for (const finding of result.findings) findings.push(finding);
            stages.push({
                stage,
                rule: registered.id,
                invariant: declaration.invariant,
                findings: result.findings.length,
                healed: result.healed.length,
                bypassed: false,
                elapsed,
            });
        }
    }

    const moved: string[] = [];
    const movedByThisRun: string[] = [];
    for (const [path, stamp] of stamps) {
        if (stampOf(resolve(options.repoRoot, path)) === stamp) continue;
        if (written.includes(path)) {
            movedByThisRun.push(path);
            continue;
        }
        moved.push(path);
    }

    const escaped = written.filter((path) => !withinDeclaredScope(path, scope, paths));
    const unfulfilled = written.filter((path) => stamps.has(path) && !movedByThisRun.includes(path));

    return {
        findings,
        stages,
        written,
        escaped,
        unfulfilled,
        scanned: paths.length,
        registered: registry.rules.length,
        bypassedAny,
        scope,
        authoritative,
        moved,
        movedByThisRun,
        incomparable,
    };
}
