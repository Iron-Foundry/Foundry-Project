import { underRoots } from "../core/filters/scope.filter.ts";
import {
    ENTRYPOINT_ROOTS,
    GUARD_RESOLUTION_DEPTH,
    MUTATION_FIELDS,
    NO_FIX_FLAG,
    OPT_IN_MUTATION_FLAGS,
    PRESENCE_READERS,
} from "../core/constants/path.constants.ts";
import { stringLiterals } from "../core/predicates/literal.predicate.ts";
import {
    presenceBackedMutationGuards,
    unpublishedBranchOperands,
    unwitnessedWrites,
} from "../core/validators/entrypoint.validator.ts";
import type { BranchOperand, Mutation, PresenceBackedGuard } from "../core/validators/entrypoint.validator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

const PIPELINE_ENTRY = "runPipeline";

function finding(path: string, line: number, flag: string): Finding {
    return {
        rule: "entrypoint/healingIsOptIn",
        path,
        line,
        locus: flag,
        stack: [
            { check: "entrypoint", resolved: path },
            { check: "flag", resolved: flag },
            { check: "default", resolved: "report" },
        ],
        actual: `${path} offers ${flag}, so healing is opt-in`,
        expected: `${path} heals by default and offers ${NO_FIX_FLAG}`,
        remediation: {
            action: "rename",
            from: flag,
            to: NO_FIX_FLAG,
            target: path,
            deterministic: true,
            decide: "an opt-in repair flag inverts the rule — the tool computed the fix and then declined to apply it, which turns a solved problem into a queue nobody drains",
        },
        healed: false,
    };
}

const REPORT_CALL = "writePipelineReport";

function unpublishedOperand(path: string, operand: BranchOperand): Finding {
    return {
        rule: "entrypoint/unpublishedBranchOperand",
        path,
        line: operand.line,
        locus: operand.name,
        stack: [
            { check: "entrypoint", resolved: path },
            { check: "branches", resolved: operand.name },
            { check: "published", resolved: "absent" },
        ],
        actual: `${operand.name} is computed here, decides which of two behaviours the run takes, is passed into the run, and appears in no key the emitted report declares`,
        expected: "the operand published as a report key",
        remediation: {
            action: "declare",
            from: operand.name,
            to: null,
            target: path,
            deterministic: false,
            decide: "an operand a run BRANCHES on decides what its result MEANS, so a report omitting it publishes a measurement whose conditions the reader cannot recover — and this tree answers outstanding work by READING the report rather than by re-running, so the fact lives only in a line printed to whoever started it. Publish it as a key. THE KEY NAME IS THE AUTHOR'S rather than derivable, which is why this reports instead of healing: a healer inventing a name asserts a field nobody declared. An operand that changes only HOW a result was produced belongs nowhere in it, and this comparison cannot tell that from one that changes what the result means — so a false positive is argued out on the record rather than narrowed away, because narrowing until nothing false ever fires is the check governing the scanner",
        },
        healed: false,
    };
}

function duplicateEntry(path: string, pipelines: readonly string[]): Finding {
    return {
        rule: "entrypoint/secondPipelineEntry",
        path,
        line: 1,
        locus: PIPELINE_ENTRY,
        stack: [
            { check: "entries", resolved: String(pipelines.length) },
            { check: "sites", resolved: pipelines.join(" ") },
        ],
        actual: `${String(pipelines.length)} entrypoints run the pipeline`,
        expected: "one entrypoint",
        remediation: {
            action: "move",
            from: path,
            to: pipelines[0] ?? null,
            target: path,
            deterministic: false,
            decide: "governance runs through a single entry point whose default is the full pipeline, and arguments narrow it; a second entry is a second default that can disagree with the first, so a run can pass without having run everything",
        },
        healed: false,
    };
}

function unwitnessed(path: string, mutation: Mutation): Finding {
    return {
        rule: "entrypoint/unwitnessedWrite",
        path,
        line: mutation.line,
        locus: mutation.target,
        stack: [
            { check: "target", resolved: mutation.target },
            { check: "reads", resolved: String(mutation.reads) },
            { check: "witness", resolved: "absent" },
        ],
        actual: `${path} rewrites ${mutation.target} from content read earlier, with no re-read compared against it before the write`,
        expected: `${path} re-reads ${mutation.target} immediately before writing and aborts when it differs from what was read`,
        remediation: {
            action: "declare",
            from: null,
            to: "compare-and-swap",
            target: path,
            deterministic: false,
            decide: "a whole-file rewrite derived from an earlier read silently destroys anything written between the two, and the loser of that race is never told — the write reports success, so the destruction is discovered only when somebody misses their own work",
        },
        healed: false,
    };
}

