import { slotText } from "../../../config/surface.config.ts";
import { ENTRY_PATH } from "../constants/manifest.constants.ts";
import { writeRepair } from "../writers/repair.writer.ts";

const LEAD: ReadonlyArray<readonly [string, string]> = [
    ["overview", "Purpose"],
    ["whenToUse", "When to use"],
    ["whenNotToUse", "When NOT to use"],
    ["install", "Install"],
    ["quickStart", "Quick start"],
    ["api", "API"],
    ["configuration", "Configuration"],
    ["aiContext", "AI context"],
    ["disposal", "Disposal"],
];

const PAIR_KEYS = ["option", "note"];

const FENCE = "```";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
}

function titleCase(key: string): string {
    return key
        .split("-")
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(" ");
}

function isPair(entry: Record<string, unknown>): boolean {
    const keys = Object.keys(entry);
    return keys.length === PAIR_KEYS.length && PAIR_KEYS.every((key) => keys.includes(key));
}

function renderRecords(entries: readonly Record<string, unknown>[]): string[] {
    const out: string[] = [];

    for (const entry of entries) {
        if (typeof entry["code"] === "string") {
            if (typeof entry["intent"] === "string") out.push(entry["intent"], "");
            out.push(`${FENCE}${textOf(entry["lang"] ?? "")}`, entry["code"], FENCE, "");
            continue;
        }

        if (isPair(entry)) {
            out.push(`- \`${textOf(entry["option"])}\` — ${textOf(entry["note"])}`);
            continue;
        }

        for (const [key, value] of Object.entries(entry)) out.push(`- **${key}**: ${textOf(value)}`);
        out.push("");
    }

    while (out.at(-1) === "") out.pop();
    return out;
}

function renderValue(value: unknown): string[] {
    if (typeof value === "string") return value.split("\n");
    if (!Array.isArray(value) || value.length === 0) return [];

    if (value.every((entry) => typeof entry === "string")) return value.map((entry) => `- ${String(entry)}`);
    if (value.every(isRecord)) return renderRecords(value);

    return value.map((entry) => `- ${textOf(entry)}`);
}

function section(out: string[], heading: string, value: unknown): void {
    const body = renderValue(value);
    if (body.length === 0) return;
    out.push(`## ${heading}`, "", ...body, "");
}

function listed(value: unknown, format: (entry: unknown) => string): string[] {
    return Array.isArray(value) ? value.map((entry) => `- ${format(entry)}`) : [];
}

function domainLine(entry: unknown): string {
    if (!isRecord(entry)) return textOf(entry);
    return `**${textOf(entry["meta"])}** — ${textOf(entry["sub"])}`;
}

export function renderEntry(source: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        return null;
    }
    if (!isRecord(parsed)) return null;

    const docs = isRecord(parsed["docs"]) ? parsed["docs"] : {};
    const governance = isRecord(parsed["governance"]) ? parsed["governance"] : {};
    const lead = new Set(LEAD.map(([key]) => key));

    const out: string[] = [
        `<!-- GENERATED from ${slotText("surface", "manifest")} by this package's pipeline. Edit the manifest, never this file. -->`,
        "",
        `# ${textOf(parsed["label"] ?? "")}`,
        "",
    ];

    if (typeof parsed["summary"] === "string") out.push(parsed["summary"], "");

    for (const [key, heading] of LEAD) section(out, heading, docs[key]);
    for (const key of Object.keys(docs)) {
        if (!lead.has(key)) section(out, titleCase(key), docs[key]);
    }

    const metadata: ReadonlyArray<readonly [string, string[]]> = [
        ["Capabilities", listed(parsed["capabilities"], (entry) => `\`${textOf(entry)}\``)],
        ["Domains", listed(parsed["domains"], domainLine)],
        ["Architecture principles", listed(governance["principles"], (entry) => `\`${textOf(entry)}\``)],
        ["Quality concepts", listed(parsed["governedBy"], (entry) => `\`${textOf(entry)}\``)],
    ];
    for (const [heading, body] of metadata) {
        if (body.length > 0) out.push(`## ${heading}`, "", ...body, "");
    }

    while (out.at(-1) === "") out.pop();
    return `${out.join("\n")}\n`;
}

export function writeEntry(repoRoot: string, rendered: string): string | null {
    return writeRepair({ repoRoot, declared: "" }, ENTRY_PATH, rendered).refusal;
}
