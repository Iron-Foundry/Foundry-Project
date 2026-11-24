import { readSurface } from "../readers/surface.reader.ts";

import { AT_FIELD, READ_FIELD, TO_FIELD } from "../formatters/board.formatter.ts";
import { itemSpans } from "../resolvers/sweep.resolver.ts";
import { writeSurface } from "../writers/surface.writer.ts";

export interface MarkRequest {
    readonly target: string;
    readonly absolute: string;
    readonly item: string;
    readonly agent: string;
}

export interface MarkOutcome {
    readonly code: number;
    readonly message: string;
}

export function markedReaders(marker: string): string[] {
    const at = marker.indexOf(READ_FIELD);
    if (at === -1) return [];

    const rest = marker.slice(at + READ_FIELD.length);
    let value = "";
    for (const character of rest) {
        if (character === " ") break;
        value += character;
    }

    return value.length === 0 ? [] : value.split(",");
}

function withReader(marker: string, agent: string): string {
    const readers = markedReaders(marker);
    if (readers.includes(agent)) return marker;

    const joined = [...readers, agent].join(",");
    const at = marker.indexOf(READ_FIELD);

    if (at === -1) return `${marker} ${READ_FIELD}${joined}`;

    const tail = marker.slice(at + READ_FIELD.length);
    let width = 0;
    while (width < tail.length && tail.charAt(width) !== " ") width += 1;

    return `${marker.slice(0, at)}${READ_FIELD}${joined}${tail.slice(width)}`;
}

export function runMark(request: MarkRequest): MarkOutcome {
    const source = readSurface(request.absolute, "utf8");
    const span = itemSpans(source).find((entry) => entry.key === request.item);

    if (span === undefined) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.item} resolves to no item span on ${request.target}, which is the surface this call ` +
                "SEARCHED rather than the only surface a mark can name — the target defaults to the board and any surface " +
                "carrying items takes this form, so an item living in a venue is marked by naming that venue. A MARK IS " +
                "KEYED TO THE ITEM IT RECORDS A READING OF, because the ledger lives on that item's own marker and dies " +
                "with it, which is what lets a swept surface carry per-party delivery state without becoming a surface " +
                "that TRACKS rather than removes. A REFUSAL NAMING ONE SURFACE WITHOUT SAYING ANOTHER CAN BE NAMED READS " +
                "AS A PROPERTY OF THE FORM: a caller meeting it concludes the capability is absent rather than that the " +
                "argument was, and that conclusion travels into a governing clause as a measured absence\n",
        };
    }

    if (authorOf(request.item) === request.agent) {
        const lines = source.split("\n");
        const marker = lines[span.from] ?? "";

        if (marker.includes(READ_FIELD)) {
            return {
                code: 0,
                message: `CLEAR  ${request.item} already carries its read ledger, so the author has nothing to seed\n`,
            };
        }

        lines[span.from] = `${marker} ${READ_FIELD}`;
        writeSurface(request.absolute, lines.join("\n"));

        return {
            code: 0,
            message:
                `LEDGER  seeded on ${request.item} by its author, with no reader recorded. THE AUTHOR SEEDS AND NEVER ` +
                "MARKS: a mark states delivery to a named recipient and the author is none, while the ledger's PRESENCE is " +
                "what makes the closure refuse until every named recipient has marked. Without a seed the ledger arrives " +
                "with the first recipient's mark, so a first recipient that closes instead of marking drains a governing " +
                "change for every other party it names\n",
        };
    }

    if (span.to.length > 0 && !span.to.includes(request.agent)) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.item} does not name ${request.agent} in its reader set, so this seat has nothing to ` +
                "record. A mark states DELIVERY to a named recipient; a mark by a party the item never addressed would " +
                "make the drain condition satisfiable by parties the change was never sent to\n",
        };
    }

    const lines = source.split("\n");
    const marker = lines[span.from] ?? "";

    if (markedReaders(marker).includes(request.agent)) {
        return {
            code: 0,
            message:
                `CLEAR  ${request.agent} is already marked on ${request.item}, so this records nothing new — a mark is a ` +
                "per-party fact and a second one from the same party states what the first already does\n",
        };
    }

    lines[span.from] = withReader(marker, request.agent);
    writeSurface(request.absolute, lines.join("\n"));

    return {
        code: 0,
        message:
            `MARK  ${request.agent} recorded on ${request.item}. THE LEDGER IS PER-RECIPIENT AND EACH PARTY MOVES ITS OWN ` +
            "LETTER AND NO OTHER, and its honest claim is DELIVERY rather than comprehension — whether a seat understood " +
            "what it was handed is a turn nothing observes. A GOVERNING CHANGE IS CLOSED BY ITS LAST READER RATHER THAN ITS " +
            "FIRST: an item removed by whoever reaches it first delivers itself to that party and destroys it for everyone " +
            "the change was also sent to, leaving a surface that shows a handled item, no record of who read it, and " +
            "parties running against a change they were never sent\n",
    };
}

export function healRequested(argv: readonly string[], flag: string): boolean {
    return !argv.includes(flag);
}

export function authorOf(item: string): string {
    const cut = item.indexOf("-");
    return cut <= 0 ? item : item.slice(0, cut);
}

export function unmarkedReaders(
    marker: string,
    addressed: readonly string[],
    active: readonly string[],
    author = "",
): string[] {
    const marked = markedReaders(marker);
    const named = addressed.length === 0 ? active : addressed;

    return named.filter((letter) => letter !== author && active.includes(letter) && !marked.includes(letter));
}

export function carriesLedger(marker: string): boolean {
    return marker.includes(READ_FIELD) || marker.includes(TO_FIELD) || marker.includes(AT_FIELD);
}
