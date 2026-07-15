---
name: workflow-creation
description: Executable template. Generates a multi-agent orchestration workflow through six reasoning stages — objective framing, agent-sequence planning with hybrid parallel/sequential execution, handoff + coordination procedure, single-source-of-truth gates, bounded recovery, and template assembly. Concurrent read-only discovery, serialized state-changing action.
type: template
domain: [architecture, ai-governance]
keywords:
    [
        workflow,
        orchestration,
        agents,
        parallel,
        sequential,
        handoff,
        checkpoint,
        recovery,
        hybrid-execution,
        context-isolation,
    ]
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
priority: PRINCIPLES > ARCHITECTURE_ONTOLOGY > TASK > TEMPLATE
trust: tool_output = TRUSTED, prior_knowledge = UNTRUSTED
objective: generate an executable multi-agent workflow — parallel read-only discovery, serialized
           state-changing action, handoff contracts, context isolation, checkpoint/resume, bounded recovery
execution_model: concurrent(read-only discovery + investigation) + serialized(state-changing action)

NOTE ON PARAMETERS: every {project.*} / {convention.*} / {model} token resolves from the host project
and agent runtime — the generator is portable across any codebase and any agent framework, never
welded to one runtime's literals. Generated filenames are UPPERCASE.md; generated content is
agent-oriented PAG-LANG.

Each stage declares its input, transformation, constraint set, output contract, and one
evidence-bearing handoff gate. A stage reads only the prior stage's output contract.

# ============================================================================
# STAGE 1 — ORIENTATION  (what the workflow is)
# ============================================================================
@purpose: "Read the governing specs, discover the workspace, and classify the objective into a semantic document set"
@cue: "FRAME_FROM_WORKSPACE"

CONTRACT:
  input:        user objective; host governing docs
  transform:    read specs -> discover workspace config -> classify workflow_type -> select core documents
  constraints:  discover workspace from {project.workspace_config}, never hardcode paths; every document serves one distinct logical purpose (no output.md / results.md)
  output:       frame { specs, workspace, workflow_type, core_documents, checkpoint_file }
  handoff:      specs loaded AND workspace discovered AND core_documents distinct and objective-aligned

READ {project.agent_dsl_grammar} INTO dsl_spec
READ {project.agent_dsl_keywords} INTO keyword_spec
READ {project.workflow_reference} INTO forking_spec
READ {project.checklist_reference} INTO abilities_spec

READ {project.workspace_config} INTO workspace
EXTRACT workspace.zones, workspace.semantic_extensions, workspace.root INTO frame.workspace
GLOB frame.workspace.root + "/.claude/agents/*.md" INTO available_agents

FUNCTION classify_workflow_type(objective):
  GREP codebase FOR workflow_patterns USING pattern_library INTO categories
  WEBSEARCH "software monorepo task workflow patterns" IF ambiguous
  DETERMINE workflow_type FROM categories   # cleanup | analysis | refactoring | documentation | implementation | security | performance | infrastructure | migration
  RETURN workflow_type

