import { contentDivides, contentIsImmutable } from "../../config/surface.config.ts";
import { enclosingRecord, itemSpanFlags } from "../core/analyzers/board.analyzer.ts";
import {
    ACCUMULATOR_MARKER,
    HISTORY_HEADINGS,
    PAST_MARKERS,
    STATUS_MARKERS,
    TENSE_EXEMPT,
    TENSE_EXEMPT_ROOTS,
} from "../core/constants/tense.constants.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const FENCE = "```";

function isAccumulator(path: string): boolean {
    const slash = path.lastIndexOf("/");
    const name = slash === -1 ? path : path.slice(slash + 1);
    return name.startsWith(ACCUMULATOR_MARKER);
}

interface Hit {
    readonly marker: string;
    readonly line: number;
    readonly text: string;
    readonly kind: string;
}

function prose(line: string): string {
    let out = "";
    let inCode = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i] ?? "";
        if (char === "`") {
            inCode = !inCode;
            continue;
        }
        if (!inCode) out += char;
    }

    return out.toLowerCase();
}

function isLetter(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function containsPhrase(text: string, phrase: string): boolean {
    let from = text.indexOf(phrase);

    while (from !== -1) {
        const before = from === 0 ? "" : (text[from - 1] ?? "");
        const afterIndex = from + phrase.length;
        const after = afterIndex >= text.length ? "" : (text[afterIndex] ?? "");

        if (!isLetter(before) && !isLetter(after)) return true;
        from = text.indexOf(phrase, from + 1);
    }

    return false;
}

function scan(source: string): Hit[] {
    const out: Hit[] = [];
    const lines = source.split("\n");
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
        const raw = lines[index] ?? "";
        if (raw.trimStart().startsWith(FENCE)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;

        const text = prose(raw);
        if (text.length === 0) continue;

        for (const marker of STATUS_MARKERS) {
            if (text.includes(marker)) out.push({ marker, line: index + 1, text: raw.trim(), kind: "retiredStatus" });
        }

        if (raw.startsWith("#")) {
            for (const heading of HISTORY_HEADINGS) {
                if (text.includes(heading)) {
                    out.push({ marker: heading, line: index + 1, text: raw.trim(), kind: "historySection" });
                }
            }
        }

        for (const marker of PAST_MARKERS) {
            if (containsPhrase(text, marker)) {
                out.push({ marker, line: index + 1, text: raw.trim(), kind: "pastTense" });
            }
        }
    }

    return out;
}

function finding(path: string, hit: Hit, anchor: string | null): Finding {
    const decide =
        hit.kind === "retiredStatus"
            ? "delete the record rather than marking it — a retired record is history, and history has two homes"
            : hit.kind === "historySection"
              ? "move the section to _changelogs.txt — a governing document states what is true now"
              : "rewrite the sentence so it describes the current state, or move it to _changelogs.txt; a fact about third-party platform behaviour is written in present tense and is not history";

    return {
        rule: `tense/${hit.kind}`,
        path,
        line: hit.line,
        locus: anchor === null ? hit.marker : anchor,
        stack: [
            { check: "exempt", resolved: "no" },
            { check: "mention", resolved: "no" },
            { check: "marker", resolved: hit.marker },
            { check: "anchor", resolved: anchor ?? "line" },
        ],
        actual: hit.text.slice(0, 200),
        expected: null,
        remediation: { action: "none", from: hit.marker, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "taxonomy",
    invariant:
        "every governed document that OUTLIVES its writing states what is true now and carries no history of this project; a transient surface is governed on its FORMAT and never on its content",
    extensions: [".md"],
    kinds: ["retiredStatus", "historySection", "pastTense"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const reached: string[] = [];
        const skippedByDeclaredPath: string[] = [];
        const skippedByUpstreamRoot: string[] = [];
        const skippedAsAccumulator: string[] = [];
        const skippedAsTransientVenue: string[] = [];
        const dividedSurfaces: string[] = [];

        for (const path of context.paths) {
            if (TENSE_EXEMPT.includes(path)) {
                skippedByDeclaredPath.push(path);
                continue;
            }
            if (TENSE_EXEMPT_ROOTS.some((root) => path.startsWith(root))) {
                skippedByUpstreamRoot.push(path);
                continue;
            }
            if (isAccumulator(path)) {
                skippedAsAccumulator.push(path);
                continue;
            }
            if (contentIsImmutable(path)) {
                skippedAsTransientVenue.push(path);
                continue;
            }
            reached.push(path);

            const source = context.read(path);

            if (!contentDivides(path)) {
                for (const hit of scan(source)) findings.push(finding(path, hit, null));
                continue;
            }

            dividedSurfaces.push(path);
            const appendOnly = itemSpanFlags(source);
            const anchorOf = enclosingRecord(source);

            for (const hit of scan(source)) {
                if (appendOnly[hit.line - 1] === true) continue;
                findings.push(finding(path, hit, anchorOf(hit.line)));
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                scanned: reached.length,
                reached,
                skippedByDeclaredPath,
                skippedByUpstreamRoot,
                skippedAsAccumulator,
                skippedAsTransientVenue,
                dividedSurfaces,
                dividedReason:
                    "a surface whose declared lifetime DIVIDES is scanned in its owner-rewritable region and skipped in " +
                    "its append-only one, because a finding on a span no party may rewrite is a report nobody can drain " +
                    "— the unreachable-remediation shape, whose cost lands on the findings beside it rather than on " +
                    "itself. The declaration decides THAT a surface splits and the span mechanism decides WHERE, so no " +
                    "prose is parsed and the one config stays the only truth",
                anchorReason:
                    "on a surface whose declared lifetime DIVIDES, a finding's locus is the enclosing RECORD rather " +
                    "than a line, because such a surface only ever grows: every position any party appends moves every " +
                    "line below it, so a reported line points further above its subject at a constant rate while the " +
                    "report still reads as current, and a reader joining that line against the live file lands the " +
                    "finding in whichever span happened to grow. The record letter is the anchor an append cannot " +
                    "move. The line is kept beside it because it is exact at the moment of the run, and the two are " +
                    "told apart by the DECLARED lifetime rather than by the file's extension",
            },
        };
    },
};
