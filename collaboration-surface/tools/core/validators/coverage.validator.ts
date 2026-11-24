import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readDeclaredRules, readExpandedSlugs, stripGateDeclarations } from "../readers/rule.reader.ts";
import type { Finding } from "../types/segment.types.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

export interface Expansion {
    readonly slug: string;
    readonly digest: string;
}

export const UNBUILT_HALF = "none";

export interface CheckableHalf {
    readonly slug: string;
    readonly line: number;
    readonly gate: string;
}

function unwrap(cell: string): string {
    const trimmed = cell.trim();
    if (trimmed.length < 2) return trimmed;
    if (!trimmed.startsWith("`") || !trimmed.endsWith("`")) return trimmed;
    return trimmed.slice(1, -1).trim();
}

function slugOf(cell: string): string {
    const trimmed = cell.trim();
    if (!trimmed.startsWith("`") || !trimmed.endsWith("`")) return "";
    return trimmed.slice(1, -1).trim();
}

export interface RosterRow {
    readonly slug: string;
    readonly line: number;
    readonly cell: string;
    readonly cells: number;
}

export function rosterRows(registry: string): RosterRow[] {
    const out: RosterRow[] = [];
    const lines = registry.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (!line.trimStart().startsWith("|")) continue;

        const cells = line.split("|");
        const slug = slugOf(cells[1] ?? "");
        if (slug.length === 0) continue;

        let last = "";
        for (let cursor = cells.length - 1; cursor > 1; cursor -= 1) {
            const value = unwrap(cells[cursor] ?? "");
            if (value.length === 0) continue;
            last = value;
            break;
        }

        out.push({ slug, line: index + 1, cell: last, cells: cells.length });
    }

    return out;
}

export function checkableHalves(registry: string, registered: ReadonlySet<string>): CheckableHalf[] {
    const out: CheckableHalf[] = [];

    for (const row of rosterRows(registry)) {
        if (row.cell !== UNBUILT_HALF && !registered.has(row.cell)) continue;
        out.push({ slug: row.slug, line: row.line, gate: row.cell });
    }

    return out;
}

export interface DigestResult {
    readonly findings: Finding[];
    readonly healed: string[];
    readonly expanded: Expansion[];
}

function finding(
    kind: string,
    path: string,
    slug: string,
    line: number,
    actual: string,
    decide: string | null,
    deterministic: boolean,
): Finding {
    return {
        rule: `coverage/${kind}`,
        path,
        line,
        locus: slug,
        stack: [
            { check: "surface", resolved: "digest" },
            { check: kind, resolved: "failed" },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: slug, to: null, target: path, deterministic, decide },
        healed: false,
    };
}

export function inspectDigests(
    repoRoot: string,
    digests: readonly string[],
    declared: ReadonlySet<string>,
    fix: boolean,
): DigestResult {
    const findings: Finding[] = [];
    const healed: string[] = [];
    const expanded: Expansion[] = [];

    for (const path of digests) {
        const absolute = resolve(repoRoot, path);
        if (!existsSync(absolute)) continue;
        const source = readSurface(absolute, "utf8");

        const declarations = readDeclaredRules(source);
        if (declarations.length > 0) {
            if (fix) {
                writeSurface(absolute, stripGateDeclarations(source));
                healed.push(`${path}: ${String(declarations.length)} gate declarations stripped`);
            } else {
                for (const entry of declarations) {
                    findings.push(
                        finding(
                            "digestDeclares",
                            path,
                            entry.slug,
                            entry.line,
                            `${entry.slug} carries gate: ${entry.gate} inside a digest`,
                            null,
                            true,
                        ),
                    );
                }
            }
        }

        for (const expansion of readExpandedSlugs(source)) {
            expanded.push({ slug: expansion.slug, digest: path });
            if (declared.has(expansion.slug)) continue;

            findings.push(
                finding(
                    "undeclaredExpansion",
                    path,
                    expansion.slug,
                    expansion.line,
                    `${expansion.slug} is expanded here but no axis document declares it`,
                    "an expansion with no declaration is a rule nothing governs — declare it in the axis document with a registered gate or a conduct proof, or delete the expansion if the rule is already carried under another slug",
                    false,
                ),
            );
        }
    }

    return { findings, healed, expanded };
}
