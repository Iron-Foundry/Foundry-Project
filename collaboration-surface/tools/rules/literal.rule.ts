import { AUTHORED_ROOTS } from "../core/constants/path.constants.ts";
import { endOfQuoted } from "../core/predicates/comment.predicate.ts";
import { underRoots } from "../core/filters/scope.filter.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const COMPOSERS: ReadonlySet<string> = new Set(["within", "withinSurface", "surfacePath", "slotText", "inSurface"]);

const FILESYSTEM_CALLS: ReadonlySet<string> = new Set([
    "join",
    "resolve",
    "existsSync",
    "readFileSync",
    "readSurface",
    "readdirSync",
    "writeFileSync",
    "writeSurface",
    "appendSurface",
    "statSync",
    "mkdirSync",
    "rmdirSync",
    "renameSync",
    "walk",
    "readSource",
]);

const MODULE_SUFFIX = ".ts";

const ENCODINGS: ReadonlySet<string> = new Set(["utf8", "utf-8", "ascii", "base64", "binary", "hex", "latin1"]);

const DECIDE =
    "a path spelled in source is a claim about a tree this package does not own — it resolves onto the " +
    "consuming project or onto nothing, differently in every consumer, and the failure surfaces as a check " +
    "that silently governs the wrong files or refuses citations that are true. Every root resolves through " +
    "the parameter surface, which computes its prefix from its own file location, so the literal becomes an " +
    "argument to a composer or a declared slot rather than a value a reader trusts";

const ENUMERATORS: ReadonlySet<string> = new Set(["readdirSync", "readdir", "walk"]);

const RECURSIVE_FLAG = "recursive";

const ESCAPING_ROOTS: ReadonlySet<string> = new Set(["repoRoot", "REPO_ROOT", "projectRoot"]);

const NARROWERS: ReadonlySet<string> = new Set(["surfacePrefix", "surfacePath", "surfaceRoot"]);

const ENUMERATION_DECIDE =
    "a RECURSIVE enumeration rooted at a path that resolves outside the declared surface prefix lists a tree " +
    "this package does not own — in a consumer that tree is the whole host repository, including everything " +
    "its dependencies install, so the call reads correct and costs minutes rather than milliseconds and the " +
    "failure presents as a run that hangs rather than as anything a verdict reports. The discriminator is " +
    "ENUMERATION rather than the root: resolving a NAMED path through the same root walks nothing and is the " +
    "correct form, which is why the safe uses far outnumber the hazardous one and a scan for the root alone " +
    "reports mostly noise. Narrow the enumeration to the surface's own prefix and prepend it to each entry, so " +
    "the listing covers exactly what this package declares";

function tokensOf(text: string): string[] {
    const out: string[] = [];
    let held = "";

    for (const character of `${text} `) {
        const word =
            (character >= "A" && character <= "Z") ||
            (character >= "a" && character <= "z") ||
            (character >= "0" && character <= "9") ||
            character === "_";

        if (word) {
            held += character;
            continue;
        }

        if (held.length > 0) out.push(held);
        held = "";
    }

    return out;
}

function argumentsOf(source: string, openAt: number): string {
    let depth = 0;

    for (let cursor = openAt; cursor < source.length; cursor += 1) {
        const character = source.charAt(cursor);
        if (character === "(") depth += 1;
        else if (character === ")") {
            depth -= 1;
            if (depth === 0) return source.slice(openAt + 1, cursor);
        }
    }

    return "";
}

function nameEndingAt(source: string, openAt: number): string {
    let cursor = openAt - 1;
    let name = "";

    while (cursor >= 0) {
        const character = source.charAt(cursor);
        const word =
            (character >= "A" && character <= "Z") ||
            (character >= "a" && character <= "z") ||
            (character >= "0" && character <= "9") ||
            character === "_";
        if (!word) break;
        name = character + name;
        cursor -= 1;
    }

    return name;
}

interface Enumeration {
    readonly line: number;
    readonly root: string;
}

const QUOTES: ReadonlySet<string> = new Set(['"', "'", "`"]);

