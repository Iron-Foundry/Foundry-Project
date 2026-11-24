import {
    AGENT_FIELDS,
    AGENT_INDEX,
    BOARD_PATH,
    COMMS_TEMPLATE,
    GATE_FIELDS,
    PROJECTION_HOST,
    STALE_MARKERS,
} from "../core/constants/board.constants.ts";
import { BLOCKING_SUFFIX, VENUE_ARCHIVE } from "../core/constants/blocking.constants.ts";
import { checkProjection } from "../core/inspectors/projection.inspector.ts";
import { checkGateState } from "../core/inspectors/report.inspector.ts";
import { boardRecords, delimitersIn } from "../core/analyzers/board.analyzer.ts";
import type { BoardRecord } from "../core/analyzers/board.analyzer.ts";
import { carriesMarker } from "../core/analyzers/marker.analyzer.ts";
import {
    checkIndex,
    checkItemAddressing,
    checkItemFences,
    checkItemLetters,
    checkOrphanDelimiters,
    checkReadable,
    checkTemplateDrift,
} from "../core/inspectors/board.inspector.ts";
import {
    boardFinding,
    checkAddressees,
    checkRecord,
    checkStateDrift,
    healStateDrift,
    peerSet,
    stateDrift,
} from "../core/validators/board.validator.ts";
import { writeBoardIfUnmoved } from "../core/generators/board.generator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function checkDuplicateFields(source: string, records: readonly BoardRecord[], findings: Finding[]): void {
    const lines = source.split("\n");
    const starts = records.map((record) => record.line);

    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record === undefined) continue;

        const required = record.kind === "agent" ? AGENT_FIELDS : GATE_FIELDS;
        const end = starts[index + 1] ?? lines.length + 1;
        const seen = new Map<string, number>();

        for (let cursor = record.line; cursor < end - 1; cursor += 1) {
            const line = lines[cursor] ?? "";
            for (const field of required) {
                if (!line.startsWith(`  ${field}:`)) continue;
                seen.set(field, (seen.get(field) ?? 0) + 1);
            }
        }

        for (const [field, count] of seen) {
            if (count < 2) continue;
            findings.push(
                boardFinding(
                    "duplicateField",
                    record.line,
                    record.label,
                    `${record.label} declares ${field} ${String(count)} times`,
                    `${record.label} declares ${field} once`,
                    "a record carries exactly its fixed schema, and a field parsed into a map collapses its duplicates into one entry — so a second declaration of the same field is invisible to every check that reads the parsed record, while a reader sees two fields disagreeing about one thing",
                ),
            );
        }
    }
}

function checkMarkers(source: string, findings: Finding[]): void {
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        const colon = line.indexOf(":");
        const value = colon === -1 ? line.trim() : line.slice(colon + 1).trim();
        const first = value.split(" ")[0] ?? "";

        for (const marker of STALE_MARKERS) {
            if (first !== marker) continue;
            if (!carriesMarker(line, marker)) continue;

            findings.push(
                boardFinding(
                    "staleMarker",
                    index + 1,
                    marker,
                    `the board carries the marker ${marker}`,
                    "current truth only",
                    "the board is overwritten in place; a resolved flag or completed unit is deleted outright, because a stale record manufactures a false belief in every agent that reads it",
                ),
            );
        }
    }
}

