const FENCE_MARK = "`";

const FENCE_MINIMUM = 3;

const SPAN_OPEN = "┌";

const SPAN_CLOSE = "└";

export interface ForgedBoundary {
    readonly line: number;
    readonly text: string;
}

function opensAFence(text: string): boolean {
    let run = 0;
    while (run < text.length && text.charAt(run) === FENCE_MARK) run += 1;

    return run >= FENCE_MINIMUM;
}

function opensASpan(text: string): boolean {
    return text.startsWith(SPAN_OPEN) || text.startsWith(SPAN_CLOSE);
}

export function forgedBoundaries(body: string): ForgedBoundary[] {
    const out: ForgedBoundary[] = [];
    const lines = body.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
        const text = (lines[index] ?? "").trimStart();
        if (!opensAFence(text) && !opensASpan(text)) continue;

        out.push({ line: index + 1, text: text.slice(0, 40) });
    }

    return out;
}
