import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { moduleSource } from "../analyzers/graph.analyzer.ts";
import { identityOf } from "../registries/rule.registry.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import {
    EMISSION_CALL,
    FINDING_EMISSION,
    REPORT_SUFFIX,
    RULE_DIR,
    SKIP_PREFIX,
    STEP_DIR,
} from "../constants/report.constants.ts";
import { containsInCode, declaresProperty } from "../predicates/source.predicate.ts";

export function isConstructShaped(id: string): boolean {
    if (id.length === 0) return false;
    for (const char of id) {
        if (char < "a" || char > "z") return false;
    }
    return true;
}

export function reportMissing(repoRoot: string, id: string): boolean {
    return !existsSync(resolve(repoRoot, GENERATED_DIR, `${id}.report.generated.json`));
}

export const REPORT_IDENTITY_FIELDS = ["scope", "authoritative", "verdict"];

export function missingReportIdentity(repoRoot: string, id: string): string[] {
    const target = resolve(repoRoot, GENERATED_DIR, `${id}.report.generated.json`);
    if (!existsSync(target)) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(readSurface(target, "utf8"));
    } catch {
        return [...REPORT_IDENTITY_FIELDS];
    }

    if (typeof parsed !== "object" || parsed === null) return [...REPORT_IDENTITY_FIELDS];

    const record = parsed as Record<string, unknown>;
    return REPORT_IDENTITY_FIELDS.filter((field) => record[field] === undefined);
}

function quotedArgument(source: string, at: number): string | null {
    let cursor = at;
    while (cursor < source.length && (source[cursor] ?? "") !== ",") cursor += 1;
    cursor += 1;
    while ((source[cursor] ?? "") === " ") cursor += 1;
    if ((source[cursor] ?? "") !== '"') return null;

    let value = "";
    cursor += 1;
    while (cursor < source.length && (source[cursor] ?? "") !== '"') {
        value += source[cursor] ?? "";
        cursor += 1;
    }

    return value.length > 0 ? value : null;
}

export function emittedIds(source: string): string[] {
    const out = new Set<string>();

    for (let i = 0; i + EMISSION_CALL.length <= source.length; i += 1) {
        let k = 0;
        while (k < EMISSION_CALL.length && source[i + k] === EMISSION_CALL[k]) k += 1;
        if (k !== EMISSION_CALL.length) continue;

        const id = quotedArgument(source, i + EMISSION_CALL.length);
        if (id !== null) out.add(id);
    }

    return [...out];
}

export function stepEmittedIds(repoRoot: string): string[] {
    const dir = resolve(repoRoot, STEP_DIR);
    if (!existsSync(dir)) return [];

    const out = new Set<string>();
    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(".ts")) continue;
        out.add(identityOf(entry));
        for (const id of emittedIds(readSurface(resolve(dir, entry), "utf8"))) out.add(id);
    }

    return [...out];
}

export function claimedReportIds(repoRoot: string): Set<string> {
    const out = new Set<string>(stepEmittedIds(repoRoot));

    const dir = resolve(repoRoot, RULE_DIR);
    if (existsSync(dir)) {
        for (const entry of readdirSync(dir)) {
            if (!entry.endsWith(".ts")) continue;
            const source = readSurface(resolve(dir, entry), "utf8");
            out.add(identityOf(entry));
            for (const id of emittedIds(source)) out.add(id);
        }
    }

    return out;
}

export function orphanReports(repoRoot: string, claimed: ReadonlySet<string>): string[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(REPORT_SUFFIX)) continue;

        const id = entry.slice(0, entry.length - REPORT_SUFFIX.length);
        if (claimed.has(id)) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(resolve(dir, entry), "utf8"));
        } catch {
            continue;
        }
        if (typeof parsed !== "object" || parsed === null) continue;

        const record = parsed as Record<string, unknown>;
        if (record["rule"] === undefined || record["stage"] === undefined) continue;

        out.push(entry);
    }

    return out;
}

