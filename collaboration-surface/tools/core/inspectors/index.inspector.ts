const ROW = "| ";

const ACTIVE_STATE = "ACTIVE";

function cellsOf(line: string): string[] {
    return line.split("|");
}

export function activeSeatLetters(index: string): string[] {
    const out: string[] = [];

    for (const line of index.split("\n")) {
        if (!line.startsWith(ROW)) continue;

        const cells = cellsOf(line);
        const letter = (cells[1] ?? "").trim();
        if (letter.length !== 1 || letter < "A" || letter > "Z") continue;
        if ((cells[3] ?? "").trim() !== ACTIVE_STATE) continue;

        out.push(letter);
    }

    return out;
}

export function indexedStates(index: string): Map<string, string> {
    const out = new Map<string, string>();

    for (const line of index.split("\n")) {
        if (!line.startsWith(ROW)) continue;

        const cells = cellsOf(line);
        const letter = (cells[1] ?? "").trim();
        if (letter.length !== 1 || letter < "A" || letter > "Z") continue;

        const state = (cells[3] ?? "").trim();
        if (state.length === 0) continue;

        out.set(letter, state);
    }

    return out;
}

export function indexedLetters(index: string): { letters: Set<string>; duplicates: string[] } {
    const letters = new Set<string>();
    const duplicates: string[] = [];

    for (const line of index.split("\n")) {
        if (!line.startsWith(ROW)) continue;

        const letter = (cellsOf(line)[1] ?? "").trim();
        if (letter.length === 0 || letter === "letter") continue;
        if (letter.charAt(0) < "A" || letter.charAt(0) > "Z") continue;

        if (letters.has(letter)) duplicates.push(letter);
        letters.add(letter);
    }

    return { letters, duplicates };
}
