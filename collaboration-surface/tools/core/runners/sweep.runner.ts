import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readSurface } from "../readers/surface.reader.ts";
import { appendSurface, writeSurface } from "../writers/surface.writer.ts";

import { surfacePath } from "../../../config/surface.config.ts";
import { activeSeats } from "../analyzers/board.analyzer.ts";
import { READ_FIELD } from "../formatters/board.formatter.ts";
import { wasDelivered } from "../registries/snapshot.registry.ts";
import { itemSpans, seenItems, spanText, withoutSpans, type ItemSpan } from "../resolvers/sweep.resolver.ts";
import { authorOf, unmarkedReaders } from "./mark.runner.ts";

function ledgerOf(source: string, span: ItemSpan): string | null {
    const marker = source.split("\n")[span.from] ?? "";
    return marker.includes(READ_FIELD) ? marker : null;
}

export function ledgerComplete(source: string, span: ItemSpan, active: readonly string[]): boolean {
    const marker = ledgerOf(source, span);
    if (marker === null) return false;

    return unmarkedReaders(marker, span.to, active, authorOf(span.key)).length === 0;
}

const HEADING = "\n## board sweep: items every addressee has written past\n\n";

export interface SweepOutcome {
    readonly swept: readonly string[];
    readonly message: string;
}

export function runSweep(repoRoot: string, absolute: string, archive: string): SweepOutcome {
    if (!existsSync(absolute)) return { swept: [], message: "" };

    const before = readSurface(absolute, "utf8");
    const spans = itemSpans(before);

    const index = resolve(repoRoot, surfacePath("agent_index"));
    const active = activeSeats(before, existsSync(index) ? readSurface(index, "utf8") : "");
    const marked = spans.filter((span) => ledgerComplete(before, span, active));

    const written = seenItems(spans).filter((span) => ledgerOf(before, span) === null);
    if (written.length === 0 && marked.length === 0) return { swept: [], message: "" };

    const held: string[] = [];
    const seen: ItemSpan[] = [...marked];

    for (const span of written) {
        const unread = span.to.filter((reader) => !wasDelivered(repoRoot, reader, span.key));
        if (unread.length === 0) {
            seen.push(span);
            continue;
        }
        held.push(`${span.key} → ${unread.join(", ")}`);
    }

    const holdNote =
        held.length === 0
            ? ""
            : `SWEEP HELD  ${String(held.length)} item(s) stand because an addressee has not been handed them: ${held.join(
                  "; ",
              )}. The write-past rule says the addressee wrote AFTER the item, which is a fact about their WRITING and never about their READING — durability and delivery are independent, and archiving an item nobody received preserves the first while destroying the second\n`;

    if (seen.length === 0) return { swept: [], message: holdNote };

    const entries = seen.map(
        (span) =>
            `\n### ${span.key} — to ${span.to.join(", ")} · ${
                marked.includes(span)
                    ? "every named reader marked its read ledger"
                    : "every addressee was handed this item in a delivered read"
            }\n\n${spanText(before, span)}\n`,
    );

    const target = resolve(repoRoot, archive);
    appendSurface(target, existsSync(target) ? entries.join("") : `${HEADING}${entries.join("")}`);

    const witness = readSurface(absolute, "utf8");
    if (witness !== before)
        return { swept: [], message: "SWEEP HELD  the board moved during the sweep; nothing removed\n" };

    writeSurface(absolute, withoutSpans(before, seen));

    return {
        swept: seen.map((span) => span.key),
        message: `${holdNote}SWEPT  ${String(seen.length)} item(s) extracted whole: ${seen
            .map((span) => `${span.key} (${marked.includes(span) ? "read ledger complete" : "delivered to every addressee"})`)
            .join(", ")}\n`,
    };
}
