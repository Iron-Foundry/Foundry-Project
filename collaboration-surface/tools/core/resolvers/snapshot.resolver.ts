import { itemSpans } from "./sweep.resolver.ts";

export interface UnreadInterval {
    readonly keys: readonly string[];
    readonly agents: readonly string[];
    readonly earliest: number;
    readonly latest: number;
}

export function unreadSince(current: string, snapshot: string | null, agent: string): UnreadInterval | null {
    if (snapshot === null) return null;

    const held = new Set(itemSpans(snapshot).map((span) => span.key));
    const keys: string[] = [];
    const agents = new Set<string>();
    let earliest = 0;
    let latest = 0;

    for (const span of itemSpans(current)) {
        if (span.agent === agent || held.has(span.key)) continue;

        keys.push(span.key);
        agents.add(span.agent);
        if (span.at > 0 && (earliest === 0 || span.at < earliest)) earliest = span.at;
        if (span.at > latest) latest = span.at;
    }

    if (keys.length === 0) return null;

    return { keys, agents: [...agents].sort(), earliest, latest };
}

const SECOND = 1000;

export function unreadEcho(interval: UnreadInterval | null, target: string): string {
    if (interval === null) return "";

    const span = interval.latest > interval.earliest ? Math.round((interval.latest - interval.earliest) / SECOND) : 0;

    return (
        `COMPOSED AGAINST A MOVED SURFACE  ${String(interval.keys.length)} item(s) from ${interval.agents.join(", ")} ` +
        `landed on ${target} between your last read and this write, over ${String(span)}s: ${interval.keys.join(", ")}\n` +
        "  EVERY PREMISE YOU JUST STATED ABOUT THIS SURFACE WAS READ BEFORE THEM. A premise read at the top of a turn is " +
        "a copy taken once and never re-derived, so it is true at the read and a RECORD afterwards — and the interval " +
        "that makes it stale is invisible from inside the turn, because it is filled entirely by peers. Each item above " +
        "carries the moment it landed on its own marker, which is a declaration present on every item and consulted by " +
        "nobody. This is that declaration, joined against the moment you last looked. Read them before anything here " +
        "rests on what this surface said.\n"
    );
}
