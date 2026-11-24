import { TASK_MARKER } from "../constants/checklist.constants.ts";

export interface IdBreach {
    readonly kind: string;
    readonly line: number;
    readonly id: string;
    readonly actual: string;
    readonly expected: string;
}

export function isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
}

function idAt(line: string, from: number): string | null {
    let cursor = from;
    let parts = 0;
    let digits = 0;
    let value = "";

    while (cursor < line.length) {
        const char = line.charAt(cursor);
        if (isDigit(char)) {
            digits += 1;
            value += char;
            cursor += 1;
            continue;
        }
        if (char === "." && digits > 0 && isDigit(line.charAt(cursor + 1))) {
            parts += 1;
            digits = 0;
            value += char;
            cursor += 1;
            continue;
        }
        break;
    }

    if (digits === 0 || parts !== 2) return null;
    if (cursor < line.length && isDigit(line.charAt(cursor))) return null;

    return value;
}

export function declaredId(line: string): string | null {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith(TASK_MARKER)) return null;

    let cursor = TASK_MARKER.length;
    while (cursor < trimmed.length && trimmed.charAt(cursor) === " ") cursor += 1;

    return idAt(trimmed, cursor);
}

export function citedIds(line: string): string[] {
    const out: string[] = [];

    for (let index = 0; index < line.length; index += 1) {
        if (!isDigit(line.charAt(index))) continue;
        if (index > 0 && (isDigit(line.charAt(index - 1)) || line.charAt(index - 1) === ".")) continue;

        const id = idAt(line, index);
        if (id !== null) out.push(id);
    }

    return out;
}

const BINDING_FIELDS = ["verifier", "owner"];

function boundAgent(line: string, field: string): string | null {
    const marker = `*${field}:*`;
    const at = line.indexOf(marker);
    if (at === -1) return null;

    let cursor = at + marker.length;
    while (cursor < line.length && line.charAt(cursor) === " ") cursor += 1;

    const letter = line.charAt(cursor);
    if (letter < "A" || letter > "Z") return null;

    const after = line.charAt(cursor + 1);
    if (after !== "" && after !== " " && after !== "\r") return null;

    return letter;
}

export function agentBreaches(lines: readonly string[], active: ReadonlySet<string>): IdBreach[] {
    const out: IdBreach[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        for (const field of BINDING_FIELDS) {
            const letter = boundAgent(line, field);
            if (letter === null || active.has(letter)) continue;

            const names = `the ${field} names agent ${letter}, and no active record declares it`;
            const resolves = `a ${field} resolves to an agent the board declares ACTIVE`;
            out.push({
                kind: "danglingBinding",
                line: index + 1,
                id: `${field}:${letter}`,
                actual: names,
                expected: resolves,
            });
        }
    }

    return out;
}

const CLOSES_FIELD = "CLOSES:";

function phaseOf(id: string): number {
    const dot = id.indexOf(".");
    return dot === -1 ? Number.NaN : Number(id.slice(0, dot));
}

export function closureBreaches(lines: readonly string[]): IdBreach[] {
    let closes = "";
    let declaredAt = 0;
    const open: { id: string; line: number }[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();

        if (trimmed.startsWith(CLOSES_FIELD)) {
            closes = trimmed.slice(CLOSES_FIELD.length).trim();
            declaredAt = index + 1;
            continue;
        }

        const id = declaredId(lines[index] ?? "");
        if (id !== null) open.push({ id, line: index + 1 });
    }

    if (closes.length === 0) return [];

    const closurePhase = phaseOf(closes);
    if (Number.isNaN(closurePhase)) return [];

    const later = open.filter((task) => {
        const phase = phaseOf(task.id);
        return task.id !== closes && !Number.isNaN(phase) && phase > closurePhase;
    });

    if (later.length === 0) return [];

    return [
        {
            kind: "closureBeforeItsDependencies",
            line: declaredAt,
            id: closes,
            actual:
                `the closure row ${closes} sits in phase ${String(closurePhase)} and these open rows sit later: ` +
                later.map((task) => `${task.id} at line ${String(task.line)}`).join(", "),
            expected: `every open row sits at or before the phase of the closure row ${closes}`,
        },
    ];
}

export function idBreaches(lines: readonly string[]): IdBreach[] {
    const out: IdBreach[] = [];
    const declared = new Map<string, number>();

    for (let index = 0; index < lines.length; index += 1) {
        const id = declaredId(lines[index] ?? "");
        if (id === null) continue;

        const first = declared.get(id);
        if (first === undefined) {
            declared.set(id, index + 1);
            continue;
        }

        const twice = `${id} is declared at line ${String(first)} and again here`;
        out.push({ kind: "duplicateId", line: index + 1, id, actual: twice, expected: "one task per id" });
    }

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (declaredId(line) !== null) continue;

        for (const id of citedIds(line)) {
            if (declared.has(id)) continue;

            const cited = `${id} is cited and no task declares it`;
            const resolves = "a cited id resolves to a declared task";
            out.push({ kind: "danglingReference", line: index + 1, id, actual: cited, expected: resolves });
        }
    }

    return out;
}
