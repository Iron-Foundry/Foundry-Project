import { CONTRACT_FIELDS, MILESTONE_MARKER, PHASE_MARKER, TASK_MARKER } from "../constants/checklist.constants.ts";
import { HISTORY_HEADINGS, PAST_MARKERS, STATUS_MARKERS } from "../constants/tense.constants.ts";
import { carriesMarker } from "../analyzers/marker.analyzer.ts";

export interface Counted {
    readonly milestones: number;
    readonly phases: number;
    readonly tasks: number;
}

export interface Block {
    readonly line: number;
    readonly text: string;
}

export interface Phase {
    readonly line: number;
    readonly title: string;
}

const HISTORY_MARKERS = [...PAST_MARKERS, ...STATUS_MARKERS, ...HISTORY_HEADINGS];

export function isTask(line: string): boolean {
    return line.trimStart().startsWith(TASK_MARKER);
}

export function missingFields(text: string): string[] {
    return CONTRACT_FIELDS.filter((field) => !text.includes(field));
}

export function taskBlocks(lines: readonly string[]): Block[] {
    const out: Block[] = [];
    let open: { line: number; parts: string[] } | null = null;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        if (isTask(line)) {
            if (open !== null) out.push({ line: open.line, text: open.parts.join(" ") });
            open = { line: index + 1, parts: [line.trim()] };
            continue;
        }

        if (open === null) continue;

        if (line.trim().length === 0 || !line.startsWith("  ")) {
            out.push({ line: open.line, text: open.parts.join(" ") });
            open = null;
            continue;
        }

        open.parts.push(line.trim());
    }

    if (open !== null) out.push({ line: open.line, text: open.parts.join(" ") });

    return out;
}

export function declaresContract(blocks: readonly Block[]): boolean {
    return blocks.some((block) => missingFields(block.text).length === 0);
}

export function count(lines: readonly string[]): Counted {
    let milestones = 0;
    let phases = 0;
    let tasks = 0;

    for (const line of lines) {
        if (line.startsWith(MILESTONE_MARKER)) milestones += 1;
        if (line.startsWith(PHASE_MARKER)) phases += 1;
        if (isTask(line)) tasks += 1;
    }

    return { milestones, phases, tasks };
}

export function historyIn(line: string): string | null {
    const lowered = line.toLowerCase();
    for (const marker of HISTORY_MARKERS) {
        if (carriesMarker(lowered, marker)) return marker;
    }
    return null;
}

function scaffolding(line: string, labels: readonly string[]): boolean {
    const upper = line.toUpperCase();
    for (const label of labels) {
        if (upper.includes(label)) return true;
    }
    return false;
}

export function emptyPhases(lines: readonly string[], scaffold: readonly string[] = []): Phase[] {
    const out: Phase[] = [];
    let open: Phase | null = null;
    let argued = false;

    const close = (): void => {
        if (open !== null && argued) out.push(open);
        open = null;
        argued = false;
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        if (line.startsWith(PHASE_MARKER)) {
            close();
            open = { line: index + 1, title: line.slice(PHASE_MARKER.length).trim() };
            continue;
        }

        if (open === null) continue;

        if (isTask(line)) {
            open = null;
            argued = false;
            continue;
        }

        if (line.startsWith(MILESTONE_MARKER) || line.startsWith("## ")) {
            close();
            continue;
        }

        if (line.trim().length > 0 && !scaffolding(line, scaffold)) argued = true;
    }

    close();
    return out;
}
