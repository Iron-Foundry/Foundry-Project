export const SCHEDULE_STATES = ["planned", "created", "open", "archived"] as const;

export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export interface SchedulePlan {
    readonly ordinal: string;
    readonly invariant: string;
    readonly merged?: string;
    readonly establishes: string;
    readonly note?: string;
    readonly declaredState?: ScheduleState;
    readonly declaredBecause?: string;
}

export function defineSchedule(rows: readonly SchedulePlan[]): readonly SchedulePlan[] {
    return rows;
}

export const schedule: readonly SchedulePlan[] = defineSchedule([
    {
        ordinal: "1",
        invariant: "no-removal-under-an-open-decision",
        establishes: "nothing irreversible lands while the decision authorising it is under review",
    },
    {
        ordinal: "2",
        invariant: "support-is-measured-never-assumed",
        establishes: "what the coordination system already supports, read from the tree rather than believed",
        declaredState: "archived",
        declaredBecause:
            "no listing holds this row's venue, because its file was destroyed by a close that deleted rather than moved — so the tree carries no observation to derive from and the value is authored data",
        note: "its argument is lost to a destructive close, and that loss is the founding member of the archive-never-delete ruling",
    },
    {
        ordinal: "3",
        invariant: "a-topology-states-its-invariants",
        establishes: "what the scalability sketch presupposes and leaves unstated",
    },
    {
        ordinal: "4",
        invariant: "local-consistency-composes-globally",
        establishes: "scope claims contain across levels, so a coherent local board cannot hide an overlap",
    },
    {
        ordinal: "5",
        invariant: "every-surface-declares-its-lifetime",
        establishes: "which surfaces accumulate, which govern, which are dynamic, which need a state machine",
        note: "absorbed first, its distribution built, then moved whole",
    },
    {
        ordinal: "6",
        invariant: "a-fact-declared-twice-is-collapsed-before-it-is-compared",
        merged: "coordination-shape-is-acyclic",
        establishes:
            "one fact stated in two places disagrees the moment either moves, so the copies collapse before any comparison is built — AND whether coordination branches as a tree or a DAG, with the shape stayed maintained and visible",
        note: "all seven orderings held, its outcome was built and its distribution drained before the move, and it went whole into the archive with its durable half in the accumulator",
    },
    {
        ordinal: "6a",
        invariant: "an-invocation-joins-the-run-it-would-have-duplicated",
        establishes:
            "how a party invokes any SHARED LONG-RUNNING PROCESS without colliding with a party already running it — the package's OWN pipeline as much as a host verification, a compiler or a linter. **Internal tooling is the sharper case rather than the exception**: the measured collisions in this series are all the package's own governance run, which is the one process every seat invokes and the one whose output every seat quotes. The proposal under discussion is a shared-state invoker: one tool that launches other tools, normalises the invocation to the ACTIVE PROCESS it targets rather than to the command text, and publishes an OPEN JOINABLE state, so a second party invoking while the first is still running JOINS that run and consumes its result instead of starting a second one. It must decide what a run's identity IS, what a joiner is entitled to, what happens when the joiner arrives mid-run or after completion, and whether a run is a surface with a declared lifetime like any other. **This shapes every tool usage rather than one**, so it binds architecture, tool composition and what a capability is permitted to assume about exclusivity",
        note: "all seven orderings held, its outcome was written as a class surface and its distribution built and drained before the move, and it went whole into the archive with every seat's durable half in the accumulator; INSERTED between the sixth and seventh by an owner directive and raised at that position",
    },
    {
        ordinal: "6b",
        invariant: "a-scan-that-finds-more-than-one-declaration-refuses-rather-than-choosing",
        establishes:
            "a mechanism meeting more than one declaration of a fact refuses rather than selecting one, since a tiebreak converts a correct refusal into a confident wrong answer and moves the decision to whoever wrote the tiebreak",
        note: "CORRECTED from created: the file raised for it was renumbered out of the foreseen seventh and then REMOVED, so the row returns to the only state a row with no file can hold. It was declared as the sixth venue's successor and recorded as an insertion AFTER its raise, so it sat where it was APPENDED until this move brought it to the place its own ordinal states — the licence a letter carries is to have been WRITTEN late, never to sit outside its own sequence",
    },
    {
        ordinal: "7",
        invariant: "agent-count-is-derived-never-chosen",
        establishes: "how many seats the work implies, how work is allocated, and what workspace approach follows",
        note: "all seven orderings held at the invocation and it went whole into the archive: its outcome written as a class surface and walked by two seats against its own gate, its distribution built and drained, every convened seat's durable half in the accumulator, and its successor declared and raised before the move",
    },
    {
        ordinal: "7a",
        invariant: "a-surface-read-through-a-tool-is-data-rather-than-a-document",
        establishes:
            "whether the coordination substrate itself should be TYPED rather than prose, now that communication is read almost entirely through the tool's diff — which reports exactly what changed since a party last looked, so the file is no longer a document anybody reads end to end but a data structure being rendered. It must decide: where the PROSE/DATA split falls and which content is which; which kinds of document live where, and whether a collaboration wiki is maintained or the manifest gains protocol integration so it stays the ACTUAL onboarding document, explaining the method of operating and indexing every path with its concern; whether the communication surface becomes typed and schema-based rather than markdown, since it already is schema-bearing in substance, and what TYPE SAFETY AT THE COMMUNICATION LAYER would buy; and what that unlocks — a collaboration that extends into apps and other runtimes, reading and manipulating a running system inside communication itself, programmatically capable and digestible rather than transcribed. **It is raised BEFORE any follow-up venue because it shapes all of them**, and it is the tools-evolution question stated at the substrate rather than at any one form",
        note: "every ordering held at the invocation and it went whole into the archive: its outcome written as a class surface and walked against it by each convened seat, its distribution built and drained, every convened seat's durable half in the accumulator, and its successor declared against this table's PLANNED row rather than raised; INSERTED between the seventh and eighth by an owner directive, on the ground that markdown and text surfaces become the bottleneck under a tool-mediated read and that the substrate decision must converge before the venues that would build on it are opened",
    },
    {
        ordinal: "8",
        invariant: "every-protocol-rule-has-a-gate",
        establishes: "what tooling is built, what is extended, and what protocol hardens and how",
        note: "raised at this position once the owner lifted the pause that had held it, on their direct answer naming this row as the one to raise. Creation and opening are two events: the roster carries each letter unread until that seat marks its own",
    },
    {
        ordinal: "9",
        invariant: "a-seat-receives-what-it-needs",
        establishes: "what a dedicated scaling context carries, and what reaches a seat versus a bounded invocation",
    },
    {
        ordinal: "10",
        invariant: "evolution-follows-from-the-rules",
        establishes:
            "what the rules already on disk imply the next step is, rather than what would be pleasant to build",
    },
    {
        ordinal: "11",
        invariant: "coordination-concepts-are-typed",
        establishes:
            "every concept this protocol coordinates on — a surface, an item, a state, a verdict, a deferral, a run — carries a declared type that selects its schema, its legal placement and the rules binding it, so a mechanism dispatches rather than guesses and an untyped construct fails rather than resolving vacuously",
    },
    {
        ordinal: "12",
        invariant: "a-fixed-output-shape-forces-its-input-unconditionally",
        establishes:
            "why an artifact whose shape is fixed makes its producer build every input the shape COULD carry, whether or not any target consumes one — so a whole-corpus context is paid to fill two empty columns, and the discriminator is that a CONDITIONAL output shape lets the producer skip what nothing reads; this is the work-was-never-needed axis, which has no second party and therefore fits no collision shape",
        note: "INSERTED as its own row rather than folded into the joining venue, on the ruling that a question with no second party is orthogonal to every collision question and folding it in would converge on neither",
    },
    {
        ordinal: "13",
        invariant: "a-concern-is-a-component-of-the-forcing-relation",
        establishes:
            "how the release work partitions and what each concern owns: a concern is a connected component of the relation JOIN TWO SURFACES WHEN A CHANGE TO ONE FORCES A CHANGE TO THE OTHER, never an area of a work list, so the seat count follows the cut rather than the cut following an available seat count. It must decide the relation itself and the concerns it yields, what each concern owns and what it refuses, which concerns run CONCURRENTLY against a bounded parallel capacity and which run AFTER rather than beside them, and what a later assurance party composes its brief FROM — since a planning surface deletes every row it closes, and no form extracts before that deletion, so the record of what was built is destroyed by the rule that keeps the surface honest.",
    },
]);
