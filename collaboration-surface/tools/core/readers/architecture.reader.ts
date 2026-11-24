export interface PrincipleWalk {
    readonly declared: number;
    readonly cited: number;
    readonly uncited: readonly string[];
    readonly danglingCitations: readonly string[];
}

const RECORD_ANCHOR = "### ";

const PREFIX = "ARC-";

function idsIn(source: string, anchored: boolean): string[] {
    const out: string[] = [];

    for (const line of source.split("\n")) {
        const trimmed = anchored ? line.trim() : line;
        let from = 0;

        while (from < trimmed.length) {
            const at = trimmed.indexOf(PREFIX, from);
            if (at === -1) break;
            if (anchored && at !== RECORD_ANCHOR.length) break;
            from = at + PREFIX.length;

            let id = PREFIX;
            let cursor = at + PREFIX.length;
            while (cursor < trimmed.length) {
                const char = trimmed.charAt(cursor);
                if (char < "0" || char > "9") break;
                id += char;
                cursor += 1;
            }

            if (id.length > PREFIX.length) out.push(id);
            if (anchored) break;
        }
    }

    return out;
}

export function walkPrinciples(catalog: string, citing: readonly string[]): PrincipleWalk {
    const declared = new Set(idsIn(catalog, true));
    const cited = new Set<string>();

    for (const source of citing) {
        for (const id of idsIn(source, false)) cited.add(id);
    }

    const uncited = [...declared].filter((id) => !cited.has(id)).sort();
    const dangling = [...cited].filter((id) => !declared.has(id)).sort();

    return { declared: declared.size, cited: declared.size - uncited.length, uncited, danglingCitations: dangling };
}
