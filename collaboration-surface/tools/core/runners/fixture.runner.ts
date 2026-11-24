import { existsSync } from "node:fs";

import { readSurface } from "../readers/surface.reader.ts";
import { writeSurface } from "../writers/surface.writer.ts";

const CLOSER = "];";

const FIRES_LEAD = "FIRES ";

const ACCEPTS_LEAD = "ACCEPTS ";

const PAIR_SEPARATOR = "/";

export interface FixtureSample {
    readonly path: string;
    readonly text: string;
}

export interface ParsedSamples {
    readonly fires: FixtureSample | null;
    readonly accepts: FixtureSample | null;
}

export interface FixtureRequest {
    readonly target: string;
    readonly absolute: string;
    readonly pair: string;
    readonly body: string;
    readonly witness: string;
}

export interface FixtureOutcome {
    readonly code: number;
    readonly message: string;
}

export function parseSamples(body: string): ParsedSamples {
    let fires: FixtureSample | null = null;
    let accepts: FixtureSample | null = null;

    let openPath = "";
    let openLines: string[] = [];
    let into: "fires" | "accepts" | "" = "";

    const close = (): void => {
        if (into === "" || openPath.length === 0) return;
        const sample = { path: openPath, text: `${openLines.join("\n")}\n` };
        if (into === "fires") fires = sample;
        else accepts = sample;
    };

    for (const line of body.split("\n")) {
        if (line.startsWith(FIRES_LEAD)) {
            close();
            into = "fires";
            openPath = line.slice(FIRES_LEAD.length).trim();
            openLines = [];
            continue;
        }
        if (line.startsWith(ACCEPTS_LEAD)) {
            close();
            into = "accepts";
            openPath = line.slice(ACCEPTS_LEAD.length).trim();
            openLines = [];
            continue;
        }
        if (into === "") continue;
        openLines.push(line);
    }

    close();
    return { fires, accepts };
}

function quoted(text: string): string {
    let out = "";
    for (const character of text) {
        if (character === "\\") out += "\\\\";
        else if (character === '"') out += '\\"';
        else if (character === "\n") out += "\\n";
        else out += character;
    }
    return `"${out}"`;
}

export function fixtureEntry(rule: string, kind: string, samples: ParsedSamples): string {
    const fires = samples.fires;
    const accepts = samples.accepts;

    return [
        "    {",
        `        rule: ${quoted(rule)},`,
        `        kind: ${quoted(kind)},`,
        "        fires: [",
        `            { path: ${quoted(fires?.path ?? "")}, text: ${quoted(fires?.text ?? "")} },`,
        "        ],",
        "        passes: [",
        `            { path: ${quoted(accepts?.path ?? "")}, text: ${quoted(accepts?.text ?? "")} },`,
        "        ],",
        "    },",
    ].join("\n");
}

export function runFixture(request: FixtureRequest): FixtureOutcome {
    if (!existsSync(request.absolute)) {
        return {
            code: 2,
            message: `ABSENT  ${request.target} does not exist, so there is no fixture set to append into\n`,
        };
    }

    const separator = request.pair.indexOf(PAIR_SEPARATOR);
    if (separator <= 0 || separator === request.pair.length - 1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.pair} is not a rule-and-kind pair. A FIXTURE PROVES ONE KIND rather than one rule: ` +
                "a pair collapsing every kind of a rule into one judgement reports a rule proven while a kind it emits " +
                "has never been shown to fire, which is the granularity the certifier keys its whole report on\n",
        };
    }

    const samples = parseSamples(request.body);
    if (samples.fires === null || samples.accepts === null) {
        return {
            code: 2,
            message:
                "REFUSED  a fixture declares BOTH halves and this body carries " +
                `${samples.fires === null ? "no fired sample" : "no accepted sample"}. A CHECK NOBODY HAS SEEN FAIL IS ` +
                "INDISTINGUISHABLE FROM ONE THAT CANNOT, and a check whose every member fails has been shown to refuse " +
                "rather than to discriminate — so the halves are declared together or the entry certifies one direction " +
                "and reads as certifying both. Each half opens its own line naming its path, and its text follows\n",
        };
    }

    const before = readSurface(request.absolute, "utf8");
    if (before !== request.witness) {
        return {
            code: 2,
            message:
                `CONTENDED  ${request.target} moved since this call read it, so the append is refused rather than written ` +
                "over content that arrived in between. A WRITE COMPOSED FROM AN EARLIER READ IS WHERE A CONCURRENT " +
                "PARTY'S WORK DISAPPEARS SILENTLY: the write reports success to whoever overwrote and says nothing to " +
                "whoever was overwritten. Re-read and re-issue\n",
        };
    }

    const lines = before.split("\n");
    let at = -1;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        if ((lines[index] ?? "").trim() !== CLOSER) continue;
        at = index;
        break;
    }

    if (at === -1) {
        return {
            code: 2,
            message:
                `REFUSED  ${request.target} declares no fixture set this form can append within, so an entry would land ` +
                "wherever the file happens to end. A SURFACE TAKES THIS FORM BY CARRYING THE SET IT GOVERNS, which is " +
                "the same boundary every keyed append here requires — without one the append is a write at an offset " +
                "rather than a member of a declared collection\n",
        };
    }

    const [rule, kind] = [request.pair.slice(0, separator), request.pair.slice(separator + 1)];
    const written = [...lines.slice(0, at), fixtureEntry(rule, kind, samples), ...lines.slice(at)].join("\n");
    writeSurface(request.absolute, written);

    return {
        code: 0,
        message:
            `FIXTURE  ${request.pair} appended to ${request.target} with both halves declared. THE CERTIFIER REFUSES A ` +
            "KIND WITHOUT A VIOLATING SAMPLE AND WITHOUT A CLEARING ONE, so both were party writes into authored source " +
            "with no fence, no witness and no refusal — this form supplies the placement and the compare-and-swap and " +
            "leaves the sample CONTENT where it belongs, with the author who knows what violates the kind and what a " +
            "correct member looks like. A SAMPLE NAMING A PARTY CARRIES ITS OWN ROSTER: a clean half whose verdict " +
            "depends on who is seated is a control that accepted for reasons its text does not state\n",
    };
}
