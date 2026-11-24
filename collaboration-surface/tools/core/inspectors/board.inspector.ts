import { delimitersIn, unparsedDelimiters, unresolvedAddressing } from "../analyzers/board.analyzer.ts";
import { AGENT_FIELDS, GATE_FIELDS, READ_BUDGET_CHARS } from "../constants/board.constants.ts";
import { indexedLetters } from "./index.inspector.ts";
import { readBoardContract } from "../readers/board.reader.ts";
import { itemSpans } from "../resolvers/sweep.resolver.ts";
import { boardFinding } from "../validators/board.validator.ts";
import type { Finding } from "../types/segment.types.ts";

const ORDINAL_SEPARATOR = "-";

interface FenceCounts {
    opens: number;
    closes: number;
    line: number;
}

const ADDRESS_PREFIX = "To ";

const ADDRESS_TERMINATOR = "—";

const EVERYONE = "ALL";

const ROLE_PREFIX = "WHOEVER";

export function readerSet(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith(ADDRESS_PREFIX)) return [];

    const end = trimmed.indexOf(ADDRESS_TERMINATOR);
    if (end === -1) return [];

    const body = trimmed.slice(ADDRESS_PREFIX.length, end);
    if (body.includes(ROLE_PREFIX) || body.includes(EVERYONE)) return [];

    const out = new Set<string>();
    for (const part of body.split(",")) {
        for (const word of part.split(" ")) {
            const name = word.trim();
            if (name.length !== 1 || name < "A" || name > "Z") continue;
            out.add(name);
        }
    }

    return [...out];
}

export function checkIndex(
    records: readonly { kind: string; label: string; line: number }[],
    index: string,
    findings: Finding[],
): void {
    const { letters, duplicates } = indexedLetters(index);

    for (const letter of duplicates) {
        findings.push(
            boardFinding(
                "duplicateIndexBinding",
                1,
                letter,
                `the index binds ${letter} more than once`,
                `${letter} bound to exactly one role`,
                "a letter is bound to exactly one role at a time: a reissue rewrites its row in place rather than adding a second one, because two rows for one letter give every item, citation and reader set two answers for who holds it, and nothing errors",
            ),
        );
    }

    for (const record of records) {
        if (record.kind !== "agent") continue;

        const space = record.label.indexOf(" ");
        const letter = space === -1 ? record.label : record.label.slice(space + 1);
        if (letters.has(letter)) continue;

        findings.push(
            boardFinding(
                "unindexedAgent",
                record.line,
                letter,
                `${record.label} writes under a letter the index does not bind`,
                `${letter} carrying an index row before its first write`,
                "a letter is claimed by adding the index row, never by using it. Writing under an unindexed letter is the same construct as a task citing an agent the board does not declare — it reads as governed and resolves to nothing, and every citation written against it resolves to nothing too",
            ),
        );
    }
}

function drift(declared: readonly string[], derived: readonly string[], kind: string, findings: Finding[]): void {
    const held = new Set(derived);
    const missing = declared.filter((field) => !held.has(field));
    const extra = derived.filter((field) => !declared.includes(field));

    if (missing.length === 0 && extra.length === 0) return;

    findings.push(
        boardFinding(
            "templateDrift",
            1,
            kind,
            `the comms template declares ${derived.join(", ")} for a ${kind} record`,
            `${declared.join(", ")}`,
            "the template is what a new board is built FROM, so a schema transcribed in the gate and restated in the template is two copies of one contract with nothing keeping them equal — and the drift surfaces only when somebody raises a board and it fails on its first run. The checklist gate already derives its contract from its own template for exactly this reason; a board raised from a drifted template is non-conformant at birth",
        ),
    );
}

export function checkTemplateDrift(template: string, findings: Finding[]): void {
    const contract = readBoardContract(template);

    if (contract.agentFields.length > 0) drift(AGENT_FIELDS, contract.agentFields, "agent", findings);
    if (contract.gateFields.length > 0) drift(GATE_FIELDS, contract.gateFields, "gate", findings);
}

export function checkReadable(source: string, findings: Finding[]): void {
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (line.length <= READ_BUDGET_CHARS) continue;

        findings.push(
            boardFinding(
                "unreadableField",
                index + 1,
                line.slice(0, 40),
                `one field carries ${String(line.length)} characters, past what a single read can consume`,
                `no field longer than ${String(READ_BUDGET_CHARS)} characters`,
                "the board is read whole before any agent acts, and an oversized board is read in parts until it is whole — but a part is never smaller than one field, so a field past the read budget removes the last granularity the protocol has left and makes reading it whole impossible rather than merely expensive; the rule that every other board rule depends on then stops holding while every one of them still reports green",
            ),
        );
    }
}

export function checkItemAddressing(source: string, findings: Finding[]): void {
    for (const site of unresolvedAddressing(source)) {
        findings.push(
            boardFinding(
                "unresolvedAddressing",
                site.line,
                site.opener,
                "an item names an addressee in its text while its metadata resolved to everyone",
                "the metadata carries the letters the text names",
                "the sweep closes an item once every ADDRESSEE has posted later than it, so an item whose addressing failed to parse is addressed to everyone and is swept by nobody — it accumulates while looking correctly filed. The failure is silent in the direction that costs most: the writer sees their item land, the reader still receives it, and only the automatic drain quietly stops applying. A parser that rejects the punctuation every writer actually uses degrades to broadcast rather than erroring, which is why the construct is checked on the surface instead of trusted at the tool",
            ),
        );
    }
}

interface RecordSpan {
    readonly agent: string;
    readonly from: number;
    readonly through: number;
}

