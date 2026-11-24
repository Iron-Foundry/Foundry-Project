import { existsSync, mkdirSync, renameSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import type { Finding, Remediation } from "../types/segment.types.ts";

export function rootOf(path: string, roots: readonly string[]): string | null {
    for (const root of roots) {
        if (path.startsWith(`${root}/`)) return root;
    }
    return null;
}

export function remediate(path: string, expected: string | null, decide: string): Remediation {
    return {
        action: "rename",
        from: basename(path),
        to: expected,
        target: dirname(path),
        deterministic: expected !== null,
        decide: expected === null ? decide : null,
    };
}

export function move(repoRoot: string, from: string, to: string): boolean {
    if (from === to) return false;
    const fromAbs = resolve(repoRoot, from);
    const toAbs = resolve(repoRoot, to);

    if (existsSync(toAbs)) return false;

    try {
        mkdirSync(dirname(toAbs), { recursive: true });
        renameSync(fromAbs, toAbs);
        return true;
    } catch {
        return false;
    }
}

export function countBy<T>(items: readonly T[], pick: (item: T) => string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of items) {
        const key = pick(item);
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}

export function unresolvedFinding(path: string, locus: string, actual: string, decide: string): Finding {
    return {
        rule: "corpus/unresolved",
        path,
        line: 0,
        locus,
        stack: [
            { check: "corpusRoot", resolved: "declared" },
            { check: locus, resolved: actual },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: actual, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}