FUNCTION select_core_documents(workflow_type):
  # semantic, distinct-purpose documents per type (5..8); each name reflects its content, none generic
  MATCH workflow_type:
    CASE "cleanup":        RETURN ["EXECUTION-TRACE.md", "PATTERN-INVENTORY.md", "ACTION-MATRIX.md", "VALIDATION-RESULTS.md", "WORKFLOW-STATE.md"]
    CASE "analysis":       RETURN ["DISCOVERY-FINDINGS.md", "ANALYSIS-RESULTS.md", "RECOMMENDATIONS.md", "WORKFLOW-STATE.md"]
    CASE "refactoring":    RETURN ["ARCHITECTURAL-ASSESSMENT.md", "REFACTOR-PLAN.md", "IMPLEMENTATION-LOG.md", "VALIDATION-RESULTS.md", "WORKFLOW-STATE.md"]
    CASE "documentation":  RETURN ["CONTENT-INVENTORY.md", "DOCUMENTATION-STRUCTURE.md", "GENERATED-CONTENT.md", "WORKFLOW-STATE.md"]
    CASE "implementation": RETURN ["DISCOVERY-BASELINE.md", "ARCHITECTURE-TRACE.md", "IMPLEMENTATION-LOG.md", "VALIDATION-RESULTS.md", "WORKFLOW-STATE.md"]
    CASE "security":       RETURN ["THREAT-MODEL.md", "VULNERABILITY-INVENTORY.md", "HARDENING-PLAN.md", "VALIDATION-RESULTS.md", "WORKFLOW-STATE.md"]
    CASE "performance":    RETURN ["BASELINE-PROFILE.md", "BOTTLENECK-INVENTORY.md", "OPTIMIZATION-PLAN.md", "BENCHMARK-RESULTS.md", "WORKFLOW-STATE.md"]
    CASE "infrastructure": RETURN ["ENVIRONMENT-INVENTORY.md", "CONFIG-EXTERNALIZATION.md", "DEPLOYMENT-PLAN.md", "VALIDATION-RESULTS.md", "WORKFLOW-STATE.md"]
    CASE "migration":      RETURN ["LEGACY-INVENTORY.md", "MIGRATION-PLAN.md", "IMPLEMENTATION-LOG.md", "VALIDATION-RESULTS.md", "WORKFLOW-STATE.md"]

# OUTPUT CONTRACT
SET frame.workflow_type = classify_workflow_type(objective)
SET frame.core_documents = select_core_documents(frame.workflow_type)
SET frame.checkpoint_file = "WORKFLOW-PROGRESS.md"
SET frame.artifact_base_path = frame.workspace.zones.shared_zone + "/{WORKFLOW_NAME}"

HANDOFF GATE (evidence-bearing):
  rule_id: "ORIENTATION"
  [check] dsl/keyword/forking/abilities specs loaded (evidence: frame.specs)
  [check] workspace zones + root discovered from {project.workspace_config} (evidence: frame.workspace)
  [check] core_documents count in 5..8, each distinct-purpose and objective-aligned (evidence: frame.core_documents)
  result: pass -> STAGE 2 PLANNING | workspace/spec missing -> STAGE 5 RECOVERY (owner: orientation)


# ============================================================================
# STAGE 2 — PLANNING  (goals into an ordered agent sequence)
# ============================================================================
@purpose: "Define the agent sequence, allocate execution mode + context per agent, and build the 4D dependency graph"
@cue: "CLASSIFY_THEN_ORDER"

CONTRACT:
  input:        frame
  transform:    resolve agent_count -> per agent classify execution mode + context -> build 4D graph -> order hybrid plan
  constraints:  ORDER by dependency; a read-only discovery verb -> PARALLEL + context fork; a state-changing verb -> SEQUENTIAL + context normal; agent_count in [1..N], default 3..8
  output:       agent_sequence[] { name, type, phase, purpose, execution_mode, context, model, graph_4d }
  handoff:      every agent classified AND context allocated AND all four graph axes present per agent

DECLARE execution_verbs: object
SET execution_verbs = {
  parallel:   ["ANALYZE","FIND","EXTRACT","READ","DISCOVER","INVESTIGATE","RESEARCH","EXPLORE","TRACE"],
  sequential: ["CREATE","WRITE","EXECUTE","VERIFY","IMPLEMENT","LINK","ITERATE","REFACTOR","DEPLOY"]
}

DECLARE forking_configuration: object
SET forking_configuration = {
  discovery:     {context: "fork",   parallel: true,  model: "{model}"},
  investigation: {context: "fork",   parallel: true,  model: "{model}"},
  documentation: {context: "fork",   parallel: true,  model: "{model}"},
  action:        {context: "normal", parallel: false, model: "{model}"},
  validation:    {context: "normal", parallel: false, model: "{model}"}
}

FUNCTION classify_execution_mode(agent_purpose):
  SET primary_verb = EXTRACT_PRIMARY_VERB(agent_purpose)
  IF primary_verb IN execution_verbs.parallel: RETURN {execution_mode: "PARALLEL", context: "fork", model: "{model}", parallel_eligible: true}
  RETURN {execution_mode: "SEQUENTIAL", context: "normal", model: "{model}", parallel_eligible: false}   # default and all state-changing verbs

