import { mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { slotList } from "../../../config/surface.config.ts";
import { writeSurface } from "./surface.writer.ts";

export interface RepairScope {
    readonly repoRoot: string;
    readonly declared: string;
    readonly claimed?: boolean;
}

export interface RepairOutcome {
    readonly written: boolean;
    readonly refusal: string | null;
}

const WHOLE = "whole";

const CLIMB = "..";

export function containedBy(declared: string, path: string): boolean {
    if (declared.length === 0 || declared === WHOLE) return true;

    const from = relative(declared, path);
    return from.length > 0 && !from.startsWith(CLIMB) && !resolve(from).startsWith(CLIMB);
}

export function isEnumerable(path: string, regions: readonly string[]): boolean {
    return regions.some((region) => containedBy(region, path));
}

export function writeRepair(scope: RepairScope, path: string, text: string): RepairOutcome {
    const regions = slotList("convention", "enumerable_write_regions");

    if (isEnumerable(path, regions) && scope.claimed === false) {
        return {
            written: false,
            refusal:
                `REFUSED  ${path} sits in a region where ONLY RUNS WRITE AND EVERY RUN DECLARES, and this write carries no ` +
                "live claim. BOTH DIRECTIONS OF THE QUESTION HOLD THERE AND ONLY THERE: a write with no live claim is " +
                "refusable because nothing else writes it, and a claim with no write is detectable for the same reason. " +
                "Across the source tree neither premise holds — a party edits without declaring anything — so the same " +
                "primitive carries CLAIMS ONLY there and refuses to infer a writer from a changed file, which is the " +
                "ambiguity it declines rather than resolves. The regions are DECLARED operands rather than a branch keyed " +
                "on a path shape, so a region added to the configuration acquires the correct direction with no edit here",
        };
    }

    if (!containedBy(scope.declared, path)) {
        return {
            written: false,
            refusal:
                `REFUSED  ${path} sits outside the scope this run DECLARED, which is ${scope.declared}. CONTAINMENT IS A ` +
                "PROPERTY OF THE MECHANISM RATHER THAN A CLAIM ABOUT THE RUN: asking whether a run WROTE outside its " +
                "scope needs a witness nobody holds for a repair scattered across source, while asking whether it CAN is " +
                "answered at one function every healer passes through. A run that declares a subtree and repairs beside " +
                "it makes every concurrency argument resting on that declaration unsound, because a party that read the " +
                "claim and stayed clear of it was never clear at all",
        };
    }

    const absolute = resolve(scope.repoRoot, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeSurface(absolute, text);

    return { written: true, refusal: null };
}