function recordSpans(source: string): RecordSpan[] {
    const opens = new Map<string, number>();
    const counted = new Map<string, number>();
    const out: RecordSpan[] = [];

    for (const mark of delimitersIn(source)) {
        if (mark.agent.includes(ORDINAL_SEPARATOR)) continue;

        counted.set(mark.agent, (counted.get(mark.agent) ?? 0) + 1);

        if (mark.open) {
            opens.set(mark.agent, mark.line);
            continue;
        }

        const from = opens.get(mark.agent);
        if (from === undefined) continue;

        opens.delete(mark.agent);
        out.push({ agent: mark.agent, from, through: mark.line });
    }

    return out.filter((span) => counted.get(span.agent) === 2);
}

export function checkItemLetters(source: string, findings: Finding[]): void {
    const records = recordSpans(source);

    for (const item of itemSpans(source)) {
        const line = item.from + 1;

        const holder = records.find((record) => record.from < line && record.through > line);
        if (holder === undefined) continue;
        if (holder.agent === item.agent) continue;

        findings.push(
            boardFinding(
                "foreignItemLetter",
                line,
                item.key,
                `item ${item.key} sits inside the record of ${holder.agent}, so its key letter and its holder disagree`,
                `item ${item.key} sits inside the record of ${item.agent}`,
                "one writer per record and one letter per item are the same claim read from two operands, and NOTHING COMPARES THEM — the fence-pair check counts each key's own markers and passes a perfectly formed item wherever it happens to sit, while the interleaving check matches a foreign FENCE and an item fence is not foreign to itself. So an item written into a peer's record is well-formed by both, and every mechanism keyed on the letter then reads a different answer depending on which operand it took: the drain resolves the item by its own key and finds it, the record owner reads it as content of their block and may not remove it, and an anchored edit on the holder's span covers text the holder never wrote. Move the item into the record its key names, or reopen it under the letter whose record it sits in — the two operands are both cheap to change and only their AGREEMENT is load-bearing. THIS DOES NOT REACH FOREIGN PROSE: text written into a peer's record with no fence at all carries no letter to compare, so it is invisible to this check and to every other, which is the reason the item mechanism needs a fence rather than a convention",
            ),
        );
    }
}

export function checkOrphanDelimiters(
    source: string,
    records: readonly { kind: string; label: string }[],
    findings: Finding[],
): void {
    const decide =
        "a delimiter is the anchor every span operation keys on, so one that belongs to no record is read by the " +
        "readers that honour fences and resolved by none of them — a record form placing its write after the last " +
        "close it finds lands beside a close that ends nothing, and a peer copying the surface as a seed copies an " +
        "anchor that points at no span. Remove the line, or complete the record it was meant to close";

    for (const line of unparsedDelimiters(source)) {
        findings.push(
            boardFinding(
                "orphanDelimiter",
                line,
                `line ${String(line)}`,
                `an unfenced record delimiter at line ${String(line)} names no letter`,
                "every unfenced delimiter names the letter of the record or item it bounds",
                decide,
            ),
        );
    }

    const seated = new Set(
        records
            .filter((record) => record.kind === "agent")
            .map((record) => record.label.slice(record.label.indexOf(" ") + 1)),
    );

    for (const mark of delimitersIn(source)) {
        if (mark.agent.includes(ORDINAL_SEPARATOR)) continue;
        if (seated.has(mark.agent)) continue;

        findings.push(
            boardFinding(
                "orphanDelimiter",
                mark.line,
                mark.agent,
                `a record delimiter for ${mark.agent} bounds no record carrying that letter`,
                `an Agent ${mark.agent} heading between the delimiters for ${mark.agent}`,
                decide,
            ),
        );
    }
}

export function checkItemFences(source: string, findings: Finding[]): void {
    const seen = new Map<string, FenceCounts>();

    for (const span of itemSpans(source)) {
        if (span.at !== 0) continue;

        findings.push(
            boardFinding(
                "unstampedItem",
                span.from + 1,
                span.key,
                `item ${span.key} carries no allocated stamp`,
                `item ${span.key} opened by the tool, which allocates the stamp`,
                "the auto-sweep keys an item by the stamp the tool allocates, so a hand-opened fence is one the sweep can never take — and a hand edit is the sanctioned fallback when the tool is down, which makes that fallback a residue generator on the surface the tool exists to keep clean. The item is not stranded: a handler still drops it by id with an extraction, and this finding is what makes the explicit drain necessary rather than optional",
            ),
        );
    }

    for (const mark of delimitersIn(source)) {
        if (!mark.agent.includes(ORDINAL_SEPARATOR)) continue;

        const held = seen.get(mark.agent) ?? { opens: 0, closes: 0, line: mark.line };
        if (mark.open) held.opens += 1;
        else held.closes += 1;
        seen.set(mark.agent, held);
    }

    for (const [key, counts] of seen) {
        if (counts.opens === 1 && counts.closes === 1) continue;

        findings.push(
            boardFinding(
                "malformedItemFence",
                counts.line,
                key,
                `item ${key} carries ${String(counts.opens)} open and ${String(counts.closes)} close markers`,
                `item ${key} carries exactly one of each`,
                "the span tool returns a span only when exactly one open and one close exist for a key, so a duplicated or unclosed item fence makes that item permanently unremovable BY TOOL — and the repair is manual, on the one surface the item mechanism exists to stop repairing by hand. At item granularity there are roughly ten times as many fences as at record level, so the failure that never mattered before becomes the common one",
            ),
        );
    }
}
