---
name: development-rules
description: Universal software-architecture principle canon — structural, computation, resource, execution, security, performance, infrastructure, resilience, enforcement, human, and evolution domains, with tension resolutions and directive mappings.
type: reference
domain: [architecture, ai-governance, governance]
keywords:
    [
        principles,
        architecture,
        soc,
        kiss,
        dry,
        srp,
        solid,
        security,
        performance,
        infrastructure,
        resilience,
        enforcement,
        contracts,
        compatibility,
        schema,
        concurrency,
        transactions,
        events,
        messaging,
        causality,
        observability,
        ioc,
        plugins,
        discovery,
        declarative,
        metaprogramming,
        ddd,
        bounded-context,
        architecture-styles,
        design-patterns,
        streaming,
        correctness,
        determinism,
        ai-architecture,
        tensions,
        directives,
        lifecycle,
    ]
owner: BanesLab
created: 2026-04-08
last-verified: 2026-07-11
version: 3
staleness-days: -1
max-lines: 720
depends-on: []
supersedes:
---

```ruby
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRINCIPLE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    DATA TRANSFORMATIONS              DATA RESOURCES                         │
│    (what happens to data)            (where data lives)                     │
│              │                              │                               │
│              ▼                              ▼                               │
│    ┌───────────────────┐          ┌───────────────────┐                     │
│    │    COMPUTATION    │          │     RESOURCE      │                     │
│    │    (Stateless)    │◄─────────│    (Stateful)     │                     │
│    ├───────────────────┤  observe ├───────────────────┤                     │
│    │ • Pure functions  │          │ • File handles    │                     │
│    │ • Immutability    │          │ • DB connections  │                     │
│    │ • Idempotency     │          │ • Single owner    │                     │
│    │ • Traces/Replay   │          │ • Lifecycle mgmt  │                     │
│    │ • Mark uncertainty│          │ • Halt on error   │                     │
│    └─────────┬─────────┘          └─────────┬─────────┘                     │
│              │                              │                               │
│              └──────────────┬───────────────┘                               │
│                             │                                               │
│                             ▼                                               │
│              ┌─────────────────────────────┐                                │
│              │         EXECUTION           │                                │
│              │    (Control flow/Events)    │────┐                           │
│              ├─────────────────────────────┤    │ feedback                  │
│              │ • Event-driven              │    │                           │
│              │ • No parent callbacks       │    │                           │
│              │ • Monotonic growth          │    │                           │
│              │ • Backtrack by snapshot     │    │                           │
│              └──────────────┬──────────────┘    │                           │
│                             │                   │                           │
│                             ▼                   │                           │
│              ┌─────────────────────────────┐    │                           │
│              │        STRUCTURAL           │◄───┘                           │
│              │   (Universal + Reflective)  │                                │
│              ├─────────────────────────────┤                                │
│              │ • SOC, KISS, DRY, SOLID     │                                │
│              │ • Symbol tables             │                                │
│              │ • Semantic addressing       │                                │
│              │ • Layered time              │                                │
│              │ • Homoiconicity             │                                │
│              └─────────────────────────────┘                                │
│                             │                                               │
│         ┌───────────────────┴───────────────────┐                           │
│         ▼                                       ▼                           │
│    ┌─────────────┐                       ┌─────────────┐                    │
│    │   HUMAN     │                       │  EVOLUTION  │                    │
│    │  FACTORS    │                       │ PRINCIPLES  │                    │
│    ├─────────────┤                       ├─────────────┤                    │
│    │ • 150 lines │                       │ • YAGNI     │                    │
│    │ • 6 files   │                       │ • Under-spec│                    │
│    │ • Cognitive │                       │ • Non-goals │                    │
│    │ • Expression│                       │ • Modular   │                    │
│    │ • Authority │◄──────────────────────│ • Approved  │                    │
│    └─────────────┘                       └─────────────┘                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Stateless = "What happens to data"   (verbs: transform, validate, compute) │
│  Stateful  = "Where data lives"       (nouns: file, connection, cache)      │
│  Structural = "How code is organized" (applies to both, observes itself)    │
│  Cross-cutting = "Constraints wrapping all of the above" (see domains below)│
└─────────────────────────────────────────────────────────────────────────────┘
```
```json
{ "Directive": "EnforceSingleConcernWithSystemView", "Clarification": "Module handles one concern while maintaining whole-system mental model" },
{ "Directive": "CompressToSimplest", "Clarification": "Simplest solution via rules/generators, never raw enumeration" },
{ "Directive": "EliminateDuplicationViaSharing", "Clarification": "No duplicate logic, maximize structure sharing with copy-on-write" },
{ "Directive": "DeriveResponsibilityFromInvariants", "Clarification": "Single change reason derived from constraints, not features" },
{ "Directive": "ExtendViaComposablePrimitives", "Clarification": "Open for extension via few minimal composable interfaces" },
{ "Directive": "EnsureSubstitutabilityAndConfluence", "Clarification": "Replaceable components where operation order doesn't affect result" },
{ "Directive": "SegregateByMeaning", "Clarification": "Interfaces contain only used methods, addressed semantically" },
{ "Directive": "InvertToInterchangeableAbstractions", "Clarification": "Depend on abstractions where code/data/state are same class" },
{ "Directive": "ForbidCallbacksAllowNegotiation", "Clarification": "No parent callbacks, but execution may refuse or counter-propose" },
{ "Directive": "ParameterizeWithDeferredNames", "Clarification": "Behavior controlled by inputs, names assigned only when necessary" },
{ "Directive": "CentralizeAsVersionedSymbols", "Clarification": "Single truth source via queryable persistent symbol tables" },
{ "Directive": "ScaleMonotonically", "Clarification": "Handle growth without redesign via append-only structures" },
{ "Directive": "ComposeAcrossPhases", "Clarification": "Combine modules freely, no hard compile/runtime boundary" },
{ "Directive": "ExtendWithoutOverspecifying", "Clarification": "Add features externally, deliberately leave room for evolution" },
{ "Directive": "IsolateModulesProtectState", "Clarification": "Independent swappable units, state is precious code is replaceable" },
{ "Directive": "OrganizeHierarchicallyByMeaning", "Clarification": "Layers/trees where memory placement reflects semantic relationships" },
{ "Directive": "AvoidUnnecessaryDocumentNonGoals", "Clarification": "Don't build unneeded features, explicitly state what system won't do" },
{ "Directive": "FailImmediatelyHaltOnInconsistency", "Clarification": "Detect and report errors immediately, never continue with invalid resource state" },
{ "Directive": "MinimizeDependenciesDiagnoseSymbolically", "Clarification": "Reduce coupling, infer system health rather than metric it" },
{ "Directive": "ConcentrateLogicConstrainCognition", "Clarification": "Related code together, human mental capacity is design parameter" },
{ "Directive": "EncapsulateButShipInspector", "Clarification": "Hide internals, but production supports live introspection" },
{ "Directive": "FreezeDataAssignOnce", "Clarification": "Computed data immutable after creation, variables assigned exactly once" },
{ "Directive": "EnsureRepeatableWithQuickRecovery", "Clarification": "Same result on repeat, state reconstruction designed-in" },
{ "Directive": "SeparateConcernsRestoreBySnapshot", "Clarification": "Changes don't affect unrelated areas, backtrack via reinstantiation" },
{ "Directive": "LayerWithLogicalTime", "Clarification": "Horizontal organization with phase markers over wall clocks" },
{ "Directive": "EmitEventsAllowInterruption", "Clarification": "Communicate via events, pause/inspect/resume is control flow" },
{ "Directive": "DeclareIntentExplainAtRuntime", "Clarification": "Specify what not how, system answers 'why' during execution" },
{ "Directive": "AvoidStateUndoSemantically", "Clarification": "Computation has no persistent state, rollback restores meaning not bytes" },
{ "Directive": "BoundComplexityAcceptPartialCorrectness", "Clarification": "{limits.max_lines} lines/{limits.max_files} files max, stop with uncertainty over silent incorrectness" },
{ "Directive": "TreatTracesAsFirstClass", "Clarification": "Execution traces are manipulable, queryable, replayable objects" },
{ "Directive": "AttachJustificationToValues", "Clarification": "Values carry why they were computed, not just provenance" },
{ "Directive": "AllowMarkedInvalidState", "Clarification": "Computation uncertainty permitted if explicitly marked" },
{ "Directive": "PauseGCAtSemanticBoundaries", "Clarification": "Deterministic GC pauses aligned with phase transitions" },
{ "Directive": "CollectUnusedConcepts", "Clarification": "GC finds obsolete rules and abandoned hypotheses, not just memory" },
{ "Directive": "TreatRulesAsData", "Clarification": "Constraints and invariants are queryable first-class objects, not implicit assumptions" },
{ "Directive": "EnforceSingleOwnership", "Clarification": "Every runtime resource has exactly one owner; shared ownership requires ref-counting or weak refs" },
{ "Directive": "BoundLifetimeToOwner", "Clarification": "Resource lifetime must be subset of owner lifetime, unbounded = leak candidate" },
{ "Directive": "GuaranteeSymmetricRelease", "Clarification": "Open→Close, Subscribe→Unsubscribe must be guaranteed, single-path, exception-safe" },
{ "Directive": "DistinguishReachableFromUseful", "Clarification": "GC frees unreachable not unused; architectural leaks via caches/observers survive GC" },
{ "Directive": "WeakenNonOwningReferences", "Clarification": "References not implying ownership must be weak, ephemeral, or recalculable" },
{ "Directive": "MakeRetentionExplicit", "Clarification": "Hidden retention in DI/ORM/signals must be observable, bounded, and documented" },
{ "Directive": "EnforceReleaseStructurally", "Clarification": "If release depends on discipline it will leak; enforce via scope/RAII/structure" },
{ "Directive": "RequireTeardownPath", "Clarification": "Long-lived components need init→run→shutdown; missing shutdown = guaranteed leak" },
{ "Directive": "SnapshotMeaningBeforeMutation", "Clarification": "Log resource state before changes, discard only on commit" },
{ "Directive": "AllowDeliberateSlowness", "Clarification": "Insert pauses for human comprehension and inspection" },
{ "Directive": "MakeErrorsPartOfLanguage", "Clarification": "Errors use system vocabulary, parseable and processable" },
{ "Directive": "IncludeHumanInComputation", "Clarification": "Human is part of execution, system explains itself continuously" },
{ "Directive": "ContractBeforeImplementation", "Clarification": "Define API/service/data/schema contracts with explicit pre/post/invariants before implementing; consumers depend on the interface" },
{ "Directive": "EvolveViaVersionedCompatibility", "Clarification": "Breaking changes are versioned and negotiated; maintain backward/forward compatibility (tolerant reader), never silent breakage" },
{ "Directive": "ValidateAtEverySchemaBoundary", "Clarification": "Validate against a schema at every boundary; make invalid states unrepresentable via type safety" },
{ "Directive": "DeriveViewsFromCanonicalTruth", "Clarification": "One canonical model as single source of truth; every view/read model is derived, never a parallel truth" },
{ "Directive": "CommitAtomicallyWithinBoundary", "Clarification": "Changes commit fully or not at all within an explicit transaction boundary; control concurrency by contention profile" },
{ "Directive": "CoordinateViaSagaNotDistributedLock", "Clarification": "Cross-service consistency via sagas and compensating transactions, not distributed 2PC; publish reliably via outbox" },
{ "Directive": "DecoupleViaEventsAndBroker", "Clarification": "Communicate across autonomy boundaries by emitting events through a broker; accept eventual consistency for availability" },
{ "Directive": "OrderByCausalityNotClock", "Clarification": "Order distributed events by happens-before with logical clocks (vector/Lamport), never wall-clock timestamps" },
{ "Directive": "EmitStructuredTelemetryWithCorrelation", "Clarification": "Emit structured logs/metrics/traces with a correlation ID threaded through every hop; audit security-relevant actions immutably" },
{ "Directive": "InvertControlInjectDependencies", "Clarification": "Dependencies are injected, never self-constructed or hidden; extend via plugins at declared extension points, core unchanged" },
{ "Directive": "DiscoverByConventionBindLate", "Clarification": "Register capabilities in a queryable registry; discover implementations by convention at runtime and bind by capability, not hardcoded wiring" },
{ "Directive": "DriveBehaviorDeclarativelyFromMetadata", "Clarification": "Components self-describe via manifest/metadata; behavior is declarative data, convention over configuration; declaring computed facts is drift" },
{ "Directive": "IsolateBoundedContextsWithACL", "Clarification": "Each bounded context owns its model and language; translate at an anti-corruption layer so foreign models cannot leak in" },
{ "Directive": "KeepDomainCoreFreeOfIO", "Clarification": "Domain core depends on nothing; I/O and frameworks are edge adapters (ports & adapters / hexagonal); split by autonomy need, not fashion" },
{ "Directive": "ApplyPatternsByForceNotDefault", "Clarification": "Apply a creational/structural/behavioral pattern only when its force is present; speculative patterns are accidental complexity" },
{ "Directive": "ProcessStreamsSinglePassBounded", "Clarification": "Process large/unbounded data single-pass, forward-only, lazily; keep stages stateless and apply backpressure to bound memory" },
{ "Directive": "IsolateNondeterminismDeterministicCore", "Clarification": "Inject clock/randomness/I/O so the core is deterministic and reproducible; test invariants via property-based verification" },
{ "Directive": "GovernModelsGroundGenerationBoundOutput", "Clarification": "Version and evaluate models like dependencies; ground generation in retrieved evidence (RAG); validate model output at the boundary, never into a trusted sink" }
```