export function unboundedEnumerations(source: string): Enumeration[] {
    const out: Enumeration[] = [];

    for (let cursor = 0; cursor < source.length; cursor += 1) {
        const character = source.charAt(cursor);

        if (QUOTES.has(character)) {
            cursor = endOfQuoted(source, cursor + 1, character) - 1;
            continue;
        }

        if (character !== "(") continue;

        const name = nameEndingAt(source, cursor);
        if (!ENUMERATORS.has(name)) continue;

        const args = argumentsOf(source, cursor);
        const tokens = tokensOf(args);
        if (!tokens.includes(RECURSIVE_FLAG)) continue;

        const escaping = tokens.find((token) => ESCAPING_ROOTS.has(token));
        if (escaping === undefined) continue;
        if (tokens.some((token) => NARROWERS.has(token))) continue;

        out.push({ line: lineOf(source, cursor), root: escaping });
    }

    return out;
}

function isPathShaped(value: string): boolean {
    if (value.length === 0) return false;
    if (value.endsWith(MODULE_SUFFIX)) return false;
    if (ENCODINGS.has(value)) return false;

    return !value.includes(" ");
}

function closingQuote(source: string, start: number, quote: string): number {
    let cursor = start;

    while (cursor < source.length) {
        const char = source.charAt(cursor);
        if (char === "\\") {
            cursor += 2;
            continue;
        }
        if (char === quote) return cursor;
        if (char === "\n" && quote !== "`") return -1;
        cursor += 1;
    }

    return -1;
}

function callBefore(source: string, quoteAt: number): string {
    let cursor = quoteAt - 1;
    while (cursor >= 0 && (source.charAt(cursor) === " " || source.charAt(cursor) === "\n")) cursor -= 1;
    if (source.charAt(cursor) !== "(") return "";

    cursor -= 1;
    let name = "";
    while (cursor >= 0) {
        const char = source.charAt(cursor);
        const word =
            (char >= "A" && char <= "Z") ||
            (char >= "a" && char <= "z") ||
            (char >= "0" && char <= "9") ||
            char === "_";
        if (!word) break;
        name = char + name;
        cursor -= 1;
    }

    return source.charAt(cursor) === "." ? "" : name;
}

function lineOf(source: string, index: number): number {
    let line = 1;
    for (let cursor = 0; cursor < index; cursor += 1) {
        if (source.charAt(cursor) === "\n") line += 1;
    }
    return line;
}

const BINDING_LEAD = "const ";

const BINDING_ASSIGN = "=";

const BINDING_END = ";";

function isWordCharacter(character: string): boolean {
    return (
        (character >= "A" && character <= "Z") ||
        (character >= "a" && character <= "z") ||
        (character >= "0" && character <= "9") ||
        character === "_"
    );
}

function skipSpaces(source: string, from: number): number {
    let cursor = from;
    while (source.charAt(cursor) === " ") cursor += 1;
    return cursor;
}

export function pathBindings(source: string): Map<string, string> {
    const out = new Map<string, string>();
    let from = 0;

    for (;;) {
        const at = source.indexOf(BINDING_LEAD, from);
        if (at === -1) return out;
        from = at + BINDING_LEAD.length;
        if (at > 0 && isWordCharacter(source.charAt(at - 1))) continue;

        let cursor = from;
        let name = "";
        while (cursor < source.length && isWordCharacter(source.charAt(cursor))) {
            name += source.charAt(cursor);
            cursor += 1;
        }
        if (name.length === 0) continue;

        cursor = skipSpaces(source, cursor);
        if (source.charAt(cursor) !== BINDING_ASSIGN) continue;
        cursor = skipSpaces(source, cursor + 1);

        const quote = source.charAt(cursor);
        if (quote !== '"' && quote !== "'") continue;

        const close = closingQuote(source, cursor + 1, quote);
        if (close === -1) continue;
        if (source.charAt(skipSpaces(source, close + 1)) !== BINDING_END) continue;

        const value = source.slice(cursor + 1, close);
        if (isPathShaped(value)) out.set(name, value);
    }
}

interface BoundLiteral {
    readonly line: number;
    readonly call: string;
    readonly binding: string;
    readonly value: string;
}

function topLevelArguments(text: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let held = "";

    for (let cursor = 0; cursor < text.length; cursor += 1) {
        const character = text.charAt(cursor);

        if (QUOTES.has(character)) {
            const end = endOfQuoted(text, cursor + 1, character);
            held += text.slice(cursor, end);
            cursor = end - 1;
            continue;
        }

        if (character === "(" || character === "[" || character === "{") depth += 1;
        if (character === ")" || character === "]" || character === "}") depth -= 1;

        if (character === "," && depth === 0) {
            out.push(held.trim());
            held = "";
            continue;
        }

        held += character;
    }

    if (held.trim().length > 0) out.push(held.trim());
    return out;
}

