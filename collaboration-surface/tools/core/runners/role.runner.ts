import { existsSync } from "node:fs";

import { roleFieldsFrom, roleSectionsFrom, roleSubsectionsFrom } from "../inspectors/role.inspector.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const PLACEHOLDER_OPEN = "<";

const PLACEHOLDER_CLOSE = ">";

export interface RoleRequest {
    readonly absolute: string;
    readonly template: string;
    readonly letter: string;
    readonly concern: string;
}

export interface RoleOutcome {
    readonly code: number;
    readonly message: string;
}

function filled(field: string, letter: string, concern: string): string {
    const colon = field.indexOf(":");
    const key = colon === -1 ? field : field.slice(0, colon);

    if (key === "letter") return `letter: ${letter}`;
    if (key === "concern") return `concern: ${concern}`;
    if (key === "name") return `name: ${concern}.${letter.toLowerCase()}`;

    return field.endsWith(":") ? `${field} ${PLACEHOLDER_OPEN}unwritten${PLACEHOLDER_CLOSE}` : field;
}

export function runRole(request: RoleRequest): RoleOutcome {
    if (request.concern.trim().length === 0) {
        return {
            code: 2,
            message:
                "REFUSED  a role document is named for the CONCERN this seat owns and this call named none. The letter " +
                "changes hands while the concern outlives the seat, which is why the filename carries the concern and " +
                "the letter takes the variant slot — a letter-named document breaks every citation the moment a seat " +
                "changes hands, and the letter is not lost because it moves into a field a tool reads and a rename " +
                "cannot break",
        };
    }

    if (existsSync(request.absolute)) {
        return {
            code: 2,
            message:
                "CLEAR  this seat already owns a role document, so there is nothing to raise. The document is " +
                "CURRENT-TRUTH and is edited in place; a second one under one concern would give every reader two " +
                "answers to what this seat owns and refuses, with nothing saying which wins",
        };
    }

    const template = readSurface(request.template, "utf8");
    const sections = roleSectionsFrom(template);

    if (sections.length === 0) {
        return {
            code: 2,
            message:
                "REFUSED  the role template declares no sections, so this form has no contract to raise a document " +
                "from. The section set is DERIVED from the template on every run rather than transcribed here, which " +
                "is what stops the raise and the check drifting from the document a seat is raised from — so an empty " +
                "template is a missing contract rather than a document with no sections",
        };
    }

    const lines: string[] = ["---"];
    for (const field of roleFieldsFrom(template)) lines.push(filled(field, request.letter, request.concern));
    lines.push("---", "");

    for (const section of sections) {
        lines.push(section, "", `${PLACEHOLDER_OPEN}unwritten${PLACEHOLDER_CLOSE}`, "");
    }

    for (const subsection of roleSubsectionsFrom(template)) {
        lines.push(subsection, "", `${PLACEHOLDER_OPEN}unwritten${PLACEHOLDER_CLOSE}`, "");
    }

    writeSurface(request.absolute, lines.join("\n"));

    return {
        code: 0,
        message:
            `DOCUMENT  raised for ${request.letter} at the concern ${request.concern}, with its section set and its ` +
            "frontmatter DERIVED from the role template rather than transcribed — so a section added to the template " +
            "arrives in the next document with no edit here, and the raise cannot disagree with the check reading the " +
            "same contract. EVERY SECTION LANDS UNWRITTEN AND THAT IS THE POINT: a seeded placeholder states nothing " +
            "while reading as a section that exists, so the shape is delivered and the content is owed. The measured " +
            "failure modes are the section a seat reads its own document FOR — a document listing only virtues is " +
            "decoration, because a seat opening it is looking for the trap it fell into last time",
    };
}
