export interface TemplateContract {
    readonly genesisStages: readonly string[];
    readonly rippleDimensions: readonly string[];
    readonly dependencyAxes: readonly string[];
    readonly confidenceThreshold: number;
}

const GRAPH_MARKER = "graph_4d: {";

const ASSIGN = "SET ";

const SEPARATOR = " = ";

function quotedItems(value: string): string[] {
    const out: string[] = [];
    let inside = false;
    let item = "";

    for (let index = 0; index < value.length; index += 1) {
        const character = value.charAt(index);

        if (character === '"') {
            if (inside) out.push(item);
            item = "";
            inside = !inside;
            continue;
        }
        if (inside) item += character;
        if (character === "]" && !inside) break;
    }

    return out;
}

function leadingNumber(value: string): number {
    let digits = "";

    for (let index = 0; index < value.length; index += 1) {
        const character = value.charAt(index);
        const isDigit = character >= "0" && character <= "9";
        if (isDigit || character === ".") {
            digits += character;
            continue;
        }
        if (digits.length > 0) break;
        if (character !== " ") break;
    }

    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
}

function assignmentsIn(source: string): Map<string, string> {
    const out = new Map<string, string>();

    for (const raw of source.split("\n")) {
        const line = raw.trim();
        if (!line.startsWith(ASSIGN)) continue;

        const at = line.indexOf(SEPARATOR);
        if (at === -1) continue;

        const name = line.slice(ASSIGN.length, at).trim();
        if (name.length === 0 || out.has(name)) continue;
        out.set(name, line.slice(at + SEPARATOR.length));
    }

    return out;
}

function objectKeys(source: string, marker: string): string[] {
    const at = source.indexOf(marker);
    if (at === -1) return [];

    const out: string[] = [];
    let key = "";

    for (let index = at + marker.length; index < source.length; index += 1) {
        const character = source.charAt(index);
        if (character === "}") break;

        if (character === ":") {
            const trimmed = key.trim();
            if (trimmed.length > 0) out.push(trimmed);
            key = "";
            continue;
        }
        if (character === ",") {
            key = "";
            continue;
        }
        key += character;
    }

    return out;
}

export function readTemplateContract(source: string): TemplateContract {
    const assignments = assignmentsIn(source);

    return {
        genesisStages: quotedItems(assignments.get("substrate_cycle") ?? ""),
        rippleDimensions: quotedItems(assignments.get("ripple_dimensions") ?? ""),
        dependencyAxes: objectKeys(source, GRAPH_MARKER),
        confidenceThreshold: leadingNumber(assignments.get("confidence_threshold") ?? ""),
    };
}
