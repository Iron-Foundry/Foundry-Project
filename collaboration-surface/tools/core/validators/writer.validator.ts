import { localImports } from "../analyzers/graph.analyzer.ts";
import { SURFACE_WRITE_CALLS } from "../writers/surface.writer.ts";

const FILESYSTEM_MODULE = `"node:${"fs"}"`;

const WRITE_MEMBERS = [`write${"FileSync"}`, `rm${"Sync"}`, `mk${"dirSync"}`];

const PRIMITIVE_MEMBERS: readonly string[] = SURFACE_WRITE_CALLS;

export interface WriteBreach {
    readonly path: string;
    readonly member: string;
}

function isNameCharacter(character: string): boolean {
    return (
        (character >= "A" && character <= "Z") ||
        (character >= "a" && character <= "z") ||
        (character >= "0" && character <= "9") ||
        character === "_" ||
        character === "$"
    );
}

export function importedNames(line: string): string[] {
    const out: string[] = [];
    let held = "";

    for (const character of `${line} `) {
        if (isNameCharacter(character)) {
            held += character;
            continue;
        }
        if (held.length > 0) out.push(held);
        held = "";
    }

    return out;
}

export function importsWriter(source: string): string | null {
    for (const raw of source.split("\n")) {
        const line = raw.trim();
        if (!line.startsWith("import ")) continue;

        if (line.endsWith(`${FILESYSTEM_MODULE};`)) {
            for (const member of WRITE_MEMBERS) {
                if (line.includes(member)) return member;
            }
            continue;
        }

        const names = importedNames(line);
        for (const member of PRIMITIVE_MEMBERS) {
            if (names.includes(member)) return member;
        }
    }

    return null;
}

export function reachableFrom(
    entries: readonly string[],
    known: ReadonlySet<string>,
    read: (path: string) => string,
): string[] {
    const seen = new Set<string>();
    const queue = [...entries];

    while (queue.length > 0) {
        const path = queue.shift() ?? "";
        if (path.length === 0 || seen.has(path)) continue;
        seen.add(path);

        for (const next of localImports(path, read(path), known)) queue.push(next);
    }

    return [...seen].sort();
}

export function unsanctionedWriters(
    entries: readonly string[],
    known: ReadonlySet<string>,
    read: (path: string) => string,
    sanctioned: readonly string[],
): WriteBreach[] {
    const out: WriteBreach[] = [];

    for (const path of reachableFrom(entries, known, read)) {
        if (sanctioned.includes(path)) continue;

        const member = importsWriter(read(path));
        if (member === null) continue;

        out.push({ path, member });
    }

    return out;
}
