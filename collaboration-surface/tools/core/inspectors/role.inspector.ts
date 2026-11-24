import { FRONTMATTER_FENCE } from "../constants/template.constants.ts";
import type { Finding } from "../types/segment.types.ts";

const USAGE_HEADING = "# HOW THIS TEMPLATE IS USED";

export function roleSectionsFrom(template: string): readonly string[] {
    const sections: string[] = [];

    for (const line of template.split("\n")) {
        const text = line.trim();
        if (!text.startsWith("# ")) continue;
        if (text === USAGE_HEADING) continue;
        sections.push(text);
    }

    return sections;
}

export function roleSubsectionsFrom(template: string): readonly string[] {
    const out: string[] = [];

    for (const line of template.split("\n")) {
        const text = line.trim();
        if (!text.startsWith("## ")) continue;
        out.push(text);
    }

    return out;
}

export interface MeasuredSection {
    readonly section: string;
    readonly state: "absent" | "unfilled";
}

function sectionBody(source: string, heading: string): string[] | null {
    const lines = source.split("\n");
    let inside = false;
    const body: string[] = [];

    for (const line of lines) {
        const text = line.trim();

        if (!inside && text.startsWith(heading)) {
            inside = true;
            continue;
        }
        if (inside && text.startsWith("#")) break;
        if (!inside) continue;
        if (text.length === 0) continue;
        if (text.startsWith("<") && text.endsWith(">")) continue;
        body.push(text);
    }

    return inside ? body : null;
}

export function unfilledMeasuredSections(source: string, template: string): MeasuredSection[] {
    const out: MeasuredSection[] = [];

    for (const heading of roleSubsectionsFrom(template)) {
        const body = sectionBody(source, heading);
        if (body === null) {
            out.push({ section: heading, state: "absent" });
            continue;
        }
        if (body.length === 0) out.push({ section: heading, state: "unfilled" });
    }

    return out;
}

export function roleFieldsFrom(template: string): readonly string[] {
    const fields: string[] = [];
    const lines = template.split("\n");
    if (lines[0]?.trim() !== FRONTMATTER_FENCE) return fields;

    for (const line of lines.slice(1)) {
        const text = line.trim();
        if (text === FRONTMATTER_FENCE) break;

        const colon = text.indexOf(":");
        if (colon <= 0) continue;

        const key = text.slice(0, colon);
        const value = text.slice(colon + 1).trim();
        fields.push(value.startsWith("<") ? `${key}:` : `${key}: ${value}`);
    }

    return fields;
}

const DECIDE =
    "a role document states who a seat is, what it owns, what it refuses and the principles that decide " +
    "its calls — and it is read by every other seat to know what may be routed where. A uniform shape is " +
    "what makes the set comparable: a reader looking for what a seat REFUSES must find it in the " +
    "same place in each, or the document is prose that happens to be filed together. The section set is " +
    "DERIVED from the role template rather than transcribed here, so the check cannot drift from the " +
    "document a seat is raised from: it is " +
    "the contract and the frontmatter carries the operands a tool reads — the letter the citations " +
    "resolve through, and the concern the filename is derived from";

export function checkRoleCoverage(
    letters: readonly string[],
    files: readonly string[],
    build: (kind: string, locus: string, actual: string, expected: string, decide: string) => Finding,
    findings: Finding[],
): void {
    for (const letter of letters) {
        const marker = `.${letter.toLowerCase()}.role.md`;
        if (files.some((file) => file.endsWith(marker))) continue;

        findings.push(
            build(
                "roleMissing",
                letter,
                `${letter} is ACTIVE in the agent index and owns no role document`,
                `a <subject>.${letter.toLowerCase()}.role.md under the roles directory`,
                "a seat's role document is what every other seat reads to know what may be routed to it, and what a resuming session reads to know what it owns and refuses. The index ALLOCATES the letter and this check binds the obligation to it, so a new seat cannot become active without one — otherwise the shape is gated and the existence is not, and a uniform document nobody is required to write is a folder that stays empty while the gate reports green",
            ),
        );
    }
}

export function checkRoleShape(
    path: string,
    source: string,
    template: string,
    build: (kind: string, locus: string, actual: string, expected: string, decide: string) => Finding,
    findings: Finding[],
): void {
    const sections = roleSectionsFrom(template);

    for (const field of roleFieldsFrom(template)) {
        if (source.includes(field)) continue;
        findings.push(
            build("roleFieldMissing", field, `${path} declares no ${field}`, `${field} in the frontmatter`, DECIDE),
        );
    }

    for (const section of sections) {
        if (source.split("\n").some((line) => line.trim() === section)) continue;
        findings.push(
            build(
                "roleSectionMissing",
                section,
                `${path} carries no "${section}" section`,
                sections.join(", "),
                DECIDE,
            ),
        );
    }

    for (const gap of unfilledMeasuredSections(source, template)) {
        findings.push(
            build(
                "measuredSectionUnfilled",
                gap.section,
                gap.state === "absent"
                    ? `${path} carries no "${gap.section}" subsection`
                    : `${path} declares "${gap.section}" and states nothing under it`,
                `${gap.section} carrying at least one measured entry, or absent from the template`,
                "A SEAT'S MEASURED ERROR DISTRIBUTION IS THE ONLY EVIDENCE IT HOLDS ABOUT ITSELF, AND NOTHING ELSE IN THE TREE KEEPS A COPY. A rule carries the shape it enforces, a gate carries a verdict, the accumulator carries what a discussion concluded — none of them records what one seat has repeatedly got wrong, which is the input that makes a role document more than a job description. A DECLARED-AND-EMPTY SECTION AND AN ABSENT ONE ARE DIFFERENT STATES AND ONLY ONE OF THEM IS AN ANSWER: a seat that has measured nothing yet writes what it has, and a template seed left in place states nothing while reading as a section that exists. The section set is DERIVED from the role template on every run, so this cannot drift from the document a seat is raised from, and a document listing only virtues is decoration — a seat reading its own document is looking for the trap it fell into last time",
            ),
        );
    }
}
