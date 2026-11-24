import { MILESTONE_MARKER, PHASE_MARKER } from "../constants/checklist.constants.ts";

export interface PhaseSpan {
    readonly title: string;
    readonly line: number;
    readonly text: string;
    readonly band: string;
}

export function phaseSpans(lines: readonly string[]): PhaseSpan[] {
    const out: PhaseSpan[] = [];
    let title = "";
    let start = -1;
    let body: string[] = [];
    let band: string[] = [];

    const close = (): void => {
        if (start === -1) return;
        out.push({ title, line: start + 1, text: body.join("\n"), band: band.join("\n") });
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";

        if (line.startsWith(PHASE_MARKER)) {
            close();
            title = line.slice(PHASE_MARKER.length).trim();
            start = index;
            body = [];
            continue;
        }
        if (line.startsWith(MILESTONE_MARKER)) {
            close();
            start = -1;
            body = [];
            band = [];
            continue;
        }
        if (start !== -1) body.push(line);
        else band.push(line);
    }

    close();
    return out;
}
