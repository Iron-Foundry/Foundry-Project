import type { CorpusRootData } from "../types/taxonomy.types.ts";
import type { Document } from "../types/segment.types.ts";

const SEPARATOR = ".";

export function nameParts(name: string): string[] {
    const parts: string[] = [];
    let held = "";

    for (let index = 0; index < name.length; index += 1) {
        const character = name.charAt(index);
        if (character === SEPARATOR) {
            parts.push(held);
            held = "";
            continue;
        }
        held += character;
    }
    parts.push(held);

    return parts;
}

export function rawFacetOf(document: Document, config: CorpusRootData): string | null {
    for (const field of config.facetFields) {
        for (const segment of document.segments) {
            if (segment.kind !== "frontmatter-field") continue;
            if (segment.key !== field) continue;

            const value = segment.value ?? "";
            if (value.length > 0) return value;
        }
    }

    return null;
}

export function symbolOf(document: Document): string | null {
    for (const segment of document.segments) {
        if (segment.kind !== "heading") continue;

        const value = (segment.key ?? segment.value ?? "").trim();
        if (value.length > 0) return value;
    }

    return null;
}

export function keyFromSymbol(symbol: string): string {
    let key = "";

    for (let index = 0; index < symbol.length; index += 1) {
        const character = symbol.charAt(index);
        if (character === "_") {
            key += "-";
            continue;
        }
        key += character.toLowerCase();
    }

    return key;
}
