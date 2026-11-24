import { readFileSync, type PathOrFileDescriptor } from "node:fs";

import { withOpenRetry } from "../guards/surface.guard.ts";

export function readSurface(path: PathOrFileDescriptor, encoding: "utf8"): string {
    return withOpenRetry(() => readFileSync(path, encoding));
}

export const SURFACE_READ_CALLS: readonly string[] = [readSurface.name];

export const RAW_READ_CALLS: readonly string[] = [readFileSync.name];
