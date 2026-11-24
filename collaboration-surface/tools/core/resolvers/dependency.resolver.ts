import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { basename, resolve } from "node:path";

import { slotText } from "../../../config/surface.config.ts";
import {
    BIN_FIELD,
    DEPENDENCY_FIELDS,
    INSTALL_ROOT,
    REACH_EXTENSIONS,
    SCRIPTS_FIELD,
    SPECIFIER_SEPARATOR,
    TYPE_PACKAGE_PREFIX,
} from "../constants/dependency.constants.ts";
import { NODE_MODULES } from "../constants/path.constants.ts";
import { walk } from "../iterators/file.iterator.ts";
import { stringLiterals } from "../predicates/literal.predicate.ts";
import { hasPrefix, splitWords } from "../predicates/text.predicate.ts";

export interface DependencyReach {
    readonly declared: readonly string[];
    readonly reached: readonly string[];
    readonly unreached: readonly string[];
    readonly undetermined: readonly string[];
    readonly corpus: readonly string[];
}

function record(value: unknown): Record<string, unknown> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function parse(path: string): Record<string, unknown> | null {
    try {
        return record(JSON.parse(readSurface(path, "utf8")));
    } catch {
        return null;
    }
}

export function declaredDependencies(manifest: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const field of DEPENDENCY_FIELDS) {
        const held = record(manifest[field]);
        if (held === null) continue;
        for (const name of Object.keys(held)) out.push(name);
    }
    return out;
}

function invocableNames(packageDir: string, name: string): string[] | null {
    const installed = parse(resolve(packageDir, INSTALL_ROOT, ...name.split(SPECIFIER_SEPARATOR), "package.json"));
    if (installed === null) return null;

    const bin = installed[BIN_FIELD];
    if (typeof bin === "string") return [basename(bin), name];

    const map = record(bin);
    if (map === null) return [name];
    return [...Object.keys(map), name];
}

function scriptTokens(manifest: Record<string, unknown>): string[] {
    const scripts = record(manifest[SCRIPTS_FIELD]);
    if (scripts === null) return [];

    const out: string[] = [];
    for (const command of Object.values(scripts)) {
        if (typeof command !== "string") continue;
        for (const token of splitWords(command)) out.push(token);
    }
    return out;
}

function corpusLiterals(
    packageDir: string,
    manifestPath: string,
): { literals: Set<string>; tokens: Set<string>; corpus: string[] } {
    const literals = new Set<string>();
    const tokens = new Set<string>();
    const corpus: string[] = [];
    const skip = [NODE_MODULES, ".git", slotText("surface", "generated")];

    for (const file of walk({ root: packageDir, ignored: skip, extensions: REACH_EXTENSIONS })) {
        if (file === manifestPath) continue;
        corpus.push(file);
        for (const literal of stringLiterals(readSurface(file, "utf8"))) {
            literals.add(literal.value);
            for (const word of splitWords(literal.value)) tokens.add(word);
        }
    }

    return { literals, tokens, corpus };
}

function reachedBySpecifier(literals: ReadonlySet<string>, name: string): boolean {
    if (literals.has(name)) return true;
    const scoped = name + SPECIFIER_SEPARATOR;
    for (const literal of literals) {
        if (hasPrefix(literal, scoped)) return true;
    }
    return false;
}

function reachedAsTypePackage(literals: ReadonlySet<string>, name: string): boolean {
    if (!hasPrefix(name, TYPE_PACKAGE_PREFIX)) return false;
    return literals.has(name.slice(TYPE_PACKAGE_PREFIX.length));
}

export function dependencyReach(packageDir: string, manifestPath: string): DependencyReach {
    const manifest = parse(manifestPath);
    if (manifest === null) {
        return { declared: [], reached: [], unreached: [], undetermined: [], corpus: [] };
    }

    const declared = declaredDependencies(manifest);
    const { literals, tokens, corpus } = corpusLiterals(packageDir, manifestPath);
    for (const token of scriptTokens(manifest)) tokens.add(token);

    const reached: string[] = [];
    const unreached: string[] = [];
    const undetermined: string[] = [];

    for (const name of declared) {
        if (reachedBySpecifier(literals, name) || reachedAsTypePackage(literals, name) || tokens.has(name)) {
            reached.push(name);
            continue;
        }

        const invocable = invocableNames(packageDir, name);
        if (invocable === null) {
            undetermined.push(name);
            continue;
        }

        let found = false;
        for (const invocation of invocable) {
            if (!tokens.has(invocation)) continue;
            found = true;
            break;
        }

        if (found) reached.push(name);
        else unreached.push(name);
    }

    return { declared, reached, unreached, undetermined, corpus };
}

export function installRootPresent(packageDir: string): boolean {
    return existsSync(resolve(packageDir, INSTALL_ROOT));
}
