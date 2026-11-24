import { lifetime } from "../../config/surface.config.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const MARKDOWN = ".md";

const CELL = "|";

const CLOSED: Readonly<Record<string, readonly string[]>> = {
    retention: lifetime.values.retention,
    mutability: lifetime.values.mutability,
    removal: lifetime.values.removal,
};

interface Declared {
    readonly axis: string;
    readonly value: string;
    readonly line: number;
}

const MARKUP = new Set(["`", "*", "_", " "]);

function bare(cell: string): string {
    let start = 0;
    let end = cell.length;

    while (start < end && MARKUP.has(cell[start] ?? "")) start += 1;
    while (end > start && MARKUP.has(cell[end - 1] ?? "")) end -= 1;

    return cell.slice(start, end).toLowerCase();
}

const SEPARATORS = new Set(["·", ",", "/"]);

function tokens(value: string): string[] {
    const out: string[] = [];
    let held = "";

    for (const char of value) {
        if (!SEPARATORS.has(char)) {
            held += char;
            continue;
        }
        const token = bare(held);
        if (token.length > 0) out.push(token);
        held = "";
    }

    const last = bare(held);
    if (last.length > 0) out.push(last);
    return out;
}

const WORD_BREAK = new Set([" ", "\t", "-"]);

function words(text: string): string[] {
    const out: string[] = [];
    let held = "";

    for (const char of text) {
        if (!WORD_BREAK.has(char)) {
            held += char;
            continue;
        }
        if (held.length > 0) out.push(held);
        held = "";
    }

    if (held.length > 0) out.push(held);
    return out;
}

const AXIS_COLUMN = lifetime.columns.axis;

const VALUE_COLUMN = lifetime.columns.value;

function axisNamedBy(cell: string): string | null {
    for (const word of words(cell)) {
        if (CLOSED[word] !== undefined) return word;
    }
    return null;
}

interface Columns {
    readonly axis: number;
    readonly value: number;
}

function columnsOf(row: readonly string[]): Columns | null {
    let axis = -1;
    let value = -1;

    for (let at = 0; at < row.length; at += 1) {
        const label = bare(row[at] ?? "");
        if (label === AXIS_COLUMN) axis = at;
        if (label === VALUE_COLUMN) value = at;
    }

    return axis === -1 || value === -1 ? null : { axis, value };
}

function statesTheSet(axis: string, value: string): boolean {
    const closed = CLOSED[axis] ?? [];
    const parts = tokens(value);
    if (parts.length < 2) return false;

    for (const part of parts) if (!closed.includes(part)) return false;
    return true;
}

const SPACING = new Set([" ", "\t"]);

function phrases(text: string): string[] {
    const out: string[] = [];
    let held = "";

    for (const char of text) {
        if (!SPACING.has(char)) {
            held += char;
            continue;
        }
        if (held.length > 0) out.push(held);
        held = "";
    }

    if (held.length > 0) out.push(held);
    return out;
}

function definesTheAxis(value: string): boolean {
    return phrases(value).length > 1;
}

function cells(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith(CELL)) return [];

    const out: string[] = [];
    for (const part of trimmed.split(CELL)) {
        const cell = part.trim();
        if (cell.length > 0) out.push(cell);
    }
    return out;
}

