import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import type { Edit, Finding, Hit, Verdict } from "../types/segment.types.ts";
import { writeSurface } from "../writers/surface.writer.ts";

export interface Report {
    readonly tool: string;
    readonly verdict: Verdict;
    readonly scanned: number;
    readonly findings: readonly Finding[];
    readonly hits: readonly HitRecord[];
    readonly edits: readonly EditRecord[];
    readonly rejected: readonly EditRecord[];
    readonly coverage: Coverage;
}

export interface HitRecord {
    readonly pattern: string;
    readonly path: string;
    readonly line: number;
    readonly text: string;
}

export interface EditRecord {
    readonly path: string;
    readonly reason: string;
    readonly start: number;
    readonly end: number;
    readonly replacement: string;
}

export interface Coverage {
    readonly roots: readonly string[];
    readonly filesByExtension: Readonly<Record<string, number>>;
}

export function toHitRecords(hits: readonly Hit[]): HitRecord[] {
    return hits.map((hit) => ({
        pattern: hit.patternId,
        path: hit.path,
        line: hit.span.line,
        text: hit.segments.map((s) => s.text).join("\n"),
    }));
}

export function toEditRecords(edits: readonly Edit[]): EditRecord[] {
    return edits.map((edit) => ({
        path: edit.path,
        reason: edit.reason,
        start: edit.start,
        end: edit.end,
        replacement: edit.replacement,
    }));
}

export function verdictOf(findings: readonly Finding[], rejected: readonly Edit[]): Verdict {
    return findings.length === 0 && rejected.length === 0 ? "pass" : "fail";
}

export function writeReport(repoRoot: string, name: string, report: Report): string {
    const target = join(repoRoot, GENERATED_DIR, `${name}.generated.json`);
    mkdirSync(dirname(target), { recursive: true });
    writeSurface(target, `${JSON.stringify(report, null, 2)}\n`);
    return target;
}
