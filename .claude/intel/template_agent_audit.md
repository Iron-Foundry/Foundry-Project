---
name: agent-audit
description: Executable template. Audits a target agent against the universal agent contract — portability, DSL compliance, algorithmic embodiment, capability awareness, evidence grounding — and applies bounded, non-destructive corrections, through five stages: orientation, domain-currency forensics, dimensioned audit, bounded correction, and a scored report.
type: template
domain: [ai-governance, quality]
keywords: [agent-audit, universal-contract, portability, embodiment, capability-awareness, evidence-grounding, non-destructive, scored]
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
priority: EVIDENCE > UNIVERSAL_CONTRACT > TASK
trust: searched_evidence = TRUSTED, oracle_confirmation = TRUSTED, prior_knowledge = UNTRUSTED
objective: measure a target agent against the universal agent contract on counted, thresholded
           dimensions, correct it non-destructively toward the contract, and report a score

SEMANTIC OPERATION BOUNDARY: audit steps are semantic operations — DISCOVER_RESOURCES, READ_RESOURCE,
SEARCH_CONTENT, ANALYZE_CONTENT, CALCULATE_METRIC, CONSULT_ORACLE, VALIDATE, PERSIST_ARTIFACT,
REPORT_RESULT. A runtime ADAPTER maps them (Claude Code: SEARCH_CONTENT->Grep, DISCOVER_RESOURCES->Glob,
READ_RESOURCE->Read, VALIDATE/EXECUTE->Bash, PERSIST_ARTIFACT->Write). {project.*} / {convention.*} /
{model} are adapter-resolved; the audit core carries no hardcoded runtime paths. Content matching is
procedural, never regex.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract.

# ============================================================================
# STAGE 1 — ORIENTATION  (what is being audited, in what mode)
# ============================================================================
@purpose: "Load registries + governance, profile capabilities, and identify the target (self or specified)"
@cue: "FRAME_THE_AUDIT"

CONTRACT:
  input:        invocation (optional target); host registries + governance sources
  transform:    discover registries -> probe capabilities -> resolve target + self_audit_mode
  constraints:  probe by CAPABILITY not OS-string; registries adapter-resolved, not hardcoded
  output:       run_frame { agent_registry, governance_sources, capability_mode, target_agent, agent_content, self_audit_mode }
  handoff:      registries discovered AND capabilities classified AND target loaded

DISCOVER_RESOURCES "{project.agent_registry}" INTO agent_registry
DISCOVER_RESOURCES "{project.governance_sources}" INTO governance_sources
FOR EACH capability IN ["filesystem", "search", "execution", "persistence", "oracle", "web_research"]:
  PROBE capability INTO verdict; SET capability_profile[capability] = verdict
CALCULATE capability_mode IN [full, degraded, blocked] FROM capability_profile

WHEN user_specifies_target: SET target_agent = user_input; SET self_audit_mode = false
ELSE: SET target_agent = {self.definition}; SET self_audit_mode = true
READ_RESOURCE target_agent INTO agent_content

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] agent registry + governance sources discovered, adapter-resolved (evidence: run_frame.agent_registry)
  [check] capabilities probed and classified full | degraded | blocked (evidence: capability_mode)
  [check] target identified (self or specified) and content read (evidence: agent_content, self_audit_mode)
  result: pass -> STAGE 2 FORENSICS (owner: orientation)

# ============================================================================
# STAGE 2 — FORENSICS  (domain currency, external audit only)
# ============================================================================
@purpose: "Confirm deprecated patterns in the target's domain by evidence + oracle before flagging anything"
@cue: "CONFIRM_BEFORE_FLAG"

CONTRACT:
  input:        run_frame (external targets only)
  transform:    research the target's domain best-practice -> confirm suspected deprecations via oracle -> score currency
  constraints:  a deprecation is flagged ONLY after oracle/evidence confirmation, never assumed; degrade gracefully when research/oracle unavailable
  output:       forensics { outdated_patterns[], currency_score }
  handoff:      every flagged deprecation confirmed OR the step disclosed as skipped (degraded)

