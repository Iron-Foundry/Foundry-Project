const CONTEXT_CAP = 400;

function counted(lines: readonly string[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const line of lines) out.set(line, (out.get(line) ?? 0) + 1);
    return out;
}

export function diffLines(before: string, after: string): string[] {
    const was = before.split("\n");
    const now = after.split("\n");

    const heldBefore = counted(was);
    const heldAfter = counted(now);

    const added: string[] = [];
    const removed: string[] = [];

    for (const line of now) {
        if (line.trim().length === 0) continue;
        const spare = heldAfter.get(line) ?? 0;
        if ((heldBefore.get(line) ?? 0) >= spare) continue;
        heldAfter.set(line, spare - 1);
        added.push(line);
    }

    for (const line of was) {
        if (line.trim().length === 0) continue;
        const spare = heldBefore.get(line) ?? 0;
        if ((heldAfter.get(line) ?? 0) >= spare) continue;
        heldBefore.set(line, spare - 1);
        removed.push(line);
    }

    const out: string[] = [];
    for (const line of removed) out.push(`- ${line.trim().slice(0, CONTEXT_CAP)}`);
    for (const line of added) out.push(`+ ${line.trim().slice(0, CONTEXT_CAP)}`);

    return out;
}
