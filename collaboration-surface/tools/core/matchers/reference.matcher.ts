import { INLINE_KINDS, type Segment } from "../types/segment.types.ts";

export const REFERENCE_FIELDS = ["see", "source", "intel", "action", "detect", "canon", "digest"] as const;

const REFERENCE_INLINE_KINDS: ReadonlySet<string> = new Set(INLINE_KINDS);

const EXTERNAL_PREFIXES = ["http://", "https://", "mailto:", "#"];

const LOCAL_SCHEME = "local:";

export interface Reference {
    readonly raw: string;
    readonly target: string;
    readonly locus: string;
    readonly line: number;
}

function hasPrefix(text: string, prefix: string): boolean {
    if (prefix.length > text.length) return false;
    for (let i = 0; i < prefix.length; i += 1) {
        if (text[i] !== prefix[i]) return false;
    }
    return true;
}

function stripAnchor(value: string): string {
    const hash = value.indexOf("#");
    return hash === -1 ? value : value.slice(0, hash);
}

function stripLocator(value: string): string {
    const colon = value.lastIndexOf(":");
    if (colon <= 0 || colon === value.length - 1) return value;

    for (let index = colon + 1; index < value.length; index += 1) {
        const char = value.charAt(index);
        const digit = char >= "0" && char <= "9";
        if (!digit && char !== "-") return value;
    }

    return value.slice(0, colon);
}

function unquote(value: string): string {
    let start = 0;
    let end = value.length;
    while (start < end && value[start] === "`") start += 1;
    while (end > start && value[end - 1] === "`") end -= 1;
    return value.slice(start, end);
}

function firstToken(value: string): string {
    const space = value.indexOf(" ");
    return space === -1 ? value : value.slice(0, space);
}

const PLACEHOLDERS = ["<", ">", "*", "?"];

function isPattern(value: string): boolean {
    for (const character of PLACEHOLDERS) {
        if (value.indexOf(character) !== -1) return true;
    }
    return false;
}

function isExternal(value: string): boolean {
    for (const prefix of EXTERNAL_PREFIXES) {
        if (hasPrefix(value, prefix)) return true;
    }

    const colon = value.indexOf(":");
    const slash = value.indexOf("/");
    return colon !== -1 && (slash === -1 || colon < slash);
}

export function referencesIn(segment: Segment): Reference[] {
    const out: Reference[] = [];

    const consider = (raw: string, locus: string): void => {
        let value = unquote(firstToken(raw));
        if (hasPrefix(value, LOCAL_SCHEME)) value = value.slice(LOCAL_SCHEME.length);
        if (value.length === 0 || isExternal(value)) return;
        if (hasPrefix(value, "@")) value = value.slice(1);

        const target = stripLocator(stripAnchor(value));
        if (target.length === 0) return;

        const slash = target.lastIndexOf("/");
        if (slash === -1) return;
        if (target.slice(slash + 1).indexOf(".") === -1) return;
        if (isPattern(target)) return;

        out.push({ raw, target, locus, line: segment.line });
    };

    const isField = segment.kind === "field" || segment.kind === "frontmatter-field";
    if (isField && segment.key !== undefined && segment.value !== undefined) {
        for (const key of REFERENCE_FIELDS) {
            if (segment.key === key) consider(segment.value, `${key}:`);
        }
    }

    for (const inline of segment.inlines) {
        if (REFERENCE_INLINE_KINDS.has(inline.kind)) consider(inline.value, inline.kind);
    }

    return out;
}
