---
name: pag-guide
description: PAG practical guide. Syntax, phases, constraints, debugging, worked examples. BanesLab IP.
type: reference
domain: [ai-governance]
keywords: [pag, grammar, syntax, phases, constraints, debugging, examples, instructions, prompts]
owner: BanesLab
created: 2026-04-08
last-verified: 2026-04-08
version: 1
staleness-days: -1
max-lines: 900
depends-on: [reference_pag_grammar.md, reference_pag_keywords.md]
supersedes:
---

Getting Started with PAG
========================

Learn to write PAG documents through **practical patterns**.

Planning, Structure & Variables

Before writing, answer these questions to clarify your document's purpose:

```text
Planning, Structure & Variables63 linesVERB target PREPOSITION source [INTO destination]

Examples:
READ customer_data FROM database
EXTRACT email FROM customer_data INTO email_value
ANALYZE email_value AGAINST email_pattern
WRITE validation_result TO output
FILTER items TO valid_items WHERE status = "active"
CREATE report FROM findings USING template

# ─────────────────────────────────────────────────────────
# BASIC DOCUMENT STRUCTURE
# ─────────────────────────────────────────────────────────

---
name: my-first-pag
type: instruction
version: 1.0.0
---

THIS INSTRUCTION IS a basic PAG document example

%% META %%:
  intent: "Demonstrate PAG structure"
  context: "Learning exercise"

# PHASE 1: Setup
  READ "input.json" INTO data
  VALIDATE data AGAINST schema

  VALIDATION GATE:
    ✅ data loaded successfully
    ✅ schema validation passed

# PHASE 2: Process
  FOR EACH item IN data.items:
    ANALYZE item FOR requirements
    IF item.valid:
      COLLECT item INTO results

ALWAYS:
  - Log all state changes
  - Validate before writing

NEVER:
  - Skip validation gates
  - Modify source data directly

# ─────────────────────────────────────────────────────────
# VARIABLE DECLARATION
# ─────────────────────────────────────────────────────────

DECLARE config: object
DECLARE items: array
DECLARE counter: number

SET config.name = "workflow-config"
SET config.version = "1.0.0"
SET counter = 0

FOR EACH item IN source_data:
    SET counter = counter + 1
    APPEND item TO items
```

- What is the purpose? Single sentence describing what this document accomplishes.
- What are the major stages? Sequential phases that build on each other.
- What depends on what? Which phases produce outputs that later phases consume.
- What can fail? Error conditions and how to recover.
- How will I know it succeeded? Specific, verifiable validation conditions.
- Uses keywords like READ, WRITE, FROM, INTO common in programming
- Each instruction has a clear action, target, and source
- Explicit structure may reduce ambiguity compared to prose
- Frontmatter — metadata (name, type, version)
- Declaration — what this document does
- Phases — sequential steps, each with a validation gate
- Constraints — ALWAYS/NEVER rules
- DECLARE — establishes a variable with its type, use at start for structured data
- SET — assigns values, use for initialization and updates
- Declaring before use makes data flow between phases explicit

Control Flow, Error Recovery & Validation

Use `IF/ELSE IF/ELSE`for branching, `FOR EACH`for collections (never just `FOR`), and `TRY/EXCEPT`for operations that may fail. Gates are **checkpoints**between phases:

