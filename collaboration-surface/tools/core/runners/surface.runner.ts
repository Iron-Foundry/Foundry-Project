import { existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { localSeeds, seededLifetimeOf, surfacePath } from "../../../config/surface.config.ts";
import { taxonomy } from "../../../config/taxonomy.config.ts";
import { writeRepair } from "../writers/repair.writer.ts";

const BANNER = "═";

const LIVE_SECTION_LEAD = "**A surface raised from this template";

export interface SurfaceRequest {
    readonly repoRoot: string;
    readonly templateSlot: string;
    readonly rootSlot: string;
    readonly subject: string;
    readonly concern: string;
    readonly rehearse: boolean;
}

export interface SurfaceOutcome {
    readonly code: number;
    readonly message: string;
}

export function declaredSubjects(): readonly string[] {
    return taxonomy.subjects;
}

export function raisedFrom(template: string): string {
    const lines = template.split("\n");
    const out: string[] = [];
    let carrying = false;

    for (const line of lines) {
        if (line.startsWith(LIVE_SECTION_LEAD)) break;
        if (!carrying && !line.startsWith(BANNER)) continue;
        carrying = true;
        out.push(line);
    }

    return `${out.join("\n").trimEnd()}\n`;
}

export function raiseLocalSurfaces(repoRoot: string): string {
    const lines: string[] = [];

    for (const [templateSlot, surfaceSlot] of localSeeds()) {
        const target = surfacePath(surfaceSlot);
        if (existsSync(resolve(repoRoot, target))) continue;

        const template = surfacePath(templateSlot);
        const templatePath = resolve(repoRoot, template);
        if (!existsSync(templatePath)) {
            lines.push(
                `ABSENT  ${target} is a local surface and ${template} resolves to no file, so it cannot be raised. ` +
                    "Every reader of it meets an absent file until the template is restored\n",
            );
            continue;
        }

        const outcome = writeRepair({ repoRoot, declared: "whole" }, target, readSurface(templatePath, "utf8"));
        lines.push(
            outcome.written
                ? `RAISED  ${target} from ${template}. A LOCAL SURFACE IS KEPT BY EACH MACHINE AND TRACKED BY NONE, so a ` +
                      "tree without one raises it from the template that seeds it before the first read\n"
                : (outcome.refusal ?? ""),
        );
    }

    return lines.join("");
}

export function runSurfaceRaise(request: SurfaceRequest): SurfaceOutcome {
    if (request.subject.trim().length === 0) {
        return {
            code: 2,
            message:
                "REFUSED  a raised surface is named for the SUBJECT it is about, and this call named none. The filename is " +
                "what every citation resolves through, so a surface with no subject is one no reference can reach\n",
        };
    }

    if (!declaredSubjects().includes(request.subject.trim())) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.subject.trim()} is not a declared SUBJECT, so this form would raise a surface the naming ` +
                "walk fails on its first run — born non-conformant, by the one mechanism that exists to make a surface " +
                "conformant at creation. A RAISE THAT ACCEPTS ANY SUBJECT MOVES THE VOCABULARY FROM A CLOSED SET TO " +
                "WHATEVER A CALLER TYPED, and the cost lands on whoever next runs the whole scope rather than on the caller, " +
                "who is told the raise succeeded. An undeclared word is an approved configuration edit rather than a naming " +
                "choice: work the ladder — an existing subject, then the is-a test, then the filename is wrong, then the " +
                `surface is. Declared: ${declaredSubjects().join(" ")}\n`,
        };
    }

    if (seededLifetimeOf(request.templateSlot) === null) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.templateSlot} seeds no declared surface, so this form has no destination it may derive. ` +
                "A TEMPLATE DECLARES A LIFETIME FOR AN INSTANCE and the seeds relation is what resolves where that instance " +
                "lands — raising into a root named at the call site would put the destination in the form rather than in " +
                "the declaration, which is the claim-about-a-tree this package refuses\n",
        };
    }

    const templatePath = resolve(request.repoRoot, surfacePath(request.templateSlot));
    if (!existsSync(templatePath)) {
        return {
            code: 2,
            message: `REFUSED  ${request.templateSlot} resolves to no file, so there is no contract to raise from\n`,
        };
    }

    const target = `${surfacePath(request.rootSlot)}/${request.subject.trim()}.${request.concern}.md`;
    if (existsSync(resolve(request.repoRoot, target))) {
        return {
            code: 2,
            message:
                `CLEAR  ${target} already exists, so there is nothing to raise. A raised surface is CURRENT TRUTH and is ` +
                "corrected in place; a second one under one subject gives every reader two statements with nothing saying " +
                "which is the class\n",
        };
    }

    const template = readSurface(templatePath, "utf8");
    const carried = raisedFrom(template);

    if (!carried.includes(BANNER)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.templateSlot} declares no permanent block, so a raise would carry no contract and the ` +
                "surface would be governed by nothing while reading as one raised from a template\n",
        };
    }

    if (request.rehearse) {
        return {
            code: 0,
            message:
                `REHEARSED  ${target} WOULD be raised from ${request.templateSlot}, carrying its permanent blocks, and ` +
                "NOTHING WAS WRITTEN. Every refusal this form runs has run: the subject resolves, the template seeds a " +
                "declared root, the file is there, the destination is free, and the contract block is present. A " +
                "REHEARSAL THAT WRITES IS THE WORST SHAPE A PREVIEW CAN TAKE, because a party takes it precisely to " +
                "learn what an act would do WITHOUT doing it — so the one invocation chosen for safety becomes the one " +
                "that acts unannounced, and the artifact it leaves reads as somebody's deliberate work. The flag reaches " +
                "this form rather than being accepted at the command and dropped on the way\n",
        };
    }

    const outcome = writeRepair({ repoRoot: request.repoRoot, declared: "whole" }, target, carried);
    if (!outcome.written) return { code: 2, message: outcome.refusal ?? "" };

    return {
        code: 0,
        message:
            `SURFACE  ${target} raised from ${request.templateSlot}. THE PERMANENT BLOCKS ARE CARRIED AND THE LIVE SECTION ` +
            "IS BORN PRESENT AND EMPTY, which is distinguishable from a populated one — an ABSENT section makes an " +
            "oversight read exactly like a decision, and a seeded placeholder states nothing while reading as a section " +
            "that exists. THE DESTINATION IS DERIVED FROM THE SEEDS RELATION RATHER THAN NAMED HERE, so a template and the " +
            "root it seeds cannot disagree about where an instance lands\n",
    };
}
