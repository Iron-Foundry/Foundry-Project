import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { writeSurface } from "../writers/surface.writer.ts";

export interface FixtureTree {
    readonly root: string;
    readonly release: () => void;
}

export function growFixtureTree(samples: readonly { path: string; text: string }[]): FixtureTree {
    const root = mkdtempSync(resolve(tmpdir(), "govern-fixture-"));

    for (const sample of samples) {
        const target = resolve(root, sample.path);
        mkdirSync(dirname(target), { recursive: true });
        writeSurface(target, sample.text);
    }

    return {
        root,
        release: (): void => {
            rmSync(root, { recursive: true, force: true });
        },
    };
}
