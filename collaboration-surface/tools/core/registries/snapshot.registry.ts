import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { appendSurface, writeSurface } from "../writers/surface.writer.ts";

const SNAPSHOT_ROOT = `${GENERATED_DIR}/board.snapshots`;

const MAX_KEY_LENGTH = 80;

const DIGEST_LENGTH = 12;

function readableKey(target: string): string {
    let key = "";
    for (const char of target) {
        const lower = char >= "a" && char <= "z";
        const upper = char >= "A" && char <= "Z";
        const digit = char >= "0" && char <= "9";
        key += lower || upper || digit ? char : "-";
    }
    return key;
}

function surfaceKey(target: string): string {
    const readable = readableKey(target);
    if (readable.length <= MAX_KEY_LENGTH) return readable;

    const digest = createHash("sha256").update(target).digest("hex").slice(0, DIGEST_LENGTH);
    const tail = readable.slice(readable.length - (MAX_KEY_LENGTH - DIGEST_LENGTH - 1));
    return `${tail}-${digest}`;
}

function snapshotPath(repoRoot: string, agent: string, target: string): string {
    return resolve(repoRoot, SNAPSHOT_ROOT, `${agent}.${surfaceKey(target)}.snapshot.generated.txt`);
}

export function readSnapshot(repoRoot: string, agent: string, target: string): string | null {
    const path = snapshotPath(repoRoot, agent, target);
    return existsSync(path) ? readSurface(path, "utf8") : null;
}

export function writeSnapshot(repoRoot: string, agent: string, target: string, content: string): void {
    const path = snapshotPath(repoRoot, agent, target);
    mkdirSync(dirname(path), { recursive: true });
    writeSurface(path, content);
}

const FIELD_MARK_TAIL = ".field.generated.txt";

function fieldMarkPath(repoRoot: string, agent: string): string {
    return resolve(repoRoot, SNAPSHOT_ROOT, `${agent}${FIELD_MARK_TAIL}`);
}

export function readFieldMark(repoRoot: string, agent: string): number {
    const path = fieldMarkPath(repoRoot, agent);
    if (!existsSync(path)) return 0;

    const held = Number(readSurface(path, "utf8").trim());
    return Number.isFinite(held) ? held : 0;
}

export function writeFieldMark(repoRoot: string, agent: string, at: number): void {
    const path = fieldMarkPath(repoRoot, agent);
    mkdirSync(dirname(path), { recursive: true });
    writeSurface(path, String(at));
}

const SNAPSHOT_TAIL = ".snapshot.generated.txt";

export function unkeyedSnapshots(repoRoot: string): string[] {
    const root = resolve(repoRoot, SNAPSHOT_ROOT);
    if (!existsSync(root)) return [];

    const out: string[] = [];
    for (const entry of readdirSync(root)) {
        if (!entry.endsWith(SNAPSHOT_TAIL)) continue;

        const head = entry.slice(0, entry.length - SNAPSHOT_TAIL.length);
        if (head.includes(".")) continue;
        out.push(entry);
    }

    return out;
}

export function pruneUnkeyedSnapshots(repoRoot: string): string[] {
    const stale = unkeyedSnapshots(repoRoot);
    for (const entry of stale) rmSync(resolve(repoRoot, SNAPSHOT_ROOT, entry), { force: true });
    return stale;
}

export function lastInteraction(repoRoot: string, agent: string): number {
    const root = resolve(repoRoot, SNAPSHOT_ROOT);
    if (!existsSync(root)) return 0;

    const lead = `${agent}.`;
    let newest = 0;

    for (const entry of readdirSync(root)) {
        if (!entry.startsWith(lead)) continue;

        const stamped = statSync(resolve(root, entry)).mtimeMs;
        if (stamped > newest) newest = stamped;
    }

    return newest;
}

export function forgetAgent(repoRoot: string, agent: string): string[] {
    const root = resolve(repoRoot, SNAPSHOT_ROOT);
    if (!existsSync(root)) return [];

    const lead = `${agent}.`;
    const held = readdirSync(root).filter((entry) => entry.startsWith(lead));
    for (const entry of held) rmSync(resolve(root, entry), { force: true });

    return held;
}

function deliveredPath(repoRoot: string, agent: string): string {
    return resolve(repoRoot, SNAPSHOT_ROOT, `${agent}.delivered.generated.txt`);
}

export function readDelivered(repoRoot: string, agent: string): Set<string> {
    const path = deliveredPath(repoRoot, agent);
    if (!existsSync(path)) return new Set();

    const out = new Set<string>();
    for (const line of readSurface(path, "utf8").split("\n")) {
        const key = line.trim();
        if (key.length > 0) out.add(key);
    }
    return out;
}

export function recordDelivered(repoRoot: string, agent: string, keys: readonly string[]): void {
    if (keys.length === 0) return;

    const held = readDelivered(repoRoot, agent);
    let added = "";
    for (const key of keys) {
        if (held.has(key)) continue;
        held.add(key);
        added += `${key}\n`;
    }
    if (added.length === 0) return;

    const path = deliveredPath(repoRoot, agent);
    mkdirSync(dirname(path), { recursive: true });
    appendSurface(path, added);
}

export function wasDelivered(repoRoot: string, agent: string, key: string): boolean {
    return readDelivered(repoRoot, agent).has(key);
}
