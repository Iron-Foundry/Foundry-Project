import { readSurface } from "../core/readers/surface.reader.ts";
import { resolve } from "node:path";

import { surfacePath } from "../../config/surface.config.ts";
import { AXIS_DOCUMENTS } from "../core/constants/path.constants.ts";
import { walk } from "../core/iterators/file.iterator.ts";
import { readDeclaredRules } from "../core/readers/rule.reader.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const MECHANISM_ROOT = surfacePath("entrypoints");

const FIELD = "RESTATES";

interface Restatement {
    readonly slug: string;
    readonly path: string;
    readonly line: number;
}

function lineOf(source: string, index: number): number {
    let line = 1;
    for (let cursor = 0; cursor < index; cursor += 1) {
        if (source[cursor] === "\n") line += 1;
    }
    return line;
}

function declaredRestatements(source: string, path: string): Restatement[] {
    const out: Restatement[] = [];
    const at = source.indexOf(FIELD);
    if (at === -1) return out;

    const assign = source.indexOf("=", at);
    if (assign === -1) return out;

    const open = source.indexOf("[", assign);
    if (open === -1) return out;

    const close = source.indexOf("]", open);
    if (close === -1) return out;

    let cursor = open;
    while (cursor < close) {
        const quote = source.indexOf('"', cursor);
        if (quote === -1 || quote > close) break;

        const end = source.indexOf('"', quote + 1);
        if (end === -1 || end > close) break;

        const slug = source.slice(quote + 1, end);
        if (slug.length > 0) out.push({ slug, path, line: lineOf(source, quote) });
        cursor = end + 1;
    }

    return out;
}

export const rule: RuleDeclaration = {
    stage: "meta",
    jurisdiction: "all",
    invariant:
        "every rule slug a mechanism declares its strings to state resolves against the declared rule set, so a renamed or retired rule cannot leave a mechanism stating it",
    extensions: [],
    kinds: ["unresolvedSlug"],
    heals: false,

    reads: [...AXIS_DOCUMENTS],
    readsTree:
        "the subject is a declaration inside a MECHANISM, and the mechanism sources are entrypoints rather " +
        "than governed documents — so they are outside the scanned path set by construction, and a rule " +
        "reading only that set would report a clean green over every mechanism in the tree",

    check(context: RuleContext): RuleResult {
        const declared = new Set<string>();
        const readAxes: string[] = [];

        for (const path of AXIS_DOCUMENTS) {
            if (!context.exists(path)) continue;
            readAxes.push(path);
            for (const rule of readDeclaredRules(context.read(path))) declared.add(rule.slug);
        }

        if (declared.size === 0) {
            return {
                findings: [],
                healed: [],
                derivations: {
                    declaredSlugs:
                        "ABSENT — no axis document resolved, so the branch comparing a declaration against the set does not run",
                    readAxes,
                },
            };
        }

        const root = resolve(context.repoRoot, MECHANISM_ROOT);
        const sources = context.exists(MECHANISM_ROOT) ? walk({ root, ignored: [], extensions: [".ts"] }) : [];

        const restatements: Restatement[] = [];
        for (const file of sources) {
            const relative = file
                .slice(context.repoRoot.length + 1)
                .split("\\")
                .join("/");
            for (const found of declaredRestatements(readSurface(file, "utf8"), relative)) restatements.push(found);
        }

        const findings: Finding[] = [];
        const unresolved: string[] = [];

        for (const restatement of restatements) {
            if (declared.has(restatement.slug)) continue;
            unresolved.push(restatement.slug);
            findings.push({
                rule: "emission/unresolvedSlug",
                path: restatement.path,
                line: restatement.line,
                locus: restatement.slug,
                stack: [
                    { check: "declaredSet", resolved: String(declared.size) },
                    { check: "restates", resolved: restatement.slug },
                    { check: "resolution", resolved: "absent" },
                ],
                actual: `${restatement.slug} is declared as a rule this mechanism states and resolves to no declared rule`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: restatement.slug,
                    to: null,
                    target: restatement.path,
                    deterministic: false,
                    decide: "a mechanism prints its own statement of a protocol rule, and the surface that delivers a rule most often is a mechanism's output — which is the surface a repair pass reaches last, because output reads as a result rather than as a statement of the rule. Name the slug this mechanism now states, or remove the declaration where it no longer states one. THE SCOPE IS STATED RATHER THAN IMPLIED: this closes RENAME and RETIREMENT, where a slug stops resolving and the declaration says so. It does NOT close REWORDING — a rule whose text changes while its slug stands leaves every mechanism string stale and this check green, which is where the class actually lives, and the repair for that half is composing the string from the rule rather than declaring a pointer to it",
                },
                healed: false,
            });
        }

        return {
            findings,
            healed: [],
            derivations: {
                readAxes,
                declaredSlugs: declared.size,
                mechanismsScanned: sources.length,
                restatements: restatements.map((entry) => `${entry.slug} @ ${entry.path}`),
                unresolved,
                range: "the population is every slug a mechanism DECLARES; a mechanism stating a rule and declaring nothing is invisible to it, and a declaration that resolves says nothing about whether the string still matches the rule's text",
            },
        };
    },
};
