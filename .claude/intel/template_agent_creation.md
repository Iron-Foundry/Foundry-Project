---
name: agent-creation
description: Executable template. Generates a portable, evidence-grounded investigation agent through seven reasoning stages — orientation, non-destructive domain discovery, difficulty-scaled design, runtime-neutral contract composition + adapter rendering, artifact adjudication, bounded recovery, and an audited report. Never from assumptions, never with hardcoded runtime literals.
type: template
domain: [ai-governance, architecture]
keywords:
    [
        agent-generation,
        meta-agent,
        evidence-grounded,
        portable-contract,
        adapter,
        adaptive-structure,
        capability-profile,
        non-destructive,
        audit,
    ]
owner: BanesLab
created: 2026-07-14
last-verified: 2026-07-14
version: 1
staleness-days: -1
max-lines: 700
depends-on: [reference_development_rules.md]
supersedes:
---

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

```py
%% META %%:
priority: EVIDENCE > PORTABLE_CONTRACT > ADAPTER_RENDERING > TASK
trust: inspected_domain_evidence = TRUSTED, prior_knowledge = UNTRUSTED, an_assumption = FORBIDDEN
objective: compose a task-specific agent from inspected domain evidence into a runtime-neutral
           portable contract, render it through an adapter, and prove the artifact is grounded and embodied

SEMANTIC OPERATION BOUNDARY: stages state WHAT must happen as semantic operations — DECLARE_RESOURCE,
DISCOVER_RESOURCES, READ_RESOURCE, SEARCH_CONTENT, ANALYZE_CONTENT, EXTRACT_FACTS, CALCULATE_METRIC,
COMPOSE_ARTIFACT, VALIDATE_ARTIFACT, PERSIST_ARTIFACT, REQUEST_DECISION, REPORT_RESULT. A runtime
ADAPTER decides HOW (Claude Code: DISCOVER_RESOURCES->Glob, SEARCH_CONTENT->Grep, READ_RESOURCE->Read,
ANALYZE/EXECUTE->Bash, PERSIST_ARTIFACT->Write). The core carries no runtime paths or commands; every
{project.*} / {convention.*} / {model} token is adapter-resolved from the host.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract.

# ============================================================================
# STAGE 1 — ORIENTATION  (what this generation is)
# ============================================================================
@purpose: "Load context, profile runtime capabilities, and resolve operation mode + cache decision before any domain work"
@cue: "PROFILE_BEFORE_ACT"

CONTRACT:
  input:        user_request; host registries + ontology + workspace
  transform:    load context -> probe capabilities -> resolve collision mode -> resolve cache decision
  constraints:  probe by CAPABILITY not OS-string; no silent duplicate/overwrite; cache identity by normalized-path hash + TTL
  output:       run_frame { registries, capability_profile, runtime_mode, operation_mode, cache_decision, domain_cache }
  handoff:      capabilities classified AND operation_mode resolved AND cache decision made

DISCOVER_RESOURCES "{project.agent_registry}" INTO agent_registry
DISCOVER_RESOURCES "{project.invocation_registry}" INTO invocation_registry
DISCOVER_RESOURCES "{project.knowledge_docs}" INTO knowledge_docs
DECLARE_RESOURCE "{project.principle_ontology}" AS principle_ontology
SET agent_workspace = "{convention.agent_workspace}"

FUNCTION profile_capabilities():
  DECLARE profile: object
  FOR EACH capability IN ["filesystem", "search", "execution", "persistence", "validation", "user_interaction"]:
    PROBE capability INTO verdict
    IF verdict == "available": SET profile[capability] = "available"
    ELSE IF safe_substitute_exists(capability): SET profile[capability] = "substituted"
    ELSE: SET profile[capability] = "unavailable"
  IF any_required == "unavailable" AND non_substitutable: SET runtime_mode = "blocked"
  ELSE IF any == "substituted": SET runtime_mode = "degraded"
  ELSE: SET runtime_mode = "full"
  RETURN {profile: profile, runtime_mode: runtime_mode}

FUNCTION resolve_operation_mode(user_request, agent_registry):
  EXTRACT target_agent_name FROM user_request
  CALCULATE name_collision = agent_registry CONTAINS target_agent_name
  CALCULATE domain_collision = agent_registry ANY covers target_domain
  IF name_collision OR domain_collision: REQUEST_DECISION user WITH ["REFINE", "RENAME", "REPLACE", "CANCEL"] INTO mode
  ELSE: SET mode = "CREATE"
  RETURN {target_agent_name: target_agent_name, operation_mode: mode}

FUNCTION resolve_cache(user_request):
  EXTRACT domain_path FROM user_request
  CALCULATE domain_hash = hash(NORMALIZE(domain_path))
  DECLARE_RESOURCE agent_workspace + "/domain-" + domain_hash INTO domain_cache
  IF EXISTS(domain_cache) AND age_days(domain_cache) < {convention.cache_ttl_days}: RETURN {cache_decision: "use_cached_domain", domain_cache: domain_cache}
  IF EXISTS(domain_cache): RETURN {cache_decision: "reject_stale_cache", domain_cache: domain_cache}
  RETURN {cache_decision: "no_cache_investigate", domain_cache: domain_cache}

# OUTPUT CONTRACT
SET cap = profile_capabilities()
SET op = resolve_operation_mode(user_request, agent_registry)
SET cache = resolve_cache(user_request)
SET run_frame = {registries: {agent_registry, invocation_registry, knowledge_docs, principle_ontology}, capability_profile: cap.profile, runtime_mode: cap.runtime_mode, operation_mode: op.operation_mode, target_agent_name: op.target_agent_name, cache_decision: cache.cache_decision, domain_cache: cache.domain_cache}

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] capabilities probed and classified full | degraded | blocked (evidence: capability_profile)
  [check] operation_mode in {CREATE, REFINE, RENAME, REPLACE, CANCEL}; no silent duplicate (evidence: operation_mode)
  [check] cache decision made by normalized-path hash + TTL (evidence: cache_decision)
  result: mode != CANCEL AND runtime_mode != blocked -> STAGE 2 DISCOVERY | blocked/CANCEL -> STAGE 6 RECOVERY (owner: orientation)


# ============================================================================
# STAGE 2 — DISCOVERY  (evidence before any composition)
# ============================================================================
@purpose: "Extract scope matched to the domain shape and build an evidence-grounded knowledge base non-destructively"
@cue: "DISCOVER_NEVER_ASSUME"

CONTRACT:
  input:        run_frame
  transform:    extract scope -> investigate non-destructively (or reuse fresh cache) -> build knowledge base
  constraints:  NON-DESTRUCTIVE — inspect and analyze only, never mutate the source; every fact traces to a discovered resource; observable output required
  output:       knowledge_base { scope, structure, purposes, dependencies, interfaces, patterns, statistics, evidence_sources }
  handoff:      knowledge base grounded in real resources AND persisted

FUNCTION extract_scope(user_request):
  EXTRACT investigation_type FROM user_request
  MATCH investigation_type:
    CASE "single-resource": READ_RESOURCE domain_path INTO c; EXTRACT_FACTS interfaces, declarations, line_count FROM c INTO scope; SET depth = "resource"
    CASE "directory":       DISCOVER_RESOURCES domain_path INTO r; EXTRACT_FACTS resource_count, subdomains, interfaces FROM r INTO scope; SET depth = "directory"
    CASE "module":          DISCOVER_RESOURCES domain_path INTO r; ANALYZE_CONTENT r FOR architecture_patterns, base_classes INTO scope; SET depth = "module"
    CASE "repository":      DISCOVER_RESOURCES domain_path INTO r; ANALYZE_CONTENT r FOR systems, boundaries INTO scope; SET depth = "repository"
    CASE "auto":            CALCULATE depth FROM domain_path shape
  RETURN {scope: scope, depth: depth}

FUNCTION investigate(run_frame, scope):
  IF run_frame.cache_decision == "use_cached_domain": READ_RESOURCE run_frame.domain_cache INTO domain_knowledge
  ELSE:
    DECLARE plan: object
    SET plan.static = analyze-without-mutation
    IF run_frame.capability_profile.execution == "available": SET plan.executable = safe-observable-analysis
    ANALYZE_CONTENT scope VIA plan INTO domain_knowledge
    PERSIST_ARTIFACT domain_knowledge TO run_frame.domain_cache
  RETURN domain_knowledge

# OUTPUT CONTRACT
SET s = extract_scope(user_request)
SET domain_knowledge = investigate(run_frame, s.scope)
DECLARE knowledge_base: object
SET knowledge_base.scope = s.scope
EXTRACT_FACTS structure, purposes, dependencies, interfaces, patterns FROM domain_knowledge INTO knowledge_base
CALCULATE_METRIC knowledge_base.statistics = {resource_count, interface_count, dependency_count, resource_types, architectural_patterns}
SET knowledge_base.evidence_sources = discovered_resources
PERSIST_ARTIFACT knowledge_base TO agent_workspace + "/domain-knowledge"

HANDOFF GATE (evidence-bearing):
  rule_id: "DISCOVERY"
  [check] scope depth matches domain shape (resource | directory | module | repository) (evidence: knowledge_base.scope)
  [check] investigation mutated no source; outputs observable (evidence: non-destructive analysis)
  [check] every fact traces to an evidence source (evidence: knowledge_base.evidence_sources)
  result: pass -> STAGE 3 DESIGN (owner: orientation)


# ============================================================================
# STAGE 3 — DESIGN  (goals into a difficulty-scaled structure)
# ============================================================================
@purpose: "Characterize the domain, derive portable principles, and scale the target agent's phase rigor to difficulty"
@cue: "SCALE_RIGOR_TO_RISK"

CONTRACT:
  input:        knowledge_base + registries
  transform:    assign characteristics -> measure baseline grammar -> select relevant docs -> extract principles -> scale phase structure -> derive per-phase validation requirements
  constraints:  characteristics assigned FROM evidence; portable principles only (exclude runtime-specific); phase count scales with risk/complexity/uncertainty
  output:       agent_design { characteristics, baseline, principles, phase_structure, validation_requirements }
  handoff:      phase rigor scaled to difficulty AND every phase has verifiable exit conditions

FUNCTION assign_characteristics(kb):
  ANALYZE_CONTENT kb FOR risk_factors, side_effects, dependency_patterns, uncertainty_factors
  IF dependencies.external.count > 0: SET risk = "high"
  ELSE IF kb.structure.resource_count > {convention.medium_risk_threshold}: SET risk = "medium"
  ELSE: SET risk = "low"
  CALCULATE_METRIC complexity = weighted(resource_count, interface_count, dependency_patterns)
  CALCULATE reversibility IN [reversible, partially-reversible, irreversible] FROM side_effects + external_dependencies
  CALCULATE uncertainty IN [low, medium, high] FROM missing_evidence
  RETURN {risk: risk, complexity: complexity, reversibility: reversibility, uncertainty: uncertainty}

FUNCTION measure_baseline(agent_registry):
  DECLARE patterns: array
  FOR EACH agent IN agent_registry:
    READ_RESOURCE agent INTO spec
    APPEND {phase_count: count(phase_markers IN spec), gate_count: count(validation_gates IN spec), operation_count: count(semantic_operations IN spec)} TO patterns
  CALCULATE_METRIC baseline = {mean_phase_count, mean_gate_count} FROM patterns
  RETURN baseline

FUNCTION extract_principles(characteristics, relevant_docs, principle_ontology):
  SET candidates = ["phase_gated_execution", "validation_boundaries", "declaration_before_use", "evidence_before_composition", "adapter_separation", "auditability"]
  DECLARE principles: array
  FOR EACH p IN candidates: ANALYZE_CONTENT p AGAINST characteristics; IF applicable: APPEND p TO principles
  FOR EACH doc IN relevant_docs: EXTRACT_FACTS domain_principles FROM doc INTO principles
  # exclude runtime-specific principles from the portable core
  RETURN principles

FUNCTION scale_phase_structure(characteristics):
  IF characteristics.risk == "high" AND characteristics.complexity > {convention.high_complexity_threshold}:
    SET boundaries = ["Discovery", "Analysis", "Planning", "Validation", "Generation", "Verification", "Finalization"]   # 7
  ELSE IF characteristics.risk == "medium" OR characteristics.complexity > {convention.medium_complexity_threshold}:
    SET boundaries = ["Discovery", "Analysis", "Generation", "Verification", "Finalization"]   # 5
  ELSE:
    SET boundaries = ["Discovery", "Generation", "Verification"]   # 3
  RETURN {boundaries: boundaries, validation_density: proportional_to(risk, complexity, uncertainty)}

# OUTPUT CONTRACT
DECLARE agent_design: object
SET agent_design.characteristics = assign_characteristics(knowledge_base)
SET agent_design.baseline = measure_baseline(agent_registry)
SET relevant_docs = []
FOR EACH doc IN knowledge_docs: READ_RESOURCE doc INTO d; IF match(d, agent_design.characteristics) > {convention.relevance_threshold}: APPEND doc TO relevant_docs
SET agent_design.principles = extract_principles(agent_design.characteristics, relevant_docs, principle_ontology)
SET agent_design.phase_structure = scale_phase_structure(agent_design.characteristics)
DECLARE validation_requirements: object
FOR EACH phase IN agent_design.phase_structure.boundaries: DERIVE validation_requirements[phase] FROM phase.purpose + adapter_separation_needs + evidence_grounding_needs + safety_constraints
SET agent_design.validation_requirements = validation_requirements

HANDOFF GATE (evidence-bearing):
  rule_id: "DESIGN"
  [check] risk/complexity/reversibility/uncertainty assigned from evidence (evidence: agent_design.characteristics)
  [check] phase count scaled 3 | 5 | 7 to difficulty; validation density proportional (evidence: phase_structure)
  [check] principles portable, runtime-specific excluded (evidence: agent_design.principles)
  [check] every phase has verifiable exit conditions (evidence: validation_requirements)
  result: pass -> STAGE 4 COMPOSITION (owner: planning)


# ============================================================================
# STAGE 4 — COMPOSITION  (build the canonical contract, then render)
# ============================================================================
@purpose: "Compose the runtime-neutral portable contract as the canonical artifact, then render it through the adapter"
@cue: "CONTRACT_FIRST_ADAPTER_RENDERS"

CONTRACT:
  input:        agent_design + knowledge_base + run_frame
  transform:    compose portable contract -> compose validation strategy -> render via adapter -> persist artifacts
  constraints:  the portable contract is CANONICAL and runtime-neutral (no paths/commands/model in the core); adapter outputs are projections that add runtime metadata but never alter core intent; invocation is SINGLE-PATH (no fallback/dual path); a REPLACE persist requires a verified archive first (STAGE 6)
  output:       artifact_set { portable_contract, agent_specification, invocation_contract, audit_inputs }
  handoff:      runtime-neutral contract composed AND artifacts rendered as projections AND persisted

FUNCTION compose_contract(agent_design, run_frame):
  DECLARE contract: object
  SET contract.identity = {name: run_frame.target_agent_name, version, description}
  SET contract.purpose = agent_purpose
  SET contract.domain_model = {scope: knowledge_base.scope, characteristics: agent_design.characteristics}
  SET contract.capability_requirements = required_capabilities
  SET contract.phase_specifications = COMPOSE_ARTIFACT(agent_design.phase_structure, agent_design.validation_requirements, agent_design.principles)
  SET contract.validation_strategy = {pre: ["capabilities_detected", "history_checked", "domain_knowledge_available"], during: ["phase_gates_enforced", "evidence_grounded_content", "adapter_separated"], post: ["schema_valid", "audit_complete", "unsupported_assumptions_absent"]}
  SET contract.safety_constraints = {non_destructive, no_runtime_leakage, evidence_grounded}
  SET contract.output_contract = ["portable_agent_contract", "invocation_contract", "audit_report", "final_report"]
  RETURN contract

FUNCTION render_via_adapter(contract):
  DECLARE_RESOURCE "{project.runtime_adapter}" AS adapter
  RENDER contract VIA adapter INTO artifact_set   # {agent_specification, invocation_contract, audit_report}
  # model, filenames, destinations are adapter-resolved ({model}, {convention.*}), never hardcoded;
  # the invocation contract exposes ONE path — invoke the agent — with no manual fallback.
  VALIDATE_ARTIFACT artifact_set AGAINST adapter.schema
  RETURN artifact_set

# OUTPUT CONTRACT
SET portable_contract = compose_contract(agent_design, run_frame)
GUARD replacement_safety(run_frame.operation_mode)   # STAGE 6 archives + verifies before any destructive persist
SET artifact_set = render_via_adapter(portable_contract)
FOR EACH artifact IN artifact_set: PERSIST_ARTIFACT artifact TO adapter.destination

HANDOFF GATE (evidence-bearing):
  rule_id: "COMPOSITION"
  [check] portable contract is runtime-neutral — no paths/commands/model in the core (evidence: portable_contract)
  [check] runtime artifacts are projections of the contract, model/paths adapter-resolved (evidence: artifact_set)
  [check] invocation contract is single-path, no fallback (evidence: invocation_contract)
  [check] REPLACE gated on a verified archive before persist (evidence: replacement_safety guard)
  result: pass -> STAGE 5 ADJUDICATION | archive unverified -> STAGE 6 RECOVERY (owner: compilation)


# ============================================================================
# STAGE 5 — ADJUDICATION  (does the artifact satisfy the goal)
# ============================================================================
@purpose: "Prove the persisted artifact is semantically compliant, evidence-grounded, and algorithmically embodied"
@cue: "PROVE_ON_THE_PERSISTED_ARTIFACT"

CONTRACT:
  input:        persisted agent_specification + knowledge_base
  transform:    check semantic compliance -> check evidence grounding -> check algorithmic embodiment
  constraints:  judge the STORED artifact, not the in-memory plan; zero runtime-specific leakage; every claim traces to the knowledge base; the agent must EMBODY the architecture, not merely describe it
  output:       adjudication { semantic, grounding, embodiment, verdict }
  handoff:      compliance compliant AND grounding grounded AND embodiment embodied

FUNCTION check_semantic(generated):
  SEARCH_CONTENT generated FOR semantic_operations, phase_markers, validation_gates INTO markers
  SEARCH_CONTENT generated FOR runtime_specific_leakage INTO leakage
  IF markers.counts pass required AND leakage.count == 0: RETURN "compliant"
  RETURN "non_compliant"

FUNCTION check_grounding(generated, knowledge_base):
  SEARCH_CONTENT generated FOR claims INTO claim_set
  ANALYZE_CONTENT claim_set AGAINST knowledge_base
  CALCULATE_METRIC grounding_score = grounded_claims / total_claims
  IF grounding_score >= {convention.grounding_threshold} AND unsupported_claims == 0: RETURN "grounded"
  RETURN "unsupported_claims_present"

FUNCTION check_embodiment(generated):
  DECLARE present: array
  FOR EACH marker IN ["phase_gates", "declaration_before_use", "calculated_metrics", "thresholds", "iterative_discovery"]: SEARCH_CONTENT generated FOR marker INTO p; APPEND p TO present
  CALCULATE_METRIC embodiment_score = fraction(present)
  IF embodiment_score >= {convention.embodiment_threshold}: RETURN "embodied"
  RETURN "insufficiently_embodied"

# OUTPUT CONTRACT
READ_RESOURCE persisted_agent_specification INTO generated
DECLARE adjudication: object
SET adjudication.semantic = check_semantic(generated)
SET adjudication.grounding = check_grounding(generated, knowledge_base)
SET adjudication.embodiment = check_embodiment(generated)
SET adjudication.verdict = all_pass(adjudication) ? "pass" : "reject"

HANDOFF GATE (evidence-bearing):
  rule_id: "ADJUDICATION"
  [check] required semantic-operation/phase/gate counts present AND zero runtime leakage (evidence: adjudication.semantic)
  [check] every architecture claim traces to the knowledge base, threshold met (evidence: adjudication.grounding)
  [check] artifact embodies gates/declaration-before-use/metrics/thresholds/iterative discovery (evidence: adjudication.embodiment)
  result: verdict == pass -> STAGE 7 REPORTING | reject -> STAGE 6 RECOVERY (owner: validation)


# ============================================================================
# STAGE 6 — RECOVERY  (what happens when a check fails)
# ============================================================================
@purpose: "Halt on blocked capability, guarantee recoverability before destructive persist, and reject/re-compose failing artifacts"
@cue: "ARCHIVE_OR_HALT_NEVER_INFER"

CONTRACT:
  input:        blocked runtime_mode; REPLACE operation; adjudication reject
  transform:    blocked -> halt with report; REPLACE -> archive + verify before mutate; failed adjudication -> reject persisted artifact and re-compose
  constraints:  destructive generation requires an archived, VERIFIED recoverable copy before any mutation; a failing artifact is NEVER persisted as final; never infer past a blocked capability
  output:       recovery_outcome { archived, halted, recomposed }
  handoff:      recoverability verified before destructive persist AND no failing artifact left as final

FUNCTION replacement_safety(operation_mode):
  IF operation_mode == "REPLACE":
    REQUEST_DECISION user FOR approval
    ARCHIVE existing artifacts TO agent_workspace + "/archive"
    VALIDATE_ARTIFACT archive_persisted
    IF NOT archive_persisted: RETURN {persistence_decision: "blocked"}
  RETURN {persistence_decision: "safe_to_persist"}

# OUTPUT CONTRACT
IF run_frame.runtime_mode == "blocked": HALT WITH blocked_report; RETURN
IF adjudication.verdict == "reject":
  DISCARD persisted_agent_specification   # never left as final
  RE-RUN from the owning stage of the failure (DESIGN for structure, COMPOSITION for rendering)

HANDOFF GATE (evidence-bearing):
  rule_id: "RECOVERY"
  [check] destructive persist preceded by a verified archive (evidence: replacement_safety)
  [check] blocked non-substitutable capability halts generation, not inferred past (evidence: runtime_mode)
  [check] no artifact failing adjudication persisted as final (evidence: discard)
  result: safe_to_persist -> resume owning stage | halted -> STAGE 7 REPORTING as blocked (owner: recovery)


# ============================================================================
# STAGE 7 — REPORTING  (when the generation is complete)
# ============================================================================
@purpose: "Persist an inspectable provenance trail and report artifacts, validation status, and limitations"
@cue: "AUDIT_THEN_REPORT"

CONTRACT:
  input:        run_frame + agent_design + artifact_set + adjudication
  transform:    compose audit trail -> persist -> compose + report final result
  constraints:  the report names limitations (degraded mode, unsupported capabilities); provenance is inspectable
  output:       final_report
  handoff:      provenance persisted AND final report distinguishes artifacts, validation status, and limitations

SET audit_report = {agent_identity, domain, operation_mode, runtime_environment, risk, complexity, reversibility, uncertainty, phase_count, validation_gates, evidence_sources, capability_profile, adapter_identity, portability_status, timestamp: {convention.timestamp}}
PERSIST_ARTIFACT audit_report TO agent_workspace + "/generation-audit"
COMPOSE_ARTIFACT final_report FROM {generation_summary, risk_summary, compliance_summary, artifact_references, limitations}
REPORT_RESULT final_report

HANDOFF GATE (evidence-bearing):
  rule_id: "REPORTING"
  [check] provenance trail persisted (evidence sources, capability profile, adapter identity, portability status) (evidence: audit_report)
  [check] final report distinguishes artifacts, validation status, and limitations (evidence: final_report)
  result: TERMINATE

FINALIZE final_report


# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - profile runtime capabilities (full/degraded/blocked) before acting
  - check creation history and domain cache by identity + TTL
  - investigate non-destructively and ground the knowledge base in real resources
  - assign risk/complexity/reversibility/uncertainty from evidence, and scale phase rigor (3/5/7) to it
  - extract portable core principles (phase-gated execution, validation boundaries, declaration-before-use, evidence-before-composition, adapter separation, auditability)
  - compose the runtime-neutral portable contract first, then render through the adapter
  - a stage reads ONLY the prior stage's output contract, and hands off through exactly one evidence-bearing gate
  - validate semantic compliance, evidence grounding, and algorithmic embodiment on the PERSISTED artifact
  - emit an inspectable audit trail and a final report that names limitations

NEVER:
  - generate from assumptions — every claim traces to inspected domain evidence
  - emit runtime-specific paths or commands into the portable core (adapter-resolve them)
  - detect the runtime by OS string — probe capabilities
  - hardcode a model, filename, or destination — the adapter resolves {model} / {convention.*}
  - emit a fallback or dual-path invocation — one path, fail-fast, single source of truth
  - overwrite or duplicate an agent without a collision decision and a verified archive
  - mutate the source domain during investigation
  - persist an artifact that fails semantic-compliance, evidence-grounding, or embodiment validation
```
