import { contentIsUnrepairable } from "../../config/surface.config.ts";
import { writeRepair } from "../core/writers/repair.writer.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const CARRIAGE_RETURN = "\r";

const LINE_FEED = "\n";

const CRLF = `${CARRIAGE_RETURN}${LINE_FEED}`;

const DECIDE =
    "a line ending is platform state rather than content, and a checkout under line-ending conversion writes a " +
    "carriage return before every line feed. Every reader here splits on the line feed alone, so the carriage return " +
    "lands inside the last token of each line: a fence whose closing run is followed by it never closes, and a path " +
    "extracted up to the end of the line resolves to nothing. The repair is deterministic — the carriage return goes " +
    "and the line feed stays — so it heals on capture";

function carriageLines(source: string): number[] {
    const out: number[] = [];
    let line = 1;

    for (let cursor = 0; cursor < source.length; cursor += 1) {
        const character = source.charAt(cursor);
        if (character === CARRIAGE_RETURN && source.charAt(cursor + 1) === LINE_FEED) out.push(line);
        if (character === LINE_FEED) line += 1;
    }

    return out;
}

function finding(path: string, lines: readonly number[]): Finding {
    const first = lines[0] ?? 0;

    return {
        rule: "text/carriageReturn",
        path,
        line: first,
        locus: `line ${String(first)}`,
        stack: [
            { check: "lineEnding", resolved: "carriage return before line feed" },
            { check: "lines", resolved: String(lines.length) },
        ],
        actual: `${String(lines.length)} line(s) end in a carriage return before the line feed`,
        expected: "every line ends in a line feed alone",
        remediation: {
            action: "rename",
            from: CRLF,
            to: LINE_FEED,
            target: path,
            deterministic: true,
            decide: DECIDE,
        },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "structure",
    jurisdiction: "all",
    invariant: "every governed text file ends each line in a line feed alone",
    extensions: [],
    kinds: ["carriageReturn"],
    heals: true,

    check(context: RuleContext, fix: boolean): RuleResult {
        const findings: Finding[] = [];
        const healed: string[] = [];
        const frozen: string[] = [];
        const refused: string[] = [];

        for (const path of context.paths) {
            const source = context.read(path);
            const lines = carriageLines(source);
            if (lines.length === 0) continue;

            if (contentIsUnrepairable(path)) {
                frozen.push(path);
                continue;
            }

            if (!fix) {
                findings.push(finding(path, lines));
                continue;
            }

            const outcome = writeRepair({ repoRoot: context.repoRoot, declared: "" }, path, source.split(CRLF).join(LINE_FEED));
            if (!outcome.written) {
                refused.push(path);
                findings.push(finding(path, lines));
                continue;
            }

            healed.push(path);
        }

        return {
            findings,
            healed,
            derivations: {
                reached: [...context.paths],
                skippedAsFrozen: frozen,
                refusedAtWrite: refused,
                range:
                    "the population is every path this run is handed; a frozen surface is reported by path rather than " +
                    "rewritten, because its declared lifetime forbids the repair and a finding there is one nobody can drain",
            },
        };
    },
};