```text
Control Flow, Error Recovery & Validation64 linesIF validation_passed === true:
    EXECUTE next_phase
    SET status = "complete"
ELSE IF error_recoverable === true:
    ATTEMPT retry_operation
    SET max_attempts = 3
ELSE:
    REPORT "ESCALATE_BLOCKER"
    REPORT failure_context
END IF

# ─────────────────────────────────────────────────────────
# ITERATION PATTERNS
# ─────────────────────────────────────────────────────────

FOR EACH document IN core_documents:
    READ document INTO content
    VALIDATE content AGAINST schema
    IF content.valid:
        APPEND document TO processed_list

FOR EACH agent IN agent_sequence:
    EXECUTE Task WITH agent.config
    VERIFY agent.validation_gates PASS

# ─────────────────────────────────────────────────────────
# ERROR RECOVERY
# ─────────────────────────────────────────────────────────

ON ERROR file_modified:
TRY:
    RENAME current_file TO current_file.bak
    WRITE updated_content TO <NEW>current_file
    DELETE current_file.bak
CATCH:
    RENAME current_file.bak TO current_file

WHEN verification_failure DETECTED:
    APPEND failure_context TO log
    IF failure_severity === "BLOCKER":
        REPORT "PAUSE_FOR_USER"
        AWAIT user_decision INTO resolution
    ELSE:
        CONTINUE WITH documented_deviation
    END IF

# ─────────────────────────────────────────────────────────
# VALIDATION GATES
# ─────────────────────────────────────────────────────────

# PHASE 2: Data Processing

    EXTRACT source.records INTO records
    FOR EACH record IN records:
        ANALYZE record USING mapping_rules INTO transformed_record
        APPEND transformed_record TO transformed_data
    VALIDATE transformed_data AGAINST output_schema

    VALIDATION GATE:
        ✅ All records extracted successfully
        ✅ Mapping rules applied
        ✅ Output schema validation passed
        ✅ No data loss detected
        ✅ Ready for Phase 3
```

- Always include a colon after conditions
- Keep conditions specific — use IF data.email matches pattern not IF data looks good
- Each branch should contain complete instruction sequences
- Use END IF for complex nested conditionals
- FOR EACH — iterator represents the current item in the collection
- Use FOR EACH agent IN agent_sequence to iterate over arrays directly
- Avoid WHILE for simple iteration; reserve for unpredictable conditions
- ON ERROR — declares what error type triggers the handler
- The backup-write-delete pattern is atomic — failure restores the original
- Design recovery to leave the system in a consistent state
- Use REPORT when human intervention is needed
- Each gate should have 3-5 conditions
- Good: ✅ customer_email matches email_pattern, ✅ record_count > 0
- Bad: ✅ data looks valid, ✅ everything worked
- Specific conditions aim to make success criteria unambiguousUse uppercase for PAG keywords Keep phases focused on single objectives Add validation gates at every phase boundary Use DECLARE for explicit variable typing Document intent in %% META %% blocks Define ALWAYS/NEVER rules for constraints Use REPORT for status communication Implement error recovery with TRY/EXCEPT Prose instruction Wrong `"Get the customer data and check if it's valid"`Correct `READ customer_data FROM database
ANALYZE customer_data AGAINST validation_schema`Vague condition Wrong `✅ data looks good`Correct `✅ customer_data.email matches email_pattern`FOR without EACH Wrong `FOR item IN collection:`Correct `FOR EACH item IN collection:`Missing colon Wrong `IF validation_passed
EXECUTE next_phase`Correct `IF validation_passed:
EXECUTE next_phase`

Document Structure
==================

Every PAG document follows a consistent structure that aims to provide explicit patterns for AI systems.

Structure, Frontmatter & META

YAML frontmatter provides document metadata. The META block declares the document's semantic intent. PAG documents can include flowcharts, state machines, DAGs, priority queues, task markers, and more:

