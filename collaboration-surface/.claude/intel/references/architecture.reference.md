---
id: architecture-principles
title: Architecture principle canon — universal, domain-neutral
domain: architecture
owner: BanesLab
tags: [principles, structural, computation, resource, execution, security, performance, infrastructure, resilience, enforcement, contracts, schema, concurrency, events, causality, observability, extensibility, declarative, domain-modeling, styles, patterns, streaming, correctness, models, tensions]
confidence: high
sources:
  S1: BanesLab principle canon, used under CC BY-SA
---

# architecture-principles

Prefix `ARC`. **This is the principle canon the package itself ships.** It does not claim to be what
`{project.principle_ontology}` resolves to — that slot names the HOST's own catalog and resolves ABSENT
where a host keeps none, so a document claiming to BE a host slot's value would make two truths out of
one binding. A consumer reaching for principles reads the host's catalog where that slot resolves and
this canon otherwise.

Domain-neutral by construction: nothing here names a platform, a language or a tree, so the canon
transfers unchanged and every instance lives in the document that cites it.

> Principle canon authored by Bane's Lab, used under CC BY-SA. Attribution is never stripped.

Records are grouped by domain, and the groups the file carries are the groups it describes. The
`inversions` name a debt and the leverage replacing it; the domain catalogs state the principle; the
`tensions` resolve pairs that only appear to conflict and mark the ones that genuinely do.

**A tension carries its resolution, its remediation and its detection**, because an unresolved apparent
conflict is where a reader silently picks one principle and drops the other — and a `real` tension
carries the trade-off explicitly rather than pretending a separation of domains recovers both.

## loop

### ARC-000
type: procedure
subject: architecture.loop
statement: Architecture is derived by repeating OBSERVE CodeState, SELECT Pattern, CHECK Invariants, DIVERT AutoFix on violation, APPLY Pattern, UPDATE Architecture, until stable.
detect: |
  INITIALIZE<Architecture> → REPEAT {
    OBSERVE<CodeState> → SELECT<Pattern> → CHECK<Invariants>
      → [IF<Violation> DIVERT<AutoFix>] → APPLY<Pattern> → UPDATE<Architecture>
  } UNTIL<Stable>
confidence: community
source: S1

## core-graph

### ARC-001
type: fact
subject: architecture.core
statement: The execution-model core is four domains — computation, resource, execution and structural — and every other domain is cross-cutting and wraps that core.
confidence: community
source: S1

### ARC-002
type: fact
subject: architecture.core.edges
statement: Resource observes computation, computation and resource both feed execution, execution feeds back into structural, and structural governs all three while deriving human factors and evolution.
confidence: community
source: S1

### ARC-003
type: fact
subject: architecture.core.vocabulary
statement: Computation is what happens to data and takes verbs, resource is where data lives and takes nouns, structural is how code is organised and observes itself.
confidence: community
source: S1

