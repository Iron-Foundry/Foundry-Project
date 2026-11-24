import { appendFileSync, writeFileSync } from "node:fs";

import { withOpenRetry } from "../guards/surface.guard.ts";

export function writeSurface(path: string, text: string): void {
    withOpenRetry(() => {
        writeFileSync(path, text, "utf8");
    });
}

export function appendSurface(path: string, text: string): void {
    withOpenRetry(() => {
        appendFileSync(path, text, "utf8");
    });
}

export const SURFACE_WRITE_CALLS: readonly string[] = [writeSurface.name, appendSurface.name];

export const RAW_WRITE_CALLS: readonly string[] = [writeFileSync.name, appendFileSync.name];