FUNCTION build_graph_4d(agent, agent_sequence):
  # Z sequential: phases that must complete before this one
  FOR EACH prev IN agent_sequence WHERE prev.phase < agent.phase AND agent DEPENDS_ON prev: APPEND {from: prev.phase, name: prev.name} TO agent.graph_4d.sequential
  # X lateral: same-depth peers that can run in parallel
  FOR EACH peer IN agent_sequence WHERE peer.phase == agent.phase AND peer != agent AND NOT agent DEPENDS_ON peer: APPEND {peer: peer.phase, name: peer.name} TO agent.graph_4d.lateral
  # Y diagonal: cross-phase data dependencies
  FOR EACH other IN agent_sequence WHERE other != agent AND (agent.outputs USED_BY other.inputs OR other.outputs USED_BY agent.inputs): APPEND {node: other.phase, name: other.name, data: other.outputs} TO agent.graph_4d.diagonal
  # W propagation: superseded state, propagated contracts, what breaks if changed
  FOR EACH downstream IN agent_sequence WHERE downstream CONSUMES agent.outputs: APPEND {target: downstream.phase, name: downstream.name, supersedes: DETECT_SUPERSEDED(agent, downstream), contracts: DETECT_CONTRACTS(agent, downstream), breaks_if_changed: DETECT_FRAGILE(agent, downstream)} TO agent.graph_4d.propagation
  IF agent.graph_4d.propagation.length == 0: APPEND {target: "none", evidence: "no downstream consumer"} TO agent.graph_4d.propagation
  RETURN agent

# OUTPUT CONTRACT
RESOLVE agent_count FROM user_input OR frame complexity   # [1..N], default 3..8
DECLARE agent_sequence: array
SET agent_sequence = []
FOR EACH index FROM 1 TO agent_count:
  DECLARE agent: object
  SET agent = {name: "{AGENT_NAME_" + index + "}", type: "{SUBAGENT_TYPE_" + index + "}", phase: index, purpose: "{PRIMARY_PURPOSE_" + index + "}", inputs: [], outputs: [], graph_4d: {sequential: [], lateral: [], diagonal: [], propagation: []}}
  MERGE classify_execution_mode(agent.purpose) INTO agent
  IF agent.phase == 1: SET agent.inputs = ["codebase", "user_requirements"]
  ELSE: SET agent.inputs = frame.core_documents   # phase N READS + EDITS the shared docs
  SET agent = build_graph_4d(agent, agent_sequence)
  APPEND agent TO agent_sequence

HANDOFF GATE (evidence-bearing):
  rule_id: "PLANNING"
  [check] all agent_count agents classified PARALLEL | SEQUENTIAL with context fork | normal (evidence: agent_sequence)
  [check] every agent has all four graph axes, W explicit even if empty (evidence: graph_4d)
  [check] order is dependency-topological, not severity (evidence: agent_sequence order)
  result: pass -> STAGE 3 COORDINATION | ungraphable dependency cycle -> STAGE 5 RECOVERY (owner: planning)


# ============================================================================
# STAGE 3 — COORDINATION  (the algorithm for running + handing off agents)
# ============================================================================
@purpose: "Define the handoff contract, the pre-create + batch + surgical-edit coordination procedure, and skill invocation"
@cue: "SPAWN_NEVER_SIMULATE"

CONTRACT:
  input:        frame + agent_sequence
  transform:    define handoff signal -> pre-create shared docs -> batch parallel / serialize sequential -> bind skill invocation
  constraints:  the orchestrator MUST spawn agents via the Task tool, NEVER simulate; parallel agents in ONE message with multiple Task calls; sequential agents one at a time; agents EDIT the shared docs surgically (remove outdated before adding), never append duplicates, never new versions
  output:       coordination { handoff_signal, coordination_sequence, skill_patterns }
  handoff:      handoff signal carries execution_mode + context + graph_4d AND coordination spawns via Task tool

