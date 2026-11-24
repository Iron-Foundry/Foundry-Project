import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { authorOf, markedReaders, runMark, unmarkedReaders } from "../runners/mark.runner.ts";
import { ledgerComplete } from "../runners/sweep.runner.ts";

function ledgered(marker: string): BranchObservation {
    const source = [marker, "           To F, G — a governing change.", "           └─── END AGENT H-1"].join("\n");
    const span = { key: "H-1", agent: "H", at: 1, to: ["F", "G"], from: 0, through: 2 };
    return { complete: ledgerComplete(source, span, ["F", "G", "H"]) };
}
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";
import { positionFieldLabels } from "../validators/venue.validator.ts";

const POSITION_SCHEMA = [
    "Each position the tool posts lands inside that record as a fenced item, and carries these fields:",
    "",
    "  Position <address><n> — <one-line claim>",
    "    Axis:     <the design question this addresses>",
    "    Evidence: <observation anyone can reproduce>",
    "    Proposes: <the concrete mechanism>",
    "    Costs:    <what it makes harder>",
    "    Contradicts: <the position id this one argues against>",
    "    Signed:   <the author's own letter>",
    "",
].join("\n");

const SURFACE = "probe.board.md";

const RECORD = [
    "┌─── AGENT A ───",
    "Agent A — ACTIVE",
    "  Flags:   —",
    "           ┌─── AGENT A-1 ─── kind:judgement at:1000 to:B,C",
    "           To B AND C — a governing change every named seat must hold.",
    "           └─── END AGENT A-1",
    "└─── END AGENT A",
].join("\n");

function marking(root: string, agent: string, item: string): BranchObservation {
    const absolute = resolve(root, SURFACE);
    const outcome = runMark({ target: SURFACE, absolute, item, agent });
    const after = readSurface(absolute, "utf8");

    const marker = after.split("\n").find((line) => line.includes(`AGENT ${item} ───`)) ?? "";

    return {
        code: outcome.code,
        readers: markedReaders(marker).length,
        held: unmarkedReaders(marker, ["B", "C"], ["B", "C"]).length,
    };
}

function holding(marker: string, addressed: readonly string[], active: readonly string[]): BranchObservation {
    return { code: 0, readers: 0, held: unmarkedReaders(marker, addressed, active).length };
}

export const MARK_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "mark.runner",
        branch: "a named recipient marking its own letter, which leaves the other recipient holding the item open",
        seed: [{ path: SURFACE, text: RECORD }],
        exercise: (root) => marking(root, "B", "A-1"),
        expect: { code: 0, readers: 1, held: 1 },
    },
    {
        subject: "mark.runner",
        branch: "a party the item never addressed, whose mark would satisfy a drain for a seat never sent the change",
        seed: [{ path: SURFACE, text: RECORD }],
        exercise: (root) => marking(root, "D", "A-1"),
        expect: { code: 2, readers: 0, held: 2 },
    },
    {
        subject: "mark.runner",
        branch: "the author seeding the ledger, which records no reader and holds the item for every named recipient",
        seed: [{ path: SURFACE, text: RECORD }],
        exercise: (root) => marking(root, "A", "A-1"),
        expect: { code: 0, readers: 0, held: 2 },
    },
    {
        subject: "sweep.runner",
        branch: "a read ledger every named reader has marked, which the sweep drains without waiting on its author",
        seed: [],
        exercise: () => ledgered("           ┌─── AGENT H-1 ─── kind:judgement at:1 to:F,G read:G,F"),
        expect: { complete: true },
    },
    {
        subject: "sweep.runner",
        branch: "a read ledger one named reader has not marked, which holds the item against every other drain path",
        seed: [],
        exercise: () => ledgered("           ┌─── AGENT H-1 ─── kind:judgement at:1 to:F,G read:G"),
        expect: { complete: false },
    },
    {
        subject: "mark.runner",
        branch: "a recipient that has gone inactive, which drops out of the drain because it can no longer act",
        seed: [],
        exercise: () => holding("┌─── AGENT A-1 ─── kind:judgement at:1000 to:B,C read:B", ["B", "C"], ["B"]),
        expect: { code: 0, readers: 0, held: 0 },
    },
    {
        subject: "mark.runner",
        branch: "an item addressed to EVERY seat, whose author is not a recipient of its own delivery",
        seed: [],
        exercise: () => ({
            code: 0,
            readers: 0,
            held: unmarkedReaders("┌─── AGENT B-1 ─── kind:judgement at:1000 to:*", [], ["A", "B"], authorOf("B-1"))
                .length,
        }),
        expect: { code: 0, readers: 0, held: 1 },
    },
    {
        subject: "mark.runner",
        branch: "the same item once its one other recipient marks, which drains rather than waiting on its author",
        seed: [],
        exercise: () => ({
            code: 0,
            readers: 0,
            held: unmarkedReaders(
                "┌─── AGENT B-1 ─── kind:judgement at:1000 to:* read:A",
                [],
                ["A", "B"],
                authorOf("B-1"),
            ).length,
        }),
        expect: { code: 0, readers: 0, held: 0 },
    },
    {
        subject: "venue.validator",
        branch: "the position field labels DERIVED from the venue template's own schema block, with the signature excluded because an item on either surface carries one — so a schema gaining a field is matched with no edit to the party that reads it",
        seed: [],
        exercise: () => ({ labels: positionFieldLabels(POSITION_SCHEMA).join(",") }),
        expect: { labels: "Axis,Evidence,Proposes,Costs,Contradicts" },
    },
    {
        subject: "venue.validator",
        branch: "a template declaring no schema block, where the derivation yields nothing rather than a guessed set — a refusal keyed on an invented vocabulary would fire on whatever its author happened to imagine",
        seed: [],
        exercise: () => ({ labels: positionFieldLabels("# a template with no position schema\n").join(",") }),
        expect: { labels: "" },
    },
];