```text
Structure, Frontmatter & META142 lines---
name: comprehensive-workflow-template
version: 1.0.0
type: WORKFLOW
description: Full PAG grammar template
keywords: [workflow, template, comprehensive]
context: [{project_instructions_file}, config.json]
model: {model}
---

THIS WORKFLOW EXECUTES comprehensive task orchestration

%% META %%:
intent: "Primary objective of this workflow"
objective: "Measurable success criteria"
context: "Execution environment and constraints"
priority: high
recursion_limit: 5

TRY:
    BACKUP current_file TO current_file.bak
    WRITE updated_content TO current_file
    DELETE current_file.bak
CATCH:
    RESTORE FROM current_file.bak

DECLARE config: object
DECLARE results: array
DECLARE status: string
SET config.mode = "production"
SET results = []

# PHASE 1: Discovery
    @purpose: "Gather initial data and validate inputs"
    CUE color: "blue"

    [ ] Pending task marker
    [x] Completed task marker

    GLOB "**/*.{file_ext}" INTO source_files
    READ "config.json" INTO config
    VALIDATE config AGAINST schema

    FOR EACH file IN source_files:
        ANALYZE file FOR patterns INTO findings
        APPEND findings TO results

    IF results.length > 0:
        SET status = "found"
    ELSE:
        REPORT "No results found"
        EXIT 1

    VALIDATION GATE:
        ✅ source_files populated
        ✅ config validated against schema
        ASSERT results.length > 0
        IF FAIL: REPORT "Discovery failed"

# PHASE 2: Processing
    @purpose: "Transform and validate data"

    RULE validation_rule:
        WHEN item.type === "critical":
            VALIDATE item AGAINST strict_schema
            MARK item AS verified

    STEP 1: FILTER results WHERE valid === true
    STEP 2: SORT results BY priority DESC

    FUNCTION process_item(item):
        EXTRACT item.data INTO processed
        RETURN processed

    START parallel_section
    PARALLEL:
        TASK "analyze subset A" WITH subagent_type: "Explore"
        TASK "analyze subset B" WITH subagent_type: "Explore"
    END

    AWAIT all_tasks INTO combined_results

    VALIDATION GATE:
        ✅ All items processed
        ✅ No validation errors

FLOWCHART decision_flow LAYOUT vertical:
    start[Begin] --> validate{Valid?}
    validate / yes → process[Process]
    validate / no → error[Handle Error]
    process --> complete((End))
    error --> complete

STATE_MACHINE approval_workflow:
    STATE pending:
        ENTRY: SEND notification TO reviewer
    STATE approved:
        ENTRY: EXECUTE finalize
    TRANSITION FROM pending TO approved
        ON approval
        GUARD: all_checks_passed

DAG build_pipeline:
    NODE setup:
        READ "{package_manifest}" INTO pkg
    NODE build DEPENDS_ON [setup]:
        BASH "{build_cmd}"
    NODE test AFTER build:
        BASH "{test_cmd}"
    PARALLEL_GROUP: lint, typecheck

PRIORITY_QUEUE task_queue COMPARE_BY priority:
    ENQUEUE critical_task TO task_queue PRIORITY = 10
    ENQUEUE normal_task TO task_queue PRIORITY = 5
    DEQUEUE FROM task_queue TO next_task
    PEEK task_queue

# PHASE 3: Finalization
    CREATE report FROM results USING template
    WRITE report TO "output/report.md"
    REPORT "Workflow complete: " + results.length + " items"

    VALIDATION GATE:
        ✅ Report generated
        ✅ Output file written

ALWAYS:
    - READ before WRITE
    - VALIDATE at phase boundaries
    - REPORT state changes
    - VERIFY gates before proceeding

NEVER:
    - SKIP validation gates
    - MODIFY source data directly
    - PROCEED past BLOCKER without confirmation
    - CREATE files without explicit path

WHEN processing_sensitive_data:
    ALWAYS:
        - BACKUP before modification
        - REPORT all access
```

