import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { basename, resolve } from "node:path";

import { historyPath, projectRoot, slotText, surfacePath, surfacePrefix } from "../../../config/surface.config.ts";
import { AGENDA, BLOCKING_SUFFIX, VENUE_ARCHIVE } from "../constants/blocking.constants.ts";
import { BOARD_PATH } from "../constants/board.constants.ts";
import { NO_FIX_FLAG } from "../constants/path.constants.ts";
import { runArchiveMove } from "../runners/converge.runner.ts";
import { plannedInvariants } from "../runners/venue.runner.ts";
import { convergenceEdges } from "../validators/converge.validator.ts";

const REPO_ROOT = projectRoot();

export const RESTATES: readonly string[] = [
    "a_venue_accumulates_and_the_board_is_swept",
    "a_venue_is_absorbed_before_it_is_archived",
    "an_undecided_half_names_its_receiver",
];

const HELP = [
    `${slotText("execution", "converge_command")} -- --agent <LETTER> --file <venue>`,
    "",
    "  Converges a prioritised discussion: the venue is MOVED WHOLE INTO THE ARCHIVE once every edge",
    "  holds, and is never removed from the repository — the extraction keeps the CONCLUSION and the",
    "  archive keeps the REASONING, so a closure that only extracts destroys what it cannot restate.",
    "  Every precondition is an ORDERING this venue's own seats derived, and each was found by",
    "  violating it — so it is encoded as a REFUSAL rather than written down, because an ordering",
    "  recorded in prose is rediscovered by collision while one encoded in the operation cannot be.",
    "",
    "  --agent <LETTER>   MANDATORY. The seat taking the operation.",
    "  --file <venue>     MANDATORY. The venue to converge, by path or by the name a seat sees.",
    "  --rehearse         Report which edges hold and move nothing.",
    "  --help             This text.",
    "",
    "  A violated ordering leaves a correct-looking result reached in the wrong sequence, which is",
    "  why review at any level of care does not catch one: the only place it can be caught is the",
    "  moment it is attempted.",
    "",
].join("\n");

function argumentValue(flag: string): string | null {
    const at = process.argv.indexOf(flag);
    if (at === -1 || at + 1 >= process.argv.length) return null;

    const value = process.argv[at + 1] ?? "";
    return value.startsWith("--") ? null : value;
}

function venueNames(): string[] {
    const prefix = surfacePrefix();
    const root = resolve(REPO_ROOT, prefix);
    if (!existsSync(root)) return [];

    const out: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(BLOCKING_SUFFIX)) continue;
        out.push(prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`);
    }

    return out;
}

function resolveTarget(named: string): string {
    if (existsSync(resolve(REPO_ROOT, named))) return named;

    const prefix = surfacePrefix();
    const prefixed = prefix.length === 0 ? named : `${prefix}/${named}`;
    return existsSync(resolve(REPO_ROOT, prefixed)) ? prefixed : named;
}

function main(): void {
    if (process.argv.includes("--help")) {
        process.stdout.write(HELP);
        process.exit(0);
    }

    const agent = argumentValue("--agent");
    const named = argumentValue("--file");

    if (agent === null || named === null) {
        process.stdout.write("REFUSED  converge requires --agent <LETTER> and --file <venue>\n");
        process.exit(2);
    }

    const target = resolveTarget(named);
    const absolute = resolve(REPO_ROOT, target);

    if (!absolute.endsWith(BLOCKING_SUFFIX)) {
        process.stdout.write(`REFUSED  ${target} is not a venue: only a prioritised discussion converges\n`);
        process.exit(2);
    }

    if (!existsSync(absolute)) {
        process.stdout.write(`ABSENT  ${target} does not exist; nothing to converge\n`);
        process.exit(2);
    }

    const board = resolve(REPO_ROOT, BOARD_PATH);
    const index = resolve(REPO_ROOT, surfacePath("agent_index"));
    const archivePath = resolve(REPO_ROOT, historyPath());

    const edges = convergenceEdges(
        REPO_ROOT,
        target,
        readSurface(absolute, "utf8"),
        existsSync(board) ? readSurface(board, "utf8") : "",
        existsSync(index) ? readSurface(index, "utf8") : "",
        existsSync(archivePath) ? readSurface(archivePath, "utf8") : "",
        venueNames(),
        plannedInvariants(
            existsSync(resolve(REPO_ROOT, AGENDA)) ? readSurface(resolve(REPO_ROOT, AGENDA), "utf8") : "",
        ),
    );

    for (const edge of edges) {
        process.stdout.write(`  ${edge.holds ? "holds  " : "BLOCKS "} ${edge.edge}\n           ${edge.detail}\n`);
    }

    const blocking = edges.filter((edge) => !edge.holds);

    if (blocking.length > 0) {
        process.stdout.write(
            `REFUSED  ${String(blocking.length)} of ${String(edges.length)} ordering(s) do not hold, so ${target} stands. ` +
                "Each is a constraint this venue's seats derived by colliding with it, which is why it is a refusal " +
                "rather than a note. THE CLOSURE IS NOW REVERSIBLE AND THE ORDERINGS STILL BIND, FOR A REASON THE " +
                "REVERSIBILITY DOES NOT TOUCH: the venue moves to an archive nobody reads, so a clause that never " +
                "reached the successor and a durable half that never reached the accumulator are lost to every reader " +
                "who consults the outcome, whatever survives on disk. Reversibility changed what a wrong sequence " +
                "COSTS and not whether it happened — a correct-looking result reached in the wrong order is still a " +
                "result nobody can act on\n",
        );
        process.exit(2);
    }

    const archiveRoot = resolve(REPO_ROOT, VENUE_ARCHIVE);
    const destination = resolve(archiveRoot, basename(target));

    if (!existsSync(archiveRoot)) {
        process.stdout.write(
            `REFUSED  the declared archive root does not resolve, so ${target} stands. A converged venue is MOVED ` +
                "there whole rather than removed from the repository — the extraction keeps the CONCLUSION and the " +
                "archive keeps the REASONING, so a closure with nowhere to move to would destroy the argument while " +
                "satisfying every ordering. Create the root, or correct the declaration; this refuses rather than " +
                "falling back to a deletion, because a fallback here is the exact operation the ruling forbids\n",
        );
        process.exit(2);
    }

    if (existsSync(destination)) {
        process.stdout.write(
            `REFUSED  ${basename(target)} already exists in the archive, so ${target} stands rather than overwriting ` +
                "it. A move onto an occupied name destroys whatever is there, and the attention sits on the source. " +
                "THIS TEST IS THE EARLY REPORT AND NOT THE PROTECTION — the move itself refuses on an occupied name, " +
                "because a check followed by an act leaves a window in which the name can appear, and the protection " +
                "has to be the operation rather than a prior question about it\n",
        );
        process.exit(2);
    }

    if (process.argv.includes(NO_FIX_FLAG)) {
        process.stdout.write(
            `PREVIEW  every ordering holds; ${target} would be MOVED WHOLE into the archive by ${agent}, not deleted\n`,
        );
        process.exit(0);
    }

    const moved = runArchiveMove(absolute, destination, target);
    if (moved.code !== 0) {
        process.stdout.write(moved.message);
        process.exit(moved.code);
    }

    process.stdout.write(
        `CONVERGED  ${target} MOVED WHOLE into the archive by ${agent}: every ordering held, the durable half is in ` +
            "the accumulator, the successor carries what this venue left open, and the argument itself survives where " +
            "a reader can still separate a ruling from a preference and see what was refuted on the way\n",
    );
    process.exit(0);
}

main();