export function boundLiterals(source: string): BoundLiteral[] {
    const bindings = pathBindings(source);
    const out: BoundLiteral[] = [];
    if (bindings.size === 0) return out;

    for (let cursor = 0; cursor < source.length; cursor += 1) {
        const character = source.charAt(cursor);

        if (QUOTES.has(character)) {
            cursor = endOfQuoted(source, cursor + 1, character) - 1;
            continue;
        }

        if (character !== "(") continue;

        const call = nameEndingAt(source, cursor);
        if (!FILESYSTEM_CALLS.has(call)) continue;

        const parts = topLevelArguments(argumentsOf(source, cursor));
        for (let index = 1; index < parts.length; index += 1) {
            const value = bindings.get(parts[index] ?? "");
            if (value === undefined) continue;

            const under = tokensOf(parts[index - 1] ?? "");
            if (!under.some((token) => ESCAPING_ROOTS.has(token))) continue;
            if (under.some((token) => NARROWERS.has(token))) continue;

            out.push({ line: lineOf(source, cursor), call, binding: parts[index] ?? "", value });
        }
    }

    return out;
}

export const rule: RuleDeclaration = {
    stage: "structure",
    jurisdiction: "all",
    invariant: "a path-shaped string literal in authored source is composed through the parameter surface",
    extensions: [".ts"],
    kinds: ["rawPath", "unboundedEnumeration"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const scoped = underRoots(context.paths, AUTHORED_ROOTS);
        let literals = 0;

        for (const path of scoped) {
            const source = context.read(path);

            for (const found of unboundedEnumerations(source)) {
                findings.push({
                    rule: "literal/unboundedEnumeration",
                    path,
                    line: found.line,
                    locus: found.root,
                    stack: [
                        { check: "call", resolved: "recursive enumeration" },
                        { check: "root", resolved: found.root },
                        { check: "narrowed", resolved: "no" },
                    ],
                    actual: `a recursive enumeration rooted at ${found.root}, which resolves outside the declared surface prefix`,
                    expected: "an enumeration narrowed to the surface's own prefix",
                    remediation: {
                        action: "declare",
                        from: found.root,
                        to: null,
                        target: path,
                        deterministic: false,
                        decide: ENUMERATION_DECIDE,
                    },
                    healed: false,
                });
            }

            for (const bound of boundLiterals(source)) {
                findings.push({
                    rule: "literal/rawPath",
                    path,
                    line: bound.line,
                    locus: bound.value,
                    stack: [
                        { check: "shape", resolved: "path" },
                        { check: "binding", resolved: bound.binding },
                        { check: "composer", resolved: bound.call },
                    ],
                    actual: bound.value,
                    expected: null,
                    remediation: {
                        action: "declare",
                        from: bound.value,
                        to: null,
                        target: path,
                        deterministic: false,
                        decide:
                            `${DECIDE}. BINDING THE LITERAL TO A NAME FIRST DOES NOT MOVE IT THROUGH THE SURFACE: the name ` +
                            "reaches the filesystem call carrying the same claim about a tree, and a check reading only " +
                            "the call's own quoted arguments passes it — so a root that names a location this package " +
                            "has since left scans an empty set and every consumer of it reports green",
                    },
                    healed: false,
                });
            }

            for (let cursor = 0; cursor < source.length; cursor += 1) {
                const char = source.charAt(cursor);
                if (char !== '"' && char !== "'") continue;

                const close = closingQuote(source, cursor + 1, char);
                if (close === -1) break;

                const value = source.slice(cursor + 1, close);
                cursor = close;

                if (!isPathShaped(value)) continue;
                literals += 1;

                const composer = callBefore(source, cursor - value.length - 1);
                if (!FILESYSTEM_CALLS.has(composer)) continue;
                if (COMPOSERS.has(composer)) continue;

                findings.push({
                    rule: "literal/rawPath",
                    path,
                    line: lineOf(source, close),
                    locus: value,
                    stack: [
                        { check: "shape", resolved: "path" },
                        { check: "composer", resolved: composer.length === 0 ? "none" : composer },
                    ],
                    actual: value,
                    expected: null,
                    remediation: {
                        action: "declare",
                        from: value,
                        to: null,
                        target: path,
                        deterministic: false,
                        decide: DECIDE,
                    },
                    healed: false,
                });
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                reached: scoped,
                skippedAsOutsideAuthoredRoots: context.paths.filter((path) => !scoped.includes(path)),
                literals,
            },
        };
    },
};
