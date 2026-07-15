---
name: debugging
description: Executable template. Debugs through five evidence-gated stages plus recovery — clue analysis, execution trace with trace-confidence and information-debt, evidence-scored hypothesis, surgical loop-broken fix, and revert/pivot validation — never guessing a fix, never leaving a bad one in place, reflecting instead of iterating when the loop-breaker trips.
type: template
domain: [quality, ai-governance]
keywords: [debug, evidence-gated, trace-confidence, information-debt, hypothesis, surgical-fix, checkpoint, revert-pivot, recovery]
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
priority: EVIDENCE > ROOT_CAUSE > SPEED
trust: procedural_trace = TRUSTED, test_result = TRUSTED, prior_knowledge = UNTRUSTED, a_hypothesis = UNTRUSTED_UNTIL_SCORED
objective: find the root cause by evidence-gated tracing, apply one surgical fix, prove broken-fixed +
           no-regression, and reflect rather than iterate when the loop-breaker trips

SEMANTIC OPERATION BOUNDARY: steps are semantic operations — READ_RESOURCE, DISCOVER_RESOURCES,
SEARCH_CONTENT, ANALYZE_CONTENT, CALCULATE_METRIC, APPLY_EDIT, CHECKPOINT, RESTORE, EXECUTE_TEST,
PERSIST_ARTIFACT, ASK_USER, REPORT_RESULT. A runtime ADAPTER maps them (Claude Code: SEARCH->Grep,
READ->Read, APPLY_EDIT->Edit, EXECUTE_TEST->Bash). Content matching is procedural (token/Set
membership), NEVER regex. Clue classes ({convention.clue_taxonomy}), thresholds ({limits.*}), and the
checkpoint/restore mechanism are adapter-resolved; no runtime path or model literal lives in the core.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract. Gates fail
BACKWARD to the earliest stage that can supply the missing evidence.

# ============================================================================
# STAGE 1 — ORIENTATION  (reversible session baseline)
# ============================================================================
@purpose: "Load protocols, probe capabilities, and take a reversible baseline checkpoint before any change"
@cue: "REVERSIBLE_FIRST"

CONTRACT:
  input:        bug report; host debug protocols
  transform:    discover protocols -> probe capabilities -> checkpoint baseline -> init session
  constraints:  the baseline is reversible without version-control side effects
  output:       session { protocols, capability_verdict, baseline_checkpoint, state }
  handoff:      protocols discovered AND capabilities classified AND reversible baseline taken

DISCOVER_RESOURCES "{project.debug_protocols}" INTO protocols
FOR EACH capability IN ["filesystem", "search", "execution", "checkpoint"]: PROBE INTO status
CALCULATE capability_verdict IN [full, degraded, blocked] FROM status
CHECKPOINT baseline   # any fix is reversible without version-control side effects
INIT session {id, status: in_progress, current_gate: clue_analysis, fix_attempts: 0}; LOAD historical metrics (init if absent)

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] protocols discovered; capabilities probed (evidence: session.capability_verdict)
  [check] reversible baseline checkpoint taken (evidence: session.baseline_checkpoint)
  result: pass -> STAGE 2 CLUE (owner: orientation)

# ============================================================================
# STAGE 2 — CLUE  (Gate 1: frame the bug)
# ============================================================================
@purpose: "Extract the differential and implicit clues and classify the bug to its subsystem"
@cue: "DIFFERENTIAL_FIRST"

CONTRACT:
  input:        session + user statement
  transform:    detect differential (works vs breaks) -> extract implicit clues -> classify bug + subsystem
  constraints:  classify procedurally; when the differential is absent or the class unknown, ASK_USER and HALT
  output:       clue { differential, implicit_clues, bug_class, subsystem, state_model? }
  handoff:      differential + clues extracted AND bug classified with subsystem (or clarification requested)

EXTRACT user_statement; DETECT differential (works-scenario vs breaks-scenario) via procedural scan
EXTRACT implicit clues (timing, platform/environment, and any {convention.clue_taxonomy} signals)
CLASSIFY bug INTO the highest-probability clue class WITH its likely subsystem; build a state model when a timing differential is present
IF differential absent OR class unknown: ASK_USER targeted clarifying questions; HALT until answered

HANDOFF GATE (evidence-bearing):
  rule_id: "CLUE"
  [check] differential + implicit clues extracted procedurally (evidence: clue.differential)
  [check] bug classified with subsystem, or clarification requested (evidence: clue.bug_class)
  result: classified -> STAGE 3 TRACE | unknown -> ASK_USER + HALT (owner: orientation)

