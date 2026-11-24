import {
    AGENT_FIELDS,
    AGENT_LABEL,
    ANSWER_PREFIX,
    BOARD_PATH,
    BOARD_STATES,
    CLAIM_WORDS,
    GATE_FIELDS,
} from "../constants/board.constants.ts";
import { repeatedSpan } from "../analyzers/marker.analyzer.ts";
import { activeLetters } from "../resolvers/board.resolver.ts";
import { readerSet } from "../inspectors/board.inspector.ts";
import { ACTIVE_STATE, seatState } from "../analyzers/board.analyzer.ts";
import { indexedStates } from "../inspectors/index.inspector.ts";
import type { BoardRecord } from "../analyzers/board.analyzer.ts";
import type { Finding } from "../types/segment.types.ts";

export function boardFinding(
    kind: string,
    line: number,
    locus: string,
    actual: string,
    expected: string,
    decide: string,
): Finding {
    return {
        rule: `board/${kind}`,
        path: BOARD_PATH,
        line,
        locus,
        stack: [
            { check: "board", resolved: "present" },
            { check: "record", resolved: locus },
            { check: kind, resolved: actual },
        ],
        actual,
        expected,
        remediation: { action: "declare", from: locus, to: null, target: BOARD_PATH, deterministic: false, decide },
        healed: false,
    };
}

export function addressee(record: BoardRecord): string {
    const space = record.label.indexOf(" ");
    return space === -1 ? "" : record.label.slice(space + 1);
}

export function peerSet(records: readonly BoardRecord[], index: string): ReadonlySet<string> {
    const peers = new Set<string>();
    const stateOf = seatState(index);

    for (const record of records) {
        if (record.kind !== "agent") continue;

        const letter = addressee(record);
        if (stateOf(letter, record.state) !== ACTIVE_STATE) continue;

        peers.add(letter);
    }

    return peers;
}

export function checkAnswer(record: BoardRecord, field: string, peers: ReadonlySet<string>, findings: Finding[]): void {
    const target = field.slice(ANSWER_PREFIX.length);

    if (target === addressee(record)) {
        findings.push(
            boardFinding(
                "selfAnswer",
                record.line,
                record.label,
                `${record.label} carries ${field}, which addresses itself`,
                `a directed answer field names a peer record, never ${record.label}`,
                "an answer channel exists so one agent can reply inside another's record without disturbing it; addressed at itself it carries nothing a Status line does not already hold",
            ),
        );
        return;
    }

    if (peers.has(target)) return;

    findings.push(
        boardFinding(
            "danglingAnswer",
            record.line,
            record.label,
            `${record.label} carries ${field}, and no ${AGENT_LABEL} ${target} record exists`,
            "a directed answer field names a record present on this board",
            "a channel addressed at an absent agent is answered by nobody and reads as an outstanding reply; delete the field or raise the record it names",
        ),
    );
}

export function checkRepetition(record: BoardRecord, findings: Finding[]): void {
    for (const [field, value] of record.fields) {
        const repeat = repeatedSpan(value, CLAIM_WORDS);
        if (repeat === null) continue;

        findings.push(
            boardFinding(
                "repeatedClaim",
                record.line,
                `${record.label} ${field}`,
                `${field} states one claim twice: "${repeat}"`,
                "each claim stated once, or deleted once absorbed",
                "a record that restates itself is accumulating rather than reporting; a round is written to be read once and then absorbed into a resource, a draft or a rule, and deleted here — detail belongs behind Refs, and the board carries what the other agent must act on rather than what was done",
            ),
        );
    }
}

function checkFields(record: BoardRecord, peers: ReadonlySet<string>, findings: Finding[]): void {
    const required = record.kind === "agent" ? AGENT_FIELDS : GATE_FIELDS;

    for (const field of required) {
        if (record.fields.has(field)) continue;
        findings.push(
            boardFinding(
                "missingField",
                record.line,
                record.label,
                `${record.label} omits ${field}`,
                `${record.label} carries exactly ${required.join(", ")}`,
                "each record carries exactly its fixed schema and nothing else; a removed field reads as absence, so the field is present with an explicit em dash when it has no content",
            ),
        );
    }

    for (const field of record.fields.keys()) {
        if (required.includes(field)) continue;

        if (record.kind === "agent" && field.startsWith(ANSWER_PREFIX)) {
            checkAnswer(record, field, peers, findings);
            continue;
        }

        findings.push(
            boardFinding(
                "extraField",
                record.line,
                record.label,
                `${record.label} carries ${field}, which the schema does not declare`,
                `${record.label} carries exactly ${required.join(", ")}`,
                "the board holds normalized records rather than prose; detail belongs in memory, a plan or a document reached through Refs",
            ),
        );
    }
}

