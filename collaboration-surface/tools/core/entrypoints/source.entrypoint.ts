import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { projectRoot } from "../../../config/surface.config.ts";
import { GENERATED_DIR, NO_FIX_FLAG } from "../constants/path.constants.ts";
import { cleanSources } from "../steps/source.step.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const REPO_ROOT = projectRoot();
const REPORT = `${GENERATED_DIR}/clean.report.generated.json`;

export const RESTATES: readonly string[] = ["mutation_preview_first", "healing_is_default_in_every_entrypoint"];

function main(): void {
    const apply = !process.argv.includes(NO_FIX_FLAG);
    const result = cleanSources(REPO_ROOT, apply);

    const report = {
        tool: "clean",
        verdict: "pass",
        applied: apply,
        scanned: result.scanned,
        removed: result.removed,
        keptAsAttribution: result.kept,
        files: result.files,
    };

    mkdirSync(resolve(REPO_ROOT, GENERATED_DIR), { recursive: true });
    writeSurface(resolve(REPO_ROOT, REPORT), `${JSON.stringify(report, null, 2)}\n`);

    process.stdout.write(
        `${apply ? "CLEANED" : "PREVIEW"}  scanned=${String(result.scanned)} ` +
            `files=${String(result.files.length)} removed=${String(result.removed)} ` +
            `attributionKept=${String(result.kept)}\n` +
            `report: ${REPORT}\n`,
    );
}

main();
