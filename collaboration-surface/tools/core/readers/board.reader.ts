export interface BoardContract {
    readonly agentFields: readonly string[];
    readonly gateFields: readonly string[];
}

const AGENT_ANCHOR = "Agent <";

const GATE_ANCHOR = "Gate ";

const PLACEHOLDER = "<";

const EMPTY = "—";

function fieldsAfter(lines: readonly string[], from: number): string[] {
    const out: string[] = [];

    for (let cursor = from; cursor < lines.length; cursor += 1) {
        const line = (lines[cursor] ?? "").trim();
        if (line.length === 0) break;

        const colon = line.indexOf(":");
        if (colon <= 0) break;

        const key = line.slice(0, colon).trim();
        if (key.includes(" ")) break;
        const value = line.slice(colon + 1).trim();
        if (!value.startsWith(PLACEHOLDER) && !value.startsWith(EMPTY)) break;

        out.push(key);
    }

    return out;
}

export function readBoardContract(template: string): BoardContract {
    const lines = template.split("\n");
    let agentFields: string[] = [];
    let gateFields: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = (lines[index] ?? "").trim();

        if (agentFields.length === 0 && line.startsWith(AGENT_ANCHOR)) {
            agentFields = fieldsAfter(lines, index + 1);
            continue;
        }

        if (gateFields.length === 0 && line.startsWith(GATE_ANCHOR)) {
            gateFields = fieldsAfter(lines, index + 1);
        }
    }

    return { agentFields, gateFields };
}
