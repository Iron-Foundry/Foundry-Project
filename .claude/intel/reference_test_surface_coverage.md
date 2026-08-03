---
name: test-surface-coverage
description: First-principles, language- and tool-agnostic model for deriving complete test coverage - surface (ontological dimension x analysis lens), technique (how evidence is obtained), invariant (what must hold). Read when deciding what a change must test, not just how.
type: reference
domain: [testing, quality, process]
keywords: [test-surface, coverage-derivation, ontology, analysis-lens, invariant, technique, uncovered-cells]
owner: BanesLab
created: 2026-08-03
---

_A first-principles, language- and tool-agnostic model for deriving complete test coverage of any system: what can be wrong (surface), how it fails (lens), how to obtain evidence (technique), what must hold (invariant)._

Companion to `.claude/rules/testing.md` (PAG POLICY). That policy says tests ship with the code and which layers to run; this document says which surfaces those tests must cover.

# DERIVATION

A test surface is DERIVED, not picked from the menu below - that is how you reach the non-obvious and the not-yet-listed. Grounded in the pattern-derivation axis (`reference_pattern_ontology.md`), applied to correctness:

> **surface = an ontological dimension (WHAT can be wrong) x an analysis lens (HOW it fails) -> an invariant that must hold (the assertion), obtained by a technique.**

- **Ontology - WHAT can be wrong:** Identity, Composition, Structure, Relation, Space, Time, State, Change, Behaviour, Function, Cause, Meaning, Scale, Probability, Novelty
- **Analysis - HOW it fails:** Structural, Temporal, Spatial, Statistical, Frequency, Sequential, Relational, Behavioural, Functional, Semantic, Causal, Predictive, Anomaly, Evolutionary, Fractal/Scale
- **Reasoning - the mode a TECHNIQUE concludes by:** Observation, Description, Comparison, Classification, Explanation, Prediction, Intervention, Creation, Reflection

Every TARGETS row occupies one (dimension x lens) cell; every TECHNIQUE embodies one reasoning mode; every assertion is one invariant. **Coverage is complete when every cell that CAN fail carries a surface + a technique + an invariant.** To find missing surface, walk dimensions x lenses - an empty cell is an untested aspect (see UNCOVERED). To derive a NOVEL surface, name its dimension + lens, state its invariant, then choose the technique whose mode matches.

# TARGETS

| Test surface              | Ontology cell (dimension · lens) | Example failure modes                                                       | Detection approaches                                                 |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Semantic correctness      | Meaning · Semantic               | Wrong value, incorrect algorithm, wrong computation                         | Unit tests, property-based testing, differential testing, assertions |
| Functional correctness    | Function · Behavioural           | Invalid workflow, missing transition, incorrect business rule               | Integration tests, state-machine testing, model checking             |
| State correctness         | State · Sequential               | Invalid state, broken state transitions, violated lifecycle rules           | Invariant checks, state-machine testing, property testing            |
| Interface correctness     | Structure · Structural           | Invalid input/output shape, schema mismatch, contract violation             | Runtime validation, schema testing, contract tests                   |
| Interaction correctness   | Relation · Relational            | Wrong API response, incorrect UI behaviour, invalid component communication | End-to-end tests, contract tests, integration tests                  |
| Temporal correctness      | Time · Temporal                  | Timeout, deadline miss, stale data, starvation                              | Load testing, latency monitoring, tracing                            |
| Concurrency correctness   | Behaviour · Temporal             | Race conditions, deadlocks, livelocks, ordering failures                    | Stress testing, deterministic scheduling, instrumentation            |
| Memory correctness        | Composition · Evolutionary       | Memory leaks, excessive allocation, fragmentation, retention bugs           | Heap profiling, GC analysis, leak detection                          |
| Resource correctness      | Composition · Behavioural        | File/socket/connection/handle leaks                                         | Resource monitoring, lifecycle analysis                              |
| Performance correctness   | Scale · Statistical              | Slow algorithms, excessive CPU, high latency, throughput degradation        | Profiling, benchmarks, flamegraphs                                   |
| Reliability correctness   | Probability · Anomaly            | Crashes, unhandled exceptions, process termination                          | Crash reporting, chaos testing, fault injection                      |
| Availability correctness  | Probability · Temporal           | Service outage, cascading failure, degraded service                         | Resilience testing, fault injection                                  |
| Consistency correctness   | Relation · Statistical           | Stale cache, divergent replicas, invalid synchronization                    | Distributed testing, invariant checking                              |
| Data correctness          | Identity · Structural            | Corrupted persistence, invalid migrations, duplicate records                | Database constraints, migration tests, integration tests             |
| Numerical correctness     | Scale · Anomaly                  | Overflow, precision loss, NaN propagation                                   | Numerical testing, static analysis                                   |
| Security correctness      | Cause · Causal                   | Injection, privilege escalation, unsafe deserialization                     | Security scanners, fuzzing, penetration testing                      |
| Determinism correctness   | Novelty · Anomaly                | Same input producing different outputs unexpectedly                         | Repeatability testing, deterministic replay                          |
| Protocol correctness      | Relation · Sequential            | Invalid message ordering, malformed communication sequence                  | Protocol conformance testing                                         |
| Configuration correctness | State · Structural               | Invalid environment variables, feature flag errors, deployment mismatch     | Configuration validation, deployment testing                         |
| Observability correctness | Meaning · Frequency              | Missing logs, incorrect metrics, broken traces                              | Telemetry validation, tracing tests                                  |