function checkState(record: BoardRecord, findings: Finding[]): void {
    if (record.kind !== "gate") return;

    const state = record.fields.get("State") ?? "";
    if (BOARD_STATES.includes(state)) return;

    findings.push(
        boardFinding(
            "badState",
            record.line,
            record.label,
            `${record.label} declares State ${state}`,
            BOARD_STATES.join(" | "),
            "a gate state is one of the declared values; PENDING means unevaluated and is never a soft failure, because the board carries no warning tier either",
        ),
    );
}

export function checkRecord(record: BoardRecord, peers: ReadonlySet<string>, findings: Finding[]): void {
    checkFields(record, peers, findings);
    checkRepetition(record, findings);
    checkState(record, findings);
}

const STATE_SEPARATOR = "—";

export interface StateDrift {
    readonly letter: string;
    readonly line: number;
    readonly marker: string;
    readonly bound: string;
}

export function stateDrift(records: readonly BoardRecord[], index: string): StateDrift[] {
    const out: StateDrift[] = [];
    const bound = indexedStates(index);

    for (const record of records) {
        if (record.kind !== "agent") continue;

        const letter = addressee(record);
        const declared = bound.get(letter);
        if (declared === undefined) continue;
        if (declared === record.state) continue;

        out.push({ letter, line: record.line, marker: record.state, bound: declared });
    }

    return out;
}

export function healStateDrift(source: string, drifts: readonly StateDrift[]): string {
    const lines = source.split("\n");

    for (const drift of drifts) {
        const at = drift.line - 1;
        const line = lines[at];
        if (line === undefined) continue;

        const dash = line.indexOf(STATE_SEPARATOR);
        if (dash === -1) continue;

        lines[at] = `${line.slice(0, dash + STATE_SEPARATOR.length)} ${drift.bound}`;
    }

    return lines.join("\n");
}

export function checkStateDrift(drifts: readonly StateDrift[], findings: Finding[]): void {
    for (const drift of drifts) {
        findings.push(
            boardFinding(
                "derivedStateDrift",
                drift.line,
                `${AGENT_LABEL} ${drift.letter}`,
                `${drift.letter} declares ${drift.marker} here and ${drift.bound} where the binding is allocated`,
                `${drift.letter} carries the state its allocating surface binds`,
                "one fact declared on two surfaces has a precedence that lives only in the resolvers reading it, so the subordinate copy can be arbitrarily wrong while every derivation stays correct and no reader can see which of the two they are looking at — and it degrades to a single operand exactly where the dominant surface binds nothing, which is the case carrying the least evidence. The subordinate copy is DERIVED from the allocation rather than compared against it, which leaves one writer instead of adding a third mechanism to referee two; this heals in place, because a copy nobody may edit — its own writer stopped, and a peer is barred from the record — is otherwise a false value with no reachable repair",
            ),
        );
    }
}

export function checkAddressees(source: string, index: string, findings: Finding[]): void {
    const active = activeLetters(source, index);
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        for (const reader of readerSet(lines[index] ?? "")) {
            if (active.has(reader)) continue;

            findings.push(
                boardFinding(
                    "danglingAddressee",
                    index + 1,
                    reader,
                    `an item is addressed to ${reader}, which the board does not declare ACTIVE`,
                    "every addressee is an agent with an ACTIVE record",
                    "an item addressed to an agent that is not active has no reader and can never be handled, so it sits forever while reading as live traffic — the same shape as a row bound to an absent agent, which can be built and never retired. The roster is DERIVED: PRESENCE from the board's own records and STATE from the identity index, which is the surface a form maintains in both directions, so a seat departing through that form re-points this check on the next run with nothing to edit",
                ),
            );
        }
    }
}
