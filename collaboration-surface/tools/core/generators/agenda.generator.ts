import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { AGENDA } from "../constants/blocking.constants.ts";
import { writeRepair } from "../writers/repair.writer.ts";

export function writeAgendaIfUnmoved(repoRoot: string, witnessed: string, rendered: string): boolean {
    const current = readSurface(resolve(repoRoot, AGENDA), "utf8");
    if (current !== witnessed) return false;

    return writeRepair({ repoRoot, declared: "" }, AGENDA, rendered).written;
}