# TECHNIQUES

| Technique              | Mode           | First principle - how it obtains evidence                         |
| ---------------------- | -------------- | ----------------------------------------------------------------- |
| Static analysis        | Observation    | Read structure / types for defects before execution               |
| Unit testing           | Comparison     | Observed vs expected on an isolated unit                          |
| Integration testing    | Comparison     | Observed vs expected across cooperating parts                     |
| End-to-end testing     | Comparison     | Observed vs expected on the whole system                          |
| Property-based testing | Classification | Assert an invariant holds across a generated input space          |
| Differential testing   | Comparison     | Observed vs a reference implementation (oracle)                   |
| Contract testing       | Comparison     | Observed interface vs an agreed contract                          |
| Runtime validation     | Observation    | Check boundary data against its declared shape at runtime         |
| Assertion checking     | Comparison     | Check a runtime condition against an assumed invariant            |
| Fuzz testing           | Creation       | Generate adversarial inputs to provoke unhandled failure          |
| Load testing           | Prediction     | Project behaviour under expected demand                           |
| Stress testing         | Prediction     | Project behaviour past limits to expose timing / ordering defects |
| Profiling              | Observation    | Measure the distribution of execution cost                        |
| Heap analysis          | Observation    | Measure allocation and retention over time                        |
| Tracing                | Description    | Characterise runtime flow across components                       |
| Fault injection        | Intervention   | Induce a failure, observe the response                            |
| Chaos testing          | Intervention   | Induce random failures, observe resilience                        |
| Model checking         | Explanation    | Prove a property holds across the reachable state space           |
| Deterministic replay   | Reflection     | Reproduce a run to isolate a non-deterministic cause              |
| Monitoring             | Observation    | Observe live behaviour for deviation from normal                  |

# INVARIANTS

- Correct outputs
- Correct state evolution
- Valid state transitions
- Correct interactions
- Valid interfaces and contracts
- Acceptable execution time
- Acceptable resource consumption
- Safe concurrent behaviour
- Controlled memory usage
- Reliability under faults
- Availability under stress
- Consistency across components
- Deterministic behaviour where required
- Numerical validity
- Security boundaries
- Protocol compliance
- Configuration validity
- Accurate observability

# UNCOVERED

Cells the DERIVATION generates that TARGETS misses - the non-obvious surface, and where to expand next.

| Dimension · Lens      | Missing surface                                                                   | Invariant to assert                                            |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Space · Spatial       | Distribution / locality - data placement, dependency-graph shape, import topology | no cycle; expected reachability; bounded fan-in/out            |
| Change · Evolutionary | Drift across versions - schema / API / contract change over the version chain     | old inputs still parse; migrations compose; no silent break    |
| _any_ · Fractal/Scale | Same defect recurring at unit -> module -> system scale                           | a property that holds at one scale holds at every scale        |
| _any_ · Frequency     | Recurrence bounds - retry storms, log flood, cache thrash, hot-loop rate          | repetition count / rate stays under a declared ceiling         |
| Probability · Anomaly | Fuzz - generated / adversarial inputs discover unhandled failures                 | no crash / no invalid state on any generated input             |
| Scale · Predictive    | Load / stress - behaviour under demand                                            | latency / throughput within budget at N x load                 |
| Novelty · _self_      | Determinism - same input -> identical output; regeneration is a fixed point       | `f(x)` equals `f(x)` across runs; `regen(regen(x)) = regen(x)` |

Derive the rest the same way: any (dimension x lens) cell absent from TARGETS is a candidate surface - name its invariant, then a matching technique.

# THIS MONOREPO

Where each surface most often bites, and the layer that covers it (`./run-tests.sh {lint|fast|integration|e2e|all}`):

| Surface | Where it lives here | Layer |
| --- | --- | --- |
| Interface / Interaction | web<->api, discord<->api, api<->runelite seams; `fixtures/` + `openapi.json` + `schema.d.ts` | contract, e2e |
| Data | Alembic migrations, repositories, `player_snapshots` and other write paths | integration |
| State | Claim/approval state machines, party and session lifecycles | fast + integration |
| Consistency | Valkey caches, pubsub fan-out, per-worker state under Gunicorn | integration |
| Configuration | env vars propagated to `.env.example` + the compose files | lint + fast |
| Concurrency | Valkey leases, blocking reads, background lifespan services | integration |
| Determinism | Generated artifacts (`openapi.json`, `schema.d.ts`, icon renders) | fast |
