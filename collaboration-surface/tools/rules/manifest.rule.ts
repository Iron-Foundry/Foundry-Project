import { ENTRY_PATH, MANIFEST_PATH } from "../core/constants/manifest.constants.ts";
import { renderEntry, writeEntry } from "../core/generators/manifest.generator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function unreadable(): Finding {
    return {
        rule: "manifest/manifestUnreadable",
        path: MANIFEST_PATH,
        line: 0,
        locus: "manifest",
        stack: [
            { check: "manifest", resolved: MANIFEST_PATH },
            { check: "parse", resolved: "not a JSON object" },
        ],
        actual: "the manifest does not parse as a JSON object, so no entry document can be rendered from it",
        expected: "a JSON object carrying label, summary and a docs block",
        remediation: {
            action: "declare",
            from: MANIFEST_PATH,
            to: null,
            target: MANIFEST_PATH,
            deterministic: false,
            decide: "the manifest is the only authored source of the entry document, so a manifest that does not parse leaves the entry document describing whatever it last said. Repair the manifest; the entry document heals on the next run",
        },
        healed: false,
    };
}

function drifted(healed: boolean): Finding {
    return {
        rule: "manifest/entryDrift",
        path: ENTRY_PATH,
        line: 0,
        locus: "entry document",
        stack: [
            { check: "source", resolved: MANIFEST_PATH },
            { check: "rendered", resolved: "differs from the document on disk" },
        ],
        actual: "the entry document on disk differs from the manifest it is rendered from",
        expected: "the rendered entry document",
        remediation: {
            action: "none",
            from: ENTRY_PATH,
            to: null,
            target: MANIFEST_PATH,
            deterministic: true,
            decide: "the entry document is RENDERED, so the repair lands in the manifest it is rendered from and a healing run re-renders it; an edit to the rendered file is overwritten by the next run",
        },
        healed,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant: "the entry document is rendered from the manifest rather than authored beside it",
    extensions: [".md", ".json"],
    kinds: ["manifestUnreadable", "entryDrift"],
    heals: true,

    reads: [MANIFEST_PATH, ENTRY_PATH],

    check(context: RuleContext, fix: boolean): RuleResult {
        const surfaces = [MANIFEST_PATH, ENTRY_PATH].filter((path) => context.paths.includes(path));
        if (surfaces.length === 0 || !context.exists(MANIFEST_PATH)) {
            return { findings: [], healed: [], derivations: { surfaces, entry: "not rendered" } };
        }

        const rendered = renderEntry(context.read(MANIFEST_PATH));
        if (rendered === null) {
            return { findings: [unreadable()], healed: [], derivations: { surfaces, entry: "unreadable manifest" } };
        }

        const onDisk = context.exists(ENTRY_PATH) ? context.read(ENTRY_PATH) : null;
        if (onDisk === rendered) {
            return { findings: [], healed: [], derivations: { surfaces, entry: "current" } };
        }

        const healed: string[] = [];
        if (fix && writeEntry(context.repoRoot, rendered) === null) healed.push(ENTRY_PATH);

        return {
            findings: [drifted(healed.length > 0)],
            healed,
            derivations: { surfaces, entry: healed.length > 0 ? "rendered" : "drifted" },
        };
    },
};
