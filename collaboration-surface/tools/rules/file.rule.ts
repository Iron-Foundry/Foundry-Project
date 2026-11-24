import { surfacePrefix } from "../../config/surface.config.ts";
import { AUTHORED_ROOTS } from "../core/constants/path.constants.ts";
import { underRoots } from "../core/filters/scope.filter.ts";
import { OPEN_ATTEMPTS, TRANSIENT_OPEN_CODES } from "../core/guards/surface.guard.ts";
import { endOfQuoted } from "../core/predicates/comment.predicate.ts";
import { RAW_READ_CALLS, SURFACE_READ_CALLS } from "../core/readers/surface.reader.ts";
import { RAW_WRITE_CALLS, SURFACE_WRITE_CALLS } from "../core/writers/surface.writer.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

interface CallFamily {
    readonly kind: "rawWrite" | "rawRead";
    readonly raw: readonly string[];
    readonly primitives: readonly string[];
    readonly failure: string;
}

const FAMILIES: readonly CallFamily[] = [
    {
        kind: "rawWrite",
        raw: RAW_WRITE_CALLS,
        primitives: SURFACE_WRITE_CALLS,
        failure: "an item post lands nowhere and a waiter release leaves a slot held until it expires",
    },
    {
        kind: "rawRead",
        raw: RAW_READ_CALLS,
        primitives: SURFACE_READ_CALLS,
        failure: "a wait, a drain or a check that needed the content aborts on a file another process holds for a moment",
    },
];

const RAW_CALLS: readonly string[] = FAMILIES.flatMap((family) => family.raw);

const PRIMITIVE_CALLS: readonly string[] = FAMILIES.flatMap((family) => family.primitives);

const SOURCE_EXTENSION = ".ts";

const SUBSTRATE_ROOT = ((): string => {
    const prefix = surfacePrefix();
    return prefix.length === 0 ? "config/" : `${prefix}/config/`;
})();

const QUOTES: ReadonlySet<string> = new Set(['"', "'", "`"]);

function decide(family: CallFamily): string {
    return (
        "every file this tree touches sits on a surface the host may hold open from another process — a sync " +
        "client, an indexer, a second seat — and an open refused for that reason fails transiently, before a byte " +
        `moves. A raw call has no tolerance for it, so the failure aborts the operation that needed it: ${family.failure}. ` +
        "The primitive retries exactly that failure, bounded, and rethrows every other one and the last one, so " +
        "routing the call through it changes nothing except that a refused open is attempted again. Replace the raw " +
        "call with the primitive named in the remediation, keeping its arguments, and move the import from the " +
        "platform module to the primitive's module — the import edit is why this reports rather than heals"
    );
}

interface RawCall {
    readonly call: string;
    readonly line: number;
}

function isWordCharacter(character: string): boolean {
    return (
        (character >= "A" && character <= "Z") ||
        (character >= "a" && character <= "z") ||
        (character >= "0" && character <= "9") ||
        character === "_" ||
        character === "$"
    );
}

function endOfLineComment(source: string, from: number): number {
    const end = source.indexOf("\n", from);
    return end === -1 ? source.length : end;
}

function endOfBlockComment(source: string, from: number): number {
    const end = source.indexOf("*/", from + 2);
    return end === -1 ? source.length : end + 2;
}

function callNameAt(source: string, index: number, names: readonly string[]): string | null {
    if (index > 0 && isWordCharacter(source.charAt(index - 1))) return null;

    for (const name of names) {
        if (source.slice(index, index + name.length) !== name) continue;

        let cursor = index + name.length;
        if (isWordCharacter(source.charAt(cursor))) continue;
        while (source.charAt(cursor) === " ") cursor += 1;
        if (source.charAt(cursor) === "(") return name;
    }

    return null;
}

export function rawCalls(source: string, names: readonly string[]): RawCall[] {
    const out: RawCall[] = [];
    let line = 1;

    for (let cursor = 0; cursor < source.length; cursor += 1) {
        const character = source.charAt(cursor);

        if (character === "\n") {
            line += 1;
            continue;
        }

        const skipTo = QUOTES.has(character)
            ? endOfQuoted(source, cursor + 1, character)
            : source.startsWith("//", cursor)
              ? endOfLineComment(source, cursor)
              : source.startsWith("/*", cursor)
                ? endOfBlockComment(source, cursor)
                : -1;

        if (skipTo !== -1) {
            for (let inner = cursor; inner < skipTo; inner += 1) {
                if (source.charAt(inner) === "\n") line += 1;
            }
            cursor = skipTo - 1;
            continue;
        }

        const call = callNameAt(source, cursor, names);
        if (call === null) continue;

        out.push({ call, line });
        cursor += call.length - 1;
    }

    return out;
}

function declaresPrimitive(source: string): boolean {
    return PRIMITIVE_CALLS.some((name) => source.includes(`export function ${name}(`));
}

function familyOf(call: string): CallFamily | undefined {
    return FAMILIES.find((family) => family.raw.includes(call));
}

function finding(path: string, found: RawCall): Finding | null {
    const family = familyOf(found.call);
    if (family === undefined) return null;

    const primitive = family.primitives[family.raw.indexOf(found.call)] ?? null;

    return {
        rule: `file/${family.kind}`,
        path,
        line: found.line,
        locus: found.call,
        stack: [
            { check: "call", resolved: found.call },
            { check: "primitive", resolved: primitive ?? "none" },
        ],
        actual: `${found.call} called directly, so a transiently refused open aborts the operation`,
        expected: `${primitive ?? "the primitive"} with the same arguments`,
        remediation: {
            action: "rename",
            from: found.call,
            to: primitive,
            target: path,
            deterministic: false,
            decide: decide(family),
        },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "structure",
    jurisdiction: "all",
    invariant:
        "every file read and write in the tool source passes through its primitive, which attempts a transiently refused open again before it gives up",
    extensions: [SOURCE_EXTENSION],
    kinds: ["rawWrite", "rawRead"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const authored = underRoots(context.paths, AUTHORED_ROOTS).filter((path) => path.endsWith(SOURCE_EXTENSION));
        const scoped = authored.filter((path) => !path.startsWith(SUBSTRATE_ROOT));
        const owners: string[] = [];

        for (const path of scoped) {
            const source = context.read(path);

            if (declaresPrimitive(source)) {
                owners.push(path);
                continue;
            }

            for (const found of rawCalls(source, RAW_CALLS)) {
                const made = finding(path, found);
                if (made !== null) findings.push(made);
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                reached: scoped,
                skippedAsSubstrate: authored.filter((path) => path.startsWith(SUBSTRATE_ROOT)),
                primitiveOwners: owners,
                families: FAMILIES.map((family) => ({
                    kind: family.kind,
                    raw: family.raw,
                    primitives: family.primitives,
                })),
                transientOpenCodes: [...TRANSIENT_OPEN_CODES],
                attempts: OPEN_ATTEMPTS,
                substrateBound:
                    "the parameter surface is the substrate every tool module imports and it imports nothing in the " +
                    "tree, so it cannot reach a primitive that lives in the tool source without ceasing to be a " +
                    "substrate. Its reads are therefore outside this population BY CONSTRUCTION and are listed above " +
                    "rather than dropped, so a raw read there stays visible to a reader and uncounted by this check",
                scanBound:
                    "a call is matched by its NAME in call position outside string literals and comments, so a call " +
                    "reached through an alias, a destructured rename or a namespace member is outside this check, and " +
                    "a call inside a template literal's interpolation is skipped with the literal. The owner of a " +
                    "primitive is recognised by DECLARING it, which is the one file allowed to call the raw form",
            },
        };
    },
};
