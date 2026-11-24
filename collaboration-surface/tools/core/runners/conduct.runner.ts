import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { writeRepair } from "../writers/repair.writer.ts";

const ROW = "| `";

const CELL = "|";

const UNBUILT = "none";

const ABSENT = "—";

export interface HalfRequest {
    readonly repoRoot: string;
    readonly target: string;
    readonly slug: string;
    readonly value: string;
    readonly registered: readonly string[];
}

export interface HalfOutcome {
    readonly code: number;
    readonly message: string;
}

function rowSlug(line: string): string {
    if (!line.startsWith(ROW)) return "";

    const rest = line.slice(ROW.length);
    const close = rest.indexOf("`");
    return close === -1 ? "" : rest.slice(0, close);
}

export function isDeclaredHalf(value: string, registered: readonly string[]): boolean {
    return value === UNBUILT || value === ABSENT || registered.includes(value);
}

export function withThirdCell(line: string, value: string): string | null {
    const cells = line.split(CELL);
    if (cells.length < 5) return null;

    cells[3] = ` \`${value}\` `;
    return cells.join(CELL);
}

export function runHalf(request: HalfRequest): HalfOutcome {
    const absolute = resolve(request.repoRoot, request.target);
    if (!existsSync(absolute)) {
        return { code: 2, message: `REFUSED  ${request.target} does not exist, so there is no roster to write\n` };
    }

    if (!isDeclaredHalf(request.value, request.registered)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.value} is neither a registered check, the unbuilt marker nor the absent marker. THE ` +
                "VOCABULARY IS CLOSED TO THREE VALUES AND EACH ANSWERS A DIFFERENT QUESTION: a registered id names what " +
                "OBSERVES the half; the unbuilt marker states the half is decidable and NOT observed, which is enforcement " +
                "debt belonging in a backlog rather than in a paragraph; and the absent marker states the entry was " +
                "ASSESSED and has no checkable half at all, because its subject is an act rather than an artifact. A value " +
                "outside the three reads as governed and resolves in no count\n",
        };
    }

    const source = readSurface(absolute, "utf8");
    const lines = source.split("\n");
    const at = lines.findIndex((line) => rowSlug(line) === request.slug);

    if (at === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.slug} carries no row on ${request.target}, so there is no entry whose half this states. ` +
                "A ROW IS THE UNIT AND ITS SLUG IS THE KEY: a cell written against a slug the roster does not carry would " +
                "record an assessment of a rule the coverage walk never quantifies over\n",
        };
    }

    const written = withThirdCell(lines[at] ?? "", request.value);
    if (written === null) {
        return {
            code: 2,
            message:
                `REFUSED  the row for ${request.slug} does not carry the declared columns, so the third cell cannot be ` +
                "resolved by position — and a form guessing which cell holds the half would overwrite the entry's evidence " +
                "with its verdict\n",
        };
    }

    const outcome = writeRepair(
        { repoRoot: request.repoRoot, declared: "whole" },
        request.target,
        [...lines.slice(0, at), written, ...lines.slice(at + 1)].join("\n"),
    );
    if (!outcome.written) return { code: 2, message: outcome.refusal ?? "" };

    return {
        code: 0,
        message:
            `HALF  ${request.slug} states its checkable half as ${request.value}. A ROW WITH NO THIRD CELL IS UNASSESSED, ` +
            "which is a DECLARED state rather than a missing one — it says nobody has compared this entry's claim against " +
            "the current tree, and that is what makes the remaining work derivable from the table instead of transcribed " +
            "as a count. THE WRITE IS COMPELLED RATHER THAN CHOSEN: the cell is resolved by column position, the value is " +
            "checked against the closed set, and the write refuses where the file moved since it was read — none of which " +
            "a hand edit into this table is required to do\n",
    };
}