function declaredIn(source: string): Declared[] {
    const found: Declared[] = [];
    const lines = source.split("\n");

    let columns: Columns | null = null;

    for (let index = 0; index < lines.length; index += 1) {
        const row = cells(lines[index] ?? "");

        if (row.length === 0) {
            columns = null;
            continue;
        }

        if (columns === null) {
            columns = columnsOf(row);
            continue;
        }

        const axis = axisNamedBy(bare(row[columns.axis] ?? ""));
        if (axis === null) continue;

        const value = bare(row[columns.value] ?? "");
        if (value.length === 0) continue;
        if (statesTheSet(axis, value)) continue;
        if (definesTheAxis(value)) continue;
        found.push({ axis, value, line: index + 1 });
    }

    return found;
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant:
        "a surface declaring a lifetime axis carries a value the closed set for that axis contains, so a vocabulary closed in its statement and open in its contents fails rather than reading as governed",
    extensions: [],
    kinds: ["undeclaredValue"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const walked: string[] = [];
        const offVocabulary: string[] = [];

        for (const target of context.paths) {
            if (!target.endsWith(MARKDOWN)) continue;

            const declarations = declaredIn(context.read(target));
            if (declarations.length === 0) continue;
            walked.push(target);

            for (const declared of declarations) {
                const closed = CLOSED[declared.axis] ?? [];
                if (closed.includes(declared.value)) continue;

                offVocabulary.push(`${target}:${String(declared.line)} ${declared.axis}`);
                findings.push({
                    rule: "vocabulary/undeclaredValue",
                    path: target,
                    line: declared.line,
                    locus: declared.axis,
                    stack: [
                        { check: "axis", resolved: declared.axis },
                        { check: "declaredSet", resolved: closed.join(" ") },
                        { check: "carried", resolved: declared.value },
                        { check: "member", resolved: "no" },
                    ],
                    actual: `${target} declares a ${declared.axis} value the closed set for that axis does not contain`,
                    expected: closed.join(" "),
                    remediation: {
                        action: "declare",
                        from: declared.value,
                        to: null,
                        target,
                        deterministic: false,
                        decide: "state a value the closed set carries, or raise the missing one as an approved extension against the DECLARED set rather than writing it locally — a vocabulary that grows by one word per surface is not closed, and a value invented where it is USED is a second declaration of the set that disagrees with the first the moment either moves. A SET CLOSED IN ITS STATEMENT AND OPEN IN ITS CONTENTS IS THE FAILURE THIS OBSERVES: the statement reads as governed, every author can satisfy it, and nothing joins the declaration to the members, so a value outside it survives every reading by every party. THIS CHECK RESOLVES THE SET FROM THE PARAMETER SURFACE RATHER THAN CARRYING A COPY OF IT, so an extension is one edit to the declaration and reaches the check and every other consumer at once — the class surface states what the axes MEAN and the declaration states what their values ARE, which is one fact with one home and no transcription between them",
                    },
                    healed: false,
                });
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                vocabularySource: lifetime.vocabulary,
                axes: Object.keys(CLOSED),
                surfacesCarryingADeclaration: walked,
                offVocabulary,
                population:
                    "every markdown surface in this run's path set carrying a table whose OWN HEADER declares an axis column and a value column, which is the surface stating where its declarations live rather than this check matching an axis by an English spelling it carries. THE SPELLING FORM WAS THE DEFECT AND IT FAILED IN BOTH DIRECTIONS: a hardcoded set of axis names is a name list inside a check about closed vocabularies, so a surface reworded its rows and fell silently out of the population while the walk stayed green, and widening the match to any word made every prose cell mentioning an axis word into a declaration. The header is the surface's own identity for its columns, so a declaring table is recognised however its cells are worded and a prose table is outside by construction. A surface that DEFINES the axes without declaring a lifetime carries no value column and is therefore outside — which is correct rather than an exclusion, since it declares nothing for this check to test",
                columnSource:
                    "THE TWO COLUMN LABELS THAT IDENTIFY A DECLARING TABLE ARE READ FROM THE PARAMETER SURFACE, THE WAY THE MEMBER SETS ALREADY ARE, so this check transcribes no part of the schema it enforces. A declaring table is recognised by its own header naming an axis column and a value column; holding those two words as literals here was the same construct this check removed from its axis matching — a schema copied into a mechanism, which fails identically the moment a surface relabels its columns, dropping that surface out of the population silently while the walk stays green over it. The smallest possible registry is still a registry, and what made the earlier form deficient was position rather than size: it sat INSIDE the mechanism rather than beside the vocabulary it belongs to. One declaration now names the axes, their members and the columns that carry them, so a relabelling is one edit that reaches this check and every other consumer at once",
                valueKinds:
                    "a value cell resolves to one of three kinds and only the last is a finding. It STATES THE SET where every one of its separated tokens is a member and there is more than one — the surface exhibiting the vocabulary rather than using it. It DEFINES the axis where the cell is more than one word, which is prose about what the axis separates and carries no claim a member could satisfy. It USES a value where the cell is a single word, and that is the only kind compared against the set. The definition kind is the one this walk lacked, and its absence made a surface that DESCRIBES an axis indistinguishable from one declaring an off-vocabulary value for it",
                range: "the check decides MEMBERSHIP and claims nothing more: whether the value the surface carries is one the set contains, never whether it is the RIGHT value for that surface, which is a reading of the surface and stays with its author. An axis the set does not cover contributes no comparison rather than a passing one, so a new axis is unmeasured here until its set arrives — an unmeasured axis and a satisfied one are different states and collapsing them is the defect this whole venue named",
            },
        };
    },
};