```text
┌───────────────────────────────────────────┐
│  FRONTMATTER (YAML metadata)              │
│  ---                                      │
│  name: document-name                      │
│  type: agent|workflow|protocol|policy...  │
│  version: 1.0.0                           │
│  model: {model}                           │
│  context: [{context_file}, ...]           │
│  ---                                      │
├───────────────────────────────────────────┤
│  DOCUMENT DECLARATION                     │
│  THIS {TYPE} {VERB} {description}         │
├───────────────────────────────────────────┤
│  %% META %%:                              │
│    intent: "primary objective"            │
│    objective: "measurable goal"           │
│    context: "execution context"           │
│    priority: high|medium|low              │
│    recursion_limit: 5                     │
├───────────────────────────────────────────┤
│  TRY:                                     │
│    ... CATCH: ...                         │
├───────────────────────────────────────────┤
│  DECLARE variables: type                  │
│  SET initial_values = ...                 │
├───────────────────────────────────────────┤
│  # PHASE 1: {Phase Title}                 │
│    @purpose: "phase intent"               │
│    CUE color: "semantic marker"           │
│    [ ] task marker (pending)              │
│    [x] task marker (complete)             │
│    directives...                          │
│    VALIDATION GATE:                       │
│      ✅ condition verified                │
│      ASSERT critical_condition            │
│      IF FAIL: recovery_action             │
├───────────────────────────────────────────┤
│  FLOWCHART process_name:                  │
│    start[Begin] --> step1[Process]        │
│    step1 --> {decision}                   │
│    decision / yes → success               │
│    decision / no → retry                  │
├───────────────────────────────────────────┤
│  STATE_MACHINE workflow:                  │
│    STATE pending: ENTRY: notify           │
│    TRANSITION FROM pending TO active      │
│      ON approval GUARD: valid             │
├───────────────────────────────────────────┤
│  DAG pipeline:                            │
│    NODE build DEPENDS_ON [setup]:         │
│    NODE test AFTER build:                 │
│    PARALLEL_GROUP: lint, typecheck        │
├───────────────────────────────────────────┤
│  PRIORITY_QUEUE tasks COMPARE_BY pri:     │
│    ENQUEUE item TO tasks PRIORITY = 10    │
│    DEQUEUE FROM tasks TO next_task        │
├───────────────────────────────────────────┤
│  RULE validation_rule:                    │
│    WHEN condition: action                 │
│  STEP 1: sequential_action                │
│  FUNCTION helper(param): body             │
├───────────────────────────────────────────┤
│  # PHASE N: {Phase Title}                 │
│    directives...                          │
├───────────────────────────────────────────┤
│  ALWAYS:                                  │
│    - invariant constraint                 │
│  NEVER:                                   │
│    - prohibition rule                     │
│  WHEN context:                            │
│    ALWAYS: - conditional constraint       │
└───────────────────────────────────────────┘
```

Phases, Error Handlers & Constraints

Phases group related directives with validation checkpoints. PAG includes syntax for expressing error recovery intent. ALWAYS and NEVER blocks define behavioral boundaries. PAG supports multiple document types, each with a **default verb**for declarations:

```text
Phases, Error Handlers & Constraints41 lines# PHASE 1: Workspace Configuration Discovery

SET config_file = "workspace-config.json"

READ config_file INTO workspace_config
EXTRACT workspace_config.zones INTO zones
EXTRACT workspace_config.extensions INTO extensions

SET shared_zone = zones.shared
SET artifact_path = shared_zone + "/" + workflow_name

VALIDATION GATE:
    ✅ Workspace configuration loaded
    ✅ Zones extracted successfully
    ✅ Artifact path configured

# ─────────────────────────────────────────────────────────
# ERROR HANDLER PATTERN
# ─────────────────────────────────────────────────────────

ON ERROR file_modified:
TRY:
    RENAME current_file TO current_file.bak
    WRITE updated_content TO <NEW>current_file
    DELETE current_file.bak
CATCH:
    RENAME current_file.bak TO current_file

# ─────────────────────────────────────────────────────────
# CONSTRAINT BLOCKS
# ─────────────────────────────────────────────────────────

ALWAYS READ shared documents BEFORE WRITE
ALWAYS USE surgical replacement FOR updates
ALWAYS APPEND timestamps TO all modifications
ALWAYS VERIFY each validation gate BEFORE proceeding

NEVER SKIP entry/exit verification phases
NEVER OVERWRITE documents WITHOUT reading first
NEVER PROCEED past failed gates WITHOUT documentation
NEVER CREATE speculative findings WITHOUT evidence
```

