import { DERIVED_NOUNS } from "../constants/checklist.constants.ts";
import { isDigit } from "../resolvers/checklist.resolver.ts";

export interface CountLiteral {
    readonly line: number;
    readonly numeral: string;
    readonly noun: string;
}

const FENCE = "```";

const SPAN_DELIMITERS = new Set(["`", '"']);

function wordsIn(line: string): string[] {
    const out: string[] = [];
    let current = "";
    let span: string | null = null;

    for (let index = 0; index < line.length; index += 1) {
        const char = line.charAt(index);

        if (span === null && SPAN_DELIMITERS.has(char)) {
            if (current.length > 0) out.push(current);
            current = "";
            span = char;
            continue;
        }

        if (span !== null) {
            if (char === span) span = null;
            continue;
        }

        const joined = char === "." && isDigit(line.charAt(index - 1)) && isDigit(line.charAt(index + 1));
        const wordish =
            joined || isDigit(char) || (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "-";

        if (wordish) {
            current += char;
            continue;
        }

        if (current.length > 0) out.push(current);
        current = "";
    }

    if (current.length > 0) out.push(current);
    return out;
}

function isNumeral(word: string): boolean {
    if (word.length === 0) return false;

    for (let index = 0; index < word.length; index += 1) {
        if (!isDigit(word.charAt(index))) return false;
    }

    return true;
}

function isDerivedNoun(word: string): boolean {
    return DERIVED_NOUNS.includes(word.toLowerCase());
}

export function countLiterals(lines: readonly string[]): CountLiteral[] {
    const out: CountLiteral[] = [];
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        if (line.trimStart().startsWith(FENCE)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;

        const words = wordsIn(line);
        for (let position = 0; position + 1 < words.length; position += 1) {
            const numeral = words[position] ?? "";
            const noun = words[position + 1] ?? "";

            if (!isNumeral(numeral)) continue;
            if (!isDerivedNoun(noun)) continue;

            out.push({ line: index + 1, numeral, noun });
        }
    }

    return out;
}
