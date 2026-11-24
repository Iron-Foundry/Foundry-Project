import { existsSync, readdirSync, rmSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { channelScopeOf } from "../reporters/rule.reporter.ts";

export interface Channel {
    readonly name: string;
    readonly scope: string;
    readonly declared: string | null;
}

export interface StaleChannel extends Channel {
    readonly removable: boolean;
}

function isChannelBody(parsed: unknown): boolean {
    if (typeof parsed !== "object" || parsed === null) return false;

    const record = parsed as Record<string, unknown>;
    return record["tool"] === "govern" && record["authoritative"] === false;
}

function declaredScope(parsed: unknown): string | null {
    if (typeof parsed !== "object" || parsed === null) return null;

    const value = (parsed as Record<string, unknown>)["scope"];
    return typeof value === "string" && value.length > 0 ? value : null;
}

export function channelsIn(repoRoot: string): Channel[] {
    const dir = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(dir)) return [];

    const out: Channel[] = [];
    for (const entry of readdirSync(dir)) {
        const scope = channelScopeOf(entry);
        if (scope === null) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(readSurface(resolve(dir, entry), "utf8"));
        } catch {
            continue;
        }
        if (!isChannelBody(parsed)) continue;

        out.push({ name: entry, scope, declared: declaredScope(parsed) });
    }

    return out;
}

export function staleChannels(repoRoot: string, resolves: (scope: string) => boolean): StaleChannel[] {
    return channelsIn(repoRoot)
        .filter((channel) => !resolves(channel.scope))
        .map((channel) => ({ ...channel, removable: true }));
}

export interface NamingBreach {
    readonly name: string;
    readonly named: string;
    readonly declared: string;
}

export interface ScopeCollision {
    readonly scope: string;
    readonly names: readonly string[];
}

export function misnamedChannels(repoRoot: string): NamingBreach[] {
    const out: NamingBreach[] = [];

    for (const channel of channelsIn(repoRoot)) {
        if (channel.declared === null || channel.declared === channel.scope) continue;
        out.push({ name: channel.name, named: channel.scope, declared: channel.declared });
    }

    return out;
}

export function collidingScopes(repoRoot: string): ScopeCollision[] {
    const byScope = new Map<string, string[]>();

    for (const channel of channelsIn(repoRoot)) {
        if (channel.declared === null) continue;

        const held = byScope.get(channel.declared) ?? [];
        held.push(channel.name);
        byScope.set(channel.declared, held);
    }

    const out: ScopeCollision[] = [];
    for (const [scope, names] of byScope) {
        if (names.length < 2) continue;
        out.push({ scope, names: [...names].sort() });
    }

    return out;
}

export function removeChannel(repoRoot: string, name: string): void {
    rmSync(resolve(repoRoot, GENERATED_DIR, name), { force: true });
}
