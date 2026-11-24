import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const WAITERS = `${GENERATED_DIR}/board.waiters.generated.json`;

export interface Waiter {
    readonly id: string;
    readonly agent: string;
    readonly expiresAt: number;
}

function isWaiter(value: unknown): value is Waiter {
    if (typeof value !== "object" || value === null) return false;

    const candidate = value as { id?: unknown; agent?: unknown; expiresAt?: unknown };
    return (
        typeof candidate.id === "string" &&
        typeof candidate.agent === "string" &&
        typeof candidate.expiresAt === "number"
    );
}

function readWaiters(source: string): Waiter[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        return [];
    }

    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWaiter);
}

function liveWaiters(waiters: readonly Waiter[], now: number): Waiter[] {
    return waiters.filter((waiter) => waiter.expiresAt > now);
}

export function waitersPath(root: string): string {
    return resolve(root, WAITERS);
}

export function currentWaiters(root: string, now: number): Waiter[] {
    const path = waitersPath(root);
    if (!existsSync(path)) return [];

    return liveWaiters(readWaiters(readSurface(path, "utf8")), now);
}

export function writeWaiters(root: string, waiters: readonly Waiter[]): void {
    mkdirSync(resolve(root, GENERATED_DIR), { recursive: true });
    writeSurface(waitersPath(root), `${JSON.stringify(waiters, null, 2)}\n`);
}

export function releaseWaiter(root: string, id: string, now: number): void {
    writeWaiters(
        root,
        currentWaiters(root, now).filter((waiter) => waiter.id !== id),
    );
}

export function releaseAgent(root: string, agent: string, now: number): void {
    writeWaiters(
        root,
        currentWaiters(root, now).filter((waiter) => waiter.agent !== agent),
    );
}