function checkDelimiters(source: string, records: readonly BoardRecord[], findings: Finding[]): void {
    const markers = delimitersIn(source);

    for (const record of records) {
        if (record.kind !== "agent") continue;

        const space = record.label.indexOf(" ");
        const agent = space === -1 ? record.label : record.label.slice(space + 1);

        const opens = markers.filter((mark) => mark.open && mark.agent === agent);
        const closes = markers.filter((mark) => !mark.open && mark.agent === agent);

        const open = opens[0];
        const close = closes[0];
        const enclosed =
            opens.length === 1 &&
            closes.length === 1 &&
            open !== undefined &&
            close !== undefined &&
            open.line < record.line &&
            close.line > record.line;

        if (enclosed) {
            const intruder = markers.find(
                (mark) =>
                    mark.agent !== agent &&
                    !mark.agent.startsWith(`${agent}-`) &&
                    mark.line > open.line &&
                    mark.line < close.line,
            );
            if (intruder === undefined) continue;

            findings.push(
                boardFinding(
                    "interleavedRecord",
                    intruder.line,
                    record.label,
                    `a delimiter for ${intruder.agent} falls inside the fence of ${record.label}`,
                    `every marker between lines ${String(open.line)} and ${String(close.line)} belongs to ${agent}`,
                    "a fence that encloses another agent's fence passes the pair check while defeating its purpose: an edit anchored on the outer fence spans the inner agent's content, which is exactly the destruction the fence exists to prevent, and both records read as correctly delimited while one sits inside the other",
                ),
            );
            continue;
        }

        findings.push(
            boardFinding(
                "undelimitedRecord",
                record.line,
                record.label,
                `${record.label} is not enclosed by a matched delimiter pair`,
                `┌─── AGENT ${agent} above the record and └─── END AGENT ${agent} below it`,
                "an undelimited record has no anchor unique to its own writer, so a neighbour revising their block has nothing to edit against and reaches for a whole-file write instead — which succeeds, reports success to the one who overwrote, and says nothing to the one overwritten",
            ),
        );
    }
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant: "the coordination board carries current truth in exactly its declared schema",
    extensions: [],
    kinds: [
        "badState",
        "danglingAddressee",
        "danglingAnswer",
        "derivedStateDrift",
        "duplicateField",
        "duplicateIndexBinding",
        "extraField",
        "foreignItemLetter",
        "interleavedRecord",
        "malformedItemFence",
        "missingField",
        "orphanDelimiter",
        "oversizedProjection",
        "phantomProjection",
        "repeatedClaim",
        "selfAnswer",
        "staleGateState",
        "staleMarker",
        "templateDrift",
        "undelimitedRecord",
        "unindexedAgent",
        "unreadableField",
        "unresolvedAddressing",
        "unstampedItem",
    ],
    heals: true,

    reads:
        PROJECTION_HOST === null
            ? [BOARD_PATH, AGENT_INDEX, COMMS_TEMPLATE]
            : [BOARD_PATH, PROJECTION_HOST, AGENT_INDEX, COMMS_TEMPLATE],

    check(context: RuleContext, fix: boolean): RuleResult {
        if (!context.paths.includes(BOARD_PATH)) {
            return { findings: [], healed: [], derivations: { board: "absent" } };
        }

        const source = context.read(BOARD_PATH);
        const findings: Finding[] = [];
        const healed: string[] = [];
        const records = boardRecords(source);

        const drifts = stateDrift(records, context.exists(AGENT_INDEX) ? context.read(AGENT_INDEX) : "");
        let driftDisposition = "none — no record's marker disagrees with its binding";
        if (drifts.length > 0) {
            const applied = fix && writeBoardIfUnmoved(context.repoRoot, source, healStateDrift(source, drifts));
            if (applied) healed.push(BOARD_PATH);
            else checkStateDrift(drifts, findings);
            driftDisposition = applied
                ? "HEALED IN THIS RUN — the markers below are what the walk MEASURED before it wrote, retained because " +
                  "the heal is a comparison and the earlier state is its operand. They are not a live disagreement, " +
                  "and reading them as current state is the reading a derivation invites, which is why the " +
                  "disposition sits beside them rather than being inferred from an empty findings list"
                : "STANDING — the markers below disagree with their bindings and this run did not write, so each is " +
                  "reported as a finding";
        }

        const venues = context.paths
            .filter((path) => path.endsWith(BLOCKING_SUFFIX))
            .filter((path) => !path.startsWith(VENUE_ARCHIVE));
        const host = PROJECTION_HOST;
        const projected = host !== null && context.exists(host);
        if (host !== null && projected) checkProjection(context.read(host), venues, findings);

        const peers = peerSet(records, context.exists(AGENT_INDEX) ? context.read(AGENT_INDEX) : "");
        for (const record of records) checkRecord(record, peers, findings);

        checkDelimiters(source, records, findings);
        checkOrphanDelimiters(source, records, findings);
        checkMarkers(source, findings);
        checkReadable(source, findings);
        checkDuplicateFields(source, records, findings);
        checkItemFences(source, findings);
        checkItemLetters(source, findings);
        checkItemAddressing(source, findings);
        checkGateState(source, context.repoRoot, findings);
        checkAddressees(source, context.exists(AGENT_INDEX) ? context.read(AGENT_INDEX) : "", findings);
        if (context.exists(AGENT_INDEX)) checkIndex(records, context.read(AGENT_INDEX), findings);
        if (context.exists(COMMS_TEMPLATE)) checkTemplateDrift(context.read(COMMS_TEMPLATE), findings);

        return {
            findings,
            healed,
            derivations: {
                board: "present",
                recordsWalked: records.map((record) => record.label),
                stateDrift: drifts.map((drift) => `${drift.letter}: ${drift.marker} here, ${drift.bound} bound`),
                stateDriftDisposition: driftDisposition,
                venuesSeen: venues,
                projection: projected
                    ? "checked"
                    : "ABSENT — no governance document is declared, so the branch that checks the projection does not run",
            },
        };
    },
};