`AGENT`PERFORMS AI agent behavior definition `WORKFLOW`EXECUTES Multi-phase process orchestration `PROTOCOL`DEFINES Standard operating procedures `POLICY`ENFORCES Constraint and rule systems `CHECKLIST`PROVIDES Task tracking with validation `TEMPLATE`IMPLEMENTS Reusable document patterns `TASK`EXECUTES Single-objective operations `INSTRUCTION`IS General guidance documents `PROMPT`IS LLM interaction templates

Tool Invocation
===============

PAG patterns for invoking **Claude Code CLI**tools, enabling agents to interact with the filesystem, shell, and web.

File, Search & Execution Operations

Reading, writing, modifying files, finding files and content, running commands and fetching resources:

```text
File, Search & Execution Operations# FILE OPERATIONS
READ "config.json" INTO config
WRITE content TO "output.txt"
EDIT "{entry_file}" WITH old_string: "foo" new_string: "bar"

# SEARCH OPERATIONS
GLOB "**/*.{file_ext}" INTO source_files
GREP "TODO" IN "{src}/" INTO matches
WEB_SEARCH "PAG grammar specification"

# EXECUTION OPERATIONS
BASH "{build_cmd}" WITH timeout: 60000
WEB_FETCH "https://api.example.com/data" WITH prompt: "Extract the version"
```

- READ — read file contents, optionally bind to variable
- WRITE — write content to file path
- EDIT — replace string in file
- GLOB — find files matching pattern
- GREP — search content within files
- WEB_SEARCH — search the web for information
- BASH — execute shell command with optional timeout
- WEB_FETCH — retrieve URL content with processing prompt

Agent Operations & Invocation Patterns

Spawning agents and user interaction. Tool invocations follow consistent patterns:

```text
Agent Operations & Invocation Patterns17 lines# AGENT OPERATIONS
TASK "analyze codebase for patterns" WITH subagent_type: "Explore" -> result
ASK_USER "Which approach do you prefer?" WITH options: ["A", "B", "C"]

# INVOCATION PATTERNS

# Basic invocation
READ "config.json"

# With result binding
READ "data.json" INTO parsed_data

# With parameters
GREP "error" WITH path: "logs/", pattern: "*.log"

# Full form with result
TASK "analyze" WITH subagent_type: "Explore" -> analysis_result
```

- TASK — spawn a specialized agent for complex work
- ASK_USER — prompt user for input or decision
- Basic — just the tool and target
- WITH — add named parameters
- INTO — bind result to variable
- -> — alternative result binding syntax

Phase Design
============

Master the art of **structuring phases**— when to split, combine, and how data flows between them.

Phase Boundaries & Granularity

A phase is a **coherent unit of work**with a single responsibility:

```text
Phase Boundaries & Granularity37 lines# TOO GRANULAR (phases too small)
# PHASE 1: Read Config
    READ "config.json" INTO config
# PHASE 2: Extract Field
    SET name = config.name
# PHASE 3: Validate Name
    ANALYZE name AGAINST pattern

# TOO COARSE (phases too large)
# PHASE 1: Do Everything
    READ "config.json" INTO config
    READ "database.json" INTO db
    FOR EACH record IN db.records:
        TRANSFORM record USING rules
        VALIDATE record
        WRITE record TO output
    GENERATE report

# CORRECT (meaningful boundaries)
# PHASE 1: Configuration
    READ "config.json" INTO config
    VALIDATE config AGAINST schema
    VALIDATION GATE:
        ✅ Config loaded and validated

# PHASE 2: Data Processing
    READ "database.json" INTO db
    FOR EACH record IN db.records:
        TRANSFORM record USING config.rules
    VALIDATION GATE:
        ✅ All records transformed

# PHASE 3: Output Generation
    WRITE transformed_records TO output
    GENERATE report FROM transformed_records
    VALIDATION GATE:
        ✅ Output written successfully
```

