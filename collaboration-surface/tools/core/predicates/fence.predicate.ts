const FENCE_MARK = "`";

const FENCE_MINIMUM = 3;

const LINE_BLANKS: ReadonlySet<string> = new Set([" ", "\t", "\r"]);

function fenceRun(line: string): number {
    const text = line.trimStart();

    let run = 0;
    while (run < text.length && text.charAt(run) === FENCE_MARK) run += 1;

    return run;
}

function closesFence(line: string, opened: number): boolean {
    const run = fenceRun(line);
    if (run < opened) return false;

    const text = line.trimStart();
    for (let index = run; index < text.length; index += 1) {
        if (!LINE_BLANKS.has(text.charAt(index))) return false;
    }

    return true;
}

export function fencedFlags(source: string): boolean[] {
    const lines = source.split("\n");
    const flags: boolean[] = [];
    let opened = 0;

    for (const line of lines) {
        if (opened === 0) {
            const run = fenceRun(line);
            if (run >= FENCE_MINIMUM) {
                opened = run;
                flags.push(true);
                continue;
            }
            flags.push(false);
            continue;
        }

        flags.push(true);
        if (closesFence(line, opened)) opened = 0;
    }

    return flags;
}
