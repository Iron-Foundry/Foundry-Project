import { phaseSpans, type PhaseSpan } from "../analyzers/checklist.analyzer.ts";
import { TASK_MARKER } from "../constants/checklist.constants.ts";
import { MANDATORY_GATES } from "../constants/template.constants.ts";
import type { TemplateContract } from "../readers/template.reader.ts";

export interface ProtocolFinding {
    readonly kind: string;
    readonly line: number;
    readonly locus: string;
    readonly actual: string;
    readonly expected: string;
}

const CHECKED = "- [x]";

const GENESIS_LABEL = "genesis:";

const RIPPLE_LABEL = "ripple";

const RETIRED_FIELD = "RETIRED:";

function folded(lines: readonly string[]): string {
    return lines.join("\n").toLowerCase();
}

function absent(haystack: string, needles: readonly string[]): string[] {
    const missing: string[] = [];
    for (const needle of needles) {
        if (haystack.includes(needle.toLowerCase())) continue;
        missing.push(needle);
    }
    return missing;
}

function checkDocument(lines: readonly string[], spans: readonly PhaseSpan[], out: ProtocolFinding[]): void {
    const document = folded(lines);

    let tasks = 0;
    for (const line of lines) {
        if ((line ?? "").trim().startsWith(TASK_MARKER)) tasks += 1;
    }

    if (tasks === 0 && spans.length === 0) {
        if (lines.some((line) => (line ?? "").trim().startsWith(RETIRED_FIELD))) return;

        out.push({
            kind: "notAChecklist",
            line: 1,
            locus: "document",
            actual: "the file carries the checklist concern and declares no task and no phase",
            expected: "a checklist declares tasks under phases, or carries the concern its content answers to",
        });
        return;
    }

    const gates = absent(document, MANDATORY_GATES);
    if (gates.length > 0) {
        out.push({
            kind: "gateUnnamed",
            line: 1,
            locus: gates.join(", "),
            actual: `the artifact names no result for ${gates.join(", ")}`,
            expected: `every mandatory-always gate carries a result: ${MANDATORY_GATES.join(", ")}`,
        });
    }
}

function axisLabels(keys: readonly string[]): string[] {
    const out: string[] = [];
    for (const key of keys) {
        const cut = key.lastIndexOf("_");
        const letter = cut === -1 ? key : key.slice(cut + 1);
        if (letter.length > 0) out.push(`${letter.toUpperCase()}:`);
    }
    return out;
}

function rippleBlock(body: string, dimensions: readonly string[]): string | null {
    for (const line of body.split("\n")) {
        if (line.toLowerCase().includes(RIPPLE_LABEL)) return body.toLowerCase();
    }
    return dimensions.length === 0 ? body.toLowerCase() : null;
}

function isLetter(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function namesStage(tail: string, stage: string): boolean {
    let from = tail.indexOf(stage);

    while (from !== -1) {
        const before = from === 0 ? "" : tail.charAt(from - 1);
        const after = tail.charAt(from + stage.length);
        if (!isLetter(before) && !isLetter(after)) return true;
        from = tail.indexOf(stage, from + 1);
    }

    return false;
}

function declaredStage(text: string, stages: readonly string[]): boolean {
    for (const line of text.toLowerCase().split("\n")) {
        const at = line.indexOf(GENESIS_LABEL);
        if (at === -1) continue;

        const tail = line.slice(at + GENESIS_LABEL.length);
        for (const stage of stages) {
            if (namesStage(tail, stage)) return true;
        }
    }

    return false;
}

function checkPhases(spans: readonly PhaseSpan[], contract: TemplateContract, out: ProtocolFinding[]): void {
    const labels = axisLabels(contract.dependencyAxes);

    for (const span of spans) {
        const body = span.text.toUpperCase();

        const axes = labels.filter((label) => !body.includes(label));
        if (axes.length > 0) {
            out.push({
                kind: "axesMissing",
                line: span.line,
                locus: span.title,
                actual: `the phase declares no ${axes.join(" ")} edge`,
                expected: `every phase carries all ${String(labels.length)} dependency axes as labels: ${labels.join(" ")}`,
            });
        }

        const block = rippleBlock(span.text, contract.rippleDimensions);
        const ripple = block === null ? [...contract.rippleDimensions] : absent(block, contract.rippleDimensions);
        if (ripple.length > 0) {
            out.push({
                kind: "rippleMissing",
                line: span.line,
                locus: span.title,
                actual: `the phase carries no ripple entry for ${ripple.join(", ")}`,
                expected: `every phase carries all ${String(contract.rippleDimensions.length)} ripple dimensions, by name`,
            });
        }

        if (!declaredStage(`${span.title}\n${span.text}\n${span.band}`, contract.genesisStages)) {
            out.push({
                kind: "genesisMissing",
                line: span.line,
                locus: span.title,
                actual: `the phase declares no ${GENESIS_LABEL} stage`,
                expected: `${GENESIS_LABEL} naming a stage of the substrate cycle: ${contract.genesisStages.join(" -> ")}`,
            });
        }
    }
}

function checkCheckboxes(lines: readonly string[], out: ProtocolFinding[]): void {
    for (let index = 0; index < lines.length; index += 1) {
        const line = (lines[index] ?? "").trim();
        if (!line.startsWith(CHECKED)) continue;

        out.push({
            kind: "precheckedGate",
            line: index + 1,
            locus: line.slice(0, 60),
            actual: "a future execution checkbox is pre-checked at generation",
            expected: "generation gates are separate from execution gates, which ship unchecked",
        });
    }
}

export function scaffoldLabels(contract: TemplateContract): string[] {
    return [
        ...axisLabels(contract.dependencyAxes),
        ...contract.rippleDimensions.map((name) => name.toUpperCase()),
        ...contract.genesisStages.map((name) => name.toUpperCase()),
    ];
}

const DISTRIBUTES = "DISTRIBUTES:";

export function putToWork(lines: readonly string[]): boolean {
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(DISTRIBUTES)) continue;
        if (trimmed.slice(DISTRIBUTES.length).trim().length > 0) return true;
    }
    return false;
}

export function inspectProtocol(lines: readonly string[], contract: TemplateContract): ProtocolFinding[] {
    const out: ProtocolFinding[] = [];

    const spans = phaseSpans(lines);

    checkDocument(lines, spans, out);
    if (putToWork(lines)) checkPhases(spans, contract, out);
    checkCheckboxes(lines, out);

    return out;
}