export function deleteReport(repoRoot: string, name: string): void {
    rmSync(resolve(repoRoot, GENERATED_DIR, name), { force: true });
}

export interface ScopeGap {
    readonly report: string;
    readonly handed: number;
    readonly reached: number;
    readonly named: number;
}

function countOf(value: unknown): number {
    return typeof value === "number" ? value : 0;
}

function namedSkips(derivations: Record<string, unknown>): number {
    let total = 0;

    for (const [key, value] of Object.entries(derivations)) {
        if (!key.startsWith(SKIP_PREFIX)) continue;
        if (Array.isArray(value)) total += value.length;
    }

    return total;
}

export function unaccountedScopeGaps(repoRoot: string): ScopeGap[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: ScopeGap[] = [];

    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(REPORT_SUFFIX)) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(resolve(dir, entry), "utf8"));
        } catch {
            continue;
        }
        if (typeof parsed !== "object" || parsed === null) continue;

        const record = parsed as Record<string, unknown>;
        const derivations = record["derivations"];
        if (typeof derivations !== "object" || derivations === null) continue;

        const derived = derivations as Record<string, unknown>;
        const reachedList = derived["reached"];
        if (reachedList === undefined) continue;
        if (!Array.isArray(reachedList)) {
            out.push({ report: entry, handed: countOf(record["scanned"]), reached: -1, named: 0 });
            continue;
        }

        const handed = countOf(record["scanned"]);
        const reached = reachedList.length;
        if (handed <= reached) continue;

        const named = namedSkips(derived);
        if (handed - reached === named) continue;

        out.push({ report: entry, handed, reached, named });
    }

    return out;
}

export interface UnevaluableScope {
    readonly report: string;
    readonly handed: number;
}

function isVerdictBearing(record: Record<string, unknown>): boolean {
    if (typeof record["verdict"] !== "string") return false;
    return typeof record["scanned"] === "number";
}

function publishesAPopulation(derivations: unknown): boolean {
    if (typeof derivations !== "object" || derivations === null) return false;

    for (const value of Object.values(derivations as Record<string, unknown>)) {
        if (Array.isArray(value)) return true;
    }

    return false;
}

export function unevaluableScopes(repoRoot: string): UnevaluableScope[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: UnevaluableScope[] = [];

    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(REPORT_SUFFIX)) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(resolve(dir, entry), "utf8"));
        } catch {
            continue;
        }
        if (typeof parsed !== "object" || parsed === null) continue;

        const record = parsed as Record<string, unknown>;
        if (!isVerdictBearing(record)) continue;

        const handed = countOf(record["scanned"]);
        if (handed === 0) continue;
        if (publishesAPopulation(record["derivations"])) continue;

        out.push({ report: entry, handed });
    }

    return out;
}

export function selfAuditedReports(repoRoot: string, auditor: string): string[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: string[] = [];

    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(REPORT_SUFFIX)) continue;
        if (entry.slice(0, entry.length - REPORT_SUFFIX.length) !== auditor) continue;
        out.push(entry);
    }

    return out;
}

export interface ReportStanding {
    readonly report: string;
    readonly staleSurfaces: readonly string[];
}

function stampOf(absolute: string): number {
    if (!existsSync(absolute)) return 0;
    return statSync(absolute).mtimeMs;
}

function reachedSurfaces(parsed: unknown): string[] {
    if (typeof parsed !== "object" || parsed === null) return [];

    const derivations = (parsed as Record<string, unknown>)["derivations"];
    if (typeof derivations !== "object" || derivations === null) return [];

    const out: string[] = [];
    for (const value of Object.values(derivations as Record<string, unknown>)) {
        if (!Array.isArray(value)) continue;
        for (const member of value) {
            if (typeof member !== "string") continue;
            if (!member.includes("/")) continue;
            out.push(member);
        }
    }

    return out;
}

const COMPOSITE_SEPARATOR = "/";

