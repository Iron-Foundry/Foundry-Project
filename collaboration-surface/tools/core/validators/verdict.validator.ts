import { localImports } from "../analyzers/graph.analyzer.ts";
import { RULE_ROOT } from "../constants/layer.constants.ts";
import { MIDDLE_TIERS } from "../constants/verdict.constants.ts";
import { stringLiterals } from "../predicates/literal.predicate.ts";

export interface Tier {
    readonly tier: string;
    readonly line: number;
}

function isUpper(char: string): boolean {
    return char >= "A" && char <= "Z";
}

function isWordChar(char: string): boolean {
    if (isUpper(char)) return true;
    if (char >= "a" && char <= "z") return true;
    if (char >= "0" && char <= "9") return true;
    return char === "_";
}

export function escapedVocabulary(
    paths: readonly string[],
    read: (path: string) => string,
    exemption: readonly string[],
): string[] {
    const known = new Set(paths);
    const out: string[] = [];

    for (const path of paths) {
        let underExemption = false;
        for (const root of exemption) {
            if (path.startsWith(root)) underExemption = true;
        }
        if (!underExemption) continue;

        const source = read(path);
        let declares = false;
        for (const literal of stringLiterals(source)) {
            if (MIDDLE_TIERS.includes(literal.value.toLowerCase())) declares = true;
        }
        if (!declares) continue;

        let claimed = false;
        for (const consumer of paths) {
            if (!consumer.startsWith(RULE_ROOT)) continue;
            if (localImports(consumer, read(consumer), known).includes(path)) claimed = true;
        }
        if (claimed) continue;

        out.push(path);
    }

    return out;
}

export function declaredTiers(source: string): Tier[] {
    const out: Tier[] = [];
    let line = 1;
    let index = 0;

    while (index < source.length) {
        const char = source.charAt(index);

        if (char === "\n") {
            line += 1;
            index += 1;
            continue;
        }

        if (!isWordChar(char)) {
            index += 1;
            continue;
        }

        let end = index;
        let allUpper = true;
        while (end < source.length && isWordChar(source.charAt(end))) {
            if (!isUpper(source.charAt(end))) allUpper = false;
            end += 1;
        }

        const word = source.slice(index, end);
        if (allUpper && MIDDLE_TIERS.includes(word.toLowerCase())) {
            out.push({ tier: word.toLowerCase(), line });
        }

        index = end;
    }

    return out;
}
