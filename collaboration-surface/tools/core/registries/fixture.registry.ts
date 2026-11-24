import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { surfacePath } from "../../../config/surface.config.ts";
import type { BranchFixture } from "../fixtures/converge.fixture.ts";
import type { GateFixture } from "../fixtures/gate.fixture.ts";
import { walk } from "../iterators/file.iterator.ts";

export interface FixtureRegistry {
    readonly gates: readonly GateFixture[];
    readonly branches: readonly BranchFixture[];
    readonly sources: readonly string[];
    readonly unreadable: readonly string[];
}

const FIXTURE_DIR = `${surfacePath("pipeline")}/core/fixtures`;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isBranch(entry: unknown): entry is BranchFixture {
    return isRecord(entry) && typeof entry["exercise"] === "function" && isRecord(entry["expect"]);
}

function isGate(entry: unknown): entry is GateFixture {
    return isRecord(entry) && typeof entry["rule"] === "string";
}

export async function discoverFixtures(repoRoot: string): Promise<FixtureRegistry> {
    const files = walk({ root: resolve(repoRoot, FIXTURE_DIR), ignored: [], extensions: [".ts"] }).sort();

    const gates: GateFixture[] = [];
    const branches: BranchFixture[] = [];
    const sources: string[] = [];
    const unreadable: string[] = [];

    for (const file of files) {
        let module: Record<string, unknown>;
        try {
            module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
        } catch (error) {
            unreadable.push(`${file}: ${String(error)}`);
            continue;
        }

        let contributed = false;
        for (const exported of Object.values(module)) {
            if (!Array.isArray(exported)) continue;

            for (const entry of exported) {
                if (isBranch(entry)) {
                    branches.push(entry);
                    contributed = true;
                    continue;
                }
                if (!isGate(entry)) continue;
                gates.push(entry);
                contributed = true;
            }
        }

        if (contributed) sources.push(file);
    }

    return { gates, branches, sources, unreadable };
}
