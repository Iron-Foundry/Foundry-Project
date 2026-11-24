import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { surfacePath } from "../../../config/surface.config.ts";
import { raiseLocalSurfaces, runSurfaceRaise } from "../runners/surface.runner.ts";
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";

const TEMPLATE = [
    "# a probe template",
    "",
    "═══ CONTRACT (permanent) ═══",
    "",
    "the clause every raised surface carries",
    "",
    "═══ MODEL ═══",
    "",
    "**A surface raised from this template carries no statement until its subject is understood.**",
    "",
].join("\n");

const NO_BLOCK = ["# a probe template", "", "prose with no permanent block", ""].join("\n");

function raising(root: string, subject: string, rehearse = false): BranchObservation {
    const outcome = runSurfaceRaise({
        repoRoot: root,
        templateSlot: "model_template",
        rootSlot: "models",
        subject,
        concern: "model",
        rehearse,
    });

    const target = resolve(root, `${surfacePath("models")}/${subject.trim()}.model.md`);
    const raised = existsSync(target) ? readSurface(target, "utf8") : "";

    return {
        code: outcome.code,
        carries: raised.includes("the clause every raised surface carries"),
        seeded: raised.includes("carries no statement until its subject"),
    };
}

const BOARD_SEED = "a probe board template\n";

const INDEX_SEED = "a probe index template\n";

const HELD_BOARD = "a board this machine already holds\n";

function local(root: string): BranchObservation {
    const message = raiseLocalSurfaces(root);
    const board = resolve(root, surfacePath("board"));
    const index = resolve(root, surfacePath("agent_index"));

    return {
        board: existsSync(board) ? readSurface(board, "utf8") : "",
        index: existsSync(index) ? readSurface(index, "utf8") : "",
        reported: message.includes("RAISED"),
        absent: message.includes("ABSENT"),
    };
}

export const SURFACE_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "surface.runner",
        branch: "a tree holding neither local surface, which raises each from the template that seeds it — the index and the board are kept by each machine and tracked by none, so a fresh tree meets neither and every reader of either would meet an absent file",
        seed: [
            { path: surfacePath("board_template"), text: BOARD_SEED },
            { path: surfacePath("agent_index_template"), text: INDEX_SEED },
        ],
        exercise: (root) => local(root),
        expect: { board: BOARD_SEED, index: INDEX_SEED, reported: true, absent: false },
    },
    {
        subject: "surface.runner",
        branch: "a tree already holding its board, which the raise leaves untouched — the positive control, because a raise that rewrites a held surface has been shown to overwrite a machine's live coordination state rather than to fill an absence",
        seed: [
            { path: surfacePath("board"), text: HELD_BOARD },
            { path: surfacePath("board_template"), text: BOARD_SEED },
            { path: surfacePath("agent_index_template"), text: INDEX_SEED },
        ],
        exercise: (root) => local(root),
        expect: { board: HELD_BOARD, index: INDEX_SEED, reported: true, absent: false },
    },
    {
        subject: "surface.runner",
        branch: "a local surface whose seeding template resolves to no file, which writes nothing and names the absence rather than reporting a raise",
        seed: [{ path: surfacePath("board_template"), text: BOARD_SEED }],
        exercise: (root) => local(root),
        expect: { board: BOARD_SEED, index: "", reported: true, absent: true },
    },
    {
        subject: "surface.runner",
        branch: "a raise carrying the permanent blocks and stopping where the template addresses its own reader",
        seed: [{ path: surfacePath("model_template"), text: TEMPLATE }],
        exercise: (root) => raising(root, "base"),
        expect: { code: 0, carries: true, seeded: false },
    },
    {
        subject: "surface.runner",
        branch: "a REHEARSED raise, which runs every refusal and writes NOTHING — the worst shape a preview can take is one that acts, because the invocation a party chooses for safety becomes the one that acts unannounced and leaves an artifact reading as somebody's deliberate work",
        seed: [{ path: surfacePath("model_template"), text: TEMPLATE }],
        exercise: (root) => raising(root, "base", true),
        expect: { code: 0, carries: false, seeded: false },
    },
    {
        subject: "surface.runner",
        branch: "a template whose header addresses the RAISER, which the raise drops — the permanent blocks are what an instance carries and a copy-me line is an instruction to whoever raises it, so carrying it lands a standing artifact telling its reader to create the artifact they are reading",
        seed: [{ path: surfacePath("model_template"), text: TEMPLATE }],
        exercise: (root) => {
            raising(root, "marker");
            const held = readSurface(resolve(root, `${surfacePath("models")}/marker.model.md`), "utf8");
            return { opensAtBanner: held.trimStart().startsWith("═"), carriesHeader: held.includes("a probe template") };
        },
        expect: { opensAtBanner: true, carriesHeader: false },
    },
    {
        subject: "surface.runner",
        branch: "a template declaring no permanent block, whose raise would carry no contract at all",
        seed: [{ path: surfacePath("model_template"), text: NO_BLOCK }],
        exercise: (root) => raising(root, "base"),
        expect: { code: 2, carries: false, seeded: false },
    },
    {
        subject: "surface.runner",
        branch: "a raise naming a subject the taxonomy does not declare, which the form accepted and the naming walk then failed on its first run — BORN NON-CONFORMANT by the one mechanism that exists to make a surface conformant at creation, with the caller told the raise succeeded and the cost landing on whoever next runs the whole scope",
        seed: [{ path: surfacePath("model_template"), text: TEMPLATE }],
        exercise: (root) => raising(root, "a-subject-nobody-declared"),
        expect: { code: 2, carries: false, seeded: false },
    },
    {
        subject: "surface.runner",
        branch: "a raise naming no subject, which no citation could ever resolve through",
        seed: [{ path: surfacePath("model_template"), text: TEMPLATE }],
        exercise: (root) => raising(root, "   "),
        expect: { code: 2, carries: false, seeded: false },
    },
];