- Single objective — Each phase accomplishes one clear goal
- Validation boundary — Every phase ends with a gate that verifies success
- Data transformation — Each phase takes inputs and produces outputs
- Recovery point — If a phase fails, you know exactly where to resumeSplit: Output dependency Phase B needs Phase A's output to start Split: Retry boundary You want to retry this part independently Split: Human checkpoint Human review or approval needed before continuing Split: State persistence Results should be saved before proceeding Split: Validation required Critical conditions must be verified before next step Combine: Atomic operation Steps must all succeed or all fail together Combine: No intermediate state Partial completion has no meaningful value Combine: Shared context Operations share variables that shouldn't persist Combine: Tight coupling Steps are so interdependent that separation adds noise

Data Flow & Variable Scope

Data moves between phases through **explicit variable bindings**. Variables have **document-wide scope**after declaration:

```text
Data Flow & Variable Scope56 lines# PHASE 1: Discovery
    GLOB "**/*.{file_ext}" INTO source_files
    SET file_count = source_files.length

    VALIDATION GATE:
        ✅ source_files populated (count: file_count)

# PHASE 2: Analysis
    # Uses source_files from Phase 1
    FOR EACH file IN source_files:
        READ file INTO content
        ANALYZE content FOR patterns INTO findings
        APPEND findings TO all_findings

    VALIDATION GATE:
        ✅ all_findings contains analysis results

# PHASE 3: Reporting
    # Uses all_findings from Phase 2
    CREATE report FROM all_findings USING template
    WRITE report TO "output/report.md"

    VALIDATION GATE:
        ✅ Report generated from all_findings

# Variable scope example
# PHASE 1: Setup
    DECLARE config: object
    DECLARE results: array
    SET config.mode = "production"

    # config and results available in all subsequent phases

# PHASE 2: Processing
    # Uses config from Phase 1
    SET results = []
    FOR EACH item IN data:
        IF config.mode === "production":
            APPEND item TO results

# PHASE 3: Cleanup
    # Uses results from Phase 2
    REPORT "Processed " + results.length + " items"

# PHASE 3: Generate Reports
    # Depends on: Phase 1 (config), Phase 2 (analyzed_data)

    CREATE summary FROM analyzed_data
    APPLY config.formatting TO summary
    WRITE summary TO output_path

    VALIDATION GATE:
        ✅ analyzed_data from Phase 2 available
        ✅ config.formatting applied
        ✅ Output written to output_path
        ✅ Ready for Phase 4 (if any)
```

- Explicit outputs — Each phase declares what it produces
- Named inputs — Later phases reference earlier outputs by name
- No forward references — Phase 3 cannot use Phase 4's output
- Gate verification — Gates confirm data is ready for next phase
- DECLARE early — Declare structured variables at document start or phase start
- SET anywhere — Assign values as needed throughout phases
- Implicit pass-through — Variables persist across phase boundaries
- Document scope — All phases share the same variable namespaceEach phase has a single, clear objective Phase boundaries align with retry/recovery points Every phase ends with a validation gate Variables are declared before use Data flow between phases is explicit No forward references to later phases Dependencies documented in gates or comments Phase granularity is appropriate (not too fine/coarse) Implicit state Wrong `ANALYZE data

# Where does result go?`Correct `ANALYZE data INTO analysis_result`Unclear source Wrong `WRITE report

# Report from where?`Correct `CREATE report FROM findings

WRITE report TO "output.md"`Hidden dependency Wrong `# PHASE 2
USE the config

# Which config?`Correct `# PHASE 2

# Uses: workspace_config from Phase 1

SET mode = workspace_config.mode`

Writing Effective PAG
=====================

Practical guidance for writing **clear, maintainable PAG documents**with worked examples and debugging techniques.

Constraints & Worked Example

ALWAYS/NEVER blocks define **behavioral boundaries**that apply throughout execution. Write constraints that are **specific**and **verifiable**. Below is a complete example with line-by-line explanation:

