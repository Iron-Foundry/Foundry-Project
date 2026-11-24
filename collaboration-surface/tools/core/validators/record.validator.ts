import type { RecordEntry } from "../readers/record.reader.ts";
import type { Finding } from "../types/segment.types.ts";

export const REQUIRED = ["type", "statement", "confidence", "source"];

export const TENSION_REQUIRED = [
    "kind",
    "conflicts",
    "with",
    "axis",
    "cause",
    "resolution",
    "remediate",
    "compatible",
    "incompatible",
];

export const KINDS = ["apparent", "real"];

export const CONFIDENCE_TIERS = ["verified-local", "vendor-doc", "community", "inferred"];

export const DERIVATIONS = ["original", "adapted", "quoted"];

export const DISPUTED = "disputed";

export function recordFinding(
    kind: string,
    path: string,
    line: number,
    locus: string,
    actual: string,
    decide: string,
): Finding {
    return {
        rule: `record/${kind}`,
        path,
        line,
        locus,
        stack: [
            { check: "record", resolved: locus },
            { check: kind, resolved: "failed" },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: locus, to: null, target: path, deterministic: false, decide },
        healed: false,
    };
}

export function checkSchema(path: string, record: RecordEntry, findings: Finding[]): void {
    for (const key of REQUIRED) {
        if (record.keys[key] !== undefined) continue;
        findings.push(
            recordFinding(
                "missingKey",
                path,
                record.line,
                record.id,
                `${record.id} has no ${key}`,
                `add ${key} — the contract requires it on every typed record, and a record missing one cannot be evaluated`,
            ),
        );
    }

    const confidence = record.keys["confidence"];
    if (confidence !== undefined && !CONFIDENCE_TIERS.includes(confidence)) {
        findings.push(
            recordFinding(
                "unknownTier",
                path,
                record.line,
                record.id,
                `${record.id} declares confidence "${confidence}"`,
                `use a declared tier — ${CONFIDENCE_TIERS.join(", ")} — because precedence between evidence is decided by the tier, and a tier outside the vocabulary cannot be ranked against another. HOW a record came to be is a DIFFERENT axis and belongs in derivation — ${DERIVATIONS.join(", ")} — since material adapted from another source can be strong or weak evidence independently, so a word describing provenance cannot be ranked against one describing strength and pushing it into this vocabulary would leave the whole set unrankable`,
            ),
        );
    }

    const derivation = record.keys["derivation"];
    if (derivation !== undefined && !DERIVATIONS.includes(derivation)) {
        findings.push(
            recordFinding(
                "unknownDerivation",
                path,
                record.line,
                record.id,
                `${record.id} declares derivation "${derivation}"`,
                `use a declared derivation — ${DERIVATIONS.join(", ")} — because an open provenance vocabulary reads as governed while resolving to nothing, exactly as an open tier would. The field is OPTIONAL and states how the record came to be; its strength stays in confidence`,
            ),
        );
    }

    const surfaced = record.keys["see"] !== undefined || record.keys["detect"] !== undefined;
    if (record.keys["status"] === DISPUTED && !surfaced) {
        findings.push(
            recordFinding(
                "disputedNotSurfaced",
                path,
                record.line,
                record.id,
                `${record.id} is disputed but neither links a counterpart nor says how to resolve it`,
                "a conflict is surfaced rather than silently resolved — either see the record that disagrees, or state in detect how a reader settles it; a disputed record carrying neither says something disagrees without saying what or how",
            ),
        );
    }
}

export function checkTension(path: string, record: RecordEntry, findings: Finding[]): void {
    for (const key of TENSION_REQUIRED) {
        if (record.keys[key] !== undefined) continue;
        findings.push(
            recordFinding(
                "missingTensionKey",
                path,
                record.line,
                record.id,
                `${record.id} is a tension and has no ${key}`,
                `add ${key} — a tension is a typed relation, and without every key it degrades to prose that cannot be resolved`,
            ),
        );
    }

    const kind = record.keys["kind"];
    if (kind !== undefined && !KINDS.includes(kind)) {
        findings.push(
            recordFinding(
                "unknownKind",
                path,
                record.line,
                record.id,
                `kind is "${kind}"`,
                "kind is apparent or real — apparent means both principles survive once their domains separate, real means one must be chosen",
            ),
        );
    }

    const incompatible = record.keys["incompatible"];
    if (kind === "apparent" && incompatible !== undefined && incompatible !== "none") {
        findings.push(
            recordFinding(
                "kindContradiction",
                path,
                record.line,
                record.id,
                `kind is apparent while incompatible names "${incompatible}"`,
                "an apparent tension resolves by separating domains, so nothing is incompatible; set incompatible to none, or the tension is real",
            ),
        );
    }
    if (kind === "real" && incompatible === "none") {
        findings.push(
            recordFinding(
                "kindContradiction",
                path,
                record.line,
                record.id,
                "kind is real while incompatible is none",
                "a real tension is a genuine trade-off, so name what cannot hold together; if nothing cannot, the tension is apparent",
            ),
        );
    }
}