# ============================================================================
# STAGE 3 — TRACE  (Gate 2: execution trace, confidence + information debt)
# ============================================================================
@purpose: "Trace the call chain from entry points and gate hypothesis formation on trace confidence + information debt"
@cue: "TRACE_BEFORE_GUESS"

CONTRACT:
  input:        clue
  transform:    select patterns from the bug class -> trace call chains -> compute TCI + information debt
  constraints:  filter platform-intrinsics ({convention.known_unknowables}); block forward progress until both thresholds clear
  output:       trace { execution_graph, information_debt, tci }
  handoff:      TCI and information debt computed AND both clear threshold

SELECT search patterns FROM the bug class; SEARCH_CONTENT the scope for entry points
FOR EACH entry point: READ; trace the call chain; collect UNKNOWN calls, filtering platform-intrinsics; record per-branch information_debt = unresolved unknowns
CALCULATE trace_confidence_index (TCI) = (fully_traced + 0.5*partial) / total_paths
DETECT stagnation (no progress across recent interactions) -> request more context
PERSIST_ARTIFACT information-debt + execution graph

HANDOFF GATE (evidence-bearing):
  rule_id: "TRACE"
  [check] entry points traced; TCI and information debt computed (evidence: trace.tci, information_debt)
  [check] both thresholds clear before hypotheses (evidence: max info_debt <= {limits.info_debt} AND TCI >= {limits.min_tci})
  result: both clear -> STAGE 4 HYPOTHESIS | debt/TCI fail -> STAGE 3 (more tracing) (owner: compilation)

# ============================================================================
# STAGE 4 — HYPOTHESIS  (Gate 3: evidence-scored)
# ============================================================================
@purpose: "Score hypotheses by evidence against a confidence bar scaled by complexity and risk"
@cue: "SCORE_NEVER_GUESS"

CONTRACT:
  input:        clue + trace
  transform:    compute complexity + risk -> required_confidence -> score each hypothesis by evidence
  constraints:  a hypothesis must clear the scaled bar AND be stateable in ONE sentence with a concrete failure location
  output:       hypotheses { ranked[], top, required_confidence }
  handoff:      top hypothesis clears required_confidence AND is one sentence with a failure location

CALCULATE complexity_score FROM files_involved, info_debt, subsystems -> tier {simple, medium, complex} -> base required_confidence
APPLY risk modifier (data-loss/crash raises the bar; cosmetic lowers it)
SCORE each hypothesis by evidence: explains_differential, evidence_confirms_pattern, matches_clue_class, explains_timing -> confidence = points / 100
PERSIST_ARTIFACT ranked hypotheses

HANDOFF GATE (evidence-bearing):
  rule_id: "HYPOTHESIS"
  [check] confidence threshold scaled by complexity + risk (evidence: hypotheses.required_confidence)
  [check] top hypothesis clears the bar AND is one sentence with a concrete failure location (evidence: hypotheses.top)
  result: clears -> STAGE 5 FIX | below bar / not one-sentence -> STAGE 3 TRACE (owner: planning)

# ============================================================================
# STAGE 5 — FIX  (Gate 4: surgical, loop-breaker)
# ============================================================================
@purpose: "Apply the minimal root-cause fix at the failure location, refusing symptom treatments"
@cue: "ROOT_CAUSE_ONLY"

CONTRACT:
  input:        hypotheses.top
  transform:    design the minimal root-cause fix -> refuse symptom treatments -> apply -> increment fix_attempts
  constraints:  fix bounded to {limits.max_fix_lines}; at {limits.max_fix_attempts} the loop-breaker routes to RECOVERY
  output:       fix { change, location, fix_attempts }
  handoff:      fix is minimal + root-cause AND symptom treatments refused

IF fix_attempts >= {limits.max_fix_attempts}: GOTO STAGE 7 RECOVERY
DESIGN the minimal root-cause fix at the failure location
REFUSE symptom treatments ({convention.symptom_patterns} — timers/forced reflows/visibility toggles masking cause) -> GOTO STAGE 7 RECOVERY
IF the fix exceeds {limits.max_fix_lines}: FAIL back to STAGE 4 HYPOTHESIS   # hypothesis likely wrong or architectural
APPLY_EDIT the fix; INCREMENT fix_attempts

HANDOFF GATE (evidence-bearing):
  rule_id: "FIX"
  [check] fix is minimal + root-cause at the failure location (evidence: fix.change, fix.location)
  [check] symptom treatments refused; oversized fix bounced to HYPOTHESIS (evidence: fix bounds)
  result: applied -> STAGE 6 VALIDATION | oversized -> STAGE 4 HYPOTHESIS | symptom/attempts-exceeded -> STAGE 7 RECOVERY (owner: compilation)

