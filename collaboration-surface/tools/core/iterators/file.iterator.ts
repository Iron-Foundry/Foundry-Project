import { readdirSync, statSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { join, relative, sep } from "node:path";

export interface WalkOptions {
    readonly root: string;
    readonly ignored: readonly string[];
    readonly extensions: readonly string[];
    readonly excluded?: readonly string[];
}

function endsWithAny(name: string, suffixes: readonly string[]): boolean {
    for (const suffix of suffixes) {
        if (name.length > suffix.length && name.endsWith(suffix)) return true;
    }
    return false;
}

function hasExtension(name: string, extensions: readonly string[]): boolean {
    if (extensions.length === 0) return true;
    for (const ext of extensions) {
        if (name.length <= ext.length) continue;
        let ok = true;
        const offset = name.length - ext.length;
        for (let i = 0; i < ext.length; i += 1) {
            if (name[offset + i] !== ext[i]) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}

export function walk(options: WalkOptions): string[] {
    const found: string[] = [];
    const stack: string[] = [options.root];

    while (stack.length > 0) {
        const dir = stack.pop();
        if (dir === undefined) break;

        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (options.ignored.includes(entry)) continue;
            const full = join(dir, entry);

            let info;
            try {
                info = statSync(full);
            } catch {
                continue;
            }

            if (info.isDirectory()) {
                stack.push(full);
                continue;
            }
            if (!info.isFile()) continue;
            if (options.excluded !== undefined && endsWithAny(entry, options.excluded)) continue;
            if (hasExtension(entry, options.extensions)) found.push(full);
        }
    }

    found.sort();
    return found;
}

export function readSource(path: string): string {
    return readSurface(path, "utf8");
}

export function forwardSlashed(text: string): string {
    let out = "";
    for (let i = 0; i < text.length; i += 1) out += text[i] === "\\" ? "/" : text[i];
    return out;
}

export function toPosix(root: string, path: string): string {
    const rel = relative(root, path);
    return sep === "/" ? rel : forwardSlashed(rel);
}
