import { fencedFlags } from "../predicates/fence.predicate.ts";
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";

const OUTSIDE = "OUTSIDE";

const NESTED = ["````", "an outer block", "```", "an inner sample", "```", "````", OUTSIDE].join("\n");

const PLAIN = ["```", "a block", "```", OUTSIDE].join("\n");

const CARRIAGE = ["```", "a block", "```", OUTSIDE].join("\r\n");

function fencing(source: string): BranchObservation {
    const flags = fencedFlags(source);
    const lines = source.split("\n");

    let at = -1;
    for (let index = 0; index < lines.length; index += 1) {
        if (lines[index] === OUTSIDE) at = index;
    }

    return { fenced: flags[at] === true, lines: flags.length };
}

export const FENCE_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "fence.predicate",
        branch: "a longer fence enclosing a shorter one, where a prefix toggle inverts every later line",
        seed: [],
        exercise: () => fencing(NESTED),
        expect: { fenced: false, lines: 7 },
    },
    {
        subject: "fence.predicate",
        branch: "a fence closed by its own run length",
        seed: [],
        exercise: () => fencing(PLAIN),
        expect: { fenced: false, lines: 4 },
    },
    {
        subject: "fence.predicate",
        branch: "a fence closed on a line ending in a carriage return, which a checkout under line-ending conversion produces",
        seed: [],
        exercise: () => fencing(CARRIAGE),
        expect: { fenced: false, lines: 4 },
    },
];
