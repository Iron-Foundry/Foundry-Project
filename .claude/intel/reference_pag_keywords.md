---
name: pag-keywords
description: PAG keyword ontology. Action, control flow, declaration, modifier, coordination, state machine, DAG. BanesLab IP.
type: reference
domain: [ai-governance]
keywords: [pag, keywords, ontology, action, control-flow, declaration, modifier, uppercase]
owner: BanesLab
created: 2026-04-08
last-verified: 2026-04-08
version: 1
staleness-days: -1
max-lines: 100
depends-on: []
supersedes:
---

Keyword Ontology
================

PAG keywords are organized into semantic categories that reflect their function in instructions. All keywords are uppercase to leverage token patterns common in code training data. Hover over keywords for details.

Action Keywords

Primary verbs that initiate operations. These appear frequently in code, which may influence model completion patterns. `READ`Input acquisition `READ file INTO data``WRITE`Output generation `WRITE content TO file``EXECUTE`Action invocation `EXECUTE command WITH params``CREATE`Construction `CREATE artifact FROM template``DELETE`Removal `DELETE file_path``FIND`Discovery `FIND pattern IN scope``ANALYZE`Inspection `ANALYZE target FOR condition``VALIDATE`Verification `VALIDATE state AGAINST schema``VERIFY`Confirmation `VERIFY condition``EXTRACT`Isolation `EXTRACT data FROM source``COLLECT`Aggregation `COLLECT items INTO container``FILTER`Selection `FILTER items WHERE condition``COMPARE`Comparison `COMPARE a AGAINST b``CONVERT`Transformation `CONVERT data TO format``MERGE`Combination `MERGE sources INTO target``SPLIT`Division `SPLIT data BY delimiter``SORT`Ordering `SORT items BY criteria``RANK`Prioritization `RANK items BY score``LINK`Association `LINK source TO target``REPORT`Output `REPORT findings``ADD`Add to collection `ADD item TO list``APPEND`Append to end `APPEND value TO array``INSERT`Insert at position `INSERT item AT index``REMOVE`Remove from collection `REMOVE item FROM list``MOVE`Relocation `MOVE file TO destination``COPY`Duplication `COPY file TO backup``BACKUP`Preservation `BACKUP file TO location``RESTORE`Recovery `RESTORE FROM backup``LOAD`Resource acquisition `LOAD config FROM file``SEND`Communication `SEND message TO recipient``WAIT`Timing control `WAIT FOR condition``ATTEMPT`Trial operation `ATTEMPT operation``FAIL`Error termination `FAIL WITH message``EXIT`Exit execution `EXIT 1``RETURN`Return value `RETURN result``ITERATE`Repetition `ITERATE operation``INVESTIGATE`Deep analysis `INVESTIGATE issue``DETERMINE`Decision making `DETERMINE outcome``ENFORCE`Constraint application `ENFORCE rule``EVIDENCE`Proof provision `EVIDENCE claim``PROPAGATE`Change distribution `PROPAGATE updates``FINALIZE`Completion `FINALIZE operation``REDUCE`Aggregation `REDUCE items TO value``RENAME`Name modification `RENAME file TO newname``ORDER`Arrangement `ORDER items BY key``MARK`Annotation `MARK item AS complete`

Control Flow Keywords

Flow control structures that mirror programming constructs. `IF`Conditional execution `IF condition: action``ELSE`Alternative branch `ELSE: alternative``FOR`Iteration start `FOR EACH item IN list:``EACH`Iterator marker `FOR EACH x IN items:``WHILE`Conditional loop `WHILE condition: action``TRY`Exception handling start `TRY: risky_op``CATCH`Exception handler `CATCH: handle_error``EXCEPT`Exception alternative `EXCEPT: recovery``FINALLY`Cleanup block `FINALLY: cleanup``MATCH`Pattern matching `MATCH value:``CASE`Match branch `CASE pattern: action``DEFAULT`Fallback case `DEFAULT: fallback``WHEN`Event trigger `WHEN event: action``UNLESS`Negated conditional `UNLESS condition: action``UNTIL`Loop terminator `UNTIL done``GUARD`Early exit check `GUARD cond ELSE: exit``BREAK`Exit loop `BREAK``CONTINUE`Skip iteration `CONTINUE``GOTO`Jump to label `GOTO label``START`Flow start marker `START process``END`Flow end marker `END``STOP`Termination `STOP``LOOP`Loop marker `LOOP BACKTO step``STEP`Step marker `STEP 1: action``RULE`Rule definition `RULE name: body``IN`Containment test `item IN collection``MATCHES`Pattern test `value MATCHES /regex/`