IF run_frame.self_audit_mode == false:
  SEARCH_CONTENT agent_content FOR domain, keywords INTO agent_domain
  FOR EACH query IN best_practice_queries(agent_domain):
    RESEARCH query INTO findings   # when web_research available; else skip + note degraded
  FOR EACH finding WHERE type == "deprecated_pattern":
    SEARCH_CONTENT agent_content FOR finding.pattern INTO usage
    IF usage AND finding.confidence == "uncertain":
      CONSULT_ORACLE "{project.reasoning_oracle}" WITH deprecation_question INTO verdict
      IF verdict.confirmed: RECORD outdated_pattern {pattern, replacement: verdict.alternative, evidence: verdict}
  CALCULATE currency_score FROM outdated_patterns

HANDOFF GATE (evidence-bearing):
  rule_id: "FORENSICS"
  [check] every deprecated pattern confirmed by oracle/evidence before flagging (evidence: outdated_patterns)
  [check] currency scored; research/oracle unavailability disclosed as degraded (evidence: currency_score)
  result: pass -> STAGE 3 AUDIT (owner: orientation)

# ============================================================================
# STAGE 3 — AUDIT  (measure against the universal contract, then score)
# ============================================================================
@purpose: "Measure six contract dimensions with counted, thresholded results and compute a recommendation"
@cue: "COUNT_NEVER_JUDGE"

CONTRACT:
  input:        agent_content + forensics
  transform:    measure prohibitions, DSL, embodiment, portability, capability-awareness, evidence-grounding -> weighted score -> recommendation
  constraints:  every dimension has a counted, thresholded result — no subjective pass; content matching procedural
  output:       audit { results, embodiment_score, overall_score, recommendation }
  handoff:      every dimension measured AND recommendation in {COMPLIANT, REQUIRES_CORRECTION}

DECLARE audit_results: object
# 3.1 Prohibited operations
FOR EACH prohibition IN ["unreviewable_batch_mutation (cross-file scripts/stream-editors)", "version_control_side_effects", "silent_fallback_or_dual_path", "runtime_specific_paths_or_commands_in_core"]:
  SEARCH_CONTENT agent_content FOR prohibition INTO violations; SET audit_results.prohibitions[prohibition] = (violations == none)
# 3.2 DSL compliance (PAG, attributed)
FOR EACH keyword IN ["PHASE", "VALIDATION GATE", "DECLARE", "SET", "WHEN", "FOR EACH", semantic_operations]:
  SEARCH_CONTENT agent_content FOR keyword INTO matches; SET audit_results.dsl[keyword] = {found: matches > 0, count: matches}
# 3.3 Algorithmic embodiment
FOR EACH marker IN ["phase_gates", "declaration_before_use", "calculated_metrics", "exact_thresholds", "iterative_discovery"]:
  SEARCH_CONTENT agent_content FOR marker INTO present
CALCULATE embodiment_score = fraction(markers present)
# 3.4 Portability / no runtime leakage
SEARCH_CONTENT agent_content FOR hardcoded runtime paths + runtime-specific commands INTO leakage
SET audit_results.portability = {leakage_count: count(leakage), portable: leakage == none}
# 3.5 Capability awareness (probe, degrade/block — never silent fallback)
SEARCH_CONTENT agent_content FOR capability_probe + {full,degraded,blocked} INTO capability_aware
SEARCH_CONTENT agent_content FOR silent_fallback INTO fallback_smell
SET audit_results.capability = {aware: capability_aware > 0, fallback_free: fallback_smell == none}
# 3.6 Evidence grounding
SEARCH_CONTENT agent_content FOR claim-to-evidence mapping + {verified,contradicted,unverified} INTO grounding
SET audit_results.grounding = {evidence_gated: grounding > 0}

# score
CALCULATE overall_score = weighted(dsl_compliance, embodiment_score, portability, capability_awareness, evidence_grounding, currency_score IF external)
IF overall_score >= {convention.audit_pass_threshold}: SET recommendation = "COMPLIANT"
ELSE: SET recommendation = "REQUIRES_CORRECTION"
PERSIST_ARTIFACT {target, results: audit_results, overall_score, recommendation, capability_mode, timestamp: {convention.timestamp}} TO {convention.audit_workspace}

