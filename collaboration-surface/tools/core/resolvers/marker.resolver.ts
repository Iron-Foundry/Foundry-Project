const HEADING_LEAD = "### ";

const BACKTICK = "`";

function isLead(candidate: string): boolean {
    if (candidate.length < 2) return false;
    if (!candidate.endsWith(":")) return false;

    for (const char of candidate.slice(0, -1)) {
        if (char < "A" || char > "Z") return false;
    }

    return true;
}

const CLASS_BOUND_MARKER = "presuppose a CLASS";

export function classBoundLeads(accumulator: string): string[] {
    const out: string[] = [];

    for (const line of accumulator.split("\n")) {
        if (line.startsWith(HEADING_LEAD)) break;
        if (!line.includes(CLASS_BOUND_MARKER)) continue;

        let cursor = 0;
        while (cursor < line.length) {
            const open = line.indexOf(BACKTICK, cursor);
            if (open === -1) break;

            const close = line.indexOf(BACKTICK, open + 1);
            if (close === -1) break;

            const candidate = line.slice(open + 1, close).trim();
            if (isLead(candidate) && !out.includes(candidate)) out.push(candidate);
            cursor = close + 1;
        }
    }

    return out;
}

export function declaredLeads(accumulator: string): string[] {
    const out: string[] = [];

    for (const line of accumulator.split("\n")) {
        if (line.startsWith(HEADING_LEAD)) break;

        let cursor = 0;
        while (cursor < line.length) {
            const open = line.indexOf(BACKTICK, cursor);
            if (open === -1) break;

            const close = line.indexOf(BACKTICK, open + 1);
            if (close === -1) break;

            const candidate = line.slice(open + 1, close).trim();
            if (isLead(candidate) && !out.includes(candidate)) out.push(candidate);
            cursor = close + 1;
        }
    }

    return out;
}
