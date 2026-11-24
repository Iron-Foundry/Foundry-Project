import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { basename, dirname, relative, resolve } from "node:path";

import { NODE_MODULES, SURFACE_ROOT } from "../constants/path.constants.ts";
import { toPosix, walk } from "../iterators/file.iterator.ts";
import { isObject } from "../predicates/schema.predicate.ts";
import { splitWords } from "../predicates/text.predicate.ts";
import { readJson } from "../readers/json.reader.ts";
import { dependencyReach } from "../resolvers/dependency.resolver.ts";
import type { Finding } from "../types/segment.types.ts";

export const MANIFEST = "package.json";

const SCRIPT_TARGETS = [".ts", ".js", ".mjs", ".cjs", ".json"];

const MANIFEST_ROOTS = [SURFACE_ROOT];

function endsWithAny(text: string, suffixes: readonly string[]): boolean {
    for (const suffix of suffixes) {
        if (text.length > suffix.length && text.endsWith(suffix)) return true;
    }
    return false;
}

function isRepoRelative(token: string): boolean {
    if (token.length === 0) return false;
    if (token.startsWith("-")) return false;
    if (token.startsWith("/") || token.startsWith("\\")) return false;
    if (token.length > 1 && token[1] === ":") return false;
    return true;
}

const CLIMB = "..";

export function climbsOut(token: string): boolean {
    for (const segment of token.split("/")) {
        if (segment === CLIMB) return true;
    }

    return false;
}

function manifestFinding(manifestPath: string, kind: string, locus: string, actual: string, decide: string): Finding {
    return {
        rule: `declaration/${kind}`,
        path: manifestPath,
        line: 0,
        locus,
        stack: [
            { check: "declared", resolved: locus },
            { check: "onDisk", resolved: "absent" },
        ],
        actual,
        expected: null,
        remediation: { action: "declare", from: actual, to: null, target: manifestPath, deterministic: false, decide },
        healed: false,
    };
}

function resolvesToPackage(packageDir: string, entry: string): boolean {
    const star = entry.indexOf("*");
    if (star === -1) return existsSync(resolve(packageDir, entry, MANIFEST));

    const parent = resolve(packageDir, entry.slice(0, star));
    if (!existsSync(parent)) return false;
    try {
        for (const child of readdirSync(parent, { withFileTypes: true })) {
            if (!child.isDirectory()) continue;
            if (existsSync(resolve(parent, child.name, MANIFEST))) return true;
        }
    } catch {
        return false;
    }
    return false;
}

function manifestPaths(repoRoot: string, ignored: readonly string[]): string[] {
    const out: string[] = [];
    const skip = [...ignored.filter((name) => name !== MANIFEST), NODE_MODULES, ".git"];

    for (const root of MANIFEST_ROOTS) {
        const absolute = resolve(repoRoot, root);
        if (!existsSync(absolute)) continue;
        for (const file of walk({ root: absolute, ignored: skip, extensions: [] })) {
            if (basename(file) === MANIFEST) out.push(file);
        }
    }

    return out;
}

function reachFinding(manifestPath: string, name: string): Finding {
    return {
        rule: "declaration/unreachedDependency",
        path: manifestPath,
        line: 0,
        locus: `dependency "${name}"`,
        stack: [
            { check: "declared", resolved: name },
            { check: "specifier", resolved: "absent" },
            { check: "invocation", resolved: "absent" },
        ],
        actual: `${name} is declared and no source or configuration in this package reaches it`,
        expected: null,
        remediation: {
            action: "declare",
            from: name,
            to: null,
            target: manifestPath,
            deterministic: false,
            decide: "a declared dependency nothing reaches makes the dependency set claim a coverage it does not have, and the claim is read by installers rather than by readers — so it costs an install on every consumer and buys nothing. Reach it from source or configuration, or remove the declaration. THE REACH CORPUS IS SOURCE AND CONFIGURATION ONLY, because a package NAMED in prose is being discussed rather than invoked, and a check counting a report about an unused dependency as evidence that it is used measures the opposite of its own question. This does not heal: whether a declaration is premature or obsolete is a judgement about intent that no artifact carries",
        },
        healed: false,
    };
}