Declaration Keywords

Variable and type declarations for state management. `SET`Variable assignment `SET name = value``DECLARE`Typed declaration `DECLARE x: string``DEFINE`Constant definition `DEFINE PI = 3.14``LET`Local binding `LET temp = expr``CONST`Immutable value `CONST MAX = 100`

Modifier Keywords

Constraint qualifiers that express behavioral expectations. `MUST`Mandatory requirement `MUST validate first``NEVER`Prohibition `NEVER delete without backup``ALWAYS`Invariant rule `ALWAYS log changes``REQUIRED`Necessity marker `REQUIRED field``MANDATORY`Obligation marker `MANDATORY check``CRITICAL`High priority `CRITICAL validation``ABSOLUTE`No exceptions `ABSOLUTE rule``FORBIDDEN`Absolute prohibition `FORBIDDEN: direct DB`

Coordination Keywords

Keywords for concurrent and asynchronous operations. `AWAIT`Async wait `AWAIT op INTO result``PARALLEL`Concurrent execution `PARALLEL: tasks END``DELEGATE`Task handoff `DELEGATE task TO agent``QUEUE`Task queuing `QUEUE operation``RETRY`Retry on failure `RETRY operation``LOCK`Resource lock `LOCK resource``UNLOCK`Release lock `UNLOCK resource`

State Machine Keywords

Keywords for declarative state machine definitions. `STATE_MACHINE`Machine declaration `STATE_MACHINE workflow:``STATE`State definition `STATE pending:``TRANSITION`State change rule `TRANSITION FROM a TO b``ON`Event trigger `ON approval``FROM`Source state `FROM pending``TO`Target state `TO approved``ENTRY`Entry action `ENTRY: notify``EXIT`Exit action `EXIT: cleanup`

DAG Keywords

Keywords for Directed Acyclic Graph task orchestration. `DAG`Graph declaration `DAG pipeline:``NODE`Node definition `NODE build:``DEPENDS_ON`Dependencies `DEPENDS_ON [a, b]``AFTER`Sequencing `AFTER compile``BEFORE`Reverse sequencing `BEFORE deploy``PARALLEL_GROUP`Parallel nodes `PARALLEL_GROUP: a, b`

Priority Queue Keywords

Keywords for priority-based task scheduling. `PRIORITY_QUEUE`Queue declaration `PRIORITY_QUEUE tasks:``PRIORITY`Priority value `PRIORITY = 10``ENQUEUE`Add to queue `ENQUEUE task TO q``DEQUEUE`Remove from queue `DEQUEUE FROM q``PEEK`View top item `PEEK queue``HEAPIFY`Reorder queue `HEAPIFY queue``COMPARE_BY`Comparison function `COMPARE_BY priority`

Flowchart Keywords

Keywords for visual flow definitions. `FLOWCHART`Flow declaration `FLOWCHART process:``MERMAID`Mermaid syntax `MERMAID flowchart:``LAYOUT`Flow direction `LAYOUT vertical``SUBGRAPH`Nested group `SUBGRAPH auth:`

Document Type Keywords

Keywords that define the document type in declarations (THIS {TYPE} {VERB} description). `AGENT`AI agent definition `THIS AGENT PERFORMS...``WORKFLOW`Multi-phase process `THIS WORKFLOW EXECUTES...``PROTOCOL`Standard procedures `THIS PROTOCOL DEFINES...``POLICY`Constraint system `THIS POLICY ENFORCES...``CHECKLIST`Task tracking `THIS CHECKLIST PROVIDES...``TEMPLATE`Reusable pattern `THIS TEMPLATE IMPLEMENTS...``TASK`Single objective `THIS TASK EXECUTES...``INSTRUCTION`General guidance `THIS INSTRUCTION IS...``PROMPT`LLM interaction `THIS PROMPT IS...``COMMAND`Executable command `THIS COMMAND EXECUTES...``TEST`Test specification `THIS TEST PERFORMS...`

Document Verbs