```text
Constraints & Worked Example101 lines# STRONG CONSTRAINTS (absolute rules)
ALWAYS:
    - READ shared documents BEFORE WRITE
    - VALIDATE inputs AT phase boundaries
    - LOG state changes WITH timestamps
    - VERIFY gates BEFORE proceeding

NEVER:
    - SKIP validation gates
    - MODIFY source data directly
    - PROCEED past BLOCKER without user confirmation
    - CREATE files without explicit path

# CONDITIONAL CONSTRAINTS (context-dependent)
WHEN processing_user_data:
    ALWAYS:
        - ENCRYPT sensitive fields
        - AUDIT all access
    NEVER:
        - LOG plaintext credentials
        - STORE data beyond retention period

# ─────────────────────────────────────────────────────────
# COMPLETE WORKED EXAMPLE: CSV File Processing
# ─────────────────────────────────────────────────────────

---
name: csv-processor
type: WORKFLOW
version: 1.0.0
---

THIS WORKFLOW EXECUTES CSV file validation and transformation

%% META %%:
    intent: "Process CSV files with validation"
    context: "Data pipeline preprocessing"
    priority: high

ON ERROR file_modified:
TRY:
    RENAME current_file TO current_file.bak
    WRITE updated_content TO <NEW>current_file
    DELETE current_file.bak
CATCH:
    RENAME current_file.bak TO current_file

# PHASE 1: Input Validation
    DECLARE input_data: object
    DECLARE validated_records: array

    READ "input.csv" INTO input_data
    SET record_count = input_data.rows.length

    FOR EACH row IN input_data.rows:
        ANALYZE row AGAINST csv_schema
        IF row.valid:
            APPEND row TO validated_records
        ELSE:
            REPORT "Invalid row: " + row.line_number

    VALIDATION GATE:
        ✅ input_data loaded (record_count rows)
        ✅ Schema validation complete
        ✅ validated_records populated
        ✅ Invalid rows logged

# PHASE 2: Transformation
    # Uses: validated_records from Phase 1
    DECLARE transformed_records: array

    FOR EACH record IN validated_records:
        EXTRACT record.fields INTO field_values
        TRANSFORM field_values USING mapping_rules INTO new_record
        APPEND new_record TO transformed_records

    VALIDATION GATE:
        ✅ All validated_records processed
        ✅ transformed_records contains output
        ✅ Field mapping applied

# PHASE 3: Output
    # Uses: transformed_records from Phase 2
    CREATE output_csv FROM transformed_records
    WRITE output_csv TO "output/processed.csv"
    REPORT "Processed " + transformed_records.length + " records"

    VALIDATION GATE:
        ✅ Output file written
        ✅ Record count matches input
        ✅ Processing complete

ALWAYS:
    - VALIDATE before transformation
    - LOG invalid records with line numbers
    - BACKUP before overwrite

NEVER:
    - SKIP validation phase
    - MODIFY original input file
    - PROCEED with zero valid records
```

- ALWAYS — Actions that must happen every time
- NEVER — Actions that are prohibited under all circumstances
- WHEN — Constraints that apply in specific contexts
- Place constraints at document end for global rules, or within phases for scoped rulesVague constraint Wrong `ALWAYS handle errors properly`Correct `ALWAYS WRAP file operations IN TRY/EXCEPT`Ambiguous prohibition Wrong `NEVER do bad things`Correct `NEVER WRITE TO paths outside workspace_root`Unverifiable rule Wrong `ALWAYS be careful with data`Correct `ALWAYS VALIDATE data AGAINST schema BEFORE processing`Overly broad Wrong `NEVER modify anything`Correct `NEVER MODIFY files IN read_only_zones`

Debugging, Pitfalls & Checklist

When your PAG doesn't produce expected results, use this systematic approach. Build documents progressively, starting simple and adding complexity:

