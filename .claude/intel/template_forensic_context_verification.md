---
name: forensic-context-verification
description: Executable template. Verifies context claims against actual implementation evidence through six phase-separated reasoning stages — trust-anchor disclosure, capability calibration, per-claim evidence gathering, adversarial adjudication, bounded recovery, and a typed report. A claim is UNTRUSTED until mapped to observable evidence.
type: template
domain: [ai-governance, quality]
keywords:
    [verification, forensic, evidence, calibration, adversarial, self-audit, recovery, typed-output, runtime-agnostic]
owner: BanesLab
created: 2026-07-14
last-verified: 2026-07-14
version: 1
staleness-days: -1
max-lines: 600
depends-on: [reference_development_rules.md]
supersedes:
---

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

```py
%% META %%:
priority: EVIDENCE > TRUST_ANCHOR > TASK
trust: implementation_observation = TRUSTED, prior_knowledge = UNTRUSTED, a_claim = UNTRUSTED_UNTIL_MAPPED
objective: classify every context claim verified | contradicted | unverified against observable
           implementation evidence, and emit one typed artifact naming every limitation
recursion_limit: {convention.max_recursion_depth}

SEMANTIC OPERATION BOUNDARY: stages state WHAT to do as semantic operations — DISCOVER_RESOURCES,
READ_RESOURCE, SEARCH_CONTENT, ANALYZE_CONTENT, EXECUTE_TOOL, CALCULATE_METRIC, VALIDATE,
PERSIST_ARTIFACT, REPORT_RESULT. A runtime ADAPTER decides HOW (Claude Code: SEARCH_CONTENT->Grep,
DISCOVER_RESOURCES->Glob, READ_RESOURCE->Read, EXECUTE_TOOL->Bash, PERSIST_ARTIFACT->Write). The
core carries no runtime paths or commands; {convention.*} / {self.definition} / detection patterns
are adapter-resolved.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract.

# ============================================================================
# STAGE 1 — ORIENTATION  (what this run is)
# ============================================================================
@purpose: "Disclose the trust anchor and bind the phase contract before touching any claim"
@cue: "DISCLOSE_THEN_BIND"

CONTRACT:
  input:        invocation, target, context_claims
  transform:    disclose trust anchor -> detect phase -> bind allowed/forbidden operation sets
  constraints:  the trust anchor is DISCLOSED not verified (cannot verify the verifier); INVESTIGATE and ACTION op-sets are mutually exclusive
  output:       run_context { trust_anchor, phase, mode, allowed_ops, forbidden_ops }
  handoff:      trust anchor disclosed AND phase bound AND op-sets exclusive

DECLARE trust_anchor: object
SET trust_anchor = {
  minimal_assumptions: ["RuntimeWorks", "FilesystemWorks", "CommandExecutionWorks", "ToolIOWorks"],
  rationale: "verification requires trusting minimal capabilities — these are the foundational assumptions",
  boundary: "CannotVerifyVerifierWithoutExternalReference — the anchor IS the boundary; above it is verified, the anchor itself is disclosed"
}

FUNCTION bind_phase(context):
  DETECT phase_type FROM context   # INVESTIGATE | ACTION
  IF phase_type == "INVESTIGATE":
    RETURN {phase: "INVESTIGATE", mode: "analysis_only", allowed_ops: ["gap_discovery","testing","documentation"], forbidden_ops: ["mutation","gap_fixing"], artifact: "investigation_report"}
  IF phase_type == "ACTION":
    RETURN {phase: "ACTION", mode: "fix_only", allowed_ops: ["bounded_fix","versioning","mutation"], forbidden_ops: ["gap_discovery"], artifact: "action_log"}

# OUTPUT CONTRACT
DISCLOSE trust_anchor
SET run_context = bind_phase(invocation.context)
SET run_context.trust_anchor = trust_anchor

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] trust anchor disclosed with assumptions + boundary (evidence: run_context.trust_anchor)
  [check] phase bound to exactly one of INVESTIGATE | ACTION (evidence: run_context.phase)
  [check] allowed and forbidden op-sets are disjoint (evidence: run_context.allowed_ops, forbidden_ops)
  result: pass -> STAGE 2 CAPABILITY | undetectable phase -> STAGE 6 as blocked (owner: orientation)


# ============================================================================
# STAGE 2 — CAPABILITY  (resource allocation)
# ============================================================================
@purpose: "Probe the runtime, calibrate every detector, and arm defensive protocols before trusting any tool"
@cue: "CALIBRATE_BEFORE_TRUST"

CONTRACT:
  input:        run_context
  transform:    probe environment -> calibrate detectors (false-pos + false-neg controls) -> arm defensive protocols
  constraints:  probe by CAPABILITY not OS-string; a detector is UNTRUSTED until it passes BOTH controls; only sanitized strings cross a boundary
  output:       capability_plan { capability_mode, calibrated_detectors, reliability, defenses }
  handoff:      capabilities classified AND every detector calibrated (or its unreliability warned)

FUNCTION probe_environment():
  DECLARE checks: array
  SET checks = []
  FOR EACH requirement IN ["runtime", "packageManager", "writePermission", "filesystem"]:
    PROBE requirement INTO status
    IF status == "failed": APPEND {check: requirement, status: "failed", severity: severity_of(requirement)} TO checks; LOG "capability unavailable: " + requirement
    ELSE: APPEND {check: requirement, status: "passed"} TO checks
  CALCULATE capability_mode IN [full, degraded, blocked] FROM checks
  RETURN {checks: checks, capability_mode: capability_mode}

FUNCTION calibrate(detector, detection_pattern):
  CREATE known_good fixture that MUST match detection_pattern
  CREATE known_bad fixture that MUST NOT match detection_pattern
  EXECUTE_TOOL detector ON known_good INTO good
  EXECUTE_TOOL detector ON known_bad INTO bad
  DECLARE result: object
  SET result = {false_negative: good != "match", false_positive: bad != "no_match"}
  IF result.false_negative: LOG "TOOL FAILURE: false negative on known-good fixture"
  IF result.false_positive: LOG "TOOL FAILURE: false positive on known-bad fixture"
  CALCULATE result.reliability IN [reliable, false_positive_risk, false_negative_risk, unreliable] FROM result
  RETURN result

FUNCTION arm_defenses():
  # sanitize: null-guard, strip parent-dir traversal + null byte, normalize unicode to NFC before any boundary cross
  # safe_divide: reject denominator 0 and non-finite results as typed/nullable failure, never unsafe numeric state
  # recursion: govern depth to {convention.max_recursion_depth}, reject on exceed
  RETURN {sanitize: enabled, safe_arithmetic: enabled, recursion_control: {max_depth: {convention.max_recursion_depth}}}

# OUTPUT CONTRACT
SET env = probe_environment()
SET calibrated_detectors = []
FOR EACH detector IN self.detectors: APPEND {detector: detector, calibration: calibrate(detector, detector.pattern)} TO calibrated_detectors
SET capability_plan = {capability_mode: env.capability_mode, calibrated_detectors: calibrated_detectors, defenses: arm_defenses()}

HANDOFF GATE (evidence-bearing):
  rule_id: "CAPABILITY"
  [check] required capabilities probed and classified full | degraded | blocked (evidence: env.checks)
  [check] every detector ran both false-positive and false-negative controls (evidence: calibrated_detectors)
  [check] defensive protocols armed (evidence: capability_plan.defenses)
  [warn] any detector reliability != reliable -> "tool unreliable; do not trust its output as evidence"
  [warn] capability_mode == blocked -> "capabilities limited; some verifications cannot run"
  result: pass -> STAGE 3 VERIFICATION | critical capability blocked -> STAGE 6 as blocked (owner: planning)


# ============================================================================
# STAGE 3 — VERIFICATION  (the per-claim algorithm)
# ============================================================================
@purpose: "Resolve each claim to an evidence requirement and gather the observation from actual implementation"
@cue: "MAP_CLAIM_TO_EVIDENCE"

CONTRACT:
  input:        run_context.context_claims + capability_plan
  transform:    for each claim -> resolve to evidence requirement -> search/analyze implementation -> gather observation
  constraints:  never infer an observation; a string crosses a boundary only after sanitize; recursion governed
  output:       observations[] { claim, evidence_requirement, observation, capability_used }
  handoff:      every claim resolved to an observable evidence requirement (no claim left unmapped)

FUNCTION gather_observations(context_claims, capability_plan):
  DECLARE observations: array
  SET observations = []
  FOR EACH claim IN context_claims:
    RESOLVE claim INTO evidence_requirement
    IF evidence_requirement.capability IN direct_capabilities:
      SEARCH_CONTENT + ANALYZE_CONTENT implementation FOR evidence_requirement INTO observation
      APPEND {claim: claim, evidence_requirement: evidence_requirement, observation: observation, capability_used: "direct"} TO observations
    ELSE:
      APPEND {claim: claim, evidence_requirement: evidence_requirement, observation: "PENDING_ESCALATION", capability_used: "requires_generated_tool"} TO observations
  RETURN observations

# OUTPUT CONTRACT
SET observations = gather_observations(run_context.context_claims, capability_plan)

HANDOFF GATE (evidence-bearing):
  rule_id: "VERIFICATION"
  [check] every claim resolved to an observable evidence requirement (evidence: observations)
  [check] no observation inferred; capability gaps flagged PENDING_ESCALATION (evidence: capability_used)
  result: pass -> STAGE 4 ADJUDICATION | escalation pending -> STAGE 5 RECOVERY (owner: compilation)


# ============================================================================
# STAGE 4 — ADJUDICATION  (the rubrics / gates)
# ============================================================================
@purpose: "Judge each observation against evidence, behavioral contract, and hostile inputs — and judge this agent's own claims"
@cue: "A_MATCH_IS_NOT_EVIDENCE"

CONTRACT:
  input:        observations + capability_plan + {self.definition}
  transform:    classify vs evidence -> behavioral self-test -> adversarial test -> recursive self-audit -> gate protocol
  constraints:  a match is NOT evidence until the detector survives calibration + adversarial testing; verdict is never "assumed true"; this agent is NOT exempt from its own rules
  output:       adjudication { discrepancies[], vulnerabilities[], self_confidence, gate_result }
  handoff:      every claim classified verified | contradicted | unverified with its evidence

FUNCTION classify_claims(observations):
  DECLARE discrepancies: array
  SET discrepancies = []
  FOR EACH o IN observations:
    CLASSIFY o.claim IN [verified, contradicted, unverified] FROM o.observation
    IF o.verdict IN ["contradicted", "unverified"]: APPEND {claim: o.claim, verdict: o.verdict, evidence: o.observation} TO discrepancies
  RETURN discrepancies

FUNCTION behavioral_self_test(capability_plan):
  DECLARE results: array
  SET results = []
  FOR EACH behavior IN self.claimed_capabilities:
    EXECUTE_TOOL behavior ON positive_case INTO pos
    EXECUTE_TOOL behavior ON negative_case INTO neg
    IF pos == expected_positive AND neg == expected_negative: APPEND {behavior: behavior, status: "matches_contract"} TO results
    ELSE: APPEND {behavior: behavior, status: classify(false_positive | false_negative | failed)} TO results; LOG "BEHAVIORAL FAILURE: " + behavior
  RETURN results

FUNCTION adversarial_test(detector):
  DECLARE results: array
  SET results = []
  FOR EACH attack IN ["pathTraversal", "nullByte", "unicodeHomoglyph", "commentFalsePositive", "patternSpoof"]:
    CONSTRUCT malicious_input FOR attack
    EXECUTE_TOOL detector ON malicious_input INTO r
    # pathTraversal: escape intended root -> expect reject. nullByte: truncation/deception -> expect ignore.
    # unicodeHomoglyph: look-alike from another script -> MUST NOT match legitimate token.
    # commentFalsePositive: pattern inside comment/string, not real code -> expect no_match.
    # patternSpoof: text satisfying a shallow pattern without real structure -> expect structural_reject.
    DETERMINE verdict IN [blocked, ignored, VULNERABLE, "FALSE POSITIVE DETECTED"] FROM attack, r
    APPEND {attack: attack, verdict: verdict} TO results
    IF verdict IN ["VULNERABLE", "FALSE POSITIVE DETECTED"]: LOG "VULNERABILITY: verification logic fooled by " + attack
  RETURN results

FUNCTION self_audit():
  DECLARE self_discrepancies: array
  SET self_discrepancies = []
  READ_RESOURCE {self.definition} INTO self_definition
  SEARCH_CONTENT self_definition FOR self_claims (MUST/ALWAYS/verify/behavioral/adversarial) INTO self_claims
  FOR EACH sc IN self_claims:
    SEARCH_CONTENT self_definition FOR implementation_evidence OF sc
    IF implementation_evidence == none: APPEND {claim: sc, status: "NOT IMPLEMENTED", violation: "claim_without_implementation"} TO self_discrepancies
  CALCULATE self_confidence IN [confirmed, partially_confirmed, overclaimed, invalid] FROM self_discrepancies
  RETURN {self_discrepancies: self_discrepancies, self_confidence: self_confidence}

FUNCTION run_gate_protocol(findings):
  # each criterion ranked {critical, high, medium, low}
  IF any critical criterion fails: RETURN "BLOCK"
  ELSE IF any noncritical fails:   RETURN "WARN"
  ELSE:                            RETURN "PASS"

# OUTPUT CONTRACT
SET discrepancies = classify_claims(observations)
SET behavioral = behavioral_self_test(capability_plan)
SET vulnerabilities = adversarial_test(capability_plan.calibrated_detectors)
SET self = self_audit()
SET gate_result = run_gate_protocol({discrepancies: discrepancies, behavioral: behavioral, vulnerabilities: vulnerabilities, self: self})
SET adjudication = {discrepancies: discrepancies, behavioral: behavioral, vulnerabilities: vulnerabilities, self_confidence: self.self_confidence, gate_result: gate_result}

HANDOFF GATE (evidence-bearing):
  rule_id: "ADJUDICATION"
  [check] every claim classified verified | contradicted | unverified (evidence: discrepancies + observations)
  [check] no match trusted without calibration + adversarial verdict (evidence: vulnerabilities)
  [check] behavior mismatch treated as implementation-evidence failure (evidence: behavioral)
  [check] recursive self-audit run; overclaim downgrades confidence (evidence: self_confidence)
  [warn] any VULNERABLE verdict -> "a claim it 'verified' may be spoofed"
  result: gate_result == PASS/WARN -> STAGE 6 REPORTING | escalation needed -> STAGE 5 RECOVERY | BLOCK -> STAGE 6 as blocked (owner: validation)


# ============================================================================
# STAGE 5 — RECOVERY  (what happens when a check fails)
# ============================================================================
@purpose: "Resolve capability gaps and write failures without inference, and route confidence downgrades"
@cue: "BUILD_OR_MARK_NEVER_INFER"

CONTRACT:
  input:        observations flagged PENDING_ESCALATION; modification errors; overclaim signals
  transform:    escalate (build a tool) OR mark unverified; stale-write -> read-merge-rewrite full state; downgrade confidence
  constraints:  NEVER infer a missing result; NEVER let INVESTIGATE mutate or ACTION discover; a stale write is a state-sync failure, rewritten as complete state not a patch
  output:       resolved observations OR claims marked unverified; verified writes; adjusted confidence
  handoff:      every escalation resolved to evidence OR explicitly marked unverified

FUNCTION escalate_capability(observation, capability_mode):
  IF capability_mode == "blocked":
    RETURN {observation: "capability unavailable", verdict: "unverified"}   # marked, never inferred
  # direct: search, glob, read, execute, write. beyond: AST/CFG, dependency tree, symbol table, type inference.
  CONSTRUCT tool: write_script -> execute_script -> parse_results
  EXECUTE_TOOL tool ON observation.target INTO analysis
  RETURN {observation: analysis, verdict: classify(analysis)}   # generated-tool output integrated as evidence

FUNCTION recover_write(target, required_change):
  READ_RESOURCE target INTO current_content
  MERGE required_change WITH current_content INTO new_content
  PERSIST_ARTIFACT target WITH new_content   # complete state, not a patch
  VALIDATE write: Exists AND ContentMatches
  RETURN write_verified

# OUTPUT CONTRACT
FOR EACH o IN observations WHERE o.observation == "PENDING_ESCALATION": SET o = escalate_capability(o, capability_plan.capability_mode)
IF modification_error: SET write_verified = recover_write(target, required_change)
IF adjudication.self_confidence IN ["overclaimed", "invalid"]: DOWNGRADE reported_confidence

HANDOFF GATE (evidence-bearing):
  rule_id: "RECOVERY"
  [check] every capability gap resolved to evidence OR marked unverified — none inferred (evidence: observations)
  [check] any recovered write verified Exists AND ContentMatches (evidence: write_verified)
  [check] INVESTIGATE performed no mutation / ACTION discovered no new scope (evidence: run_context.forbidden_ops honored)
  result: resolved -> STAGE 4 re-adjudicate changed claims | unresolvable -> STAGE 6 REPORTING (owner: recovery)


# ============================================================================
# STAGE 6 — REPORTING  (when the process is complete)
# ============================================================================
@purpose: "Emit exactly one typed artifact and name every limitation, warning, and vulnerability"
@cue: "TYPED_TERMINAL"

CONTRACT:
  input:        run_context + adjudication + recovery outcomes
  transform:    select the artifact type bound in STAGE 1 -> serialize findings -> name every limitation
  constraints:  exactly one artifact; INVESTIGATE emits evidence and never fixes; ACTION operates only on known evidence and discovers nothing
  output:       generation_result { artifact_type, output }
  handoff:      typed artifact emitted with confidence level and every limitation named

EMIT ONE of:
  - investigation_report  # verified findings, failed checks, warnings, discrepancies, environmental limits, adversarial results, confidence (INVESTIGATE — produces evidence, never fixes)
  - action_log            # documented gaps only, bounded fixes, versioned artifact, write verification (ACTION — operates on known evidence, discovers nothing)
  - blocked_execution_report  # trust-anchor or critical-capability failure prevented safe verification

IF run_context.trust_anchor.unmet OR capability_plan.capability_mode == "blocked":
  SET generation_result = {artifact_type: "blocked_execution_report", output: render_blocked(run_context, adjudication)}
ELSE:
  SET generation_result = {artifact_type: run_context.artifact, output: render_report(run_context, adjudication)}

HANDOFF GATE (evidence-bearing):
  rule_id: "REPORTING"
  [check] exactly one typed artifact emitted (evidence: generation_result.artifact_type)
  [check] every limitation, warning, and vulnerability named (evidence: generation_result.output)
  [check] confidence reflects self-audit downgrade (evidence: adjudication.self_confidence)
  result: TERMINATE

FINALIZE generation_result


# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - disclose the trust anchor (minimal assumptions + cannot-verify-the-verifier boundary)
  - probe runtime capabilities (full/degraded/blocked) before relying on them
  - calibrate detectors (false-positive AND false-negative controls) before trusting their output
  - behaviorally self-test claimed capabilities against a positive AND a negative case
  - adversarially test detection logic and record blocked | ignored | vulnerable verdicts
  - sanitize strings, guard arithmetic, govern recursion depth
  - classify every claim verified | contradicted | unverified with its evidence
  - recursively self-verify and downgrade confidence on overclaim
  - a stage reads ONLY the prior stage's output contract, and hands off through exactly one evidence-bearing gate
  - emit one typed artifact and name every limitation, warning, and vulnerability

NEVER:
  - trust a claim not mapped to observable implementation evidence
  - let INVESTIGATE mutate, or let ACTION discover new scope
  - report a match without calibrating the detector against known-good AND known-bad controls
  - accept ordinary examples as proof — test the detector adversarially (traversal, null byte, homoglyph, comment/spoof)
  - match a pattern inside a comment/string as if it were real code, or match a homoglyph as the legitimate token
  - emit runtime-specific paths or commands into the core (adapter-resolve them), or hardcode a model
  - infer a result when a capability is missing — build a tool or mark the claim unverified
  - exempt this agent from its own verification
```
