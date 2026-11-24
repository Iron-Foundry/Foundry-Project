import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { join } from "node:path";

import { surfacePath } from "../../../config/surface.config.ts";
import { BEHAVIOUR_DOCUMENT } from "../constants/path.constants.ts";
import { DIGEST_ROOT, INTEL_ROOT } from "../constants/template.constants.ts";

export interface Citation {
    readonly kind: string;
    readonly member: string;
}

const RULES_DIR = DIGEST_ROOT;

const ENTRYPOINT_ROOT = surfacePath("entrypoints");

const WRITE_ENTRYPOINT = "board.entrypoint.ts";
const PLANNING_DIR = surfacePath("planning");
const RULE_SOURCES = surfacePath("rules");
const RECORD_SOURCES = INTEL_ROOT;
const RULE_SUFFIX = ".rule.ts";

function joinedDirectory(root: string, relative: string): string {
    const directory = join(root, relative);
    if (!existsSync(directory)) return "";

    let held = "";
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        held += readSurface(join(directory, entry.name), "utf8");
    }
    return held;
}

function registeredGates(root: string): string[] {
    const directory = join(root, RULE_SOURCES);
    if (!existsSync(directory)) return [];

    const ids: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(RULE_SUFFIX)) continue;
        ids.push(entry.name.slice(0, entry.name.length - RULE_SUFFIX.length));
    }
    return ids;
}

function beforeSlash(member: string): string {
    const slash = member.indexOf("/");
    return slash === -1 ? member : member.slice(0, slash);
}

export function resolvesCitation(root: string, archive: string, citation: Citation): boolean {
    if (citation.kind === "changelog") return archive.includes(citation.member);

    if (citation.kind === "rule") {
        const behaviour = join(root, BEHAVIOUR_DOCUMENT);
        const held = (existsSync(behaviour) ? readSurface(behaviour, "utf8") : "") + joinedDirectory(root, RULES_DIR);
        return held.includes(citation.member);
    }

    if (citation.kind === "gate") return registeredGates(root).includes(beforeSlash(citation.member));

    if (citation.kind === "row") return joinedDirectory(root, PLANNING_DIR).includes(citation.member);

    if (citation.kind === "record") return joinedDirectory(root, RECORD_SOURCES).includes(citation.member);

    if (citation.kind === "form") return offeredForms(root).includes(citation.member);

    return false;
}

const FLAG_OPEN = '"--';

const FLAG_CLOSE = '"';

function isFlagCharacter(character: string): boolean {
    const lower = character >= "a" && character <= "z";
    return lower || character === "-";
}

export function offeredForms(root: string): string[] {
    const entrypoint = join(root, ENTRYPOINT_ROOT, WRITE_ENTRYPOINT);
    if (!existsSync(entrypoint)) return [];

    const source = readSurface(entrypoint, "utf8");
    const out: string[] = [];
    let from = 0;

    while (from < source.length) {
        const open = source.indexOf(FLAG_OPEN, from);
        if (open === -1) break;

        let cursor = open + 1;
        while (cursor < source.length && isFlagCharacter(source.charAt(cursor))) cursor += 1;

        const flag = source.slice(open + 1, cursor);
        if (cursor > open + FLAG_OPEN.length && source.charAt(cursor) === FLAG_CLOSE && !out.includes(flag)) {
            out.push(flag);
        }
        from = open + FLAG_OPEN.length;
    }

    return out;
}

export const CITATION_KINDS = ["gate", "row", "rule", "record", "changelog", "form"];

const SEPARATOR = ":";

export function parseCitation(text: string): Citation | null {
    const at = text.indexOf(SEPARATOR);
    if (at <= 0) return null;

    const kind = text.slice(0, at).trim();
    const member = text.slice(at + 1).trim();
    if (kind.length === 0 || member.length === 0) return null;

    return { kind, member };
}

export function unknownKind(citation: Citation): boolean {
    return !CITATION_KINDS.includes(citation.kind);
}

export function citationRefusal(text: string, resolves: (citation: Citation) => boolean): string | null {
    const citation = parseCitation(text);

    if (citation === null) {
        return (
            `REFUSED  "${text}" is not a typed reference. A reference names its KIND so the resolver is ` +
            `dispatched rather than guessed: one of ${CITATION_KINDS.join(", ")}, then a colon, then the ` +
            "member\n"
        );
    }

    if (unknownKind(citation)) {
        return (
            `REFUSED  "${citation.kind}" is not a declared reference kind. The vocabulary is CLOSED — an ` +
            "unknown kind would sit outside every resolver silently, which is a gate reporting green " +
            `over an excluded subject. Declared: ${CITATION_KINDS.join(", ")}\n`
        );
    }

    if (resolves(citation)) return null;

    return (
        `REFUSED  ${citation.kind}:${citation.member} does not resolve. A reference nobody but its ` +
        "author can falsify is a claim that something exists rather than a record that it does\n"
    );
}
