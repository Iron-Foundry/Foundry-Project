import type { NamingCode, ParsedName, PlacementCode, Role, TaxonomyData } from "../types/taxonomy.types.ts";

const ACCUMULATOR_PREFIX = "_";

const ENTRY_DOCUMENT = "README.md";

function slot(parts: readonly string[], index: number): string {
    return parts[index] ?? "";
}

export function parseFilename(name: string, data: TaxonomyData): ParsedName | NamingCode {
    const parts: string[] = [];
    let current = "";
    for (let i = 0; i < name.length; i += 1) {
        const char = name[i] ?? "";
        if (char === ".") {
            parts.push(current);
            current = "";
            continue;
        }
        current += char;
    }
    parts.push(current);

    if (parts.length < 3) return "unparsable";

    const ext = slot(parts, parts.length - 1);
    const concern = slot(parts, parts.length - 2);
    const marker = data.compoundMarkers.includes(concern) ? concern : null;

    if (marker !== null) {
        if (parts.length < 4) return "unparsable";
        const realConcern = slot(parts, parts.length - 3);
        const subject = parts.slice(0, parts.length - 3).join(".");
        return { subject, variant: null, concern: realConcern, ext, marker };
    }

    const subject = slot(parts, 0);
    const variant = parts.length >= 4 ? parts.slice(1, parts.length - 2).join(".") : null;

    if (subject === concern) return "subjectEqualsConcern";
    return { subject, variant, concern, ext, marker: null };
}

const isLegalSubject = (word: string, data: TaxonomyData): boolean =>
    data.subjects.includes(word) || data.concernTags.includes(word);

const isLegalVariant = (word: string, data: TaxonomyData): boolean =>
    data.variants.includes(word) || data.subjects.includes(word) || data.agentLetters.includes(word);

export interface NamingVerdict {
    readonly ok: boolean;
    readonly code: NamingCode | null;
    readonly evidence: string;
}

export function checkNaming(name: string, parentFolder: string, data: TaxonomyData): NamingVerdict {
    const parsed = parseFilename(name, data);
    if (typeof parsed === "string") return { ok: false, code: parsed, evidence: name };

    if (!isLegalSubject(parsed.subject, data)) {
        return { ok: false, code: "undeclaredSlot", evidence: `subject "${parsed.subject}"` };
    }
    if (parsed.variant !== null && !isLegalVariant(parsed.variant, data)) {
        return { ok: false, code: "undeclaredSlot", evidence: `variant "${parsed.variant}"` };
    }
    if (!data.concernTags.includes(parsed.concern)) {
        return { ok: false, code: "undeclaredSlot", evidence: `concern "${parsed.concern}"` };
    }

    const expected = data.folderToTag[parentFolder];
    if (expected === undefined) {
        return { ok: false, code: "concernMismatch", evidence: `parent "${parentFolder}" is not a concern folder` };
    }
    if (expected !== parsed.concern) {
        return {
            ok: false,
            code: "concernMismatch",
            evidence: `tag "${parsed.concern}" against folder "${parentFolder}" expecting "${expected}"`,
        };
    }

    return { ok: true, code: null, evidence: "" };
}

const ROLE_ORDER: readonly Role[] = ["container", "subject", "concern"];

export interface PlacementVerdict {
    readonly ok: boolean;
    readonly code: PlacementCode | null;
    readonly evidence: string;
    readonly concernFolder: string | null;
    readonly foreign?: boolean;
}

function isRootSpine(fileName: string): boolean {
    if (fileName.length === 0) return false;
    if (fileName.startsWith(ACCUMULATOR_PREFIX)) return true;
    return fileName === ENTRY_DOCUMENT;
}

export function checkPlacement(
    root: string,
    segments: readonly string[],
    data: TaxonomyData,
    fileName = "",
): PlacementVerdict {
    const declared = data.containers[root] ?? [];
    const buckets = data.specialContainers[root] ?? [];

    if (segments.length === 0) {
        if (isRootSpine(fileName)) return { ok: true, code: null, evidence: root, concernFolder: null, foreign: true };
        return { ok: false, code: "looseFileAtRoot", evidence: root, concernFolder: null };
    }

    const container = slot(segments, 0);
    const isBucket = buckets.includes(container);
    const foreign = data.foreignContainers[root] ?? [];

    if (foreign.includes(container)) {
        return { ok: true, code: null, evidence: container, concernFolder: null, foreign: true };
    }

    if (!isBucket && !declared.includes(container)) {
        return { ok: false, code: "undeclaredContainer", evidence: container, concernFolder: null };
    }

    const rest = segments.slice(1);

    for (const folder of segments) {
        if (folder.includes(".")) {
            return { ok: false, code: "dottedFolder", evidence: folder, concernFolder: null };
        }
    }

    if (isBucket) {
        if (rest.length > 0) {
            return {
                ok: false,
                code: "nestedInSpecial",
                evidence: `${container}/${slot(rest, 0)}`,
                concernFolder: null,
            };
        }
        return { ok: true, code: null, evidence: "", concernFolder: container };
    }

    if (rest.length === 0) {
        return { ok: false, code: "looseFileAtRoot", evidence: container, concernFolder: null };
    }

    if (segments.length > data.maxDepthFromRoot) {
        return { ok: false, code: "tooDeep", evidence: segments.join("/"), concernFolder: null };
    }

    let consumed = 0;
    for (const folder of rest) {
        const isConcern = data.concernFolders.includes(folder);
        const isSubject = data.subjects.includes(folder);

        const role: Role | null = isConcern ? "concern" : isSubject ? "subject" : null;
        if (role === null) {
            return { ok: false, code: "badShape", evidence: folder, concernFolder: null };
        }

        const index = ROLE_ORDER.indexOf(role);
        if (index <= consumed) {
            return { ok: false, code: "roleOutOfOrder", evidence: `${folder} as ${role}`, concernFolder: null };
        }
        consumed = index;
    }

    const parent = slot(rest, rest.length - 1);
    if (!data.concernFolders.includes(parent)) {
        return { ok: false, code: "parentNotConcern", evidence: parent, concernFolder: null };
    }

    return { ok: true, code: null, evidence: "", concernFolder: parent };
}