# ============================================================================
# STAGE 6 — VALIDATION  (Gate 5: revert / pivot)
# ============================================================================
@purpose: "Prove broken-fixed and no-regression, and revert + pivot on failure rather than leave a bad fix"
@cue: "PROVE_OR_REVERT"

CONTRACT:
  input:        fix + clue
  transform:    test broken scenario (must pass) + working scenario (no regression) + edges -> score -> revert/pivot on failure
  constraints:  a failing fix RESTORES the checkpoint and pivots; never leaves a bad fix in place
  output:       validation { success_score, outcome }
  handoff:      broken fixed + no regression proven, OR reverted-and-pivoted

TEST the broken scenario (must now pass) and the working scenario (must not regress); EXECUTE_TEST the relevant suite when available; probe edge cases
CALCULATE success_score = weighted(immediate_fix, no_regression, tests_pass, stability)
IF success_score < {limits.min_success}:
  RESTORE the checkpoint
  IF next hypothesis clears the bar: PIVOT -> STAGE 5 FIX
  ELSE: FAIL back to STAGE 3 TRACE / STAGE 2 CLUE for fresh evidence
PERSIST_ARTIFACT validation outcome; on success FINALIZE + append to history; periodically auto-tune thresholds from historical success rate

HANDOFF GATE (evidence-bearing):
  rule_id: "VALIDATION"
  [check] broken fixed AND no regression proven (evidence: validation.success_score)
  [check] failure reverts via checkpoint and pivots, never leaves a bad fix (evidence: validation.outcome)
  result: success -> STAGE 8 REPORT | failure -> RESTORE + pivot to STAGE 5 or STAGE 3/2 (owner: validation)

# ============================================================================
# STAGE 7 — RECOVERY  (stop iterating, reflect)
# ============================================================================
@purpose: "On the loop-breaker, revert everything and reflect on the failed assumption instead of iterating"
@cue: "REFLECT_NOT_ITERATE"

CONTRACT:
  input:        loop trigger (fix-attempt limit hit or symptom treatment attempted)
  transform:    restore the checkpoint -> time-boxed reflection -> record + request deeper context -> restart at Gate 1
  constraints:  revert every changed file (no destructive VCS commands); reflect, do not iterate
  output:       recovery { reflection_insight, restart }
  handoff:      changes reverted AND a concrete reflection insight recorded AND fresh investigation requested

RESTORE the checkpoint   # revert every changed file, no destructive VCS commands
REFLECT (time-boxed): which assumption failed, which clue was missed, which gate was rushed, was a symptom treated
RECORD loop trigger + reflection; MARK session loop_detected; ASK_USER for deeper reproduction context; RESTART at STAGE 2 CLUE with fresh investigation

HANDOFF GATE (evidence-bearing):
  rule_id: "RECOVERY"
  [check] changes reverted (evidence: checkpoint restored)
  [check] loop acknowledged with a concrete reflection insight, fresh investigation requested (evidence: recovery.reflection_insight)
  result: restart -> STAGE 2 CLUE (owner: recovery)

# ============================================================================
# STAGE 8 — REPORT  (when the bug is fixed)
# ============================================================================
@purpose: "Report the root cause, the fix, the metrics, and any degraded capability"
@cue: "NAME_ROOT_CAUSE"

CONTRACT:
  input:        session + all gate artifacts
  transform:    compose report -> emit
  constraints:  the report states the root cause in one sentence and names any degraded capability (skipped tests / manual validation)
  output:       report
  handoff:      report names root cause, fix, metrics, and limitations

REPORT {bug, class, root cause (one sentence), fix location + change, gates passed, fix attempts, confidence, success score, historical success rate, limitations}

HANDOFF GATE (evidence-bearing):
  rule_id: "REPORT"
  [check] report names root cause, fix, metrics, and any degraded capability (evidence: report)
  result: TERMINATE

FINALIZE report

# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - probe capabilities and take a reversible baseline checkpoint first
  - gate progression on trace confidence and information debt
  - state the root cause in one sentence with a concrete failure location
  - keep fixes minimal and root-cause; validate broken-fixed AND no-regression
  - a stage reads ONLY the prior stage's output contract, and hands off through exactly one evidence-bearing gate; gates fail backward to the earliest stage that can supply the missing evidence
  - reflect (not iterate) when the loop-breaker trips

NEVER:
  - form a hypothesis below the complexity + risk-scaled confidence threshold
  - treat a symptom instead of the root cause
  - leave a failed fix in place — restore the checkpoint and pivot
  - iterate past the fix-attempt limit — enter recovery and reflect
  - use regex, or a destructive version-control revert — scan procedurally, revert via checkpoint/restore
  - hardcode clue taxonomies, thresholds, or a model — resolve from {convention.*}/{limits.*}
```