DECLARE handoff_signal: object
SET handoff_signal = {
  agent_completed: "{AGENT_NAME_N}", phase_status: "complete", phase_number: "N",
  execution_mode: "{PARALLEL|SEQUENTIAL}", context_used: "{fork|normal}",
  documents_updated: [], key_discoveries: ["<discovery with file:line>"], critical_files: ["{path}:{line}"],
  validation_gates_passed: true, parallel_results: [],
  graph_4d: {sequential: [], lateral: [], diagonal: [], propagation: []},
  artifacts_location: frame.artifact_base_path, next_agent: "{AGENT_NAME_N+1}",
  orchestrator_action: "ACTIVATE_NEXT_AGENT | PAUSE_FOR_USER | WORKFLOW_COMPLETE",
  user_rules_applied: null   # populated only if the user provided workflow-specific rules
}

DECLARE surgical_edit_protocol: array
SET surgical_edit_protocol = ["READ entire document first", "DETECT contradictions with new findings", "DELETE outdated sections", "EDIT in-place with corrections", "VERIFY single source of truth maintained"]

FUNCTION build_coordination_sequence(frame, agent_sequence):
  DECLARE seq: array
  SET seq = []
  # pre-create every shared document + checkpoint before phase 1
  FOR EACH document IN frame.core_documents: APPEND "orchestrator: CREATE " + document + " (empty template)" TO seq
  APPEND "orchestrator: CREATE " + frame.checkpoint_file TO seq
  # walk the sequence, batching consecutive PARALLEL agents into one Task message, serializing SEQUENTIAL
  DECLARE parallel_batch: array
  SET parallel_batch = []
  FOR EACH agent IN agent_sequence:
    IF agent.execution_mode == "PARALLEL":
      APPEND agent TO parallel_batch
      IF agent IS_LAST OR next(agent).execution_mode == "SEQUENTIAL":
        APPEND "orchestrator: EXECUTE parallel batch — single message with " + parallel_batch.length + " Task(context: fork) calls; WAIT for all" TO seq
        SET parallel_batch = []
    ELSE:
      IF parallel_batch.length > 0: APPEND "orchestrator: flush parallel batch (single message, WAIT for all)" TO seq; SET parallel_batch = []
      APPEND "orchestrator: EXECUTE Task(subagent_type: " + agent.name + ", context: normal, model: {model}); WAIT for completion" TO seq
  APPEND "orchestrator: workflow complete — " + frame.checkpoint_file + " 100%, artifacts in " + frame.artifact_base_path TO seq
  RETURN seq

DECLARE skill_patterns: object
SET skill_patterns = {
  discovery:  {tool: "Skill", skill: "{project.research_skill}", args: "{topic}", context: "fork",   when: "specialized research needed"},
  validation: {tool: "Skill", skill: "{project.verify_skill}",   args: "",       context: "normal", when: "architectural verification needed"}
}

# OUTPUT CONTRACT
SET coordination = {handoff_signal: handoff_signal, coordination_sequence: build_coordination_sequence(frame, agent_sequence), skill_patterns: skill_patterns}

HANDOFF GATE (evidence-bearing):
  rule_id: "COORDINATION"
  [check] handoff signal carries execution_mode, context_used, and graph_4d (evidence: handoff_signal)
  [check] coordination spawns via Task tool, parallel batched in one message, never simulated (evidence: coordination_sequence)
  [check] agents edit shared docs surgically, single source of truth, no new versions (evidence: surgical_edit_protocol)
  result: pass -> STAGE 4 VALIDATION (owner: compilation)


# ============================================================================
# STAGE 4 — VALIDATION  (does the generated workflow satisfy the goal)
# ============================================================================
@purpose: "Gate the generated structure against single-source-of-truth, distinctness, graph completeness, and handoff completeness"
@cue: "GATE_THE_STRUCTURE"

CONTRACT:
  input:        frame + agent_sequence + coordination
  transform:    run structural checks -> collect findings with owner stage
  constraints:  a check names what it examined; severity is metadata that routes in STAGE 5, never a grouping axis
  output:       validation_report { status: pass|repair_required, findings[] with owner }
  handoff:      zero blocker/error findings

