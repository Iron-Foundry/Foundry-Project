import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../core/readers/surface.reader.ts";
import {
    AGENT_ROOT,
    EXECUTED_TEMPLATES,
    MANDATORY_GATES,
    SKILL_ROOT,
    TEMPLATE_ROOT,
} from "../core/constants/template.constants.ts";
import { AGENT_INDEX } from "../core/constants/board.constants.ts";
import { underRoots } from "../core/filters/scope.filter.ts";
import { bodyOf, checkIdentity, checkKeys } from "../core/inspectors/agent.inspector.ts";
import { indexedLetters } from "../core/inspectors/index.inspector.ts";
import { isAttribution } from "../core/normalizers/source.normalizer.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function basenameOf(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? path : path.slice(slash + 1);
}

function isExecuted(path: string): boolean {
    const name = basenameOf(path);
    return EXECUTED_TEMPLATES.some((marker) => name.startsWith(`${marker}.`));
}

function finding(kind: string, path: string, locus: string, actual: string, expected: string, decide: string): Finding {
    return {
        rule: `template/${kind}`,
        path,
        line: 1,
        locus,
        stack: [
            { check: "template", resolved: basenameOf(path) },
            { check: kind, resolved: locus },
        ],
        actual,
        expected,
        remediation: { action: "declare", from: locus, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

function agentArtifacts(repoRoot: string): { path: string; source: string }[] {
    const root = `${repoRoot}/${AGENT_ROOT}`;
    if (!existsSync(root)) return [];

    const out: { path: string; source: string }[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".md")) continue;
        out.push({ path: `${AGENT_ROOT}${entry.name}`, source: readSurface(`${root}${entry.name}`, "utf8") });
    }
    return out;
}

function skillNames(repoRoot: string): Set<string> {
    const root = `${repoRoot}/${SKILL_ROOT}`;
    if (!existsSync(root)) return new Set();

    const out = new Set<string>();
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!existsSync(`${root}${entry.name}/SKILL.md`)) continue;
        out.add(entry.name);
    }
    return out;
}

function checkAgents(repoRoot: string, index: string, findings: Finding[]): string[] {
    const letters = indexedLetters(index).letters;
    const skills = skillNames(repoRoot);
    const artifacts = agentArtifacts(repoRoot);

    for (const artifact of artifacts) {
        const name = basenameOf(artifact.path);

        if (
            !bodyOf(artifact.source)
                .split("\n")
                .some((line) => isAttribution(line))
        ) {
            findings.push(
                finding(
                    "attributionMissing",
                    artifact.path,
                    name,
                    `${name} carries no attribution line in its delivered body`,
                    "the third-party attribution the licence requires, in the surface the harness delivers",
                    "an agent is produced by executing a template that is third-party IP under CC BY-SA, and the attribution binds every artifact deriving from it. The harness forwards one frontmatter key and discards the rest, so an attribution declared in a field alone is STRIPPED AT THE DELIVERY BOUNDARY — every invocation then runs the derived material with its notice removed, which is a licence exposure rather than a style finding. The check reads the body for the same reason the identity check does, and a check applying the delivery reasoning to one field while its neighbour does not is how the LOCKED half went unobserved",
                ),
            );
        }

        checkKeys(
            name,
            artifact.source,
            (kind, locus, actual, expected, decide) => finding(kind, artifact.path, locus, actual, expected, decide),
            findings,
        );

        checkIdentity(
            name,
            artifact.source,
            letters,
            skills,
            (kind, locus, actual, expected, decide) => finding(kind, artifact.path, locus, actual, expected, decide),
            findings,
        );

        for (const gate of MANDATORY_GATES) {
            if (artifact.source.includes(gate)) continue;
            findings.push(
                finding(
                    "gateMissing",
                    artifact.path,
                    gate,
                    `${name} does not declare the ${gate} gate`,
                    MANDATORY_GATES.join(", "),
                    "an executed artifact walks its template's loop as stated, and the four gates never fold — an agent omitting one was template-shaped rather than template-executed, which is the difference the rule exists to hold",
                ),
            );
        }
    }

    return artifacts.map((artifact) => basenameOf(artifact.path));
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "taxonomy",
    invariant:
        "an executed template and every artifact executed from one declare all mandatory gates and keep their attribution",
    extensions: [".md"],
    kinds: [
        "attributionMissing",
        "gateMissing",
        "letterNotInName",
        "participationUndeclared",
        "participationUnindexed",
        "protocolNotPreloaded",
        "skillDoesNotResolve",
        "templateImported",
        "undeliveredKey",
    ],
    heals: false,
    readsTree:
        "an agent artifact is the executed half of this rule's subject and it lives in a tree the taxonomy " +
        "declares FOREIGN — its filenames are identifiers a runtime resolves, so the naming gates must not " +
        "reach it and it is absent from every readable path set; the rule reads that tree directly because " +
        "its subject is declared out of scope by design rather than because the rule reaches past its own",

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const scoped = underRoots(context.paths, [TEMPLATE_ROOT]);

        for (const path of scoped) {
            const source = context.read(path);

            if (!isExecuted(path)) continue;

            const attributed = source.split("\n").some((line) => isAttribution(line));
            if (!attributed) {
                findings.push(
                    finding(
                        "attributionMissing",
                        path,
                        basenameOf(path),
                        `${basenameOf(path)} carries no attribution line`,
                        "the third-party attribution the licence requires",
                        "these templates are third-party IP under CC BY-SA; the attribution is never stripped, moved inside a fence, or reworded, and removing it is a licence violation rather than a style decision",
                    ),
                );
            }

            for (const gate of MANDATORY_GATES) {
                if (source.includes(gate)) continue;
                findings.push(
                    finding(
                        "gateMissing",
                        path,
                        gate,
                        `${basenameOf(path)} does not declare the ${gate} gate`,
                        MANDATORY_GATES.join(", "),
                        "the four gates never fold — worth, admissibility, evidence and termination run on every execution, and a template that omits one cannot be executed as stated",
                    ),
                );
            }

            for (const other of scoped) {
                if (other === path) continue;
                if (!source.includes(basenameOf(other))) continue;
                findings.push(
                    finding(
                        "templateImported",
                        path,
                        basenameOf(other),
                        `${basenameOf(path)} references ${basenameOf(other)}`,
                        "each template inlines its whole structure",
                        "the templates deliberately duplicate their spine so each stays independently executable; refactoring them toward a shared import is the one place the duplication rule is overruled",
                    ),
                );
            }
        }

        const agents = checkAgents(context.repoRoot, context.read(AGENT_INDEX), findings);

        return { findings, healed: [], derivations: { templates: scoped.map(basenameOf), agents } };
    },
};
