import { existsSync, readdirSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import { GENERATED_DIR } from "../constants/path.constants.ts";
import { REPORT_SUFFIX } from "../constants/report.constants.ts";
import { boardFinding } from "../validators/board.validator.ts";
import type { Finding } from "../types/segment.types.ts";

const GATE_PREFIX = "Gate — ";
const STATE_FIELD = "State:";
const PASSING = "PASS";
const FAILING = "RED";

interface ToolVerdict {
    readonly tool: string;
    readonly verdict: string;
    readonly authoritative: boolean;
    readonly bypassed?: boolean;
}

function isToolVerdict(value: unknown): value is ToolVerdict {
    if (typeof value !== "object" || value === null) return false;

    const held = value as Record<string, unknown>;

    if (typeof held["tool"] !== "string" || typeof held["verdict"] !== "string") return false;
    if (typeof held["authoritative"] !== "boolean") return false;

    return held["bypassed"] === undefined || typeof held["bypassed"] === "boolean";
}

function toolVerdicts(repoRoot: string): Map<string, string> {
    const out = new Map<string, string>();
    const folder = resolve(repoRoot, GENERATED_DIR);
    if (!existsSync(folder)) return out;

    for (const name of readdirSync(folder)) {
        if (!name.endsWith(REPORT_SUFFIX)) continue;

        let held: unknown;
        try {
            held = JSON.parse(readSurface(resolve(folder, name), "utf8"));
        } catch {
            continue;
        }

        if (!isToolVerdict(held)) continue;
        if (held.authoritative !== true || held.bypassed === true) continue;

        out.set(held.tool, held.verdict === "pass" ? PASSING : FAILING);
    }

    return out;
}

export function checkGateState(board: string, repoRoot: string, findings: Finding[]): void {
    const derived = toolVerdicts(repoRoot);
    const lines = board.split("\n");
    let holder = "";

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();

        if (trimmed.startsWith(GATE_PREFIX)) {
            holder = trimmed.slice(GATE_PREFIX.length).trim();
            continue;
        }
        if (!trimmed.startsWith(STATE_FIELD) || holder === "") continue;

        const stated = trimmed.slice(STATE_FIELD.length).trim();
        const computed = derived.get(holder);
        holder = "";

        if (computed === undefined || stated === computed) continue;

        findings.push(
            boardFinding(
                "staleGateState",
                index + 1,
                stated,
                `the board states ${stated} while the authoritative run on disk resolves ${computed}`,
                `${computed}, derived from the report rather than transcribed`,
                "a State field is a verdict TRANSCRIBED from a run, which makes it a cache with no invalidation: it is true when written and false the moment any agent writes a file, and nothing reports the disagreement. Every agent here independently reached the same conclusion and each answered it by refusing to assert a verdict in their own record, which leaves the field present, unmaintained and still read. The value is DERIVED — the report on disk carries the tool identity and the verdict, so the field has exactly one correct value at any moment. Healing is withheld deliberately: this board is written concurrently by every agent, three content losses here took the shape of a writer rewriting it from content that had moved, and a gate that writes to it would be that construct with a gate's authority",
            ),
        );
    }
}