function presenceBackedGuard(path: string, guard: PresenceBackedGuard): Finding {
    return {
        rule: "entrypoint/presenceBackedMutationGuard",
        path,
        line: guard.line,
        locus: guard.guard,
        stack: [
            { check: "guard", resolved: guard.guard },
            { check: "resolution", resolved: guard.chain.join(" → ") },
            { check: "operand", resolved: "presence" },
        ],
        actual: `the operand deciding whether this run MUTATES resolves to a reader answering who EXISTS`,
        expected: "the same decision resolved from a reader answering who is WRITING",
        remediation: {
            action: "declare",
            from: guard.guard,
            to: null,
            target: path,
            deterministic: false,
            decide:
                "a mutation guard asks whether taking an exclusive resource is safe RIGHT NOW, and that is a question " +
                "about a write being live rather than about a party existing. A presence surface answers who is " +
                "seated, which is a state a protocol may hold CONTINUOUSLY — and where it does, the guard's true " +
                "state never occurs and the repair it gates becomes unreachable BY CONSTRUCTION rather than deferred " +
                "until quiet, so every finding whose only remedy is that repair is stranded on a walk nobody can " +
                "drain. The two surfaces are usually both already present and one derivation apart, which is what " +
                "makes the wrong one so easy to reach: it is the surface the party is already reading. Resolve the " +
                "decision from the liveness record instead — it clears on its own when the other writer finishes, and " +
                "two parties whose write sets are disjoint stop holding each other at all. WHICH SURFACES ANSWER " +
                "WHICH QUESTION IS SEMANTIC, so it is DATA this check cites rather than a property it infers, and a " +
                "surface enters that data only once somebody has read it and classified it",
        },
        healed: false,
    };
}

export const rule: RuleDeclaration = {
    stage: "meta",
    jurisdiction: "taxonomy",
    invariant:
        "every entrypoint heals by default, disables healing only through the declared flag, resolves the decision to mutate from a reader answering who is WRITING rather than who EXISTS, and never rewrites a file from an earlier read without a compared witness",
    extensions: [".ts"],
    kinds: [
        "healingIsOptIn",
        "unpublishedBranchOperand",
        "secondPipelineEntry",
        "unwitnessedWrite",
        "presenceBackedMutationGuard",
    ],
    heals: false,

    check(context: RuleContext): RuleResult {
        const findings: Finding[] = [];
        const scoped = underRoots(context.paths, ENTRYPOINT_ROOTS);
        const pipelines: string[] = [];

        for (const path of scoped) {
            const source = context.read(path);

            for (const literal of stringLiterals(source)) {
                if (!OPT_IN_MUTATION_FLAGS.includes(literal.value)) continue;
                findings.push(finding(path, literal.line, literal.value));
            }

            for (const mutation of unwitnessedWrites(source)) {
                findings.push(unwitnessed(path, mutation));
            }

            for (const operand of unpublishedBranchOperands(source, PIPELINE_ENTRY, REPORT_CALL)) {
                findings.push(unpublishedOperand(path, operand));
            }

            for (const guard of presenceBackedMutationGuards(
                source,
                MUTATION_FIELDS,
                PRESENCE_READERS,
                GUARD_RESOLUTION_DEPTH,
            )) {
                findings.push(presenceBackedGuard(path, guard));
            }

            if (source.includes(PIPELINE_ENTRY)) pipelines.push(path);
        }

        if (pipelines.length > 1) {
            for (const path of pipelines.slice(1)) {
                findings.push(duplicateEntry(path, pipelines));
            }
        }

        return {
            findings,
            healed: [],
            derivations: {
                entrypoints: scoped,
                pipelines,
                mutationFields: [...MUTATION_FIELDS],
                presenceReaders: [...PRESENCE_READERS],
                guardResolutionDepth: GUARD_RESOLUTION_DEPTH,
                guardResolutionBound:
                    "the chain from a mutation operand to its reader is followed through local declarations to the " +
                    "declared depth and no further, so a guard whose operand is assembled across more hops than that " +
                    "is outside this check — the bound is stated rather than implied, because a mechanism that " +
                    "appears exhaustive and is not is worse than one whose limit a reader can see",
            },
        };
    },
};
