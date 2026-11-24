const QUOTES = ['"', "'", "`"];

function scanCode(source: string, at: (index: number, char: string) => boolean): boolean {
    let quote: string | null = null;
    let escaped = false;
    let comment: "line" | "block" | null = null;

    for (let i = 0; i < source.length; i += 1) {
        const char = source[i] ?? "";

        if (comment === "line") {
            if (char === "\n") comment = null;
            continue;
        }
        if (comment === "block") {
            if (char === "*" && source[i + 1] === "/") {
                comment = null;
                i += 1;
            }
            continue;
        }
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (quote !== null) {
            if (char === quote) quote = null;
            continue;
        }
        if (char === "/" && source[i + 1] === "/") {
            comment = "line";
            i += 1;
            continue;
        }
        if (char === "/" && source[i + 1] === "*") {
            comment = "block";
            i += 1;
            continue;
        }
        if (QUOTES.includes(char)) {
            quote = char;
            continue;
        }

        if (at(i, char)) return true;
    }

    return false;
}

function isIdentifierChar(char: string): boolean {
    return (
        (char >= "a" && char <= "z") ||
        (char >= "A" && char <= "Z") ||
        (char >= "0" && char <= "9") ||
        char === "_" ||
        char === "$"
    );
}

function memberCallOpensHere(source: string, index: number): boolean {
    let cursor = index - 1;
    while (cursor >= 0 && isIdentifierChar(source[cursor] ?? "")) cursor -= 1;
    if (cursor === index - 1) return false;
    return (source[cursor] ?? "") === ".";
}

function memberCallFollows(source: string, index: number): boolean {
    let cursor = index + 1;
    while (cursor < source.length && isIdentifierChar(source[cursor] ?? "")) cursor += 1;
    if (cursor === index + 1) return false;
    return (source[cursor] ?? "") === "(";
}

export function containsInCode(source: string, needle: string): boolean {
    return scanCode(source, (index) => {
        let k = 0;
        while (k < needle.length && source[index + k] === needle[k]) k += 1;
        return k === needle.length;
    });
}

export function reachesRegexLiteral(source: string): boolean {
    return scanCode(source, (index, char) => {
        const next = source[index + 1] ?? "";

        if (char === "(" && next === "/" && (source[index + 2] ?? "") !== "/") {
            return memberCallOpensHere(source, index);
        }

        if (char === "/" && next === ".") return memberCallFollows(source, index + 1);

        return false;
    });
}

export function declaresProperty(source: string, name: string): boolean {
    return (
        containsInCode(source, `${name}:`) ||
        containsInCode(source, `${name}(`) ||
        containsInCode(source, `${name},`) ||
        containsInCode(source, `${name} }`) ||
        containsInCode(source, `${name}\n`)
    );
}
