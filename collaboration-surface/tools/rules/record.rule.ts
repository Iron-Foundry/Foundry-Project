import { INTEL_ROOT } from "../core/constants/template.constants.ts";
import { citedIds, readRecordDocument } from "../core/readers/record.reader.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";
import { checkSchema, checkTension, recordFinding as finding } from "../core/validators/record.validator.ts";

const CITATION_KEYS = ["conflicts", "with", "compatible", "incompatible", "see"] as const;

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "taxonomy",
    invariant: "every typed intel record carries its required keys and every cited record id resolves",
    extensions: [".md"],
    kinds: [
        "disputedNotSurfaced",
        "duplicateId",
        "kindContradiction",
        "missingKey",
        "missingTensionKey",
        "unknownDerivation",
        "unknownKind",
        "unknownTier",
    ],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const paths = context.paths.filter((path) => path.startsWith(INTEL_ROOT));

        const known = new Set<string>();
        const parsed = new Map<string, ReturnType<typeof readRecordDocument>>();

        for (const path of paths) {
            const document = readRecordDocument(context.read(path));
            parsed.set(path, document);
            for (const record of document.records) known.add(record.id);
        }

        for (const [path, document] of parsed) {
            const seen = new Set<string>();

            for (const record of document.records) {
                if (seen.has(record.id)) {
                    findings.push(
                        finding(
                            "duplicateId",
                            path,
                            record.line,
                            record.id,
                            `${record.id} is declared more than once`,
                            "record ids are stable and unique; renumber the later one rather than reusing an id another record already answers to",
                        ),
                    );
                }
                seen.add(record.id);

                for (const key of CITATION_KEYS) {
                    const value = record.keys[key];
                    if (value === undefined) continue;
                    for (const id of citedIds(value)) {
                        if (known.has(id)) continue;
                        findings.push(
                            finding(
                                "unresolvedCitation",
                                path,
                                record.line,
                                `${record.id} ${key}`,
                                `${id} does not resolve to a record`,
                                "correct the id or drop the citation — a citation that resolves to nothing errors nowhere and disconnects the graph silently",
                            ),
                        );
                    }
                }

                if (document.shape !== "typed") continue;

                checkSchema(path, record, findings);
                if (record.keys["type"] === "tension") checkTension(path, record, findings);
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                reached: paths,
                skippedAsOutsideRecordRoot: context.paths.filter((path) => !path.startsWith(INTEL_ROOT)),
                recordsWalked: [...known].sort(),
            },
        };
    },
};