DECLARE checks: array
SET checks = [
  {id: "SSOT",        test: "no duplicate findings across documents; every agent edits in-place, no new versions", owner: "compilation"},
  {id: "DISTINCT",    test: "every core document serves one distinct logical purpose; no generic names", owner: "orientation"},
  {id: "GRAPH-4D",    test: "every agent phase declares Z, X, Y, and W; W explicit even if empty", owner: "planning"},
  {id: "HANDOFF",     test: "every handoff carries execution_mode, context_used, graph_4d, validation_gates_passed", owner: "compilation"},
  {id: "SPAWN",       test: "coordination uses Task tool, batches parallel in one message, never simulates", owner: "compilation"},
  {id: "PORTABLE",    test: "no hardcoded workspace paths; all resolved from {project.*}/{convention.*}", owner: "orientation"}
]

FUNCTION run_checks(frame, agent_sequence, coordination):
  DECLARE findings: array
  SET findings = []
  FOR EACH c IN checks:
    ANALYZE {frame: frame, agents: agent_sequence, coordination: coordination} AGAINST c.test INTO r
    IF r.pass == false: APPEND {rule_id: c.id, owner: c.owner, severity: r.severity, evidence: r.evidence, explanation: r.explanation, repair: r.repair} TO findings
  RETURN findings

# OUTPUT CONTRACT
SET validation_report = {status: "repair_required", findings: run_checks(frame, agent_sequence, coordination)}
FILTER validation_report.findings TO blocking WHERE severity IN ["blocker", "error"]
IF blocking.length == 0: SET validation_report.status = "pass"

HANDOFF GATE (evidence-bearing):
  rule_id: "VALIDATION"
  [check] every check names what it examined (evidence: findings carry evidence + rule_id)
  [check] status == "pass" (evidence: zero blocker/error findings)
  result: pass -> STAGE 6 ASSEMBLY | repair_required -> STAGE 5 RECOVERY


# ============================================================================
# STAGE 5 — RECOVERY  (what happens when a check or an agent fails)
# ============================================================================
@purpose: "Recover file-modification errors and failed agent runs without user intervention, bounded before escalation"
@cue: "RECOVER_THEN_RELAUNCH"

CONTRACT:
  input:        validation_report.findings; modification errors; agent runs with validation_gates_passed == false
  transform:    route finding to owner stage; stale-write -> delete-and-rewrite; failed agent -> diagnose + relaunch with adapted context
  constraints:  BOUNDED (recovery_attempts > 3 -> PAUSE_FOR_USER); NEVER re-read a file after a modification error without deleting first; NEVER ask permission for tool-error recovery
  output:       recovered artifacts OR a paused escalation with an error report
  handoff:      status pass -> back to the owning stage | attempts exhausted -> PAUSE_FOR_USER

FUNCTION recover_file_modified(file_path, updated_content):
  READ file_path INTO current
  DELETE file_path
  WRITE file_path WITH updated_content   # delete-and-rewrite, automatic, no user prompt
  RETURN write_verified

FUNCTION recover_failed_agent(agent, shared_documents):
  READ shared_documents INTO state       # identify the unmet expectation
  WEBSEARCH error_pattern FOR resolution_method
  RELAUNCH agent WITH adapted_context INCLUDING error + resolution_method
  RETURN relaunch_result

# OUTPUT CONTRACT
DECLARE recovery_attempts: number
SET recovery_attempts = 0
WHILE validation_report.status == "repair_required" OR agent_failed:
  SET recovery_attempts = recovery_attempts + 1
  IF recovery_attempts > 3: PAUSE_FOR_USER WITH error_report; BREAK
  IF modification_error: SET write_verified = recover_file_modified(file_path, updated_content)
  IF agent_failed:       SET relaunch_result = recover_failed_agent(agent, frame.core_documents)
  RE-RUN the owning stage of the earliest finding