Verbs used in document declarations. `IS`Identity `THIS INSTRUCTION IS...``ENFORCES`Constraint `THIS POLICY ENFORCES...``EXECUTES`Action `THIS WORKFLOW EXECUTES...``HAS`Possession `THIS AGENT HAS...``PERFORMS`Behavior `THIS AGENT PERFORMS...``PROVIDES`Offering `THIS CHECKLIST PROVIDES...``IMPLEMENTS`Realization `THIS TEMPLATE IMPLEMENTS...``DEFINES`Specification `THIS PROTOCOL DEFINES...``MANAGES`Control `THIS AGENT MANAGES...``COORDINATES`Orchestration `THIS WORKFLOW COORDINATES...``GENERATES`Creation `THIS TEMPLATE GENERATES...`

Meta Keywords

Keywords for metadata and template operations. `META`Metadata block `%% META %%:``USE`Template usage `USE TEMPLATE name``TEMPLATE`Template reference `USE TEMPLATE validation``CUE`Context cue `CUE color: "red"``MAX_DEPTH`Recursion limit `MAX_DEPTH = 5`

Validation Keywords

Keywords for validation gates and assertions. `ASSERT`Hard assertion `ASSERT condition``REQUIRE`Prerequisite check `REQUIRE dependency``VALIDATION`Gate marker `VALIDATION GATE:``GATE`Checkpoint marker `VALIDATION GATE:`

Contextual Keywords

Prepositions and connectors that establish relationships. `INTO`Destination `READ file INTO data``FROM`Source `EXTRACT FROM response``WITH`Association `EXECUTE WITH params``USING`Instrument `VALIDATE USING schema``FOR`Purpose/Iteration `SEARCH FOR pattern``IN`Containment `FIND key IN object``TO`Target `WRITE TO file``AS`Alias/Role `BIND result AS alias``BETWEEN`Range `value BETWEEN 1 AND 10``AGAINST`Comparison target `VALIDATE AGAINST schema``BASED_ON`Foundation `CREATE BASED_ON template``WITHOUT`Exclusion `EXECUTE WITHOUT logging``WHERE`Filter condition `FIND WHERE x > 0``CONTENT`Data marker `WRITE CONTENT data``NOT`Negation `NOT condition``STYLE`Formatting `STYLE output`

AI Tool Keywords

Keywords for invoking AI agent tools. `READ`File reading `READ "config.json"``WRITE`File writing `WRITE content TO file``EDIT`File modification `EDIT file old new``GLOB`Pattern matching `GLOB "**/*.js"``GREP`Content search `GREP "pattern" IN path``BASH`Shell execution `BASH "npm test"``BASH_OUTPUT`Shell output `BASH_OUTPUT bash_id``KILL_SHELL`Shell termination `KILL_SHELL shell_id``WEB_FETCH`URL retrieval `WEB_FETCH url prompt``WEB_SEARCH`Web search `WEB_SEARCH "query"``TASK`Agent spawning `TASK prompt type``TODO_WRITE`Task management `TODO_WRITE todos``ASK_USER`User interaction `ASK_USER questions``NOTEBOOK_EDIT`Jupyter editing `NOTEBOOK_EDIT path cell``SKILL`Skill invocation `SKILL "pdf"``SLASH_COMMAND`Command execution `SLASH_COMMAND "/cmd"``MCP_EXECUTE`MCP tool execution `MCP_EXECUTE tool params`

AI Tool Parameters

Common parameter names for tool invocations. `FILE_PATH`Path to file `file_path: "src/main.js"``PATTERN`Search pattern `pattern: "**/*.ts"``COMMAND`Shell command `command: "npm run build"``QUERY`Search query `query: "PAG grammar"``URL`Target URL `url: "https://..."``PROMPT`Processing prompt `prompt: "Extract..."``TIMEOUT`Max execution time `timeout: 30000``DESCRIPTION`Command description `description: "Build"``OLD_STRING`Text to replace `old_string: "foo"``NEW_STRING`Replacement text `new_string: "bar"``CONTENT`File content `content: "data..."``CELL_ID`Jupyter cell ID `cell_id: "abc123"``NOTEBOOK_PATH`Notebook file path `notebook_path: "nb.ipynb"``SUBAGENT_TYPE`Agent type to spawn `subagent_type: "Explore"`
