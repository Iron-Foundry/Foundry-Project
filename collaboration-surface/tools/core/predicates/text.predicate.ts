export function contains(haystack: string, needle: string): boolean {
    if (needle.length === 0) return true;
    if (needle.length > haystack.length) return false;
    const last = haystack.length - needle.length;
    for (let i = 0; i <= last; i += 1) {
        let k = 0;
        while (k < needle.length && haystack[i + k] === needle[k]) k += 1;
        if (k === needle.length) return true;
    }
    return false;
}

export function splitWords(text: string): string[] {
    const out: string[] = [];
    let current = "";
    let quote = "";

    for (const char of text) {
        if (quote !== "") {
            if (char === quote) quote = "";
            else current += char;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === " " || char === "\t") {
            if (current.length > 0) out.push(current);
            current = "";
            continue;
        }
        current += char;
    }

    if (current.length > 0) out.push(current);
    return out;
}

export function hasPrefix(text: string, prefix: string): boolean {
    if (prefix.length > text.length) return false;
    for (let i = 0; i < prefix.length; i += 1) {
        if (text[i] !== prefix[i]) return false;
    }
    return true;
}
