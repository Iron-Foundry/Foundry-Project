import {
    PROJECTION_CAP_CHARS,
    PROJECTION_DEFAULT,
    PROJECTION_HOST,
    PROJECTION_MARKER,
} from "../constants/board.constants.ts";
import { accumulate } from "../predicates/token.predicate.ts";
import { BLOCKING_SUFFIX } from "../constants/blocking.constants.ts";
import { boardFinding } from "../validators/board.validator.ts";
import type { Finding } from "../types/segment.types.ts";

function projectionLine(projection: string): string {
    for (const line of projection.split("\n")) {
        if (line.includes(PROJECTION_MARKER)) return line;
    }
    return "";
}

const TOKEN_BREAKS = [" ", "\t", "`", "·", "(", ")", ",", "*"];

function tokensOf(line: string): string[] {
    return accumulate(line, (char) => !TOKEN_BREAKS.includes(char));
}

function venueName(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? path : path.slice(slash + 1);
}

export function checkProjection(projection: string, venues: readonly string[], findings: Finding[]): void {
    if (!projection.includes(PROJECTION_MARKER) || projection.includes(PROJECTION_DEFAULT)) {
        findings.push(
            boardFinding(
                "staleProjection",
                1,
                PROJECTION_MARKER,
                `the board exists while ${PROJECTION_HOST} still carries no board projection`,
                "a refreshed one-liner naming the board",
                `every write to the board refreshes the ${PROJECTION_MARKER} one-liner, which is a cache of the board and never an independent truth; a projection that still reads as no-board tells every agent it is working alone`,
            ),
        );
        return;
    }

    const line = projectionLine(projection);

    if (line.length > PROJECTION_CAP_CHARS) {
        findings.push(
            boardFinding(
                "oversizedProjection",
                1,
                PROJECTION_MARKER,
                `the projection runs ${String(line.length)} characters against a declared cap of ${String(PROJECTION_CAP_CHARS)}`,
                `a projection within ${String(PROJECTION_CAP_CHARS)} characters`,
                "the projection is the ONLY board channel a spawned agent has — the board itself is never delivered — so a line past the cap is not merely untidy, it is a channel that has stopped carrying its payload. Size is the precondition for every other claim about it: a line nobody reads whole makes a truth check evaluate a clause nobody reaches, so this fails before truth does",
            ),
        );
        return;
    }

    const open = new Set(venues.map(venueName));

    for (const token of tokensOf(line)) {
        if (!token.endsWith(BLOCKING_SUFFIX) || open.has(token)) continue;
        findings.push(
            boardFinding(
                "phantomProjection",
                1,
                token,
                `the projection names ${token} as an open blocker and no such file is on disk`,
                `the projection naming only blockers that exist, or naming none`,
                "the LOCKED refresh rule binds BOTH directions, and only one of them was gated: a blocker on disk that the line omits was caught, while a blocker the line invents was not. The invented one is the worse half, because every mechanism downstream treats a blocker as outranking every queue — so a spawned agent, whose only board channel is this line, halts its own work against a decision nobody is having, and there is no file to read that would tell it otherwise. Deleting a blocker refreshes the projection in the SAME change for exactly this reason: the window between removal and refresh is the window in which the line actively lies",
            ),
        );
        return;
    }

    for (const venue of venues) {
        const name = venueName(venue);
        if (line.includes(name)) continue;
        findings.push(
            boardFinding(
                "falseProjection",
                1,
                name,
                `${name} is open while the projection does not name it`,
                `the projection naming ${name} as the open blocker`,
                "a blocker outranks every queue, and a spawned agent learns of one only through this line. A projection asserting no blocker while one is on disk is not a stale cache beside a readable source — it is a FALSE statement delivered as the ONLY statement, with no second source to disagree with. Only the blocker clause is decidable here, because a venue's existence is a file and the rest of the line is prose; a check certifying the whole line while measuring one clause would be the decoration class",
            ),
        );
        return;
    }
}
