export interface SecretShape {
    readonly prefix: string;
    readonly minimumLength: number;
}

export const SECRET_SHAPES: readonly SecretShape[] = [{ prefix: "cfxk_", minimumLength: 24 }];

function isTokenChar(char: string): boolean {
    return (
        (char >= "a" && char <= "z") ||
        (char >= "A" && char <= "Z") ||
        (char >= "0" && char <= "9") ||
        char === "_" ||
        char === "-"
    );
}

export function tokensOf(source: string): string[] {
    const out: string[] = [];
    let current = "";

    for (let i = 0; i <= source.length; i += 1) {
        const char = i < source.length ? (source[i] ?? "") : " ";
        if (isTokenChar(char)) {
            current += char;
            continue;
        }
        if (current.length > 0) out.push(current);
        current = "";
    }

    return out;
}

export function isPlaceholder(body: string): boolean {
    let first = "";
    for (const char of body) {
        if (char === "_" || char === "-") continue;
        if (first === "") {
            first = char;
            continue;
        }
        if (char !== first) return false;
    }
    return first !== "";
}

export function bearsSecret(source: string): boolean {
    let possible = false;
    for (const shape of SECRET_SHAPES) {
        if (source.includes(shape.prefix)) possible = true;
    }
    if (!possible) return false;

    for (const token of tokensOf(source)) {
        for (const shape of SECRET_SHAPES) {
            if (!token.startsWith(shape.prefix)) continue;
            if (token.length < shape.minimumLength) continue;
            if (isPlaceholder(token.slice(shape.prefix.length))) continue;
            return true;
        }
    }
    return false;
}
