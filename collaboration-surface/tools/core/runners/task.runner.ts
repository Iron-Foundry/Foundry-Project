import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { CONTRACT_FIELDS } from "../constants/checklist.constants.ts";
import { writeRepair } from "../writers/repair.writer.ts";

const TASK_MARKER = "- [ ] ";

const PLACEHOLDER = "<unwritten>";

export interface TaskRequest {
    readonly repoRoot: string;
    readonly target: string;
    readonly id: string;
    readonly statement: string;
    readonly owner: string;
}

export interface TaskOutcome {
    readonly code: number;
    readonly message: string;
}

export function contractFieldNames(fields: readonly string[]): string[] {
    const out: string[] = [];

    for (const field of fields) {
        let name = "";
        for (const character of field) {
            if (character === "*" || character === ":") continue;
            name += character;
        }
        if (name.length > 0) out.push(name);
    }

    return out;
}

function isDeclared(source: string, id: string): boolean {
    for (const line of source.split("\n")) {
        if (!line.trimStart().startsWith(TASK_MARKER)) continue;
        if (line.trimStart().slice(TASK_MARKER.length).startsWith(`${id} `)) return true;
    }

    return false;
}

function lastTaskLine(lines: readonly string[]): number {
    let at = -1;

    for (let index = 0; index < lines.length; index += 1) {
        if ((lines[index] ?? "").trimStart().startsWith(TASK_MARKER)) at = index;
    }

    return at;
}

export function runTask(request: TaskRequest): TaskOutcome {
    const absolute = resolve(request.repoRoot, request.target);

    if (!existsSync(absolute)) {
        return {
            code: 2,
            message: `REFUSED  ${request.target} does not exist, so there is no surface to carry a row\n`,
        };
    }

    if (request.id.trim().length === 0 || request.statement.trim().length === 0) {
        return {
            code: 2,
            message:
                "REFUSED  a row carries an ID every citation resolves through and a STATEMENT of what it asks for, and this " +
                "call named one without the other. An id with no statement is a citation target that asks nothing, and a " +
                "statement with no id is work no dependency, ordering claim or closure can ever name\n",
        };
    }

    const source = readSurface(absolute, "utf8");

    if (isDeclared(source, request.id.trim())) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.id} already declares a row on ${request.target}. AN ID RESOLVES TO ONE TASK, because a ` +
                "duplicated id makes every citation of it ambiguous with no error anywhere — and the ambiguity is invisible " +
                "to a reader who follows a citation and finds two answers that both look intended\n",
        };
    }

    const lines = source.split("\n");
    const at = lastTaskLine(lines);
    if (at === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.target} carries no task row, so this form has no region to append within and would ` +
                "place a row wherever the file happens to end. A surface takes this form by carrying the rows it governs\n",
        };
    }

    const fields = contractFieldNames(CONTRACT_FIELDS)
        .map((name) => (name === "owner" ? `owner: ${request.owner}` : `${name}: ${PLACEHOLDER}`))
        .join("; ");

    const row = `${TASK_MARKER}${request.id.trim()} ${request.statement.trim()} — owner: ${request.owner}; ${fields}`;
    const written = [...lines.slice(0, at + 1), row, ...lines.slice(at + 1)];

    const outcome = writeRepair({ repoRoot: request.repoRoot, declared: "whole" }, request.target, written.join("\n"));
    if (!outcome.written) return { code: 2, message: outcome.refusal ?? "" };

    return {
        code: 0,
        message:
            `ROW  ${request.id} appended to ${request.target}, carrying every CONTRACT FIELD the checklist template ` +
            "declares. THE FIELD SET IS DERIVED FROM THAT TEMPLATE RATHER THAN TRANSCRIBED HERE, so a field added there " +
            "arrives in the next row with no edit at this form and the row cannot disagree with the walk reading the same " +
            "contract. EVERY FIELD LANDS UNWRITTEN EXCEPT THE OWNER: a row is a contract its author fills, and a form " +
            "inventing an evidence or a verifier would write a claim nobody made in the name of whoever the row names\n",
    };
}
