import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { surfacePath } from "../../../config/surface.config.ts";

import { walk } from "../iterators/file.iterator.ts";
import { DECLARATION_KEYS, STAGES, type RegisteredRule, type RuleDeclaration } from "../types/rule.types.ts";
import type { Finding } from "../types/segment.types.ts";

const RULES_DIR = surfacePath("rules");

export function identityOf(path: string): string {
    let cut = -1;
    for (let index = 0; index < path.length; index += 1) {
        const char = path.charAt(index);
        if (char === "/" || char === "\\") cut = index;
    }

    const name = cut === -1 ? path : path.slice(cut + 1);

    const stop = name.indexOf(".");
    return stop === -1 ? name : name.slice(0, stop);
}

function contractFinding(path: string, locus: string, actual: string, decide: string): Finding {
    return {
        rule: "governance/declarationContract",
        path,
        line: 0,
        locus,
        stack: [
            { check: "discover", resolved: path },
            { check: "declaration", resolved: locus },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: actual, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

function validateDeclaration(path: string, value: unknown): Finding[] {
    const findings: Finding[] = [];

    if (typeof value !== "object" || value === null) {
        findings.push(
            contractFinding(path, "export rule", String(value), "export a `rule` object satisfying RuleDeclaration"),
        );
        return findings;
    }

    const record = value as Record<string, unknown>;

    for (const key of DECLARATION_KEYS) {
        if (!(key in record)) {
            findings.push(contractFinding(path, key, "missing", `add the required declaration field "${key}"`));
        }
    }

    if ("id" in record) {
        findings.push(
            contractFinding(
                path,
                "id",
                "declared",
                "a check's identity is DERIVED from its filename subject and is never declared beside it — one fact declared twice is two classifications with nothing keeping them equal, and the divergence is unconstructible only once the second declaration is gone. Delete the field; the registry supplies the id",
            ),
        );
    }

    const stage = record["stage"];
    const invariant = record["invariant"];
    const extensions = record["extensions"];
    const kinds = record["kinds"];
    const heals = record["heals"];
    const check = record["check"];

    if (!Array.isArray(kinds) || kinds.some((kind) => typeof kind !== "string" || kind.length === 0)) {
        findings.push(
            contractFinding(
                path,
                "kinds",
                String(kinds),
                "kinds is an array of every kind this check emits, DECLARED rather than recovered from its own source — a set recovered by matching spellings has a quote style to prefer, a depth to bound and an attribution to guess, so a check composing its kind dynamically is invisible to the recovery and the set that reports an unfixtured kind subtracts from an empty population and can never report a gap for it. Where the kinds range over a closed vocabulary, spread that vocabulary here rather than transcribing its members",
            ),
        );
    }

    if (typeof stage !== "string" || !STAGES.includes(stage as never)) {
        findings.push(contractFinding(path, "stage", String(stage), `stage is one of ${STAGES.join(", ")}`));
    }

    if (typeof invariant !== "string" || invariant.length === 0) {
        findings.push(
            contractFinding(path, "invariant", String(invariant), "state the invariant in one present-tense line"),
        );
    }

    if (!Array.isArray(extensions)) {
        findings.push(
            contractFinding(
                path,
                "extensions",
                String(extensions),
                "extensions is an array; empty means every file in scope",
            ),
        );
    }

    if (typeof heals !== "boolean") {
        findings.push(contractFinding(path, "heals", String(heals), "heals is a boolean"));
    }

    if (typeof check !== "function") {
        findings.push(contractFinding(path, "check", typeof check, "check is (context, fix) => RuleResult"));
    }

    return findings;
}

export interface Registry {
    readonly rules: readonly RegisteredRule[];
    readonly findings: readonly Finding[];
}

export async function discoverRules(repoRoot: string): Promise<Registry> {
    const dir = resolve(repoRoot, RULES_DIR);
    const files = walk({ root: dir, ignored: [], extensions: [".ts"] });

    const rules: RegisteredRule[] = [];
    const findings: Finding[] = [];
    const seen = new Map<string, string>();

    for (const file of files) {
        let module: Record<string, unknown>;
        try {
            module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
        } catch (error) {
            findings.push(
                contractFinding(
                    file,
                    "import",
                    String(error),
                    "the rule file must import cleanly with no side effects",
                ),
            );
            continue;
        }

        const declaration = module["rule"];
        const problems = validateDeclaration(file, declaration);
        if (problems.length > 0) {
            for (const problem of problems) findings.push(problem);
            continue;
        }

        const valid = declaration as RuleDeclaration;
        const id = identityOf(file);
        const priorPath = seen.get(id);
        if (priorPath !== undefined) {
            findings.push(
                contractFinding(
                    file,
                    "id",
                    id,
                    `identity collides with the rule discovered at ${priorPath} — a filename subject names exactly one check`,
                ),
            );
            continue;
        }

        seen.set(id, file);
        rules.push({ declaration: valid, id, path: file });
    }

    rules.sort((a, b) => {
        const byStage = STAGES.indexOf(a.declaration.stage) - STAGES.indexOf(b.declaration.stage);
        if (byStage !== 0) return byStage;
        return a.id < b.id ? -1 : 1;
    });

    return { rules, findings };
}