function inspectOne(repoRoot: string, manifestAbs: string, findings: Finding[]): void {
    let parsed: Record<string, unknown>;
    try {
        parsed = readJson(
            readSurface(manifestAbs, "utf8"),
            isObject,
            relative(repoRoot, manifestAbs),
            "a JSON object",
        );
    } catch (error) {
        findings.push(
            manifestFinding(
                relative(repoRoot, manifestAbs),
                "unparsableManifest",
                MANIFEST,
                String(error),
                "the manifest is not valid JSON — every npm script in this package is dead until it parses",
            ),
        );
        return;
    }

    const manifestPath = toPosix(repoRoot, manifestAbs);
    const packageDir = dirname(manifestAbs);

    const runtime = parsed["dependencies"];
    if (typeof runtime === "object" && runtime !== null) {
        for (const name of Object.keys(runtime as Record<string, unknown>)) {
            findings.push(
                manifestFinding(
                    manifestPath,
                    "declaredRuntimeDependency",
                    `dependencies "${name}"`,
                    `${name} is declared as a RUNTIME dependency`,
                    "runtime code here takes no third-party dependency, so a consumer needs no toolchain of its own to run what it adopted — a declared runtime dependency makes this package's reach a function of what the consumer already has, and the invariant it breaks is one no amount of noticing holds because a manifest field is read by installers rather than by readers. Vendor the behaviour, move it behind an injected port the consumer supplies, or demote it to a development dependency where it does not travel; where one is genuinely structurally unavoidable, that judgement is the maintainer's and is recorded rather than assumed, which is why this does not heal",
                ),
            );
        }
    }

    for (const name of dependencyReach(packageDir, manifestAbs).unreached) {
        findings.push(reachFinding(manifestPath, name));
    }

    const workspaces = parsed["workspaces"];
    if (Array.isArray(workspaces)) {
        for (const entry of workspaces) {
            if (typeof entry !== "string") continue;
            if (resolvesToPackage(packageDir, entry)) continue;
            findings.push(
                manifestFinding(
                    manifestPath,
                    "emptyWorkspaceGlob",
                    `workspaces "${entry}"`,
                    `${entry} matches no directory holding a ${MANIFEST}`,
                    `point the glob at the directory that actually holds the ${MANIFEST}, or drop it — a glob matching nothing installs nothing and warns only on some commands`,
                ),
            );
        }
    }

    for (const field of ["imports", "exports"]) {
        const map = parsed[field];
        if (typeof map !== "object" || map === null) continue;
        for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
            if (typeof value !== "string") continue;
            const concrete = value.split("*")[0] ?? value;
            if (concrete.length === 0) continue;
            if (existsSync(resolve(packageDir, concrete))) continue;
            findings.push(
                manifestFinding(
                    manifestPath,
                    "unresolvedSubpath",
                    `${field} "${key}"`,
                    value,
                    "the target does not exist — correct it or remove the entry, because a broken subpath fails only at the import that uses it",
                ),
            );
        }
    }

    const scripts = parsed["scripts"];
    if (typeof scripts !== "object" || scripts === null) return;

    for (const [name, command] of Object.entries(scripts as Record<string, unknown>)) {
        if (typeof command !== "string") continue;
        for (const token of splitWords(command)) {
            if (!isRepoRelative(token) || !endsWithAny(token, SCRIPT_TARGETS)) continue;

            if (climbsOut(token)) {
                findings.push(
                    manifestFinding(
                        manifestPath,
                        "hostClaimingScriptTarget",
                        `scripts.${name}`,
                        token,
                        "the script names a target OUTSIDE this package's own root, which is a claim about a tree this " +
                            "package does not own — so it resolves onto one consumer's layout or onto nothing, and it is " +
                            "green on exactly the tree it was authored against. A DECLARATION WALK RUNS IN ONE DIRECTION: " +
                            "it catches a claim with no referent and is constitutionally unable to catch a referent that " +
                            "should not have been claimed, because its criterion is disk existence rather than ownership. " +
                            "Move the invocation to the party that owns the capability, and let this package carry the DATA " +
                            "that capability reads",
                    ),
                );
                continue;
            }

            if (existsSync(resolve(packageDir, token))) continue;
            findings.push(
                manifestFinding(
                    manifestPath,
                    "unresolvedScriptTarget",
                    `scripts.${name}`,
                    token,
                    "the script names a file that does not exist — a renamed entrypoint leaves the documented command failing at the moment someone needs it",
                ),
            );
        }
    }
}

export function inspectManifests(repoRoot: string, ignored: readonly string[]): Finding[] {
    const findings: Finding[] = [];
    for (const manifest of manifestPaths(repoRoot, ignored)) inspectOne(repoRoot, manifest, findings);
    return findings;
}