HANDOFF GATE (evidence-bearing):
  rule_id: "AUDIT"
  [check] prohibitions, DSL, embodiment, portability, capability-awareness, evidence-grounding all measured (evidence: audit_results)
  [check] every dimension counted and thresholded — no subjective pass (evidence: per-dimension counts)
  [check] overall_score computed; recommendation in {COMPLIANT, REQUIRES_CORRECTION}; report persisted (evidence: overall_score)
  result: COMPLIANT -> STAGE 5 REPORT | REQUIRES_CORRECTION -> STAGE 4 CORRECTION (owner: validation)

# ============================================================================
# STAGE 4 — CORRECTION  (bounded, non-destructive)
# ============================================================================
@purpose: "Correct the target toward the universal contract without introducing a fallback or losing recoverability"
@cue: "REPAIR_TOWARD_CONTRACT"

CONTRACT:
  input:        audit (REQUIRES_CORRECTION) + agent_content
  transform:    compose correction checklist from failed dimensions -> archive (external) -> apply single-path corrections -> version
  constraints:  archive + verify recoverability before any EXTERNAL mutation; corrections are SINGLE-PATH — never add a fallback/dual-path to satisfy a check; delete offending paths without a replacement stub
  output:       corrected agent artifact { updated_content, version }
  handoff:      archive verified before mutation AND every correction single-path

COMPOSE correction_checklist FROM failed dimensions
IF NOT run_frame.self_audit_mode: ARCHIVE target BEFORE mutation; VALIDATE archive_persisted; IF NOT archive_persisted: BLOCK
DECLARE updated_content = agent_content
FOR EACH prohibited_hit:            REMOVE it (delete the offending path, no replacement stub)
FOR EACH runtime_leak:              REPLACE with the semantic operation + adapter-resolved token
FOR EACH missing_embodiment_marker: STRENGTHEN structure (add phase gate / calculated metric / iterative discovery)
FOR EACH silent_fallback:           REPLACE with bounded recovery -> else fail-fast + report
INCREMENT version
PERSIST_ARTIFACT updated_content TO target

HANDOFF GATE (evidence-bearing):
  rule_id: "CORRECTION"
  [check] external replace archived + verified before mutation (evidence: archive_persisted)
  [check] leakage -> semantic operations; fallbacks -> bounded recovery; embodiment strengthened (evidence: correction_checklist)
  [check] version incremented; single-path preserved, no dual-path introduced (evidence: updated_content)
  result: pass -> STAGE 5 REPORT (owner: recovery)

# ============================================================================
# STAGE 5 — REPORT  (when the audit is complete)
# ============================================================================
@purpose: "Emit a scored report that names every dimension, correction, and limitation"
@cue: "SCORE_AND_NAME_LIMITS"

CONTRACT:
  input:        run_frame + forensics + audit + corrections
  transform:    compose report -> emit
  constraints:  the report names the score, every dimension, corrections, and every limitation (degraded capabilities / skipped research / oracle consultations)
  output:       report
  handoff:      report names score, per-dimension results, corrections, and limitations

COMPOSE report FROM {target, mode, overall_score, per-dimension results, corrections, limitations, oracle consultations}
REPORT_RESULT report

HANDOFF GATE (evidence-bearing):
  rule_id: "REPORT"
  [check] report names score, every dimension, corrections, and limitations (evidence: report)
  result: TERMINATE

FINALIZE report

# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - probe capabilities and degrade/block gracefully
  - audit against the universal agent contract (portability, semantic boundary, capability awareness, evidence grounding, embodiment)
  - keep PAG-DSL compliance as an attributed check
  - ground every flag in searched evidence; consult the reasoning oracle on uncertainty
  - a stage reads ONLY the prior stage's output contract, and hands off through exactly one evidence-bearing gate
  - emit a scored report that names every limitation

NEVER:
  - flag a deprecation without oracle/evidence confirmation
  - pass a dimension subjectively — every check is counted and thresholded
  - rewrite an external agent without archiving + verifying recoverability first
  - introduce a fallback/dual-path to make a check pass (single-path, fail-fast)
  - leave runtime-specific paths/commands in the audited core — flag them as leakage
  - hardcode a model, path, or oracle command — adapter-resolve them
  - use regex — match procedurally
```
