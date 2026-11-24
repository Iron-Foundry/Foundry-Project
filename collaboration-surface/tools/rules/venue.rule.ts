import { BLOCKING_SUFFIX, VENUE_ARCHIVE } from "../core/constants/blocking.constants.ts";
import { fencedFlags } from "../core/predicates/fence.predicate.ts";
import { hasReadMark } from "../core/validators/converge.validator.ts";
import { selfCorrections } from "../core/validators/venue.validator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const SUCCESSOR_FIELD = "SUCCESSOR:";

const PLACEHOLDER_OPEN = "<";

interface Declaration {
    readonly line: number;
    readonly fenced: boolean;
    readonly placeholder: boolean;
}

function declarations(venue: string): Declaration[] {
    const fenced = fencedFlags(venue);
    const lines = venue.split("\n");
    const out: Declaration[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = (lines[index] ?? "").trim();
        if (!trimmed.startsWith(SUCCESSOR_FIELD)) continue;

        const value = trimmed.slice(SUCCESSOR_FIELD.length).trim();
        out.push({
            line: index + 1,
            fenced: fenced[index] === true,
            placeholder: value.startsWith(PLACEHOLDER_OPEN) || value.length === 0,
        });
    }

    return out;
}

function live(found: readonly Declaration[]): boolean {
    for (const declaration of found) {
        if (!declaration.fenced && !declaration.placeholder) return true;
    }
    return false;
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "all",
    invariant:
        "a venue that carries a successor declaration carries a LIVE one, so the edge compares a declared name rather than falling back to an ordinal nothing states",
    extensions: [],
    kinds: ["fencedOnlySuccessor"],
    heals: false,

    check(context: RuleContext): RuleResult {
        const venues = context.paths.filter((path) => path.endsWith(BLOCKING_SUFFIX));

        const reached: string[] = [];
        const fencedOnly: { path: string; line: number }[] = [];
        const corrections: string[] = [];
        const settled: string[] = [];

        for (const path of venues) {
            const into = path.startsWith(VENUE_ARCHIVE) ? settled : corrections;
            for (const key of selfCorrections(context.read(path))) into.push(`${path} · ${key}`);
        }

        const unopened: string[] = [];

        for (const path of venues) {
            const source = context.read(path);
            const found = declarations(source);
            if (found.length === 0) continue;

            reached.push(path);
            if (live(found)) continue;

            if (!path.startsWith(VENUE_ARCHIVE) && !hasReadMark(source)) {
                unopened.push(path);
                continue;
            }

            const first = found[0];
            if (first === undefined) continue;
            fencedOnly.push({ path, line: first.line });
        }

        const findings: Finding[] = fencedOnly.map((venue) => ({
            rule: "venue/fencedOnlySuccessor",
            path: venue.path,
            line: venue.line,
            locus: SUCCESSOR_FIELD,
            stack: [
                { check: "declaration", resolved: "present" },
                { check: "fenceMap", resolved: "every occurrence is fenced or placeholder" },
                { check: "live", resolved: "absent" },
            ],
            actual: "every successor declaration in this venue is fenced or a placeholder, so the venue declares no successor",
            expected: null,
            remediation: {
                action: "declare",
                from: SUCCESSOR_FIELD,
                to: null,
                target: venue.path,
                deterministic: false,
                decide:
                    "write the successor declaration UNFENCED, on its own line — the reader of this field skips every " +
                    "fenced line, so a venue carrying the field only inside a fence declares nothing and the edge falls " +
                    "back to the chrono ordinal, which is the operand the declaration exists to replace. NOTHING REPORTS " +
                    "THAT FALLBACK: an ordinal successor resolves, the edge holds or blocks for its own reasons, and the " +
                    "declaration a seat believes it made is invisible in both directions. An ordinal is a position in a " +
                    "total order while the real edges are partial with forward dependencies, so it cannot detect the " +
                    "violation it PRESERVES — a venue existing before its predecessor converges keeps every ordinal " +
                    "intact. Where the venue carries a fenced specimen beside the live line, the specimen is optional " +
                    "and the live line is not",
            },
            healed: false,
        }));

        return {
            findings,
            healed: [],
            derivations: {
                venues: venues.length,
                carryingDeclaration: reached,
                fencedOnly: fencedOnly.map((venue) => venue.path),
                createdNotOpened: unopened,
                createdNotOpenedReason:
                    "a venue whose roster carries NO read mark is CREATED and not opened, and it is excluded from the " +
                    "fenced-only finding rather than counted as a venue refusing to declare its successor. A successor " +
                    "is declared at CONVERGENCE and the raise creates the file before its predecessor archives, because " +
                    "the successor edge refuses a predecessor whose successor does not exist — so a newly raised venue " +
                    "carries only the template's specimen by construction, and firing there would report a defect that " +
                    "the required ordering produces on every raise. The operand is OPENNESS read from the roster, which " +
                    "is the same operand the concurrent-venues axis reads and a different one from PRESENCE, and a " +
                    "walk reading presence where its subject is openness reports the ordering rather than the venue",
                selfCorrectedOpen: corrections,
                selfCorrectedSettled: settled,
                selfCorrectionLifetime:
                    "the two sets are SPLIT by the venue's lifetime and never summed, because they answer different questions: an OPEN venue's count is a live measurement of an argument still running, and an ARCHIVED one's is settled and can never move again. A single number over both would read as current while most of it describes discussions that are closed, which is a verdict quoted past the set it was taken over. The split is on RETENTION rather than on mutability — the archive RETAINS these positions, which is why they are counted at all rather than excluded — and that is the axis this measurement needs, where the same surface pair needs mutability for a write check and authority for a removal check",
                selfCorrectionContract:
                    "a position whose Contradicts clause cites an id carrying its OWN author's letter is a seat correcting itself, and this names them. It is published as a DERIVATION and emits no finding, deliberately and for the reason that decides every publish-versus-gate call here: a self-correction is the protocol working rather than failing, so a check that FAILED on one would punish the honest answer and teach every seat to withdraw a claim silently instead of citing it — which is the only form of the same act that no artifact records. What it measures is the ORDERING every seat has named on itself: a position written before its operand was opened, corrected by its own author once the operand was read. Nothing else in the tree carries that number, the clause it reads is already mandatory in the position schema, and the count is derived per venue rather than transcribed anywhere",
                notChecked:
                    "whether the declared successor is the RIGHT invariant — that comparison is the convergence walk's " +
                    "declared-successor edge, which joins the declaration against a filename. This check ranges over " +
                    "every venue in the run's path set that carries the field at all, and decides only that the " +
                    "declaration is live rather than specimen; a venue carrying no field is outside it, because a venue " +
                    "that has not reached convergence has nothing to declare yet",
            },
        };
    },
};
