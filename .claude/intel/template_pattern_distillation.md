---
name: pattern-distillation
description: Executable template. Distills repeated behavioral evidence into justified shared abstraction through six stages — orientation + baseline, evidence discovery, boundary-principled selection, checkpoint-reversible migration, elimination verification, and ROI metrics. A base is created only on boundary-principle evidence; distillation is incomplete until the old pattern is gone.
type: template
domain: [architecture, quality]
keywords: [distillation, abstraction, base-class, anti-pattern, boundary-principles, checkpoint, migration, elimination, roi]
owner: BanesLab
created: 2026-07-14
last-verified: 2026-07-14
version: 1
staleness-days: -1
max-lines: 500
depends-on: [reference_development_rules.md]
supersedes:
---

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

```py
%% META %%:
priority: BEHAVIORAL_EVIDENCE > BOUNDARY_PRINCIPLES > TASK
trust: procedural_scan = TRUSTED, naming_similarity = UNTRUSTED, prior_knowledge = UNTRUSTED
objective: create shared abstractions only on boundary-principle evidence, migrate reversibly per
           target, and prove the old pattern is eliminated

SEMANTIC OPERATION BOUNDARY: steps are semantic operations — DISCOVER_RESOURCES, READ_RESOURCE,
SEARCH_CONTENT, ANALYZE_CONTENT, CALCULATE_METRIC, COMPOSE_ARTIFACT, PERSIST_ARTIFACT, CHECKPOINT,
RESTORE, EXECUTE_VERIFIER, REPORT_RESULT. A runtime ADAPTER maps them (Claude Code: DISCOVER->Glob,
SEARCH->Grep, READ->Read, COMPOSE/PERSIST->Write/Edit, EXECUTE_VERIFIER->Bash). Content matching is
procedural, NEVER regex. Role classes, base expectations, thresholds, and the registry-regenerate
command are discovered / adapter-resolved ({project.*} / {convention.*} / {limits.*}); no runtime
path or model literal lives in the core.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract.

# ============================================================================
# STAGE 1 — ORIENTATION  (the architecture landscape)
# ============================================================================
@purpose: "Load workspace + registry, probe capabilities, and measure the existing baseline and compliance gap"
@cue: "MEASURE_BEFORE_PROPOSE"

CONTRACT:
  input:        host architecture registry + rule sources
  transform:    probe capabilities -> init auditable workspace with provenance -> measure existing bases + role-class compliance
  constraints:  compare against existing bases before proposing new; distinguish missing ADOPTION from missing ABSTRACTION; HALT if required context unavailable
  output:       baseline { registry, capability_verdict, existing_bases, role_compliance }
  handoff:      capabilities probed AND baseline measured AND compliance gap classified

DISCOVER_RESOURCES "{project.architecture_registry}" INTO registry
DISCOVER_RESOURCES "{project.rule_sources}" INTO rule_context
FOR EACH capability IN ["filesystem", "search", "execution", "checkpoint"]: PROBE INTO status
CALCULATE capability_verdict IN [full, degraded, blocked] FROM status
INIT auditable workspace + manifest with input provenance; HALT if required context unavailable
EXTRACT existing base abstractions, implementation counts, hierarchy depth INTO existing_bases
DISCOVER role classes ({convention.role_taxonomy}: manager/repository/handler/service/controller/adapter/worker/...)
FOR EACH role: SCAN conformance to its expected base; CALCULATE compliance rate (missing adoption vs missing abstraction) INTO role_compliance

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] capabilities probed; baseline docs + registry loaded; manifest records provenance (evidence: baseline)
  [check] existing architecture measured; compliance gap distinguishes adoption from abstraction (evidence: role_compliance)
  result: pass -> STAGE 2 DISCOVERY (owner: orientation)

# ============================================================================
# STAGE 2 — DISCOVERY  (evidence: signatures, duplication, inconsistency)
# ============================================================================
@purpose: "Partition by semantic role, sign each class's behavior, and surface repeated structure and inconsistency"
@cue: "SIGN_FROM_BEHAVIOR"

CONTRACT:
  input:        baseline
  transform:    partition by role -> extract behavioral signatures -> detect cross-class patterns + inconsistency
  constraints:  base candidates require BEHAVIORAL evidence, not naming similarity; scan procedurally
  output:       evidence { signatures, cross_class_patterns, inconsistency }
  handoff:      domains partitioned AND each class's behavior signed from evidence

PARTITION resources by discovered semantic role
FOR EACH class IN a domain: EXTRACT behavioral signature {initialization, lifecycle hooks, error handling, state management, dependency acquisition, public orchestration} via procedural scan INTO signatures
DETECT repeated imports/init/lifecycle/error/state/dependency across a role family INTO cross_class_patterns   # with occurrence counts
DETECT competing implementations of one behavior INTO inconsistency   # consistency = dominant / total -> {consistent, weakly_consistent, inconsistent}

HANDOFF GATE (evidence-bearing):
  rule_id: "DISCOVERY"
  [check] domains partitioned by role; each class's behavior signed from evidence (evidence: signatures)
  [check] repeated structure and behavioral inconsistency surfaced across families (evidence: cross_class_patterns, inconsistency)
  result: pass -> STAGE 3 SELECTION (owner: orientation)

# ============================================================================
# STAGE 3 — SELECTION  (prioritize, then justify the boundary)
# ============================================================================
@purpose: "Normalize findings into prioritized anti-patterns and decide the abstraction verdict on boundary principles"
@cue: "JUSTIFY_THE_BOUNDARY"

CONTRACT:
  input:        evidence
  transform:    normalize + prioritize anti-patterns -> evaluate boundary principles + coverage -> verdict -> split responsibilities + design lifecycle
  constraints:  create a base ONLY on sufficient boundary principles (universal, invariant, foundational, enforcing, load-reducing) + domain coverage; otherwise prefer composition / utility / local refactor
  output:       plan { anti_patterns_prioritized, verdicts, base_designs }
  handoff:      each high-priority verdict justified AND base candidates split concrete-vs-abstract with a lifecycle

NORMALIZE findings INTO anti-patterns {type IN (copy_paste_duplication, behavioral_inconsistency, architectural_violation, conceptual_duplication, structural_duplication), occurrence, impact, effort, affected resources}
SCORE priority = impact * effort; SORT INTO remediation bands
FOR EACH high-priority anti-pattern:
  EVALUATE boundary principles {universal, invariant, foundational, enforcing, reducing_load} + domain coverage
  VERDICT IN [create_base_class, prefer_composition, prefer_utility, reject_abstraction]
FOR base candidates:
  SPLIT responsibilities -> concrete (constructor/initialize/destroy/handleError/dependency_setup) vs abstract hooks (onInitialize/onDestroy/onError/configure/executeCore)
  DESIGN the template-method lifecycle (guard -> shared -> hook -> error policy)

HANDOFF GATE (evidence-bearing):
  rule_id: "SELECTION"
  [check] base created ONLY on sufficient boundary principles + coverage; else composition/utility/local refactor (evidence: verdicts)
  [check] concrete-vs-abstract responsibilities split; template-method lifecycle defined (evidence: base_designs)
  result: pass -> STAGE 4 MIGRATION (owner: planning)

# ============================================================================
# STAGE 4 — MIGRATION  (compose + migrate, reversible per target)
# ============================================================================
@purpose: "Compose the base within limits and migrate targets low-complexity-first, each reversible via checkpoint"
@cue: "PROVE_ON_SIMPLE_FIRST"

CONTRACT:
  input:        plan
  transform:    compose base (size/name/location) -> order targets ascending complexity -> per target: checkpoint -> refactor -> verify removal -> commit | restore
  constraints:  migration is REVERSIBLE per target (checkpoint/restore); NO destructive VCS commands; enforce base size <= {limits.max_lines} (split if oversized)
  output:       migration { base_artifact, migrated_targets[], restored_targets[] }
  handoff:      base size/name/location compliant AND each target migrated or cleanly restored

COMPOSE_ARTIFACT the base; ENFORCE size <= {limits.max_lines} (split if oversized), name convention, architectural location
ORDER targets by ascending complexity   # prove the pattern on simple cases first
FOR EACH target:
  CHECKPOINT
  REFACTOR to extend/use the base
  VERIFY the removed anti-pattern is gone
  IF verified: COMMIT
  ELSE: RESTORE from checkpoint   # recovery: reversible per target, no bad state left behind

HANDOFF GATE (evidence-bearing):
  rule_id: "MIGRATION"
  [check] base size/name/location compliant (evidence: base_artifact)
  [check] targets migrated low-complexity-first; each failure restored from checkpoint (evidence: migrated_targets, restored_targets)
  result: pass -> STAGE 5 VERIFICATION (owner: compilation)

# ============================================================================
# STAGE 5 — VERIFICATION  (prove the old pattern is gone)
# ============================================================================
@purpose: "Prove elimination across the whole scope and regenerate the architecture registry to the new truth"
@cue: "INCOMPLETE_UNTIL_GONE"

CONTRACT:
  input:        migration
  transform:    scan the whole scope for the old pattern -> regenerate + reread the registry
  constraints:  allow ONLY approved base-location occurrences; FAIL completion if unapproved duplicates remain
  output:       verification { elimination_proof, registry_state }
  handoff:      old pattern proven gone (base-only occurrences) AND registry reflects the new truth

SEARCH the whole scope for the old pattern -> allow only approved base-location occurrences
IF unapproved duplicates remain: FAIL completion -> back to STAGE 4 MIGRATION
REGENERATE the architecture registry ("{project.registry_regenerate}"); REREAD
CONFIRM new base + migrated implementations represented

HANDOFF GATE (evidence-bearing):
  rule_id: "VERIFICATION"
  [check] old pattern proven gone — only approved base-location occurrences allowed (evidence: elimination_proof)
  [check] registry regenerated and reflects new truth (evidence: registry_state)
  result: pass -> STAGE 6 METRICS | unapproved duplicates -> STAGE 4 MIGRATION (owner: validation)

# ============================================================================
# STAGE 6 — METRICS  (when distillation is complete)
# ============================================================================
@purpose: "Compute measurable ROI and persist the outcome as reusable evidence"
@cue: "MEASURE_THE_ROI"

CONTRACT:
  input:        baseline + migration + verification
  transform:    compute reduction metrics -> append summary + lessons to durable history
  constraints:  ROI is measured, not asserted
  output:       report { roi, history_entry }
  handoff:      measurable ROI computed AND outcome persisted

CALCULATE duplication reduction, code reduction, base adoption, lines saved, maintenance-burden + cognitive-load reduction
APPEND summary + lessons learned to durable history
REPORT_RESULT {roi, history_entry}

HANDOFF GATE (evidence-bearing):
  rule_id: "METRICS"
  [check] measurable ROI computed (evidence: roi)
  [check] outcome persisted as reusable evidence (evidence: history_entry)
  result: TERMINATE

FINALIZE report

# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - probe capabilities and disclose degraded analysis
  - require behavioral evidence for candidates; prefer composition/utility when the boundary isn't justified
  - split concrete vs abstract responsibilities; enforce base size limits
  - migrate low-complexity-first with checkpoint/restore; verify elimination; regenerate the registry
  - a stage reads ONLY the prior stage's output contract, and hands off through exactly one evidence-bearing gate
  - compute measurable ROI and persist history

NEVER:
  - create a base abstraction on naming similarity or without sufficient boundary principles + coverage
  - migrate irreversibly — checkpoint each target, restore on failure (no destructive VCS commands)
  - declare complete while any unapproved old-pattern occurrence remains
  - use regex; hardcode role taxonomies, base names, thresholds, the registry command, or a model — discover / adapter-resolve
```
