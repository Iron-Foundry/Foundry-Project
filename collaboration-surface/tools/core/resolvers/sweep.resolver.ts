import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { surfacePrefix } from "../../../config/surface.config.ts";
import { AT_FIELD, TO_FIELD } from "../formatters/board.formatter.ts";
import { fencedFlags } from "../predicates/fence.predicate.ts";

const SEPARATOR = "\\";

const CANONICAL_SEPARATOR = "/";

export function surfaceEntries(repoRoot: string): string[] {
    const prefix = surfacePrefix();
    const root = resolve(repoRoot, prefix);
    if (!existsSync(root)) return [];

    return readdirSync(root, { recursive: true, encoding: "utf8" }).map((entry) =>
        prefix.length === 0 ? entry : `${prefix}${CANONICAL_SEPARATOR}${entry}`,
    );
}

export function openVenues(entries: readonly string[], archiveRoot: string, suffix: string): string[] {
    return entries
        .map((entry) => entry.split(SEPARATOR).join(CANONICAL_SEPARATOR))
        .filter((entry) => entry.endsWith(suffix))
        .filter((entry) => !entry.startsWith(archiveRoot));
}

export interface ItemSpan {
    readonly key: string;
    readonly agent: string;
    readonly at: number;
    readonly to: readonly string[];
    readonly from: number;
    readonly through: number;
}

const OPEN = "┌─── AGENT ";

const CLOSE = "└─── END AGENT ";

const EVERYONE = "*";

function fieldOf(line: string, field: string): string {
    const at = line.indexOf(field);
    if (at === -1) return "";

    const rest = line.slice(at + field.length);
    const end = rest.indexOf(" ");
    return end === -1 ? rest.trim() : rest.slice(0, end).trim();
}

function keyOf(line: string, marker: string): string {
    const at = line.indexOf(marker);
    if (at === -1) return "";

    const rest = line.slice(at + marker.length).trim();
    const end = rest.indexOf(" ");
    return end === -1 ? rest : rest.slice(0, end);
}

export function itemSpans(source: string): ItemSpan[] {
    const lines = source.split("\n");
    const out: ItemSpan[] = [];
    const fenced = fencedFlags(source);
    const open = new Map<string, { at: number; to: string[]; from: number }>();

    for (let index = 0; index < lines.length; index += 1) {
        if (fenced[index] === true) continue;
        const line = lines[index] ?? "";
        const trimmed = line.trim();

        if (trimmed.startsWith(OPEN)) {
            const key = keyOf(trimmed, OPEN);
            if (!key.includes("-")) continue;

            const stamp = Number(fieldOf(trimmed, AT_FIELD));
            const to = fieldOf(trimmed, TO_FIELD);
            open.set(key, {
                at: Number.isFinite(stamp) ? stamp : 0,
                to: to.length === 0 || to === EVERYONE ? [] : to.split(","),
                from: index,
            });
            continue;
        }

        if (!trimmed.startsWith(CLOSE)) continue;

        const key = keyOf(trimmed, CLOSE);
        const held = open.get(key);
        if (held === undefined) continue;

        open.delete(key);
        out.push({
            key,
            agent: key.slice(0, key.indexOf("-")),
            at: held.at,
            to: held.to,
            from: held.from,
            through: index,
        });
    }

    return out;
}

export function seenItems(spans: readonly ItemSpan[]): ItemSpan[] {
    const latest = new Map<string, number>();
    for (const span of spans) {
        const held = latest.get(span.agent) ?? 0;
        if (span.at > held) latest.set(span.agent, span.at);
    }

    return spans.filter((span) => {
        if (span.at === 0 || span.to.length === 0) return false;
        return span.to.every((reader) => (latest.get(reader) ?? 0) > span.at);
    });
}

export function spanText(source: string, span: ItemSpan): string {
    return source
        .split("\n")
        .slice(span.from, span.through + 1)
        .join("\n");
}

export function withoutSpans(source: string, spans: readonly ItemSpan[]): string {
    const dropped = new Set<number>();
    for (const span of spans) {
        for (let line = span.from; line <= span.through; line += 1) dropped.add(line);
    }

    return source
        .split("\n")
        .filter((_line, index) => !dropped.has(index))
        .join("\n");
}

function bodyOf(lines: readonly string[], from: number, through: number): string {
    const out: string[] = [];
    for (let index = from; index <= through && index < lines.length; index += 1) {
        const line = (lines[index] ?? "").trim();
        if (line.startsWith(OPEN) || line.startsWith(CLOSE)) continue;
        if (line.length > 0) out.push(line);
    }
    return out.join("\n");
}

export function duplicateTwinOf(source: string, key: string): string | null {
    const lines = source.split("\n");
    const spans = itemSpans(source);

    const target = spans.find((span) => span.key === key);
    if (target === undefined) return null;

    const body = bodyOf(lines, target.from, target.through);
    if (body.length === 0) return null;

    for (const span of spans) {
        if (span.key === key) continue;
        if (span.agent !== target.agent) continue;
        if (bodyOf(lines, span.from, span.through) !== body) continue;
        return span.key;
    }

    return null;
}