```text
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
│    │ • Line cap  │                       │ • YAGNI     │                    │
│    │ • Cognitive │                       │ • Under-spec│                    │
│    │ • Expression│                       │ • Non-goals │                    │
│    │ • Authority │◄──────────────────────│ • Modular   │                    │
│    └─────────────┘                       │ • Approved  │                    │
│                                          └─────────────┘                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Stateless = "What happens to data"   (verbs: transform, validate, compute) │
│  Stateful  = "Where data lives"       (nouns: file, connection, cache)      │
│  Structural = "How code is organized" (applies to both, observes itself)    │
│  Cross-cutting = "Constraints wrapping all of the above"                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## inversions

### ARC-010
type: fact
subject: inversion.no_shortcuts
statement: Never take a shortcut, which is debt; always take a constraint, which is leverage.
confidence: community
source: S1

### ARC-011
type: fact
subject: inversion.no_backward_compat
statement: Never build backward compatibility, which is debt; always build forward compatibility, which compounds.
confidence: community
source: S1

### ARC-012
type: fact
subject: inversion.no_fallback
statement: Never add a fallback, which is debt; always fail fast, which is clarity.
confidence: community
source: S1

### ARC-013
type: fact
subject: inversion.no_deprecation
statement: Never deprecate, which is debt; always remove explicitly, which is coherence.
confidence: community
source: S1

### ARC-014
type: fact
subject: inversion.no_legacy
statement: Never keep legacy, which is debt; always keep greenfield, which is clarity.
confidence: community
source: S1

### ARC-015
type: fact
subject: inversion.no_dual_path
statement: Never run a dual path, which is confusion; always run a single path, which is determinism.
confidence: community
source: S1

### ARC-016
type: fact
subject: inversion.no_deferring
statement: Never defer, which becomes forgetting; always act immediately, which is continuity.
confidence: community
source: S1

### ARC-017
type: fact
subject: inversion.no_optional
statement: Never make a depended-on capability optional, which orients to the user; always make it mandatory, which orients to the system.
confidence: community
source: S1

### ARC-018
type: fact
subject: inversion.no_for_now
statement: Never accept a for-now, which defers into forgetting; always act now, which is continuity.
confidence: community
source: S1

### ARC-019
type: fact
subject: inversion.no_unobserved
statement: Never leave execution unobserved, which misses learning; always observe execution, which produces learning.
confidence: community
source: S1

### ARC-020
type: fact
subject: inversion.no_uncompressed
statement: Never apply a pattern without compression, which is inefficiency; always apply a pattern with compression, which is efficiency.
confidence: community
source: S1

### ARC-021
type: fact
subject: inversion.no_unapproved
statement: Never evolve without approval, which is architectural drift; always evolve with approval, which preserves architectural integrity.
confidence: community
source: S1

### ARC-022
type: fact
subject: inversion.no_ignored_feedback
statement: Never ignore feedback, which is stagnation; always enforce feedback, which is adaptation.
confidence: community
source: S1

### ARC-023
type: fact
subject: inversion.no_shared_ownership
statement: Never share ownership, which is ambiguity; always assign a single owner, which is accountability.
confidence: community
source: S1

### ARC-024
type: fact
subject: inversion.no_unbounded
statement: Never allow unbounded lifetime, which leaks; always bound lifetime, which releases deterministically.
confidence: community
source: S1

### ARC-025
type: fact
subject: inversion.no_asymmetric
statement: Never leave a lifecycle asymmetric, which leaks resources; always enforce symmetry, which guarantees cleanup.
confidence: community
source: S1

### ARC-026
type: fact
subject: inversion.no_implicit
statement: Never retain implicitly, which hides leaks; always retain explicitly, which makes ownership observable.
confidence: community
source: S1

### ARC-027
type: fact
subject: inversion.no_discipline
statement: Never release by discipline, which is human error; always release structurally, which enforces automatically.
confidence: community
source: S1

### ARC-028
type: fact
subject: inversion.no_mutable
statement: Never hold mutable state in computation, which is unpredictability; always hold immutable data, which is reproducibility.
confidence: community
source: S1

### ARC-029
type: fact
subject: inversion.no_silent
statement: Never fail silently, which produces unknown failure; always express errors as language, which is machine-processable.
confidence: community
source: S1

### ARC-030
type: fact
subject: inversion.no_hidden
statement: Never hide invalidity, which is false consistency; always mark invalidity, which is honest uncertainty.
confidence: community
source: S1

### ARC-031
type: fact
subject: inversion.no_callbacks
statement: Never pass parent callbacks, which is tight coupling; always emit events, which decouples.
confidence: community
source: S1

### ARC-032
type: fact
subject: inversion.no_retraction
statement: Never retract, which is complexity; always grow monotonically, which is append-only scalability.
confidence: community
source: S1

### ARC-033
type: fact
subject: inversion.no_location
statement: Never address by location, which is brittle; always address semantically, which references by meaning.
confidence: community
source: S1

### ARC-034
type: fact
subject: inversion.no_timestamps
statement: Never order by timestamp, which depends on the wall clock; always order ordinally, which sequences logically.
confidence: community
source: S1

### ARC-035
type: fact
subject: inversion.no_separation
statement: Never separate code from data, which duplicates; always keep them homoiconic, which unifies code and data.
confidence: community
source: S1

### ARC-036
type: fact
subject: inversion.no_unlimited
statement: Never allow unlimited complexity, which overloads cognition; always bound complexity, which preserves human comprehension.
confidence: community
source: S1

### ARC-037
type: fact
subject: inversion.no_metrics
statement: Never diagnose health by metric, which tracks symptoms; always compute health, which diagnoses symbolically.
confidence: community
source: S1

### ARC-038
type: fact
subject: inversion.no_hardcoded_secrets
statement: Never hardcode secrets, which exposes them; always read from a secret store, which is secure configuration.
confidence: community
source: S1

### ARC-039
type: fact
subject: inversion.no_unvalidated_input
statement: Never accept unvalidated input, which permits injection; always validate at the boundary, which fails fast.
confidence: community
source: S1

### ARC-040
type: fact
subject: inversion.no_broad_privilege
statement: Never grant broad privilege, which widens blast radius; always grant least privilege, which denies by default.
confidence: community
source: S1

### ARC-041
type: fact
subject: inversion.no_env_fallback
statement: Never default an environment value, which silently misconfigures; always externalize config, which fails fast at boot.
confidence: community
source: S1

### ARC-042
type: fact
subject: inversion.no_unmeasured_optimization
statement: Never optimize unmeasured, which is guesswork; always profile first, which is evidence-based.
confidence: community
source: S1

### ARC-043
type: fact
subject: inversion.no_convention_enforcement
statement: Never enforce by convention alone, which drifts; always encode the rule as code, which is an automated gate.
confidence: community
source: S1

### ARC-044
type: fact
subject: inversion.no_implicit_contract
statement: Never leave a contract implicit, which breaks silently; always design by contract, stating preconditions, postconditions and invariants.
confidence: community
source: S1

### ARC-045
type: fact
subject: inversion.no_breaking_change
statement: Never ship an unversioned breaking change, which breaks consumers; always evolve versioned, which is a compatibility contract.
confidence: community
source: S1

### ARC-046
type: fact
subject: inversion.no_untyped_boundary
statement: Never leave a boundary untyped, which admits invalid state; always validate the boundary against a schema, which is type safety.
confidence: community
source: S1

### ARC-047
type: fact
subject: inversion.no_partial_commit
statement: Never commit partially, which corrupts; always commit within an atomic boundary, which is all or nothing.
confidence: community
source: S1

### ARC-048
type: fact
subject: inversion.no_distributed_2pc
statement: Never run cross-service two-phase commit, which couples; always compensate with a saga, which preserves service autonomy.
confidence: community
source: S1

### ARC-049
type: fact
subject: inversion.no_sync_cross_boundary
statement: Never call synchronously across an autonomy boundary, which is fragile; always emit asynchronous events, which decouple temporally.
confidence: community
source: S1

### ARC-050
type: fact
subject: inversion.no_opaque_runtime
statement: Never leave the runtime opaque, which blinds operation; always emit observable signals, which is structured telemetry.
confidence: community
source: S1

### ARC-051
type: fact
subject: inversion.no_hidden_dependency
statement: Never hide a dependency, which conceals coupling; always inject it, which inverts control.
confidence: community
source: S1

### ARC-052
type: fact
subject: inversion.no_hardcoded_wiring
statement: Never hardcode wiring, which is rigid; always discover by convention, which extends at runtime.
confidence: community
source: S1

### ARC-053
type: fact
subject: inversion.no_imperative_config
statement: Never configure imperatively, which drifts; always configure declaratively, which is convention over configuration.
confidence: community
source: S1

### ARC-054
type: fact
subject: inversion.no_leaky_context
statement: Never let a context leak across, which corrupts the model; always translate at an anti-corruption layer, which bounds the context.
confidence: community
source: S1

### ARC-055
type: fact
subject: inversion.no_hidden_nondeterminism
statement: Never hide nondeterminism, which is unreproducible; always inject it, which keeps the core deterministic.
confidence: community
source: S1

### ARC-056
type: fact
subject: inversion.no_speculative_pattern
statement: Never apply a pattern speculatively, which is accidental complexity; always apply by fit, which is force-driven.
confidence: community
source: S1

## structural

### ARC-100
type: fact
subject: structural.soc
statement: Each module holds one concern while the whole system is reasoned about.
confidence: community
source: S1

### ARC-101
type: fact
subject: structural.kiss
statement: The simplest solution is reached through rules and generators rather than enumeration.
confidence: community
source: S1

### ARC-102
type: fact
subject: structural.srp
statement: A unit has one change reason, derived from invariants rather than features.
confidence: community
source: S1

### ARC-103
type: fact
subject: structural.ocp
statement: A system extends without modification through a few composable primitives.
confidence: community
source: S1

### ARC-104
type: fact
subject: structural.lsp
statement: Components are substitutable and operation order does not change the result.
confidence: community
source: S1

### ARC-105
type: fact
subject: structural.isp
statement: Interfaces are shaped by usage and referenced by meaning rather than by location.
confidence: community
source: S1

### ARC-106
type: fact
subject: structural.dip
statement: Code depends on abstractions, in a system where code, data and state are interchangeable.
confidence: community
source: S1

### ARC-107
type: fact
subject: structural.symbol-tables
statement: One truth source is exposed as versioned queryable symbols.
confidence: community
source: S1

### ARC-108
type: fact
subject: structural.semantic-memory
statement: Layers and trees are arranged so that placement reflects meaning.
confidence: community
source: S1

### ARC-109
type: fact
subject: structural.ordinal-time
statement: Horizontal layers are ordered by logical clocks rather than by timestamps.
confidence: community
source: S1

### ARC-110
type: fact
subject: structural.reflective
statement: The system observes its own behaviour and its traces are queryable data.
confidence: community
source: S1

## dry-compression

### ARC-120
type: fact
subject: dry.literal
statement: Literal duplication compresses to function or constant extraction.
confidence: community
source: S1

### ARC-121
type: fact
subject: dry.structural
statement: Structural duplication compresses to abstraction or composition.
confidence: community
source: S1

### ARC-122
type: fact
subject: dry.semantic
statement: Semantic duplication compresses to a canonical function.
confidence: community
source: S1

### ARC-123
type: fact
subject: dry.behavioral
statement: Behavioral duplication compresses to centralized orchestration.
confidence: community
source: S1

### ARC-124
type: fact
subject: dry.logical
statement: Logical duplication compresses to predicate normalization.
confidence: community
source: S1

### ARC-125
type: fact
subject: dry.data
statement: Data duplication compresses to a single source of truth.
confidence: community
source: S1

### ARC-126
type: fact
subject: dry.knowledge
statement: Knowledge duplication compresses to a schema-driven system.
confidence: community
source: S1

### ARC-127
type: fact
subject: dry.temporal
statement: Temporal duplication compresses to parameterization.
confidence: community
source: S1

### ARC-128
type: fact
subject: dry.configurational
statement: Configurational duplication compresses to config centralization.
confidence: community
source: S1

### ARC-129
type: fact
subject: dry.interface
statement: Interface duplication compresses to a shared contract or schema.
confidence: community
source: S1

### ARC-130
type: fact
subject: dry.process
statement: Process duplication compresses to pipeline reuse.
confidence: community
source: S1

### ARC-131
type: fact
subject: dry.conceptual
statement: Conceptual duplication compresses to domain unification.
confidence: community
source: S1

### ARC-132
type: fact
subject: dry.representational
statement: Representational duplication compresses to a canonical format.
confidence: community
source: S1

### ARC-133
type: fact
subject: dry.validation
statement: Validation duplication compresses to a single validation layer.
confidence: community
source: S1

### ARC-134
type: fact
subject: dry.derivational
statement: Derivational duplication compresses to compute-on-read where that is viable.
confidence: community
source: S1

### ARC-135
type: fact
subject: dry.multi-domain
statement: Structure sharing appears outside code as shared libraries, referenced passages in writing, cited sources in research and linked accounts in finance.
confidence: community
source: S1

## computation

Stateless transformation. Data flows through and never mutates; outputs are frozen.

### ARC-200
type: fact
subject: computation.immutability
statement: Data is frozen and variables are assigned exactly once.
confidence: community
source: S1

### ARC-201
type: fact
subject: computation.stateless
statement: Computation holds no persistent state, and undo restores meaning rather than bytes.
confidence: community
source: S1

### ARC-202
type: fact
subject: computation.idempotency
statement: A repeated operation yields the same result, and quick recovery is designed in.
confidence: community
source: S1

### ARC-203
type: fact
subject: computation.declarative
statement: Computation specifies what rather than how, and the system answers why while running.
confidence: community
source: S1

### ARC-204
type: fact
subject: computation.parameterized
statement: Behaviour is controlled by inputs and names are assigned only when needed.
confidence: community
source: S1

### ARC-205
type: fact
subject: computation.composable
statement: Parts combine freely and the compile-time and runtime boundary is not hard.
confidence: community
source: S1

### ARC-206
type: fact
subject: computation.traces
statement: Execution traces are first-class objects, queryable and replayable.
confidence: community
source: S1

### ARC-207
type: fact
subject: computation.justification
statement: A value carries why it was computed, not only where it came from.
confidence: community
source: S1

### ARC-208
type: fact
subject: computation.explicit-invalidity
statement: Temporary inconsistency in computation is permitted when it is marked.
confidence: community
source: S1

### ARC-209
type: fact
subject: computation.errors-as-language
statement: Errors use the system's vocabulary and are machine-processable.
confidence: community
source: S1

## resource

Stateful lifecycle. Resources are owned, tracked and explicitly released.

### ARC-210
type: fact
subject: resource.single-owner
statement: Every resource has exactly one deterministic owner responsible for releasing it.
confidence: community
source: S1

### ARC-211
type: limit
subject: resource.bounded-lifetime
statement: A resource's lifetime is contained within its owner's lifetime, and an unbounded lifetime is a leak candidate.
confidence: community
source: S1

### ARC-212
type: fact
subject: resource.enforced-symmetry
statement: Open pairs with close, subscribe with unsubscribe, start with stop, each guaranteed and exception-safe.
confidence: community
source: S1

### ARC-213
type: pitfall
subject: resource.reachable-not-useful
statement: Garbage collection frees the unreachable rather than the unused, so an architectural leak survives it.
confidence: community
source: S1

### ARC-214
type: fact
subject: resource.weak-non-owners
statement: A reference that does not imply ownership is weak or ephemeral.
confidence: community
source: S1

### ARC-215
type: fact
subject: resource.explicit-retention
statement: Retention hidden in dependency injection, object-relational mapping or observers is observable and bounded.
confidence: community
source: S1

### ARC-216
type: pitfall
subject: resource.structural-release
statement: Release that depends on human discipline leaks, so it is enforced through scope or structure.
confidence: community
source: S1

### ARC-217
type: fact
subject: resource.teardown-path
statement: Every long-lived component has init, run and shutdown, and a missing shutdown is a leak.
confidence: community
source: S1

### ARC-218
type: fact
subject: resource.state-before-mutation
statement: Semantic resource state is snapshotted before it changes.
confidence: community
source: S1

### ARC-219
type: fact
subject: resource.predictable-gc
statement: Collection pauses are deterministic and fall at semantic boundaries.
confidence: community
source: S1

### ARC-220
type: fact
subject: resource.concept-gc
statement: Collection also reclaims unused rules and obsolete concepts, not only memory.
confidence: community
source: S1

## execution

How computation and resources interact at runtime.

### ARC-230
type: fact
subject: execution.negotiation
statement: A parent passes no callbacks, and execution may counter-propose rather than comply.
confidence: community
source: S1

### ARC-231
type: fact
subject: execution.event-driven
statement: Parts communicate by events, and pause and resume is a continuation rather than an exception.
confidence: community
source: S1

### ARC-232
type: fact
subject: execution.monotonic-growth
statement: Growth is handled by appending, never by retracting.
confidence: community
source: S1

### ARC-233
type: fact
subject: execution.orthogonality
statement: Changes are isolated and state is restored by reinstantiation from a snapshot.
confidence: community
source: S1

### ARC-234
type: fact
subject: execution.fail-fast
statement: Errors are detected immediately, and an inconsistent resource halts execution.
confidence: community
source: S1

## human-factors

The limits of human comprehension and attention.

### ARC-240
type: fact
subject: human.cohesion
statement: Related logic sits together, bounded by what a person can hold at once.
confidence: community
source: S1

### ARC-241
type: limit
subject: human.bounded-complexity
statement: A unit is bounded by how many reasons it has to change and by what a reader can hold at once, and work stops on uncertainty rather than proceeding to silent incorrectness.
detect: Where a host declares a size cap, that cap is its measurement of this principle and its own linter holds it; where none is declared the bound is the single reason to change, which is the stronger constraint because it survives a file that is short and still holds two jobs. A number stated here would be an instance masquerading as a principle.
confidence: community
source: S1

### ARC-242
type: fact
subject: human.encapsulation
statement: Internals are hidden and the system ships with a live inspector.
confidence: community
source: S1

### ARC-243
type: fact
subject: human.loose-coupling
statement: Dependencies are minimized and health is diagnosed symbolically.
confidence: community
source: S1

### ARC-244
type: fact
subject: human.in-loop
statement: The human is part of the computation and the system explains itself.
confidence: community
source: S1

### ARC-245
type: fact
subject: human.deliberate-slowness
statement: Pauses are inserted where comprehension requires them.
confidence: community
source: S1

## evolution

How the system grows and adapts.

### ARC-250
type: fact
subject: evolution.modular
statement: Units are independent and swappable, and state is protected ahead of code.
confidence: community
source: S1

### ARC-251
type: fact
subject: evolution.under-spec
statement: Features are added externally and interfaces are deliberately left room to evolve.
confidence: community
source: S1

### ARC-252
type: fact
subject: evolution.yagni
statement: Unneeded code is not built, and what the system does not do is documented.
confidence: community
source: S1

## security

Every boundary where untrusted input, credentials or authority crosses.

### ARC-300
type: fact
subject: security.defense-in-depth
statement: Controls sit at every layer rather than at the perimeter alone.
confidence: community
source: S1

### ARC-301
type: fact
subject: security.least-privilege
statement: Scope is minimal, access is denied by default and defaults are safe.
confidence: community
source: S1

### ARC-302
type: fact
subject: security.input-validation
statement: External input is validated and sanitized at the boundary against a schema.
confidence: community
source: S1

### ARC-303
type: fact
subject: security.output-encoding
statement: Output is encoded for its context at every sink, and no raw user-controlled value reaches one.
confidence: community
source: S1

### ARC-304
type: fact
subject: security.secrets
statement: Credentials come from a secret store and never appear in code, config or logs.
confidence: community
source: S1

### ARC-305
type: fact
subject: security.authz
statement: Identity is verified and then each action is authorized, because authenticated is not authorized.
confidence: community
source: S1

### ARC-306
type: fact
subject: security.attack-surface
statement: Unused endpoints, permissions and features are removed.
confidence: community
source: S1

### ARC-307
type: fact
subject: security.encryption
statement: Sensitive data is protected in transit and at rest.
confidence: community
source: S1

## performance

Hot paths, growth and resource budgets.

### ARC-310
type: fact
subject: performance.scalability
statement: State is externalized so work scales out horizontally.
confidence: community
source: S1

### ARC-311
type: fact
subject: performance.profile-first
statement: The bottleneck is measured before anything is optimized.
confidence: community
source: S1

### ARC-312
type: fact
subject: performance.complexity
statement: The complexity of critical paths is known, and avoidable quadratic or exponential growth is avoided.
confidence: community
source: S1

### ARC-313
type: fact
subject: performance.caching
statement: Expensive stable results are cached within a bound, with a time to live or an invalidation path.
confidence: community
source: S1

### ARC-314
type: fact
subject: performance.rate-limiting
statement: Access to constrained or expensive resources is bounded by rate limiting and backpressure.
confidence: community
source: S1

### ARC-315
type: fact
subject: performance.resource-efficiency
statement: Data is streamed or chunked rather than fully materialized, bounding peak memory.
confidence: community
source: S1

## infrastructure

How the system is configured, packaged and deployed.

### ARC-320
type: fact
subject: infrastructure.config
statement: Configuration comes from the environment and is validated at boot, with no fallback default.
confidence: community
source: S1

### ARC-321
type: fact
subject: infrastructure.parity
statement: Behaviour is config-driven, and a portable layer assumes no platform or operating system.
confidence: community
source: S1

### ARC-322
type: fact
subject: infrastructure.as-code
statement: Provisioning is declarative, versioned and reproducible, with drift detected.
confidence: community
source: S1

### ARC-323
type: fact
subject: infrastructure.deployment-safety
statement: Deploys are reversible and migrations are append-only, never edited in place.
confidence: community
source: S1

### ARC-324
type: fact
subject: infrastructure.containerization
statement: The runtime is declared and no host dependency is undeclared.
confidence: community
source: S1

## resilience

How the system behaves under failure.

### ARC-330
type: fact
subject: resilience.fail-fast
statement: Invalid state halts, and no fallback or default masks the failure.
confidence: community
source: S1

### ARC-331
type: fact
subject: resilience.retry-safety
statement: A repeated operation yields the same result, so retries are safe.
confidence: community
source: S1

### ARC-332
type: fact
subject: resilience.snapshot-recovery
statement: Recovery is reinstantiation from a durable checkpoint rather than patching in place.
confidence: community
source: S1

### ARC-333
type: fact
subject: resilience.circuit-breaking
statement: Cascading failure and overload are bounded by backpressure and circuit breaking.
confidence: community
source: S1

### ARC-334
type: fact
subject: resilience.bounded-recovery
statement: Retry is evidence-based and limited, escalating to a human on exhaustion.
confidence: community
source: S1

## enforcement

How architectural invariants stay true over time.

### ARC-340
type: fact
subject: enforcement.rule-as-code
statement: Every architectural invariant is encoded as an automated rule or detector.
confidence: community
source: S1

### ARC-341
type: fact
subject: enforcement.fitness-functions
statement: Architecture properties are verified continuously, not only unit behaviour.
confidence: community
source: S1

### ARC-342
type: fact
subject: enforcement.register-regenerate
statement: A new or changed rule is registered and regenerated into the enforcement catalog so it is active.
confidence: community
source: S1

### ARC-343
type: fact
subject: enforcement.continuous-compliance
statement: Gates are automated rather than convention-only.
confidence: community
source: S1

### ARC-344
type: fact
subject: enforcement.delete-dead
statement: Removing a rule or pattern deletes its dead path in the same change, leaving zero orphans.
confidence: community
source: S1

## contracts

Every boundary two components agree across.

### ARC-350
type: fact
subject: contracts.design-by-contract
statement: Preconditions, postconditions and invariants are stated and checked rather than assumed.
confidence: community
source: S1

### ARC-351
type: fact
subject: contracts.contract-first
statement: The contract is defined before the implementation, and consumers depend on the interface rather than the concretion.
confidence: community
source: S1

### ARC-352
type: fact
subject: contracts.semantic
statement: Meaning is part of the contract, and one interface shape is kept across like resources.
confidence: community
source: S1

### ARC-353
type: fact
subject: contracts.compatibility
statement: New consumers read old data and old consumers tolerate new fields.
confidence: community
source: S1

### ARC-354
type: fact
subject: contracts.versioning
statement: A breaking change is versioned and negotiated at the boundary, never silent.
confidence: community
source: S1

### ARC-355
type: fact
subject: contracts.canonical-format
statement: Independent parts compose only on an agreed canonical representation.
confidence: community
source: S1

## schema

The structure and meaning of data as it crosses boundaries and persists.

### ARC-360
type: fact
subject: schema.validation
statement: Every boundary validates against a schema, and types make invalid states unrepresentable.
confidence: community
source: S1

### ARC-361
type: fact
subject: schema.canonical-model
statement: One canonical representation exists and every view derives from it, never as a parallel truth.
confidence: community
source: S1

### ARC-362
type: fact
subject: schema.canonicalization
statement: Data is reduced to one canonical form before comparison or storage.
confidence: community
source: S1

### ARC-363
type: fact
subject: schema.ubiquitous-language
statement: A term means the same thing everywhere and names are shared with the domain.
confidence: community
source: S1

### ARC-364
type: fact
subject: schema.intent-revealing
statement: Names state intent and behaviour matches the reader's expectation.
confidence: community
source: S1

## concurrency

Where multiple actors touch shared state, or a change must be all-or-nothing.

### ARC-370
type: fact
subject: concurrency.atomicity
statement: A change commits fully or not at all within an explicit boundary.
confidence: community
source: S1

### ARC-371
type: fact
subject: concurrency.acid
statement: Operations are atomic, consistent, isolated and durable, preserving invariants across the change.
confidence: community
source: S1

### ARC-372
type: fact
subject: concurrency.isolation
statement: Concurrent operations do not corrupt each other, controlled optimistically or pessimistically by contention profile.
confidence: community
source: S1

### ARC-373
type: fact
subject: concurrency.state-isolation
statement: Mutable state is confined to owners and side effects are explicit, ordered and bounded.
confidence: community
source: S1

### ARC-374
type: fact
subject: concurrency.idempotency-keys
statement: Repeated delivery yields exactly one effect, deduplicated by key.
confidence: community
source: S1

## events

Decoupling producers from consumers across time and process boundaries.

### ARC-380
type: fact
subject: events.pub-sub
statement: Parts communicate by emitting events, and subscribers are unknown to producers.
confidence: community
source: S1

### ARC-381
type: fact
subject: events.broker
statement: Messages are buffered and routed through a broker, decoupling availability and pace.
confidence: community
source: S1

### ARC-382
type: fact
subject: events.sourcing
statement: State is persisted as an immutable event sequence and current state is a fold over it.
confidence: community
source: S1

### ARC-383
type: fact
subject: events.cqrs
statement: The write model is separated from read models, and internal domain events are distinguished from published integration events.
confidence: community
source: S1

### ARC-384
type: fact
subject: events.eventual-consistency
statement: Bounded staleness is accepted so services stay independently available.
confidence: community
source: S1

### ARC-385
type: fact
subject: events.saga
statement: Cross-service work is coordinated with compensations and published reliably through an outbox.
confidence: community
source: S1

## causality

Ordering and dependency across processes with no global clock.

### ARC-390
type: fact
subject: causality.happens-before
statement: Order follows logical dependency rather than wall-clock time.
confidence: community
source: S1

### ARC-391
type: fact
subject: causality.logical-clocks
statement: Causal order is tracked with vector or Lamport clocks, preserving cause before effect.
confidence: community
source: S1

### ARC-392
type: fact
subject: causality.dag
statement: Dependencies form an acyclic graph, and a cycle is a design defect.
confidence: community
source: S1

## observability

Making a running system's behaviour and history inspectable.

### ARC-400
type: fact
subject: observability.structured-logging
statement: Signals are emitted machine-parseable as logs, metrics and traces.
confidence: community
source: S1

### ARC-401
type: fact
subject: observability.alerting
statement: Alerts fire on computed symbolic conditions rather than raw noise.
confidence: community
source: S1

### ARC-402
type: fact
subject: observability.correlation
statement: A correlation identifier is threaded through every hop and what caused what is recorded.
confidence: community
source: S1

### ARC-403
type: fact
subject: observability.audit
statement: Security and compliance relevant actions are recorded immutably.
confidence: community
source: S1

## extensibility

How the system is wired and extended without changing its core.

### ARC-410
type: fact
subject: extensibility.ioc
statement: The framework calls the component, and dependencies are injected rather than self-constructed or hidden.
confidence: community
source: S1

### ARC-411
type: fact
subject: extensibility.plugins
statement: New behaviour arrives as plugins at declared extension points with the core unchanged.
confidence: community
source: S1

### ARC-412
type: fact
subject: extensibility.registry
statement: Capabilities are registered in one queryable place, avoiding a locator that hides dependencies.
confidence: community
source: S1

### ARC-413
type: fact
subject: extensibility.discovery
statement: Implementations are discovered by convention at runtime and bound by capability rather than hardcoded wiring.
confidence: community
source: S1

## declarative

Systems that describe themselves and are driven by data.

### ARC-420
type: fact
subject: declarative.manifest
statement: Components declare their own capabilities and the manifest is the spine.
confidence: community
source: S1

### ARC-421
type: pitfall
subject: declarative.computed-facts
statement: Declaring a fact that could be computed is drift, because a declaration that disagrees with the code is a lie nothing catches.
confidence: community
source: S1

### ARC-422
type: fact
subject: declarative.metadata-driven
statement: Behaviour is specified as data, and convention over configuration removes boilerplate.
confidence: community
source: S1

### ARC-423
type: fact
subject: declarative.capability
statement: A component declares what it provides and requires, and tooling computes the rest.
confidence: community
source: S1

### ARC-424
type: fact
subject: declarative.homoiconicity
statement: Definitions are inspectable and transformable as data.
confidence: community
source: S1

### ARC-425
type: fact
subject: declarative.metaprogramming
statement: Structure is generated or inspected programmatically, preferring compile-time evaluation to runtime code generation.
confidence: community
source: S1

### ARC-426
type: fact
subject: declarative.dsl
statement: Abstraction is raised to the domain and intent is compiled to implementation.
confidence: community
source: S1

## domain-modeling

Structuring software around the domain rather than the framework.

### ARC-430
type: fact
subject: domain.model
statement: The domain is modeled explicitly and logic lives in the model rather than scattered across services.
confidence: community
source: S1

### ARC-431
type: fact
subject: domain.bounded-context
statement: Each context owns its model and language, and relationships between contexts are mapped explicitly.
confidence: community
source: S1

### ARC-432
type: fact
subject: domain.anti-corruption
statement: Translation happens at the edge so a foreign model cannot leak in and corrupt the local one.
confidence: community
source: S1

## styles

The overall shape of a system and how its parts coordinate.

### ARC-440
type: fact
subject: styles.ports-adapters
statement: The domain core depends on nothing, and input, output and frameworks are adapters at the edge.
confidence: community
source: S1

### ARC-441
type: fact
subject: styles.layered
statement: Organisation follows concern or feature with one-directional dependencies.
confidence: community
source: S1

### ARC-442
type: fact
subject: styles.monolith-vs-services
statement: A system splits by autonomy need rather than fashion, and a modular monolith beats premature distribution.
confidence: community
source: S1

### ARC-443
type: fact
subject: styles.coordination
statement: A defined workflow is orchestrated under one owner while autonomous reactions are choreographed through events, with cross-cutting configuration centralized and domain decisions decentralized.
confidence: community
source: S1

## patterns

Named solutions applied when the force is present, never speculatively.

### ARC-450
type: fact
subject: patterns.creational
statement: Factory, abstract factory, builder and prototype hide construction behind the interface.
confidence: community
source: S1

### ARC-451
type: fact
subject: patterns.structural
statement: Adapter translates interfaces, facade simplifies a subsystem, proxy controls access, bridge splits abstraction from implementation, and decorator composes behaviour over inheritance.
confidence: community
source: S1

### ARC-452
type: fact
subject: patterns.behavioral
statement: Strategy swaps algorithms, template method fixes an invariant flow with hooks, observer emits events, and mediator centralizes interaction.
confidence: community
source: S1

## streaming

Processing data that is large, continuous or unbounded.

### ARC-460
type: fact
subject: streaming.single-pass
statement: Data is processed incrementally without materializing the whole set.
confidence: community
source: S1

### ARC-461
type: fact
subject: streaming.pipeline
statement: Stages compose and pass data forward, each owning one concern.
confidence: community
source: S1

### ARC-462
type: fact
subject: streaming.lazy
statement: Values are computed on demand and read in order to bound memory.
confidence: community
source: S1

### ARC-463
type: fact
subject: streaming.backpressure
statement: Stages stay stateless where possible and producers are bounded to consumer capacity.
confidence: community
source: S1

## correctness

Making behaviour predictable, reproducible and provable.

### ARC-470
type: fact
subject: correctness.determinism
statement: The same inputs yield the same outputs, with clock, randomness and input-output isolated and injected.
confidence: community
source: S1

### ARC-471
type: fact
subject: correctness.referential-transparency
statement: An expression is replaceable by its value and the core stays pure.
confidence: community
source: S1

### ARC-472
type: fact
subject: correctness.reproducibility
statement: A run reproduces from pinned inputs and results are stable across runs.
confidence: community
source: S1

### ARC-473
type: fact
subject: correctness.testability
statement: Design admits verification, and tests assert invariants and properties rather than examples alone.
confidence: community
source: S1

### ARC-474
type: fact
subject: correctness.static-analysis
statement: Properties are proven ahead of runtime where the cost is justified.
confidence: community
source: S1

### ARC-475
type: fact
subject: correctness.validation-vs-verification
statement: Validation checks against intent and verification checks against specification.
confidence: community
source: S1

## models

Composing systems around learned models, retrieval and generation.

### ARC-480
type: fact
subject: models.governance
statement: Models are versioned, gated and evaluated like any dependency, and measured before being trusted.
confidence: community
source: S1

### ARC-481
type: fact
subject: models.retrieval
statement: Generation is grounded in retrieved evidence, retrieved by semantic similarity, with sources cited.
confidence: community
source: S1

### ARC-482
type: fact
subject: models.explainability
statement: Knowledge is structured for queryable reasoning and the system can explain its output.
confidence: community
source: S1

### ARC-483
type: fact
subject: models.boundary
statement: Model authority is bounded and model output is validated at the boundary, never reaching a trusted sink raw.
confidence: community
source: S1

## tensions

Pairs that appear to conflict and do not, because each applies to a different domain. An unresolved
apparent conflict is where a reader silently picks one and drops the other.

### ARC-500
type: tension
subject: tension.state-authority
kind: apparent
conflicts: ARC-201 — computation.stateless
with: ARC-218 — resource.state-before-mutation
axis: whether state may be held across a call
cause: each record omits its domain qualifier when read alone, so one appears to forbid holding state while the other requires it.
statement: Computation holds no persistent state, while a resource holds state and snapshots it before mutation.
resolution: Decide by what the unit is. A transformation holds nothing; an owner of a handle, connection or entity holds state and captures it before changing it.
remediate: Separate the unit into a stateless transformation and a stateful owner, then have the owner call the transformation.
detect: A unit that both transforms data and owns a handle has merged the two domains; the merge is the defect rather than either principle.
compatible: ARC-200, ARC-210, ARC-217
incompatible: none
confidence: community
source: S1

### ARC-501
type: tension
subject: tension.mutability
kind: apparent
conflicts: ARC-200 — computation.immutability
with: ARC-250 — evolution.modular
axis: whether a value may change after creation
cause: one governs computed outputs and the other governs resource state, and both are stated as though they covered all data.
statement: Computed data is frozen after creation, while resource state is mutable and managed.
resolution: Freeze what was computed. Manage what is owned. Code is replaceable; owned state is precious and protected first.
remediate: Return new values from transformations rather than mutating arguments, and confine mutation to the owner that the state belongs to.
detect: A transformation that writes back into its input has taken on resource semantics it does not own.
compatible: ARC-028, ARC-373
incompatible: none
confidence: community
source: S1

### ARC-502
type: tension
subject: tension.invalid-state-response
kind: apparent
conflicts: ARC-234 — execution.fail-fast
with: ARC-208 — computation.explicit-invalidity
axis: what happens on encountering an invalid or uncertain value
cause: both answer the same question and give opposite answers, because they are scoped to different kinds of invalidity.
statement: A resource invariant violation halts immediately, while computation uncertainty is marked and allowed to continue.
resolution: A broken invariant on owned state halts. An uncertain or incomplete computed value is marked and flows on carrying its mark.
remediate: Classify the invalidity before choosing. If continuing could corrupt owned state, halt; if it only widens uncertainty, mark it.
detect: Unmarked uncertainty flowing onward, or a halt on a value that was merely incomplete, means the classification was skipped.
compatible: ARC-029, ARC-330
incompatible: none
confidence: community
source: S1

### ARC-503
type: tension
subject: tension.speculative-work
kind: apparent
conflicts: ARC-252 — evolution.yagni
with: ARC-251 — evolution.under-spec
axis: how much to build for a future that has not arrived
cause: both address the future and appear to disagree, because one constrains implementation and the other constrains interface.
statement: No code is written for a hypothetical feature, while no interface constraint blocks one.
resolution: Apply YAGNI to implementation and under-specification to interfaces. Build nothing extra; forbid nothing extra.
remediate: Cut the speculative implementation and keep the interface open, rather than narrowing the interface to match what was built.
detect: An interface that only admits the one case currently implemented has applied YAGNI to the wrong surface.
compatible: ARC-103, ARC-056
incompatible: none
confidence: community
source: S1

### ARC-504
type: tension
subject: tension.identity-of-definitions
kind: apparent
conflicts: ARC-210 — resource.single-owner
with: ARC-424 — declarative.homoiconicity
axis: whether a thing may be freely copied and transformed
cause: ownership forbids duplicating a runtime resource while homoiconicity encourages treating definitions as transformable data, and the word "thing" covers both.
statement: Ownership governs runtime resources, while homoiconicity governs definitions.
resolution: A handle, connection or entity has one owner and is never copied. A definition, rule or config is data and may be inspected, transformed and regenerated freely.
remediate: Ask whether releasing it means anything. If release is meaningless, it is a definition; if release matters, it is a resource.
detect: A definition guarded by ownership ceremony, or a live handle serialized as if it were data.
compatible: ARC-035, ARC-421
incompatible: none
confidence: community
source: S1

### ARC-505
type: tension
subject: tension.consistency-vs-availability
kind: real
conflicts: ARC-371 — concurrency.acid
with: ARC-384 — events.eventual-consistency
axis: what a partitioned system does when it cannot be both consistent and available
cause: under partition the two are genuinely exclusive; no separation of domains recovers both.
statement: Strong consistency holds within a transaction boundary, while eventual consistency holds across autonomy boundaries under partition.
resolution: Choose per boundary, and record the choice. Inside one owner's transaction, choose consistency. Across autonomy boundaries, choose availability and accept bounded staleness.
remediate: Move the operation inside a single transaction boundary if it must be consistent; otherwise make it a saga with compensation and state the staleness bound.
detect: A cross-service operation expecting transactional semantics has assumed a boundary it does not have.
compatible: ARC-385, ARC-370
incompatible: ARC-371 and ARC-384 cannot both hold across one partitioned boundary
confidence: community
source: S1

### ARC-506
type: tension
subject: tension.duplication-vs-locality
kind: real
conflicts: ARC-125 — dry.data
with: ARC-131 — dry.conceptual
axis: whether two similar things should be unified
cause: textual similarity and semantic identity are different properties, and only one of them justifies unification.
statement: Knowledge is centralized as rules, schemas and one source of truth, while incidental co-occurrence stays local.
resolution: Unify only where the two would have to change together. If changing one without the other would be a bug, they are one thing; if not, the similarity is coincidence.
remediate: Leave coincidental similarity alone, and when uncertain wait for the third occurrence rather than abstracting the second.
detect: A shared abstraction whose callers each pass flags to opt out of the other's behaviour was a false unification.
compatible: ARC-101, ARC-122
incompatible: unifying on coincidental similarity contradicts ARC-102
confidence: community
source: S1

### ARC-507
type: tension
subject: tension.coordination-shape
kind: real
conflicts: ARC-443 — styles.coordination
with: ARC-380 — events.pub-sub
axis: whether a workflow has a coordinating owner or none
cause: a system cannot simultaneously have a central conductor and be leaderless, so the shape is chosen rather than derived.
statement: A defined workflow is orchestrated under one coordinating owner, while autonomous reactions are choreographed through events with no conductor.
resolution: Choose by autonomy need. If the sequence must be known, recoverable and owned, orchestrate. If the parts must stay independently deployable and available, choreograph.
remediate: Name the owner of the workflow. If no single owner can exist, the workflow is choreography and the ordering must come from causality rather than a conductor.
detect: An orchestrator that must be modified whenever a participant is added has taken on the coupling choreography exists to avoid.
compatible: ARC-390, ARC-411
incompatible: one workflow cannot be both orchestrated and choreographed
confidence: community
source: S1

### ARC-508
type: tension
subject: tension.normalization-vs-read-cost
kind: apparent
conflicts: ARC-361 — schema.canonical-model
with: ARC-383 — events.cqrs
axis: whether data may be duplicated for read performance
cause: denormalization looks like a violation of one canonical truth until write and read models are distinguished.
statement: The source of truth is normalized, while derived read models are denormalized.
resolution: Normalize the canonical store and denormalize only projections derived from it. A projection is rebuildable; the canonical store is not.
remediate: Rebuild the projection from the canonical store rather than writing to both, and never accept a write directly into a read model.
detect: A read model that cannot be rebuilt from the canonical store has become a second source of truth.
compatible: ARC-382, ARC-125
incompatible: none
confidence: community
source: S1

### ARC-509
type: tension
subject: tension.call-coupling
kind: real
conflicts: ARC-049 — inversion.no_sync_cross_boundary
with: ARC-101 — structural.kiss
axis: whether a call crosses a boundary synchronously
cause: synchronous calls are simpler and asynchronous calls are more available, and the boundary decides which cost is acceptable.
statement: Synchronous calls are acceptable within a trust or consistency boundary, while asynchronous events are required across autonomy boundaries.
resolution: Stay synchronous inside a boundary where coupling is already accepted. Go asynchronous the moment the callee is independently deployable or independently failing.
remediate: Replace the cross-boundary call with an emitted event and a subscriber, and accept the staleness rather than the coupling.
detect: A synchronous call whose failure takes down an otherwise healthy caller has crossed an autonomy boundary.
compatible: ARC-381, ARC-333
incompatible: synchronous coupling across an autonomy boundary contradicts ARC-384
confidence: community
source: S1

### ARC-510
type: tension
subject: tension.convention-vs-contract
kind: apparent
conflicts: ARC-413 — extensibility.discovery
with: ARC-351 — contracts.contract-first
axis: whether agreement rests on convention or on a stated contract
cause: both describe how parts agree, and each is correct on a different side of the boundary.
statement: Convention drives internal wiring and discovery, while explicit contracts govern external boundaries.
resolution: Use convention where both sides are changed together and a break is caught immediately. Require a contract wherever a consumer can be out of step.
remediate: Promote the convention to a stated, versioned contract at the point where an external consumer starts depending on it.
detect: An external consumer relying on a naming convention is depending on something nobody promised.
compatible: ARC-052, ARC-354
incompatible: none
confidence: community
source: S1

## directives

The imperative form each principle takes when acted on. Directive first, clarification second.

| directive | clarification |
|---|---|
| EnforceSingleConcernWithSystemView | Module handles one concern while maintaining whole-system mental model |
| CompressToSimplest | Simplest solution via rules/generators, never raw enumeration |
| EliminateDuplicationViaSharing | No duplicate logic, maximize structure sharing with copy-on-write |
| DeriveResponsibilityFromInvariants | Single change reason derived from constraints, not features |
| ExtendViaComposablePrimitives | Open for extension via few minimal composable interfaces |
| EnsureSubstitutabilityAndConfluence | Replaceable components where operation order doesn't affect result |
| SegregateByMeaning | Interfaces contain only used methods, addressed semantically |
| InvertToInterchangeableAbstractions | Depend on abstractions where code/data/state are same class |
| ForbidCallbacksAllowNegotiation | No parent callbacks, but execution may refuse or counter-propose |
| ParameterizeWithDeferredNames | Behavior controlled by inputs, names assigned only when necessary |
| CentralizeAsVersionedSymbols | Single truth source via queryable persistent symbol tables |
| ScaleMonotonically | Handle growth without redesign via append-only structures |
| ComposeAcrossPhases | Combine modules freely, no hard compile/runtime boundary |
| ExtendWithoutOverspecifying | Add features externally, deliberately leave room for evolution |
| IsolateModulesProtectState | Independent swappable units, state is precious code is replaceable |
| OrganizeHierarchicallyByMeaning | Layers/trees where memory placement reflects semantic relationships |
| AvoidUnnecessaryDocumentNonGoals | Don't build unneeded features, explicitly state what system won't do |
| FailImmediatelyHaltOnInconsistency | Detect and report errors immediately, never continue with invalid resource state |
| MinimizeDependenciesDiagnoseSymbolically | Reduce coupling, infer system health rather than metric it |
| ConcentrateLogicConstrainCognition | Related code together, human mental capacity is design parameter |
| EncapsulateButShipInspector | Hide internals, but production supports live introspection |
| FreezeDataAssignOnce | Computed data immutable after creation, variables assigned exactly once |
| EnsureRepeatableWithQuickRecovery | Same result on repeat, state reconstruction designed-in |
| SeparateConcernsRestoreBySnapshot | Changes don't affect unrelated areas, backtrack via reinstantiation |
| LayerWithLogicalTime | Horizontal organization with phase markers over wall clocks |
| EmitEventsAllowInterruption | Communicate via events, pause/inspect/resume is control flow |
| DeclareIntentExplainAtRuntime | Specify what not how, system answers 'why' during execution |
| AvoidStateUndoSemantically | Computation has no persistent state, rollback restores meaning not bytes |
| BoundComplexityAcceptPartialCorrectness | 200 lines per code file max, stop with uncertainty over silent incorrectness |
| TreatTracesAsFirstClass | Execution traces are manipulable, queryable, replayable objects |
| AttachJustificationToValues | Values carry why they were computed, not just provenance |
| AllowMarkedInvalidState | Computation uncertainty permitted if explicitly marked |
| PauseGCAtSemanticBoundaries | Deterministic GC pauses aligned with phase transitions |
| CollectUnusedConcepts | GC finds obsolete rules and abandoned hypotheses, not just memory |
| TreatRulesAsData | Constraints and invariants are queryable first-class objects, not implicit assumptions |
| EnforceSingleOwnership | Every runtime resource has exactly one owner; shared ownership requires ref-counting or weak refs |
| BoundLifetimeToOwner | Resource lifetime must be subset of owner lifetime, unbounded = leak candidate |
| GuaranteeSymmetricRelease | Open→Close, Subscribe→Unsubscribe must be guaranteed, single-path, exception-safe |
| DistinguishReachableFromUseful | GC frees unreachable not unused; architectural leaks via caches/observers survive GC |
| WeakenNonOwningReferences | References not implying ownership must be weak, ephemeral, or recalculable |
| MakeRetentionExplicit | Hidden retention in DI/ORM/signals must be observable, bounded, and documented |
| EnforceReleaseStructurally | If release depends on discipline it will leak; enforce via scope/RAII/structure |
| RequireTeardownPath | Long-lived components need init→run→shutdown; missing shutdown = guaranteed leak |
| SnapshotMeaningBeforeMutation | Log resource state before changes, discard only on commit |
| AllowDeliberateSlowness | Insert pauses for human comprehension and inspection |
| MakeErrorsPartOfLanguage | Errors use system vocabulary, parseable and processable |
| IncludeHumanInComputation | Human is part of execution, system explains itself continuously |
| ContractBeforeImplementation | Define API/service/data/schema contracts with explicit pre/post/invariants before implementing; consumers depend on the interface |
| EvolveViaVersionedCompatibility | Breaking changes are versioned and negotiated; maintain backward/forward compatibility (tolerant reader), never silent breakage |
| ValidateAtEverySchemaBoundary | Validate against a schema at every boundary; make invalid states unrepresentable via type safety |
| DeriveViewsFromCanonicalTruth | One canonical model as single source of truth; every view/read model is derived, never a parallel truth |
| CommitAtomicallyWithinBoundary | Changes commit fully or not at all within an explicit transaction boundary; control concurrency by contention profile |
| CoordinateViaSagaNotDistributedLock | Cross-service consistency via sagas and compensating transactions, not distributed 2PC; publish reliably via outbox |
| DecoupleViaEventsAndBroker | Communicate across autonomy boundaries by emitting events through a broker; accept eventual consistency for availability |
| OrderByCausalityNotClock | Order distributed events by happens-before with logical clocks (vector/Lamport), never wall-clock timestamps |
| EmitStructuredTelemetryWithCorrelation | Emit structured logs/metrics/traces with a correlation ID threaded through every hop; audit security-relevant actions immutably |
| InvertControlInjectDependencies | Dependencies are injected, never self-constructed or hidden; extend via plugins at declared extension points, core unchanged |
| DiscoverByConventionBindLate | Register capabilities in a queryable registry; discover implementations by convention at runtime and bind by capability, not hardcoded wiring |
| DriveBehaviorDeclarativelyFromMetadata | Components self-describe via manifest/metadata; behavior is declarative data, convention over configuration; declaring computed facts is drift |
| IsolateBoundedContextsWithACL | Each bounded context owns its model and language; translate at an anti-corruption layer so foreign models cannot leak in |
| KeepDomainCoreFreeOfIO | Domain core depends on nothing; I/O and frameworks are edge adapters (ports & adapters / hexagonal); split by autonomy need, not fashion |
| ApplyPatternsByForceNotDefault | Apply a creational/structural/behavioral pattern only when its force is present; speculative patterns are accidental complexity |
| ProcessStreamsSinglePassBounded | Process large/unbounded data single-pass, forward-only, lazily; keep stages stateless and apply backpressure to bound memory |
| IsolateNondeterminismDeterministicCore | Inject clock/randomness/I/O so the core is deterministic and reproducible; test invariants via property-based verification |
| GovernModelsGroundGenerationBoundOutput | Version and evaluate models like dependencies; ground generation in retrieved evidence (RAG); validate model output at the boundary, never into a trusted sink |
