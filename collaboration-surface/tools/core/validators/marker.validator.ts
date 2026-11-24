import { fencedFlags } from "../predicates/fence.predicate.ts";

const HEADING_LEAD = "### ";

const ENTRIES_RULE = "ENTRIES";

const INSTANCES_RULE = "INSTANCES";

export interface UnboundedEntry {
    readonly heading: string;
    readonly line: number;
}

export function isClassHeading(heading: string): boolean {
    if (heading.length === 0) return false;

    for (const char of heading) {
        const lower = char >= "a" && char <= "z";
        const digit = char >= "0" && char <= "9";
        if (!lower && !digit && char !== "-") return false;
    }

    return true;
}

export function unboundedEntries(accumulator: string, lead: string, classBound = false): UnboundedEntry[] {
    if (lead.length === 0) return [];

    const lines = accumulator.split("\n");
    const fenced = fencedFlags(accumulator);
    const out: UnboundedEntry[] = [];

    let heading = "";
    let line = 0;
    let bounded = false;
    let instances = false;
    let started = false;

    const close = (): void => {
        if (heading.length === 0 || bounded) return;
        if (classBound && instances) return;
        out.push({ heading, line });
    };

    for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index] ?? "";

        if (!started) {
            if (text.includes(ENTRIES_RULE)) started = true;
            continue;
        }

        if (text.startsWith(HEADING_LEAD)) {
            close();
            const next = text.slice(HEADING_LEAD.length).trim();
            heading = isClassHeading(next) ? next : "";
            line = index + 1;
            bounded = false;
            instances = false;
            continue;
        }

        if (fenced[index] === true) continue;
        if (text.includes(INSTANCES_RULE)) instances = true;
        if (text.trimStart().startsWith(lead)) bounded = true;
    }

    close();

    return out;
}
