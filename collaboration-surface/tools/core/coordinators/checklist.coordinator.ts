import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { surfacePath } from "../../../config/surface.config.ts";
import { boardRecords } from "../analyzers/board.analyzer.ts";
import { BOARD_PATH } from "../constants/board.constants.ts";
import { CHECKLIST_CONCERN, CHECKLIST_TEMPLATE, CONTRACT_FIELDS } from "../constants/checklist.constants.ts";
import { GENERATED_DIR } from "../constants/path.constants.ts";
import { inspectProtocol, scaffoldLabels } from "../inspectors/checklist.inspector.ts";
import { readTemplateContract, type TemplateContract } from "../readers/template.reader.ts";
import { agentBreaches, closureBreaches, idBreaches } from "../resolvers/checklist.resolver.ts";
import { peerSet } from "../validators/board.validator.ts";
import {
    count,
    declaresContract,
    emptyPhases,
    historyIn,
    missingFields,
    taskBlocks,
} from "../validators/checklist.validator.ts";
import { countLiterals } from "../validators/literal.validator.ts";

export interface Breach {
    readonly kind: string;
    readonly line: number;
    readonly locus: string;
    readonly actual: string;
    readonly expected: string;
}

export interface SurfaceReport {
    readonly breaches: readonly Breach[];
    readonly derivations: Record<string, unknown>;
}

export function contractOf(repoRoot: string): TemplateContract {
    return readTemplateContract(readSurface(resolve(repoRoot, CHECKLIST_TEMPLATE), "utf8"));
}

export function activeSet(surface: {
    readonly read: (path: string) => string;
    readonly exists: (path: string) => boolean;
}): ReadonlySet<string> {
    if (!surface.exists(BOARD_PATH)) return new Set<string>();

    const index = surfacePath("agent_index");
    return peerSet(boardRecords(surface.read(BOARD_PATH)), surface.exists(index) ? surface.read(index) : "");
}

export function countBreaches(lines: readonly string[]): Breach[] {
    return countLiterals(lines).map((literal) => ({
        kind: "literalCount",
        line: literal.line,
        locus: `${literal.numeral} ${literal.noun}`,
        actual: `an authored surface states the cardinality of ${literal.noun} as a literal`,
        expected: `read the count from ${GENERATED_DIR} where the pipeline derives it`,
    }));
}

function contractBreaches(lines: readonly string[]): Breach[] {
    const out: Breach[] = [];

    for (const block of taskBlocks(lines)) {
        const absent = missingFields(block.text);
        if (absent.length === 0) continue;

        out.push({
            kind: "contractIncomplete",
            line: block.line,
            locus: block.text.slice(0, 60),
            actual: `the task omits ${absent.join(", ")}`,
            expected: `every task carries ${CONTRACT_FIELDS.join(", ")}`,
        });
    }

    return out;
}

function historyBreaches(lines: readonly string[]): Breach[] {
    const out: Breach[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const marker = historyIn(lines[index] ?? "");
        if (marker === null) continue;

        out.push({
            kind: "history",
            line: index + 1,
            locus: marker,
            actual: `a planning surface states ${marker}`,
            expected: "current and future only",
        });
    }

    return out;
}

function phaseBreaches(lines: readonly string[], scaffold: readonly string[]): Breach[] {
    return emptyPhases(lines, scaffold).map((essay) => ({
        kind: "phaseWithoutTask",
        line: essay.line,
        locus: essay.title,
        actual: `${essay.title} declares no task`,
        expected: "every phase declares at least one task",
    }));
}

export function inspectSurface(
    path: string,
    lines: readonly string[],
    contract: TemplateContract,
    active: ReadonlySet<string>,
): SurfaceReport {
    const breaches: Breach[] = [];

    if (path.endsWith(CHECKLIST_CONCERN)) {
        for (const breach of inspectProtocol(lines, contract)) breaches.push(breach);
    }

    for (const breach of agentBreaches(lines, active)) {
        breaches.push({
            kind: breach.kind,
            line: breach.line,
            locus: breach.id,
            actual: breach.actual,
            expected: breach.expected,
        });
    }

    for (const breach of closureBreaches(lines)) {
        breaches.push({
            kind: breach.kind,
            line: breach.line,
            locus: breach.id,
            actual: breach.actual,
            expected: breach.expected,
        });
    }

    if (!declaresContract(taskBlocks(lines))) {
        return { breaches, derivations: { contractDeclared: false, breaches: breaches.length } };
    }

    for (const breach of contractBreaches(lines)) breaches.push(breach);
    for (const breach of historyBreaches(lines)) breaches.push(breach);
    for (const breach of phaseBreaches(lines, scaffoldLabels(contract))) breaches.push(breach);

    for (const breach of idBreaches(lines)) {
        breaches.push({
            kind: breach.kind,
            line: breach.line,
            locus: breach.id,
            actual: breach.actual,
            expected: breach.expected,
        });
    }

    return { breaches, derivations: { ...count(lines), breaches: breaches.length } };
}