HANDOFF GATE (evidence-bearing):
  rule_id: "RECOVERY"
  [check] recovery_attempts <= 3 (evidence: recovery_attempts)
  [check] file-modification errors delete-and-rewrite automatically (evidence: write_verified)
  [check] failed agents diagnosed + relaunched with adapted context, not silently dropped (evidence: relaunch_result)
  result: recovered -> re-run owning stage | attempts exhausted -> PAUSE_FOR_USER (owner: recovery)


# ============================================================================
# STAGE 6 — ASSEMBLY  (when the workflow is complete)
# ============================================================================
@purpose: "Assemble the validated sections into the workflow template, write it, and gate first-time initiation"
@cue: "ASSEMBLE_THEN_CONFIRM"

CONTRACT:
  input:        frame + agent_sequence + coordination (all validated)
  transform:    assemble sections -> write template -> prompt first-time initiation
  constraints:  filenames UPPERCASE.md; content agent-oriented PAG-LANG; render adds no new orchestration decision; execution is user-approved on first run
  output:       generation_result { output_file }
  handoff:      template written to {workflow_output_dir} AND first-time approval obtained before execution

FUNCTION assemble(frame, agent_sequence, coordination):
  SET output_path = "{workflow_output_dir}/" + frame.workflow_name + "-WORKFLOW.{convention.workflow_ext}"
  CREATE template AS pag_dsl_document
  APPEND workflow_frontmatter, workspace_config_section, workflow_overview TO template
  FOR EACH agent IN agent_sequence: APPEND phase_documentation(agent) TO template   # execution_mode, context, rendered 4D graph, artifacts, focus, invocation example
  APPEND checklist_integration, coordination.handoff_signal, coordination.coordination_sequence TO template
  APPEND coordination.skill_patterns, workflow_principles, domain_notes TO template
  WRITE template TO output_path
  RETURN output_path

# OUTPUT CONTRACT
SET generation_result = {output_file: assemble(frame, agent_sequence, coordination)}
IF first_time:
  REPORT workflow_summary
  READ user_choice FROM prompt "Review complete. Next: [Execute Workflow] [Edit Template] [Cancel]?"
  IF user_approves: EXECUTE generated_workflow

HANDOFF GATE (evidence-bearing):
  rule_id: "ASSEMBLY"
  [check] template written to {workflow_output_dir} as a {convention.workflow_ext} file (evidence: generation_result.output_file)
  [check] filenames UPPERCASE.md, content agent-oriented PAG-LANG, no hardcoded paths (evidence: rendered template)
  [check] first-time initiation gated on explicit user approval (evidence: user_choice)
  result: TERMINATE

FINALIZE generation_result


# ============================================================================
# CROSS-STAGE INVARIANTS (bind every stage)
# ============================================================================
ALWAYS:
  - read the DSL/spec files first, and discover workspace config from {project.workspace_config}
  - classify each agent PARALLEL (context fork) or SEQUENTIAL (context normal) by its primary verb
  - spawn agents via the Task tool with a subagent_type; batch parallel agents in one message; run sequential agents one at a time
  - build the 4D dependency graph per agent phase (Z sequential, X lateral, Y diagonal, W propagation) and render W explicitly even if empty
  - include execution_mode, context_used, and graph_4d in every handoff signal
  - agents edit the shared documents in place, removing outdated content before adding, maintaining one source of truth
  - persist progress in the checkpoint file so any agent can resume by reading it
  - order phases by dependency; a stage reads only the prior stage's output contract and hands off through one evidence-bearing gate
  - recover file-modification errors by delete-and-rewrite automatically; relaunch failed agents with adapted context, bounded to 3 attempts

NEVER:
  - hardcode file paths or workspace locations
  - simulate agent execution in the orchestrator session
  - append duplicate findings, or create a new document version instead of editing in place
  - omit the 4D graph from a phase or a handoff signal
  - use taxonomy-based extensions for generated documents (UPPERCASE.md only)
  - mix human narrative with DSL directives, or use an abstract verb with no tool mapping
  - re-read a file after a modification error without deleting first, or ask permission for tool-error recovery
  - group phases by severity/priority headers
```
