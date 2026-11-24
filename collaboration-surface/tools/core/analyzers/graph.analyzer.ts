import { dirname, resolve } from "node:path";

export function cyclesIn(edges: ReadonlyMap<string, ReadonlySet<string>>): string[][] {
    const out: string[][] = [];
    const reported = new Set<string>();

    const walk = (node: string, trail: readonly string[]): void => {
        const at = trail.indexOf(node);
        if (at !== -1) {
            const cycle = trail.slice(at);
            const marker = [...cycle].sort().join(">");
            if (!reported.has(marker)) {
                reported.add(marker);
                out.push([...cycle]);
            }
            return;
        }
        if (trail.length > edges.size) return;

        for (const next of edges.get(node) ?? []) walk(next, [...trail, node]);
    };

    for (const node of edges.keys()) walk(node, []);
    return out;
}

export function localImports(path: string, source: string, known: ReadonlySet<string>): string[] {
    const out = new Set<string>();
    const directory = dirname(path);

    let inside = false;

    for (const line of source.split("\n")) {
        if (line.trim().startsWith("import ")) inside = true;
        if (!inside) continue;

        const from = line.indexOf('from "');
        if (from === -1) continue;
        inside = false;

        const start = from + 6;
        const end = line.indexOf('"', start);
        if (end === -1) continue;

        const specifier = line.slice(start, end);
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;

        const resolved = resolve(directory, specifier);
        let posix = "";
        for (let i = 0; i < resolved.length; i += 1) {
            const char = resolved[i] ?? "";
            posix += char === "\\" ? "/" : char;
        }

        for (const candidate of known) {
            if (posix.endsWith(candidate)) out.add(candidate);
        }
    }

    return [...out];
}

export function moduleSource(path: string, read: (path: string) => string, known: ReadonlySet<string>): string {
    const source = read(path);
    let combined = source;

    for (const imported of localImports(path, withoutTypeImports(source), known)) {
        try {
            combined += `\n${read(imported)}`;
        } catch {
            continue;
        }
    }

    return combined;
}

function withoutTypeImports(source: string): string {
    const out: string[] = [];
    let skipping = false;

    for (const line of source.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("import type ")) skipping = true;

        if (skipping) {
            if (trimmed.includes('from "')) skipping = false;
            continue;
        }

        out.push(line);
    }

    return out.join("\n");
}
