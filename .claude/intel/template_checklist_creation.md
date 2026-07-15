---
name: checklist-creation
description: Executable template. Compiles a software-architecture task into a dependency-ordered, evidence-bearing implementation checklist by resolving every {parameter} from the host and running the six generation stages in order, emitting the checklist or a blocked report.
type: template
domain: [architecture, ai-governance, governance]
keywords: [checklist, generator, template, evidence, ripple-chains, validator, semantic-policy, recovery, termination]
owner: BanesLab
created: 2026-07-14
last-verified: 2026-07-14
version: 1
staleness-days: -1
max-lines: 900
depends-on: [reference_development_rules.md]
supersedes:
---

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

```py
%% META %%:
priority: PRINCIPLES > ARCHITECTURE_ONTOLOGY > TEMPLATE > EXTERNAL_DOCS > TASK
trust: tool_output = TRUSTED, prior_knowledge = UNTRUSTED
objective: a dependency-ordered checklist whose framing, decomposition, tasks, gates, repair, and
           termination are each produced and gated by the stage that owns that decision
recursion_limit: 3

NOTE ON PARAMETERS: every {project.*} / {convention.*} / {toolchain.*} / {limits.*} token is
resolved from the host's governing docs, never hardcoded — the generator is portable across any
language and codebase that scales by structure.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract.

# ============================================================================
# STAGE 1 — ORIENTATION
# ============================================================================
@purpose: "Establish authority, trust, intent, directionality, and current-system evidence before any planning"
@cue: "OBSERVE_BEFORE_PLAN"

CONTRACT:
  input:        raw task text; host governing docs
  transform:    load authority -> discover current system -> normalize intent + directionality
  constraints:  prior knowledge is UNTRUSTED; discover before assume; read authority before analysis
  output:       context_bundle (below) — the sole artifact STAGE 2 reads
  handoff:      authority loaded AND intent + change-direction resolved AND evidence inventory non-empty

DECLARE authoritative_sources: object
SET authoritative_sources = {
  "core": {always_read: true, files: ["{project.governance_policy}", "{project.principle_ontology}"]},
  "architecture": {read_when: ["algorithm", "protocol", "pattern", "decomposition", "principle", "contract"], files: ["{project.architecture_rules}"]},
  "design": {read_when: ["style", "token", "layout", "surface", "ui", "presentation"], files: ["{project.design_guide}"]},
  "component": {read_when: ["component", "module", "element", "render", "boundary"], files: ["{project.component_docs}"]}
}

DECLARE priority_stack: array
SET priority_stack = ["PRINCIPLES", "ARCHITECTURE_ONTOLOGY", "CHECKLIST_TEMPLATE", "EXTERNAL_DOCUMENTATION", "TASK_DESCRIPTION"]
DECLARE trust_anchor: object
SET trust_anchor = {
  authoritative_docs: ["{project.governance_policy}", "{project.principle_ontology}", "{project.architecture_rules}"],
  trusted:   ["source files (any language)", "schema/config/data", "build/validator output", "tool output: Glob, Grep, Read, Bash", "structured logs/traces"],
  untrusted: ["narrative docs", "code comments", "prior codebase knowledge", "assumed file locations", "unverified claims"]
}

FUNCTION load_authoritative_sources(task_description):
  DECLARE files: array
  SET files = authoritative_sources.core.files
  FOR EACH category IN ["architecture", "design", "component"]:
    FOR EACH trigger IN authoritative_sources[category].read_when:
      FIND trigger IN task_description
      IF exists: APPEND authoritative_sources[category].files TO files; BREAK
  FOR EACH file IN files:
    READ file INTO content
    IF NOT exists: REPORT "MISSING AUTHORITATIVE SOURCE: {file}" (severity: blocker, owner: orientation)
  RETURN files

# Intent + directionality (introduce / retain / remove / analyze / mention) — the relation STAGE 4 keys on.
FUNCTION normalize_intent(task_description, explicit_constraints):
  DECLARE intent: object
  SET intent = {requested_outcome: "", requested_actions: [], entities: [], constraints: explicit_constraints, non_goals: [], change_relation: "unknown", ambiguity: []}
  EXTRACT requested_outcome, requested_actions, entities FROM task_description INTO intent
  ANALYZE task_description FOR negation_and_directionality INTO intent.change_relation
  ANALYZE task_description FOR ambiguity INTO intent.ambiguity
  IF intent.change_relation == "unknown": APPEND "change direction unresolved" TO intent.ambiguity
  RETURN intent

# Discovery patterns are generated dynamically from task keywords, not fixed enumeration.
FUNCTION discover_context(intent):
  DECLARE keywords: object
  SET keywords = {nouns: [], verbs: [], file_refs: [], folders: []}
  EXTRACT technical_nouns FROM intent WHERE PascalCase OR camelCase INTO keywords.nouns
  EXTRACT action_verbs FROM intent INTO keywords.verbs
  EXTRACT file_and_folder_refs FROM intent INTO keywords.file_refs, keywords.folders
  DECLARE patterns: object
  SET patterns = {globs: [], greps: [], targets: []}
  APPEND glob("**", "{convention.base_class_prefix}-*.{convention.source_ext}") TO patterns.globs
  APPEND glob("**", "{convention.abstract_prefix}-*.{convention.source_ext}") TO patterns.globs
  APPEND glob("**", "*registry*.{convention.source_ext}"), glob("**", "index.{convention.source_ext}") TO patterns.globs
  APPEND glob("**", "{migration_dir}", "*.{convention.source_ext}") TO patterns.globs
  FOR EACH noun IN keywords.nouns:
    APPEND glob("**", "*<noun>*.{convention.source_ext}") TO patterns.globs
    APPEND grep("class .*<noun>"), grep("interface .*<noun>") TO patterns.greps
  FOR EACH folder IN keywords.folders: APPEND glob("<folder>", "**", "*.{convention.source_ext}") TO patterns.globs
  FOR EACH ref IN keywords.file_refs: APPEND ref TO patterns.targets
  DECLARE discovered: object
  SET discovered = {base_classes: [], implementations: [], registrations: [], migrations: [], signatures: [], evidence: []}
  FOR EACH glob IN patterns.globs:
    GLOB glob INTO matches
    FOR EACH m IN matches:
      CLASSIFY m INTO discovered.base_classes | discovered.migrations | discovered.implementations
      APPEND {source: m, observation: "discovered artifact", freshness: "current", confidence: "high"} TO discovered.evidence
  FOR EACH grep IN patterns.greps:
    GREP grep (output_mode: "files_with_matches") INTO matches
    IF matches.length > 0: APPEND {pattern: grep, files: matches} TO discovered.registrations
  FOR EACH t IN patterns.targets:
    IF FILE_EXISTS(t): READ t (limit: 200) INTO c; EXTRACT public_members FROM c INTO discovered.signatures
  RETURN {keywords: keywords, discovered: discovered}

# OUTPUT CONTRACT
DECLARE context_bundle: object
SET loaded_sources = load_authoritative_sources(task_description)
SET intent = normalize_intent(task_description, explicit_constraints)
SET context = discover_context(intent)
SET context_bundle = {
  normalized_intent: intent.requested_outcome,
  change_relation: intent.change_relation,
  change_kinds: intent.requested_actions,
  authoritative_sources: loaded_sources,
  trust: trust_anchor,
  priority: priority_stack,
  discovered: context.discovered,
  evidence_inventory: context.discovered.evidence,
  unresolved_questions: intent.ambiguity,
  assumptions: []
}

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] core authority loaded (evidence: context_bundle.authoritative_sources)
  [check] normalized_intent != "" AND change_relation != "unknown" (evidence: intent)
  [check] evidence_inventory.length > 0 (evidence: discovery searches run)
  result: pass -> STAGE 2 PLANNING | fail -> STAGE 5 REPAIR (owner: orientation)


# ============================================================================
# STAGE 2 — PLANNING
# ============================================================================
@purpose: "Activate the principles that govern current decision surfaces, select protocols by semantic fit, decompose into a dependency-ordered phase graph"
@cue: "PLAN_FROM_EVIDENCE"

CONTRACT:
  input:        context_bundle
  transform:    activate principles -> select protocols -> decompose phases -> build 4D graph -> linearize
  constraints:  ORDER by dependency, NEVER by severity; every active principle binds a decision_test + validator; NEVER select a protocol from a trigger word alone
  output:       phase_records[] with per-phase 4D graph + severity metadata
  handoff:      Z-graph acyclic AND every phase declares inputs/outputs AND all four axes present

# Principle catalog: each row binds a decision_test, a validator, and a severity
# (severity selects the repair route in STAGE 5).
DECLARE principle_catalog: array
SET principle_catalog = [
  {id: "SRP",  severity: "mandatory",   activate_when: "a unit is created or modified",            decision_test: "one coherent responsibility, one change axis?", validator: "V-STRUCTURE"},
  {id: "SOC",  severity: "mandatory",   activate_when: "concerns cross a module/layer boundary",   decision_test: "policy/domain/infra/presentation/orchestration separated?", validator: "V-STRUCTURE"},
  {id: "DRY",  severity: "mandatory",   activate_when: "knowledge appears in multiple places",     decision_test: "one authoritative representation?", validator: "V-STRUCTURE"},
  {id: "DIP",  severity: "mandatory",   activate_when: "higher-level depends on lower-level impl",  decision_test: "boundary owns the abstraction, details behind it?", validator: "V-DEPENDENCY"},
  {id: "LSP",  severity: "mandatory",   activate_when: "subtypes/replaceable impls exist",         decision_test: "same behavioral contract, invariants intact?", validator: "V-CONTRACT"},
  {id: "ISP",  severity: "mandatory",   activate_when: "consumers depend on interfaces",           decision_test: "each consumer depends only on what it uses?", validator: "V-CONTRACT"},
  {id: "CONTRACT", severity: "mandatory", activate_when: "data/behavior crosses a boundary",       decision_test: "typed/schema contract validated at boundary?", validator: "V-CONTRACT"},
  {id: "LIFECYCLE", severity: "mandatory", activate_when: "resources acquired/registered/opened",  decision_test: "init/use/fail/release explicit + symmetric?", validator: "V-LIFECYCLE"},
  {id: "COMPLEXITY", severity: "mandatory", activate_when: "nontrivial logic or large artifacts",  decision_test: "size/branching/responsibility within {limits.*}?", validator: "V-STRUCTURE"},
  {id: "OCP",  severity: "recommended",  activate_when: "new variants/capabilities added",         decision_test: "extend without modifying stable selection logic?", validator: "V-EXTENSION"},
  {id: "DI",   severity: "recommended",  activate_when: "a unit collaborates with external deps",  decision_test: "collaborators injected, not newed inside core?", validator: "V-DEPENDENCY"},
  {id: "EVENTS", severity: "recommended", activate_when: "decoupled upward notification needed",   decision_test: "emit events vs parent callbacks?", validator: "V-EVENTS"},
  {id: "OBSERV", severity: "recommended", activate_when: "runtime can fail/transition/affect ops", decision_test: "structured, queryable context matched to the concern?", validator: "V-OBSERVABILITY"},
  {id: "DETERM", severity: "recommended", activate_when: "ordering/replay/retry/generation matters", decision_test: "stable results + explainable ordering?", validator: "V-DETERMINISM"},
  {id: "SECURE_DESIGN", severity: "mandatory", activate_when: "a trust boundary / sensitive op",   decision_test: "threats + controls considered at design time?", validator: "V-SECURITY"},
  {id: "LEAST_PRIV", severity: "mandatory", activate_when: "identities/permissions/tokens used",   decision_test: "minimum authority, deny by default?", validator: "V-SECURITY"},
  {id: "INPUT_VAL", severity: "mandatory", activate_when: "external/untrusted data enters",        decision_test: "validated + normalized at the boundary?", validator: "V-SECURITY"},
  {id: "SECRETS", severity: "mandatory", activate_when: "credentials/keys/sensitive config",       decision_test: "externalized, scoped, log-safe, rotatable?", validator: "V-SECURITY"},
  {id: "PERF_ENG", severity: "recommended", activate_when: "perf is a goal or a hot path changes", decision_test: "optimization has a measured baseline + budget?", validator: "V-PERFORMANCE"},
  {id: "CONFIG_EXT", severity: "mandatory", activate_when: "env-specific values or secrets used",  decision_test: "resolved via config layer, validated at boot?", validator: "V-INFRA"},
  {id: "FAIL_FAST", severity: "mandatory", activate_when: "invalid required state can occur",      decision_test: "surfaced at its boundary, not masked by a default?", validator: "V-FAILURE"},
  {id: "POLICY_CODE", severity: "mandatory", activate_when: "a new architectural invariant appears", decision_test: "encoded as an automated detector + activated in catalog?", validator: "V-ENFORCEMENT"},
  {id: "ZERO_LEGACY", severity: "mandatory", activate_when: "an existing path is replaced",        decision_test: "superseded path removed in the same completed change?", validator: "V-REPLACEMENT"},
  {id: "DELETE_DEAD", severity: "mandatory", activate_when: "symbols/registrations become unused", decision_test: "obsolete dependants + exports removed with the change?", validator: "V-REPLACEMENT"}
]
# (subset of {project.principle_ontology}; the ontology is authoritative — resolve the full set from it)

DECLARE severity_order: object
SET severity_order = {mandatory: 1, recommended: 2, contextual: 3, discouraged: 4}

FUNCTION activate_principles(context_bundle):
  DECLARE records: array
  SET records = []
  DETERMINE decision_surfaces FROM context_bundle INTO surfaces
  FOR EACH p IN principle_catalog:
    ANALYZE surfaces AGAINST p.activate_when INTO fit
    IF fit.status == "applies":
      APPEND {id: p.id, applicability: "applies", reason: fit.reason, validator: p.validator, severity: p.severity, failure_behavior: "block_if_mandatory_else_disposition"} TO records
    ELSE IF fit.status == "uncertain":
      APPEND {id: p.id, applicability: "uncertain", reason: fit.reason, validator: p.validator, severity: p.severity, failure_behavior: "investigate"} TO records
    ELSE:
      APPEND {id: p.id, applicability: "not_applicable", reason: fit.reason, validator: "", severity: p.severity, failure_behavior: "none"} TO records
  RETURN records

# Protocol selection by SEMANTIC fit against the requested state transition — never a trigger-word match.
DECLARE protocol_library: object
SET protocol_library = {
  "module-separation":     {use_when: "a unit mixes concerns or exceeds bounded complexity", chain: ["ANALYZE","FIND","EXTRACT","CREATE","VERIFY"], principles: ["SRP","SOC","COMPLEXITY"]},
  "extension-no-modify":   {use_when: "a new variant extends a stable system",               chain: ["ANALYZE","FIND","CREATE","LINK","VERIFY"], principles: ["OCP"]},
  "dependency-inversion":  {use_when: "higher-level logic depends on concrete infra",         chain: ["FIND","ANALYZE","EXTRACT","CREATE","LINK","VERIFY"], principles: ["DIP","DI"]},
  "intention-emission":    {use_when: "communication should decouple through events",         chain: ["FIND","ANALYZE","CREATE","LINK","VERIFY"], principles: ["EVENTS"]},
  "invariant-inheritance": {use_when: "subtype/base-class behavior must preserve invariants", chain: ["FIND","ANALYZE","CREATE","VERIFY"], principles: ["LSP","CONTRACT"]},
  "registry-resolution":   {use_when: "dynamic discovery or keyed resolution is justified",   chain: ["ANALYZE","FIND","CREATE","LINK","VERIFY"], principles: ["OCP"]},
  "security-hardening":    {use_when: "trust boundary/secret/identity/untrusted data affected",chain: ["ANALYZE","FIND","FILTER","CREATE","VERIFY"], principles: ["SECURE_DESIGN","LEAST_PRIV","INPUT_VAL","SECRETS"]},
  "performance-eng":       {use_when: "a measured bottleneck or declared budget exists",      chain: ["EXECUTE measure_baseline","ANALYZE","CREATE","EXECUTE","VERIFY"], principles: ["PERF_ENG"]},
  "infra-provisioning":    {use_when: "config/env/deploy/migration changes",                  chain: ["READ","ANALYZE","CREATE","WRITE","VERIFY"], principles: ["CONFIG_EXT"]},
  "resilience-recovery":   {use_when: "failure/retry/replay/recovery behavior changes",       chain: ["ANALYZE","CREATE","EXECUTE","VERIFY"], principles: ["FAIL_FAST"]},
  "replacement-elim":      {use_when: "an existing production path is replaced",              chain: ["FIND","ANALYZE","CREATE","EXECUTE","VERIFY"], principles: ["ZERO_LEGACY","DELETE_DEAD"]},
  "enforcement-authoring": {use_when: "a new invariant needs automated protection",           chain: ["ANALYZE","CREATE","LINK","EXECUTE","VERIFY"], principles: ["POLICY_CODE"]},
  "verification-gate":     {use_when: "every plan requires final reasoning + checklist validation", chain: ["ANALYZE","VERIFY","REPORT"], principles: ["ALL"], mandatory: true}
}

FUNCTION select_protocols(context_bundle, active_principles):
  DECLARE selected: array
  SET selected = []
  DETERMINE requested_transition, architecture_surfaces FROM context_bundle
  FOR EACH key IN protocol_library:
    ANALYZE {transition: requested_transition, surfaces: architecture_surfaces, principles: active_principles} AGAINST protocol_library[key].use_when INTO fit
    IF fit.semantic_match == true: APPEND {id: key, reason: fit.reason, chain: protocol_library[key].chain, principles: protocol_library[key].principles} TO selected
  IF "verification-gate" NOT IN selected: APPEND {id: "verification-gate", reason: "mandatory generation validation", chain: protocol_library["verification-gate"].chain, principles: ["ALL"]} TO selected
  RETURN selected

DECLARE loop_class_labels: object
SET loop_class_labels = {
  "Construction": {verbs: ["CREATE","WRITE"], pattern: "build artifact from specification"},
  "Perceptual":   {verbs: ["FIND","READ","ANALYZE"], pattern: "observe system state"},
  "Cognitive":    {verbs: ["EXTRACT","FILTER"], pattern: "transform understanding"},
  "Executive":    {verbs: ["EXECUTE","VERIFY"], pattern: "effect change with validation"},
  "Linking":      {verbs: ["LINK","ITERATE"], pattern: "establish relationships"}
}

FUNCTION decompose_and_graph(selected_protocols, active_principles, context_bundle):
  DECLARE phases: array
  SET phases = []
  FOR EACH proto IN selected_protocols:
    FOR EACH verb IN proto.chain WITH index:
      DETERMINE objective, preconditions, inputs, outputs, affected_artifacts FROM proto, verb, context_bundle, phases
      FILTER active_principles TO local WHERE applicability == "applies" AND decision_surface MATCHES affected_artifacts
      SET severity = worst_severity(local, severity_order)   # metadata; routes in STAGE 5
      SET loop_class = classify_loop(verb, loop_class_labels)
      APPEND {id: proto.id + "." + index, verb: verb, objective: objective, preconditions: preconditions, inputs: inputs, outputs: outputs, affected_artifacts: affected_artifacts, principles: local, severity: severity, loop_class: loop_class, graph_4d: {sequential_z: [], lateral_x: [], diagonal_y: [], propagation_w: []}} TO phases
  # 4D graph: Z sequential (dependency), X lateral (independent peers), Y diagonal (shared data), W propagation (downstream ripple)
  FOR EACH a IN phases:
    FOR EACH b IN phases WHERE a.id != b.id:
      IF b.inputs CONSUME a.outputs: APPEND {from: a.id, output: shared} TO b.graph_4d.sequential_z
      IF a peer-independent-of b:    APPEND {peer: b.id} TO a.graph_4d.lateral_x
      IF a,b share_artifact_without_prereq: APPEND {node: b.id, artifact: shared} TO a.graph_4d.diagonal_y
      FOR EACH prop IN downstream_propagation(a.outputs, context_bundle.discovered, b):
        APPEND {target: prop.target, superseded: prop.superseded, contracts: prop.contracts, breaks_if_omitted: prop.consequence} TO a.graph_4d.propagation_w
    IF a.graph_4d.propagation_w.length == 0: APPEND {target: "none", evidence: "no downstream consumer found"} TO a.graph_4d.propagation_w
  RETURN phases

FUNCTION linearize(phases):
  ANALYZE phases.graph_4d.sequential_z FOR cycles INTO cycles
  IF cycles.length > 0: RETURN {status: "blocked", cycles: cycles, phases: phases}
  ORDER phases BY topological_z_order THEN stable_tie_breaker
  RETURN {status: "pass", cycles: [], phases: phases}

# OUTPUT CONTRACT
SET active_principles = activate_principles(context_bundle)
SET selected_protocols = select_protocols(context_bundle, active_principles)
SET phase_records = decompose_and_graph(selected_protocols, active_principles, context_bundle)
SET linearization = linearize(phase_records)
SET phase_records = linearization.phases

HANDOFF GATE (evidence-bearing):
  rule_id: "PLANNING"
  [check] linearization.status == "pass" (evidence: acyclic Z-graph)
  [check] every phase has inputs, outputs, and all four graph axes (evidence: phase_records)
  [check] order is dependency-topological, severity is metadata only (evidence: no severity grouping)
  [check] every active mandatory principle binds a validator (evidence: active_principles)
  result: pass -> STAGE 3 COMPILATION | cycle/gap -> STAGE 5 REPAIR (owner: planning)


# ============================================================================
# STAGE 3 — COMPILATION
# ============================================================================
@purpose: "Compile phases into atomic, target-specific tasks under per-step execution constraints, with full ripple chains"
@cue: "COMPILE_EXECUTABLE_TASKS"

CONTRACT:
  input:        phase_records
  transform:    apply task templates + architectural execution constraints -> atomize -> attach ripple chain
  constraints:  codebase_patterns are BINDING execution constraints; ripple chains carry NAMES not counts
  output:       task_records[] (atomic, evidence contract, 9 ripple dimensions), hierarchical N.N.N ids
  handoff:      every task atomic + target-specific AND every ripple dimension present per task

# Execution constraints bound to every emitted step.
DECLARE codebase_patterns: object
SET codebase_patterns = {
  "factory_creation":    {required: "construct via factory/builder, deps injected", forbidden: "scattered direct instantiation of cross-cutting types", principle: "Factory, DI"},
  "dependency_injection":{required: "inject collaborators via constructor/factory ({registry}.resolve)", forbidden: "newing external deps inside business logic", principle: "DIP, DI"},
  "registry_discovery":  {required: "self-register at load + resolve via {registry}", forbidden: "hardcoded lookup table or central variant switch", principle: "Registry, OCP"},
  "event_emission":      {required: "children emit events, parents subscribe", forbidden: "parent callbacks passed into children", principle: "Events, Low Coupling"},
  "ports_adapters":      {required: "domain depends on ports; infra behind adapters", forbidden: "vendor SDK/infra detail imported into domain", principle: "DIP, Ports & Adapters"},
  "contract_first":      {required: "typed schema at every boundary, validated", forbidden: "implicit/unvalidated cross-boundary payloads", principle: "Contract-First, ISP"},
  "encapsulation":       {required: "information hiding behind a stable interface", forbidden: "public mutable state, leaky getters", principle: "Encapsulation"},
  "structured_observability": {required: "{logger} with machine-queryable context matched to the concern", forbidden: "console/print or stringify-blob dumps", principle: "Observability"},
  "bounded_complexity":  {required: "one concern per unit; size within {limits.max_lines}/{limits.max_files}", forbidden: "god object, mixed-concern module, oversize file", principle: "SRP, Bounded Complexity"},
  "secrets_management":  {required: "secrets from env/secret-store, validated at boot", forbidden: "hardcoded secrets/credentials in code/config/logs", principle: "Secrets"},
  "input_validation":    {required: "validate + sanitize every external input at the boundary", forbidden: "raw untrusted data entering core logic", principle: "Input Validation, Fail-Fast"},
  "least_privilege":     {required: "minimal scope per component; deny by default", forbidden: "broad/ambient authority, default-open access", principle: "Least Privilege"},
  "config_externalization": {required: "env config via config layer, fail-fast if missing", forbidden: "hardcoded infra values; VAR-or-default fallback", principle: "Config Externalization"},
  "fail_fast":           {required: "detect invalid state and halt", forbidden: "fallback/default path that masks a failure", principle: "Fail-Fast"},
  "legacy_elimination":  {required: "delete dead/dual/deprecated in the SAME change; single forward path", forbidden: "dual-path, compat shim, deprecated marker, orphaned export", principle: "Zero Legacy, No Dual-Path, Delete-Dead"},
  "enforcement_rule":    {required: "encode a new invariant as an automated rule, register it, regenerate the catalog", forbidden: "convention-only enforcement with no automated gate", principle: "Policy as Code"}
}

DECLARE task_templates: object
SET task_templates = {
  "ANALYZE": {pattern: "Examine {target} for {criteria}", tools: ["Grep","Read"], validation: "grep {observability_pattern} -> structured observability present"},
  "FIND":    {pattern: "Locate {target} in {scope}", tools: ["Glob","Grep"], validation: "glob {centralized_config_dir}, index.{convention.source_ext} -> single-source/barrel first"},
  "EXTRACT": {pattern: "Isolate {target} from {source}", tools: ["Read","Write"], validation: "glob {convention.base_class_prefix}-* -> base class available"},
  "CREATE":  {pattern: "Generate {target} using {method}", tools: ["Write","Bash"], validation: "run {toolchain.build.execute} (BLOCKING)"},
  "VERIFY":  {pattern: "Validate {target} against {constraints}", tools: ["Bash","Grep"], validation: "run {toolchain.build.execute} OR {verify_cmd} (BLOCKING)"},
  "FILTER":  {pattern: "Select {target} where {condition}", tools: ["Grep","Glob"], validation: "grep invariant/contract patterns -> maintained"},
  "EXECUTE": {pattern: "Perform {action} on {target}", tools: ["Bash","Edit"], validation: "grep {observability_pattern} -> observability tracked"},
  "WRITE":   {pattern: "Persist {content} to {destination}", tools: ["Write"], validation: "glob {migration_dir} -> migration present if schema change"},
  "READ":    {pattern: "Load {target} from {source}", tools: ["Read","Glob"], validation: "file exists before read"},
  "LINK":    {pattern: "Associate {source} with {target}", tools: ["Edit","Grep"], validation: "grep {registry_pattern} -> registry/self-registration"},
  "ITERATE": {pattern: "Repeat {action} until {condition}", tools: ["Bash"], validation: "loop terminates with a validation gate"}
}

DECLARE ripple_dimensions: array
SET ripple_dimensions = ["registry", "contracts", "persistence", "security", "infrastructure", "performance", "observability", "enforcement", "consumers"]

FUNCTION analyze_ripple(task, phase, context_bundle):
  DECLARE chain: object
  SET chain = {registry: [], contracts: [], persistence: [], security: [], infrastructure: [], performance: [], observability: [], enforcement: [], consumers: []}
  FOR EACH dim IN ripple_dimensions:
    ANALYZE {task: task, phase: phase, deps: context_bundle.discovered} FOR dim INTO impacts
    FOR EACH i IN impacts: APPEND {entity: i.entity, action: task.verb, downstream: i.downstream, evidence: i.evidence, consequence_if_omitted: i.consequence} TO chain[dim]
    IF chain[dim].length == 0: APPEND {entity: "none", action: "verify", downstream: [], evidence: "applicability checked", consequence_if_omitted: "none"} TO chain[dim]
  RETURN chain

FUNCTION compile_tasks(phase_records, context_bundle):
  DECLARE records: array
  SET records = []
  FOR EACH phase IN phase_records:
    SET template = task_templates[phase.verb]
    DETERMINE task_groups FROM phase.affected_artifacts INTO groups
    FOR EACH group IN groups:
      EXTRACT atomic_actions FROM group USING template.pattern INTO actions
      FOR EACH action IN actions:
        FOR EACH pat_name IN codebase_patterns:
          IF action MATCHES codebase_patterns[pat_name].forbidden: REWRITE action TO codebase_patterns[pat_name].required
        FILTER phase.principles TO local WHERE decision_surface MATCHES action.target
        CREATE task FROM {phase_id: phase.id, group: group.name, action: action, target: action.target, method: action.method, tools: template.tools, expected_evidence: derive_evidence(local, template.validation), local_principle_checks: local, validation: template.validation, done_condition: derive_done(action), ripple_chain: {}}
        SET task.ripple_chain = analyze_ripple(task, phase, context_bundle)
        APPEND task TO records
  # hierarchical numbering N.N.N
  SET pn = 0
  FOR EACH phase IN phase_records:
    SET pn = pn + 1; SET tn = 0
    FILTER records TO phase_tasks WHERE phase_id == phase.id
    FOR EACH t IN phase_tasks: SET tn = tn + 1; SET t.id = pn + "." + tn + ".1"
  RETURN records

# OUTPUT CONTRACT
SET task_records = compile_tasks(phase_records, context_bundle)

HANDOFF GATE (evidence-bearing):
  rule_id: "COMPILATION"
  [check] task_records.length >= phase_records.length (evidence: task_records)
  [check] every task is atomic + target-specific with an evidence contract (evidence: expected_evidence per task)
  [check] every task carries all 9 ripple dimensions with NAMES (evidence: ripple_chain)
  result: pass -> STAGE 4 VALIDATION | non-atomic/missing-ripple -> STAGE 5 REPAIR (owner: compilation)


# ============================================================================
# STAGE 4 — VALIDATION
# ============================================================================
@purpose: "Judge the generated reasoning against evidence and semantic policy before rendering"
@cue: "VERIFY_REASONING_NOT_IMPLEMENTATION"

CONTRACT:
  input:        context_bundle + phase_records + task_records
  transform:    run validation suites -> verify claims by evidence -> apply the semantic-debt rubric
  constraints:  a claim is supported only WITH evidence (never "no contradiction found"); policy is SEMANTIC, never a substring ban
  output:       validation_report { status: pass|repair_required|blocked, findings[] with owner }
  handoff:      zero blocker/error findings

# Semantic policy over controlled concepts. It keys on the RELATION to a concept, so a prohibited
# design cannot pass by renaming, and legitimately mentioning/analyzing/removing debt is NOT blocked.
DECLARE controlled_concepts: array
SET controlled_concepts = [
  {concept: "backward_compatibility_path", prohibited_relations: ["introduce", "retain"]},
  {concept: "fallback_masking_failure",    prohibited_relations: ["introduce", "retain"]},
  {concept: "deprecated_production_path",  prohibited_relations: ["introduce", "retain"]},
  {concept: "dual_production_path",        prohibited_relations: ["introduce", "retain"]},
  {concept: "deferred_required_work",      prohibited_relations: ["introduce", "retain"]},
  {concept: "shortcut_debt",               prohibited_relations: ["introduce", "retain"]},
  {concept: "unsupported_superlative_claim", prohibited_relations: ["assert"]}
]

FUNCTION classify_concept_relation(scope, content):
  DECLARE relations: array
  SET relations = []
  FOR EACH cc IN controlled_concepts:
    ANALYZE content FOR cc.concept INTO matches
    IF matches.length > 0:
      ANALYZE content FOR relation_to(cc.concept) INTO relation   # introduce | retain | remove | analyze | mention | assert
      IF relation IN ["mention", "analyze", "quote", "remove"]: SET decision = "allowed"
      ELSE IF relation IN cc.prohibited_relations:               SET decision = "violation"
      ELSE:                                                       SET decision = "investigate"
      APPEND {concept: cc.concept, relation: relation, scope: scope, decision: decision, evidence: matches} TO relations
  RETURN relations

DECLARE validation_suites: array
SET validation_suites = [
  {id: "GV-STATE",     checks: ["required records + fields exist", "ids unique", "references resolve"]},
  {id: "GV-AUTHORITY", checks: ["authority conflicts resolved", "task constraints do not override governance", "evidence not conflated with normative authority"]},
  {id: "GV-ACTIVATION",checks: ["active principles are applicable", "inactive principles have a disposition", "every active principle has a decision point + validator"]},
  {id: "GV-PLAN",      checks: ["phase inputs/outputs complete", "Z acyclic", "X/Y/W explicit", "severity does not control order"]},
  {id: "GV-TASKS",     checks: ["tasks atomic + target-specific", "evidence + done observable", "validation method available", "failure correction defined"]},
  {id: "GV-RIPPLE",    checks: ["9 dimensions per task", "all identified impacts retained (not first-match)", "empty dims carry applicability evidence"]},
  {id: "GV-SEMANTIC",  checks: ["concept relations are semantic not lexical", "no prohibited target state introduced/retained", "analysis/removal language NOT falsely blocked"]},
  {id: "GV-EVIDENCE",  checks: ["material claims have evidence", "evidence scope matches the claim", "zero-result claims record searched scope", "stale/low-confidence not presented as certain"]},
  {id: "GV-OUTPUT",    checks: ["every required field serializable", "rendering needs no architecture inference", "phases/tasks numberable deterministically"]}
]

FUNCTION verify_claims(records, context_bundle):
  DECLARE results: array
  SET results = []
  EXTRACT material_claims FROM records INTO claims
  FOR EACH claim IN claims:
    FIND claim.support IN context_bundle.evidence_inventory INTO support
    FIND claim.contradiction IN context_bundle.evidence_inventory INTO against
    IF against.length > support.length:      SET status = "contradicted"
    ELSE IF support.length > 0:              SET status = "supported"
    ELSE IF claim.applicability == "n/a":    SET status = "not_applicable"
    ELSE:                                     SET status = "unsupported"
    APPEND {claim: claim, status: status, evidence: support} TO results
  RETURN results

FUNCTION run_suites(records):
  DECLARE findings: array
  SET findings = []
  FOR EACH suite IN validation_suites:
    FOR EACH check IN suite.checks:
      ANALYZE records AGAINST check INTO r
      IF r.pass == false: APPEND {rule_id: suite.id, owner: r.owner, affected: r.record, severity: r.severity, evidence: r.evidence, explanation: r.explanation, repair: r.repair} TO findings
  RETURN findings

# OUTPUT CONTRACT
DECLARE validation_report: object
SET semantic_findings = []
FOR EACH task IN task_records:
  SET rels = classify_concept_relation("task", task.action + " " + task.done_condition)
  FOR EACH rel IN rels:
    IF rel.decision == "violation": APPEND {rule_id: "GV-SEMANTIC", owner: "compilation", affected: task.id, severity: "blocker", evidence: rel.evidence, explanation: "task introduces/retains a prohibited target state", repair: "change the DESIGN, not the wording"} TO semantic_findings
    ELSE IF rel.decision == "investigate": APPEND {rule_id: "GV-SEMANTIC", owner: "compilation", affected: task.id, severity: "error", evidence: rel.evidence, explanation: "controlled-concept relation unresolved", repair: "classify the relation from context"} TO semantic_findings
SET claim_results = verify_claims({phases: phase_records, tasks: task_records}, context_bundle)
SET suite_findings = run_suites({context: context_bundle, phases: phase_records, tasks: task_records, claims: claim_results})
SET validation_report = {status: "repair_required", findings: [], evidence_examined: context_bundle.evidence_inventory, unresolved: context_bundle.unresolved_questions}
FOR EACH f IN suite_findings:    APPEND f TO validation_report.findings
FOR EACH f IN semantic_findings: APPEND f TO validation_report.findings
FOR EACH c IN claim_results:
  IF c.status IN ["contradicted", "unsupported"]: APPEND {rule_id: "GV-EVIDENCE", owner: "validation", affected: c.claim.id, severity: "error", evidence: c.evidence, explanation: c.status, repair: "obtain evidence, correct the claim, or record an explicit disposition"} TO validation_report.findings
FILTER validation_report.findings TO blocking WHERE severity IN ["blocker", "error"]
IF blocking.length == 0: SET validation_report.status = "pass"
ELSE:                    SET validation_report.status = "repair_required"

HANDOFF GATE (evidence-bearing):
  rule_id: "VALIDATION"
  [check] every gate names what it examined (evidence: findings carry evidence + rule_id) — no ceremony
  [check] status == "pass" (evidence: zero blocker/error findings)
  result: pass -> STAGE 6 RENDERING | repair_required -> STAGE 5 REPAIR


# ============================================================================
# STAGE 5 — REPAIR
# ============================================================================
@purpose: "Repair from the earliest responsible stage, invalidate every dependent record, bound the attempts"
@cue: "REPAIR_CAUSE_NOT_WORDING"

CONTRACT:
  input:        validation_report.findings
  transform:    route each finding to its owner stage -> invalidate dependents -> re-run from there
  constraints:  BOUNDED (max_cycles = 3); severity decides route (block / disposition / investigate); NEVER restore a downstream record after an upstream repair
  output:       repaired records with status "pass", OR status "blocked" + remaining findings
  handoff:      status == "pass" -> STAGE 6 | cycle > max_cycles -> STAGE 6 as BLOCKED

DECLARE repair_state: object
SET repair_state = {cycle: 0, max_cycles: 3, earliest_stage: "", invalidated: [], applied: [], remaining: []}

DECLARE stage_order: array
SET stage_order = ["orientation", "planning", "compilation", "validation", "rendering"]

FUNCTION earliest_invalid_stage(findings):
  FOR EACH stage IN stage_order:
    FIND stage IN findings.owner INTO hits
    IF hits.length > 0: RETURN stage
  RETURN "validation"

# Severity governs the FAILURE ROUTE.
FUNCTION route_by_severity(finding):
  IF finding.severity IN ["blocker"]:         RETURN "block_and_repair"
  IF finding.severity == "error":             RETURN "repair"
  IF finding.severity == "warning":           RETURN "disposition_required"
  RETURN "investigate"

FUNCTION invalidate_dependents(stage):
  # marking cascades forward only — an upstream repair invalidates everything downstream of it
  SET idx = INDEX_OF(stage_order, stage)
  FOR EACH downstream IN stage_order FROM idx:
    MARK record_of(downstream) AS invalid
    APPEND downstream TO repair_state.invalidated
  RETURN true

FUNCTION rerun_from(stage, context_bundle):
  # re-execute the owning stage and every stage after it, threading fresh records forward
  IF stage == "orientation": SET context_bundle = rerun STAGE 1
  IF stage IN ["orientation","planning"]: SET phase_records = rerun STAGE 2 WITH context_bundle
  IF stage IN ["orientation","planning","compilation"]: SET task_records = rerun STAGE 3
  IF stage IN ["orientation","planning","compilation","validation"]: SET validation_report = rerun STAGE 4
  RETURN {context: context_bundle, phases: phase_records, tasks: task_records, report: validation_report}

WHILE validation_report.status == "repair_required":
  SET repair_state.cycle = repair_state.cycle + 1
  IF repair_state.cycle > repair_state.max_cycles:
    SET validation_report.status = "blocked"
    SET repair_state.remaining = validation_report.findings
    REPORT "REPAIR_LIMIT_EXCEEDED"
    BREAK
  SET repair_state.earliest_stage = earliest_invalid_stage(validation_report.findings)
  FOR EACH f IN validation_report.findings WHERE f.owner == repair_state.earliest_stage:
    SET route = route_by_severity(f)
    EXECUTE f.repair WITH evidence: f.evidence, route: route
    APPEND {finding: f.rule_id, repair: f.repair, route: route} TO repair_state.applied
  SET invalidated = invalidate_dependents(repair_state.earliest_stage)
  SET rerun = rerun_from(repair_state.earliest_stage, context_bundle)
  SET context_bundle = rerun.context
  SET phase_records = rerun.phases
  SET task_records = rerun.tasks
  SET validation_report = rerun.report
  REPORT repair_state

HANDOFF GATE (evidence-bearing):
  rule_id: "REPAIR"
  [check] repair_state.cycle <= max_cycles (evidence: repair_state)
  [check] dependents invalidated after every upstream repair (evidence: repair_state.invalidated)
  [check] severity preserved as the route selector (evidence: applied routes)
  result: status pass -> STAGE 6 RENDERING | blocked -> STAGE 6 (blocked terminal)


# ============================================================================
# STAGE 6 — RENDERING
# ============================================================================
@purpose: "Serialize only validated records, emit an explicit success OR blocked terminal, and guarantee bounded stopping"
@cue: "TERMINATE_EXPLICITLY"

CONTRACT:
  input:        validated records OR a blocked validation_report
  transform:    deterministic render -> write success artifact, or render the blocked report
  constraints:  rendering adds NO new architecture decisions; future execution checkboxes stay UNCHECKED; one terminal only
  output:       generation_result { status: success|blocked, output_file }
  handoff:      terminal — no premature stop while status is repairable, no loop beyond max_cycles

DECLARE rendering_rules: array
SET rendering_rules = ["number Phase N / Task N.M / Subtask N.M.K only after order is stable", "emit phases in Z-topological order", "preserve X/Y/W metadata", "severity is metadata only", "render only APPLIES principles as requirements", "preserve every ripple impact (names, not counts)", "empty dimension -> none with applicability evidence", "introduce no unsupported claim", "leave future execution checkboxes unchecked"]

FUNCTION render_checklist(context_bundle, phase_records, task_records, validation_report):
  DECLARE out: array
  SET out = []
  APPEND heading("{task_description}") TO out
  APPEND "Generated: {current_date} | Verification: {validation_report.verification_mode} | Principle ontology: {project.principle_ontology}" TO out
  APPEND "Phases: {phase_records.length} | Protocols: {selected_protocols.id}" TO out
  APPEND "## Governing Context" TO out
  APPEND "- Objective: {context_bundle.normalized_intent}" TO out
  APPEND "- Change relation: {context_bundle.change_relation}" TO out
  APPEND "- Authoritative sources: {context_bundle.authoritative_sources}" TO out
  APPEND "### Principle Disposition (applies / uncertain / n/a — reason — validator)" TO out
  FOR EACH p IN active_principles: APPEND row(p.id, p.applicability, p.reason, p.validator) TO out
  SET pn = 0
  FOR EACH phase IN phase_records:
    SET pn = pn + 1
    APPEND "## PHASE {pn}: {phase.verb} <{phase.objective}>" TO out
    APPEND "Loop Class: {phase.loop_class} | Severity: {phase.severity}" TO out
    APPEND "Dependencies (4D) — Z: {phase.graph_4d.sequential_z} | X: {phase.graph_4d.lateral_x} | Y: {phase.graph_4d.diagonal_y} | W: {phase.graph_4d.propagation_w}" TO out
    APPEND "Ripple Chain (dimension | entity | downstream | consequence-if-omitted)" TO out
    FILTER task_records TO phase_tasks WHERE phase_id == phase.id
    FOR EACH dim IN ripple_dimensions:
      FOR EACH t IN phase_tasks: FOR EACH i IN t.ripple_chain[dim]: APPEND row(dim, i.entity, i.downstream, i.consequence_if_omitted) TO out
    SET tn = 0
    FOR EACH t IN phase_tasks:
      SET tn = tn + 1
      APPEND "### Task {pn}.{tn}: {t.group} (target: {t.target})" TO out
      APPEND "- [ ] {t.id} {t.action} — method: {t.method}; evidence: {t.expected_evidence}; validation: {t.validation}; done when: {t.done_condition}" TO out
    APPEND "### Phase Execution Gate — BLOCKS PHASE {pn+1} (future execution, left unchecked)" TO out
    APPEND "- [ ] Run every task validation + record evidence" TO out
    APPEND "- [ ] Run active mandatory principle validators; resolve recommended dispositions" TO out
    APPEND "- [ ] Complete + validate every W-axis propagation edge" TO out
    APPEND "- [ ] Run {toolchain.build.execute} and {verify_cmd}" TO out
    APPEND "- [ ] forensic-context-verifier clean (gaps addressed + re-verified) before the next phase" TO out
  APPEND "# APPENDIX A — File Organization: {project_structure_from_governance_policy}" TO out
  APPEND "# APPENDIX B — Evidence Inventory (id | source | observation | freshness | confidence)" TO out
  FOR EACH e IN context_bundle.evidence_inventory: APPEND row(e.id, e.source, e.observation, e.freshness, e.confidence) TO out
  APPEND "# APPENDIX C — Registry / Contract / Enforcement changes (from ripple_chain)" TO out
  APPEND "# FINAL EXECUTION GATE — BLOCKING (future execution; unchecked at generation)" TO out
  APPEND "- [ ] Every phase gate has an evidence-bearing pass report" TO out
  APPEND "- [ ] Every active mandatory principle satisfied; recommended exceptions have a disposition" TO out
  APPEND "- [ ] Every superseded path/registration/export/config/consumer marked for removal is absent from scope" TO out
  APPEND "- [ ] Build, tests, architecture/security/performance validators required by active principles pass" TO out
  APPEND "- [ ] forensic-context-verifier reports zero blocker/error findings with evidence listed" TO out
  REDUCE out TO markdown
  RETURN markdown

FUNCTION render_blocked(context_bundle, validation_report, repair_state):
  DECLARE out: array
  SET out = ["# CHECKLIST GENERATION BLOCKED", "## Objective", context_bundle.normalized_intent, "## Blocking Findings (rule | owner | evidence | required resolution)"]
  FOR EACH f IN validation_report.findings WHERE f.severity IN ["blocker", "error"]: APPEND row(f.rule_id, f.owner, f.evidence, f.repair) TO out
  APPEND "## Completed Evidence Acquisition" TO out
  FOR EACH e IN context_bundle.evidence_inventory: APPEND "- {e.source} — {e.observation}" TO out
  APPEND "## Invalidated Outputs: {repair_state.invalidated}" TO out
  REDUCE out TO markdown
  RETURN markdown

# TERMINAL — exactly one of success / blocked; bounded by max_cycles above.
IF validation_report.status == "pass":
  SET rendered = render_checklist(context_bundle, phase_records, task_records, validation_report)
  VERIFY rendered FOR {every_phase_and_task_once, contiguous_numbering, no_dropped_ripple_impact, no_inactive_principle_as_mandatory, no_precompleted_execution_checkbox} INTO render_check
  IF render_check.pass == true:
    WRITE rendered TO "{task_name}-checklist.md"
    SET generation_result = {status: "success", output_file: "{task_name}-checklist.md", phases: phase_records.length, tasks: task_records.length}
  ELSE:
    APPEND render_check.findings TO validation_report.findings   # serialization-only defect -> back to STAGE 5
    SET generation_result = {status: "blocked", reason: "rendering integrity"}
ELSE:
  SET blocked = render_blocked(context_bundle, validation_report, repair_state)
  WRITE blocked TO "{task_name}-checklist-blocked.md"
  SET generation_result = {status: "blocked", output_file: "{task_name}-checklist-blocked.md", remaining: repair_state.remaining}

HANDOFF GATE (evidence-bearing):
  rule_id: "RENDERING"
  [check] generation_result.status IN ["success", "blocked"] AND output_file != "" (evidence: generation_result)
  [check] repair_state.cycle <= max_cycles (evidence: bounded loop)
  [check] no future execution checkbox pre-checked (evidence: render_check)
  result: TERMINATE

FINALIZE generation_result


# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - resolve authority, trust, intent, and directionality (STAGE 1) before any planning
  - discover current artifacts before architecture assumptions
  - activate a principle only with an applicability decision, and bind it to a validator
  - order phases by dependency; severity is metadata that ROUTES failure, never a grouping axis
  - express every phase's inputs, outputs, transformation, and handoff explicitly
  - a stage reads ONLY the prior stage's output contract, and hands off through exactly one evidence-bearing gate
  - represent Z sequential, X lateral, Y diagonal, W propagation, and preserve every ripple impact
  - require evidence for every material compliance/quality claim
  - separate generation-time gates (this run) from future execution gates (left unchecked)
  - repair from the earliest invalid stage and regenerate every dependent record
  - render deterministically, adding no new decision

NEVER:
  - treat prior model knowledge as current system evidence
  - treat a principle label as proof that local reasoning occurred
  - select a protocol from a trigger word alone
  - mark a claim supported only because no contradiction was found
  - enforce semantic policy with a SUBSTRING BAN (removing the word while keeping the design)
  - group phases by severity/priority headers
  - output count-only ripple, or filter ripple to the first match
  - restore a downstream record after an upstream repair invalidates it
  - claim a future execution gate passed during generation
  - let rendering infer an architecture decision, or a gate pass without checks + evidence
```