```text
Debugging, Pitfalls & Checklist43 lines# PROBLEM: Variable undefined in later phase
# CAUSE: Variable declared inside conditional or loop
# FIX: Declare at phase start

# Wrong
IF condition:
    DECLARE result: object    # Only exists in IF block
    SET result.value = data

# Correct
DECLARE result: object        # Declared at phase level
IF condition:
    SET result.value = data

# PROBLEM: Gate always fails
# CAUSE: Gate checks different variable than phase produces
# FIX: Match gate conditions to actual outputs

# Wrong
FOR EACH item IN items:
    APPEND item TO processed_items
VALIDATION GATE:
    ✅ processed_list populated    # Different variable name!

# Correct
FOR EACH item IN items:
    APPEND item TO processed_items
VALIDATION GATE:
    ✅ processed_items populated   # Matches variable name

# PROBLEM: Unexpected behavior in iteration
# CAUSE: Using FOR instead of FOR EACH
# FIX: Always use FOR EACH for collections

# Wrong
FOR item IN collection:         # Missing EACH
    PROCESS item

# Correct
FOR EACH item IN collection:    # Explicit iteration
    PROCESS item
```

Check syntax Verify keywords uppercase, colons present, FOR EACH not FOR Trace data flow Follow variables from declaration through each phase Verify gates Confirm each gate's conditions match actual phase outputs Check dependencies Ensure no phase references data from a later phase Validate constraints Confirm ALWAYS/NEVER rules don't conflict with phase logic Read document top-to-bottom as an AI would Trace every variable from declaration to use Verify each gate condition is testable Confirm no forward phase references Check ALWAYS/NEVER don't conflict with logic Ensure error handlers cover failure modes Validate indentation is consistent Test with simple input mentally

| Pitfall             | Example                      | Fix                                    |
| ------------------- | ---------------------------- | -------------------------------------- |
| Over-engineering    | 10 phases for simple task    | Combine related operations             |
| Under-specifying    | PROCESS the data             | TRANSFORM data USING rules INTO output |
| Missing error path  | No TRY/EXCEPT for file ops   | Wrap I/O in error handlers             |
| Circular dependency | Phase 2 needs Phase 3 output | Reorder phases logically               |
| Vague gates         | ✅ looks good                | ✅ output.length > 0                   |

Level 1: Minimal

Start with core structure only

- Frontmatter + declaration
- Single phase with basic operations
- One validation gate

Level 2: Multi-Phase

Add sequential phases

- Multiple phases with data flow
- Gates at each boundary
- DECLARE/SET for variables

Level 3: Control Flow

Add conditionals and loops

- IF/ELSE branching
- FOR EACH iteration
- ALWAYS/NEVER constraints

Level 4: Error Handling

Add robustness

- TRY/EXCEPT blocks
- ON ERROR handlers
- Recovery patterns

Quality Checklist
=================

Use this checklist before finalizing any PAG document to ensure **completeness**and **correctness**.

Structure, Syntax & Data Flow
Frontmatter with name, type, version Document declaration (THIS [TYPE] [VERB]) META block with intent, objective, priority Error handler (ON ERROR) Phases numbered sequentially Each phase has VALIDATION GATE ALWAYS/NEVER rules at end No phase numbering gaps All keywords uppercase Prepositions match keyword expectations Control flow has colons (IF:) Iteration uses FOR EACH Indentation consistent (4 spaces) Variables in snake_case Variables declared before use No forward phase references Sources and destinations explicit Data transformations documented 3-5 conditions per gate Conditions are verifiable No vague assertions References current/previous phases

Common Mistakes & Pre-Submission

Avoid these common errors: What is the purpose? (Single sentence) What are the major stages? (Phases) What depends on what? (Data flow) What can fail? (Error conditions) How will I know it succeeded? Are all validation gates defined?

| Wrong                   | Correct                          | Issue                            |
| ----------------------- | -------------------------------- | -------------------------------- |
| Get the customer data   | READ customer_data FROM database | Prose instead of PAG             |
| ✅ data looks good      | ✅ data.email matches pattern    | Vague condition                  |
| FOR item IN collection: | FOR EACH item IN collection:     | Missing EACH                     |
| if condition            | IF condition:                    | Lowercase keyword, missing colon |
| * List item             | APPEND item TO list              | Markdown syntax                  |