export function contradictedContracts(derivations: Record<string, unknown>): string[] {
    const out: string[] = [];

    for (const [name, value] of Object.entries(derivations)) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) continue;

        const record = value as { subject?: unknown; property?: unknown };
        if (record.property !== "composite-keyed" || typeof record.subject !== "string") continue;

        const held = derivations[record.subject];
        if (!Array.isArray(held) || held.length === 0) continue;

        const flat = held.filter((member) => typeof member === "string" && !member.includes(COMPOSITE_SEPARATOR));
        if (flat.length === 0) continue;

        out.push(
            `${name} declares ${record.subject} composite-keyed and that key carries ${String(flat.length)} member(s) with no separator: ${flat.join(", ")}`,
        );
    }

    return out;
}

export interface UnrepairableLocus {
    readonly report: string;
    readonly rule: string;
    readonly target: string;
    readonly reason: "frozenTarget" | "permanentSpan";
}

export function unrepairableLoci(
    repoRoot: string,
    frozen: (target: string) => boolean,
    permanentSpan: (path: string, locus: string) => boolean,
): UnrepairableLocus[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: UnrepairableLocus[] = [];
    const seen = new Set<string>();

    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(REPORT_SUFFIX)) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(resolve(dir, entry), "utf8"));
        } catch {
            continue;
        }

        if (typeof parsed !== "object" || parsed === null) continue;
        const held = (parsed as Record<string, unknown>)["findings"];
        if (!Array.isArray(held)) continue;

        for (const candidate of held) {
            if (typeof candidate !== "object" || candidate === null) continue;

            const record = candidate as Record<string, unknown>;
            const remediation = record["remediation"];
            if (typeof remediation !== "object" || remediation === null) continue;

            const target = (remediation as Record<string, unknown>)["target"];
            if (typeof target !== "string") continue;

            const reported = typeof record["path"] === "string" ? record["path"] : "";
            const locus = typeof record["locus"] === "string" ? record["locus"] : "";

            const reason: UnrepairableLocus["reason"] | null = frozen(target)
                ? "frozenTarget"
                : permanentSpan(reported, locus)
                  ? "permanentSpan"
                  : null;
            if (reason === null) continue;

            const rule = typeof record["rule"] === "string" ? record["rule"] : "";
            const key = `${entry}|${rule}|${target}|${locus}`;
            if (seen.has(key)) continue;

            seen.add(key);
            out.push({ report: entry, rule, target, reason });
        }
    }

    return out;
}

export function withdrawnStandings(repoRoot: string): ReportStanding[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: ReportStanding[] = [];

    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(REPORT_SUFFIX)) continue;

        const reportPath = resolve(dir, entry);
        const written = stampOf(reportPath);

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(reportPath, "utf8"));
        } catch {
            continue;
        }

        const stale: string[] = [];
        for (const surface of reachedSurfaces(parsed)) {
            if (stampOf(resolve(repoRoot, surface)) <= written) continue;
            stale.push(surface);
        }

        if (stale.length > 0) out.push({ report: entry, staleSurfaces: stale.sort() });
    }

    return out;
}

export function missingFindingFields(
    path: string,
    read: (path: string) => string,
    known: ReadonlySet<string>,
    required: readonly string[],
): string[] {
    const reachable = moduleSource(path, read, known);
    const out: string[] = [];
    for (const field of required) {
        if (!declaresProperty(reachable, field)) out.push(field);
    }
    return out;
}

export interface ShapeGap {
    readonly path: string;
    readonly field: string;
}

export function findingShapeGaps(
    paths: readonly string[],
    read: (path: string) => string,
    required: readonly string[],
): ShapeGap[] {
    const known = new Set(paths);
    const out: ShapeGap[] = [];

    for (const path of paths) {
        if (!path.endsWith(".ts")) continue;
        if (!containsInCode(read(path), FINDING_EMISSION)) continue;

        for (const field of missingFindingFields(path, read, known, required)) {
            out.push({ path, field });
        }
    }

    return out;
}
