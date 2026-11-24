export interface UngatedRow {
    readonly id: string;
    readonly line: number;
}

const CELL = "|";

function cellsOf(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith(CELL)) return [];

    const parts = trimmed.split(CELL);
    return parts.slice(1, parts.length - 1).map((part) => part.trim());
}

function isSeparator(cells: readonly string[]): boolean {
    for (const cell of cells) {
        for (const char of cell) {
            if (char !== "-" && char !== ":" && char !== " ") return false;
        }
    }
    return cells.length > 0;
}

export function ungatedRows(source: string): UngatedRow[] {
    const lines = source.split("\n");
    const rows: UngatedRow[] = [];
    let width = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const cells = cellsOf(lines[index] ?? "");
        if (cells.length === 0) {
            width = 0;
            continue;
        }

        if (isSeparator(cells)) continue;

        if (width === 0) {
            width = cells.length;
            continue;
        }

        if (cells.length !== width) continue;

        const last = cells[cells.length - 1] ?? "";
        if (last.length > 0) continue;

        rows.push({ id: cells[0] ?? "", line: index + 1 });
    }

    return rows;
}
