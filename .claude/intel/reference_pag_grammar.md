---
name: pag-grammar
description: PAG formal BNF grammar. Planning, statement, expression, coordination, flowchart rules. BanesLab IP.
type: reference
domain: [ai-governance]
keywords: [pag, bnf, grammar, cfg, rules, syntax, formal, specification]
owner: BanesLab
created: 2026-04-08
last-verified: 2026-04-08
version: 1
staleness-days: -1
max-lines: 600
depends-on: [reference_pag_keywords.md]
supersedes:
---

BNF Grammar
===========

PAG is defined by a formal **Context-Free Grammar**(CFG) expressed in BNF notation. The complete grammar is organized into **five rule categories**.

Planning Rules

Grammar for **document structure**, phases, validation gates, and meta information.

```text
BNF Grammar68 lines# Instruction
<instruction> "hl-definition">::= <frontmatter> <optional_meta_block> <optional_document_declaration> <body>
<frontmatter> "hl-definition">::= "---" <yaml_content> "---"
<optional_meta_block> "hl-definition">::= <meta_block> "hl-operator">| ε
<optional_document_declaration> "hl-definition">::= <document_declaration> "hl-operator">| ε
<document_declaration> "hl-definition">::= "THIS" <document_type> <document_verb> <description>
<document_type> "hl-definition">::= "AGENT" "hl-operator">| "COMMAND" "hl-operator">| "TASK" "hl-operator">| "WORKFLOW" "hl-operator">| "INSTRUCTION" "hl-operator">| "TEST" "hl-operator">| "TEMPLATE" "hl-operator">| "POLICY" "hl-operator">| "PROTOCOL" "hl-operator">| "CHECKLIST" "hl-operator">| "PROMPT"
<document_verb> "hl-definition">::= "IS" "hl-operator">| "ENFORCES" "hl-operator">| "EXECUTES" "hl-operator">| "HAS" "hl-operator">| "PERFORMS" "hl-operator">| "PROVIDES" "hl-operator">| "IMPLEMENTS" "hl-operator">| "DEFINES" "hl-operator">| "MANAGES" "hl-operator">| "COORDINATES"
<description> "hl-definition">::= <text>
<body> "hl-definition">::= <phase>+

# Meta Block
<meta_block> "hl-definition">::= "%%" "META" "%%" ":" <meta_field>+
<meta_field> "hl-definition">::= "intent" ":" <string>
"hl-operator">| "context" ":" <string>
"hl-operator">| "objective" ":" <string>
"hl-operator">| "criteria" ":" <string>
"hl-operator">| "priority" ":" ("high" "hl-operator">| "medium" "hl-operator">| "low")
"hl-operator">| "recursion_limit" ":" <number>

# Phase
<phase> "hl-definition">::= <optional_phase_meta_block> <optional_context_cue> <phase_header> <phase_body>
<phase_header> "hl-definition">::= "#" "PHASE" <phase_number> ":" <phase_title>
"hl-operator">| "#" <phase_type> ":" <phase_title>
"hl-operator">| "#" <semantic_phase_name> ":" <phase_title>
<phase_number> "hl-definition">::= <digit>+ ("." <digit>+)?
<phase_type> "hl-definition">::= "SETUP" "hl-operator">| "ACTION" "hl-operator">| "ANALYZE" "hl-operator">| "CLEANUP"
<semantic_phase_name> "hl-definition">::= "FIND" "hl-operator">| "INVESTIGATE" "hl-operator">| "EXTRACT"
"hl-operator">| "ANALYZE" "hl-operator">| "FINALIZE"
<phase_title> "hl-definition">::= <text>
<optional_phase_meta_block> "hl-definition">::= <meta_block> "hl-operator">| ε
<optional_context_cue> "hl-definition">::= <context_cue> "hl-operator">| ε

# Phase Body
<phase_body> "hl-definition">::= (<directive> "hl-operator">| <validation_gate>)+

# Meta Tag
<meta_tag> "hl-definition">::= "@" ("purpose" "hl-operator">| "context" "hl-operator">| "focus" "hl-operator">| "expected_output") ":" <string>

# Macro
<macro> "hl-definition">::= "USE" "TEMPLATE" <template_name>
<template_name> "hl-definition">::= <identifier>

# Context Cue
<context_cue> "hl-definition">::= "CUE" ("color" "hl-operator">| "sound" "hl-operator">| "scent" "hl-operator">| "signal") ":" <string>

# Validation Gate
<validation_gate> "hl-definition">::= <gate_marker> <check_item>+
<gate_marker> "hl-definition">::= "**" "Validation" "Gate" "**" ":"
"hl-operator">| "##" "Validation" "Gate"
<check_item> "hl-definition">::= <check_marker> <check_condition> <optional_check_evidence> <optional_failure_action>
<optional_check_evidence> "hl-definition">::= <check_evidence> "hl-operator">| ε
<optional_failure_action> "hl-definition">::= <failure_action> "hl-operator">| ε
<check_marker> "hl-definition">::= "✅" "hl-operator">| "ASSERT" "hl-operator">| "REQUIRE" "hl-operator">| "ANALYZE" "hl-operator">| "[high]" "hl-operator">| "[medium]" "hl-operator">| "[low]"
<check_condition> "hl-definition">::= <boolean_expr>
<check_evidence> "hl-definition">::= "(" "ANALYZE" <verification_expr> ")"
<failure_action> "hl-definition">::= "IF" "FAIL" ":" <directive>+

# Rule
<rule_declaration> "hl-definition">::= "RULE" <rule_name> ":" <rule_body>
<rule_name> "hl-definition">::= <identifier>
<rule_body> "hl-definition">::= <when_clause>* <directive>+ <optional_validation_gate>
<when_clause> "hl-definition">::= "WHEN" <condition> ":" <directive>+
<optional_validation_gate> "hl-definition">::= <validation_gate> "hl-operator">| ε

# Step
<step_statement> "hl-definition">::= "STEP" <step_identifier> ":" <directive>+
<step_identifier> "hl-definition">::= <number> "hl-operator">| <identifier>
```

Statement Rules

Grammar for **directives**, actions, control flow, and declarations.

```text
BNF Grammar113 lines# Directive
<directive> "hl-definition">::= <optional_task_marker> <optional_meta_tag> <optional_context_cue> <directive_body>
<directive_body> "hl-definition">::= <action_expr>
"hl-operator">| <control_flow>
"hl-operator">| <declaration_statement>
"hl-operator">| <transform_statement>
"hl-operator">| <discovery_statement>
"hl-operator">| <iteration_statement>
"hl-operator">| <function_declaration>
"hl-operator">| <announcement_statement>
"hl-operator">| <state_machine_declaration>
"hl-operator">| <dag_declaration>
"hl-operator">| <priority_queue_declaration>
"hl-operator">| <priority_queue_operation>
"hl-operator">| <flowchart_declaration>
"hl-operator">| <mermaid_declaration>
"hl-operator">| <ascii_flowchart_block>
"hl-operator">| <macro>
<optional_task_marker> "hl-definition">::= <task_marker> "hl-operator">| ε
<task_marker> "hl-definition">::= "[" <task_state> "]"
<task_state> "hl-definition">::= " " "hl-operator">| "x" "hl-operator">| "!" "hl-operator">| ">" "hl-operator">| "~"
<optional_meta_tag> "hl-definition">::= <meta_tag> "hl-operator">| ε

# Action Expr
<action_expr> "hl-definition">::= <action_verb> <modifier>* <action_target> <optional_action_args>
<action_verb> "hl-definition">::= "EXECUTE" "hl-operator">| "READ" "hl-operator">| "WRITE" "hl-operator">| "REMOVE" "hl-operator">| "ANALYZE"
"hl-operator">| "CREATE" "hl-operator">| "FIND" "hl-operator">| "REPORT"
"hl-operator">| "COLLECT" "hl-operator">| "EXTRACT" "hl-operator">| "LINK" "hl-operator">| "DETERMINE"
"hl-operator">| "INVESTIGATE" "hl-operator">| "FILTER" "hl-operator">| "COMPARE" "hl-operator">| "MARK"
"hl-operator">| "SORT" "hl-operator">| "RANK" "hl-operator">| "ORDER" "hl-operator">| "INSERT" "hl-operator">| "APPEND"
"hl-operator">| "ADD" "hl-operator">| "MOVE" "hl-operator">| "COPY" "hl-operator">| "BACKUP" "hl-operator">| "RESTORE"
"hl-operator">| "GLOB" "hl-operator">| "GREP" "hl-operator">| "SET" "hl-operator">| "ITERATE" "hl-operator">| "ATTEMPT"
"hl-operator">| "FAIL" "hl-operator">| "EXIT" "hl-operator">| "RETURN" "hl-operator">| "WAIT" "hl-operator">| "SEND"
"hl-operator">| "REDUCE" "hl-operator">| "PROPAGATE" "hl-operator">| "FINALIZE" "hl-operator">| "EVIDENCE"
<modifier> "hl-definition">::= "MUST" "hl-operator">| "NEVER" "hl-operator">| "ALWAYS" "hl-operator">| "REQUIRED" "hl-operator">| "MANDATORY"
<action_target> "hl-definition">::= <tool_name> "hl-operator">| <path> "hl-operator">| <variable_name>
<tool_name> "hl-definition">::= "SYSTEM" "hl-operator">| "USER" "hl-operator">| "SERVICE"
<optional_action_args> "hl-definition">::= <parenthesized_args> "hl-operator">| <bare_args> "hl-operator">| ε
<parenthesized_args> "hl-definition">::= "(" <arg_list> ")"
<bare_args> "hl-definition">::= <arg_list>
<arg_list> "hl-definition">::= <arg> ("," <arg>)*
<arg> "hl-definition">::= <identifier> "hl-operator">| <literal> "hl-operator">| <expression>

# Control Flow
<control_flow> "hl-definition">::= <if_statement>
"hl-operator">| <for_loop>
"hl-operator">| <while_loop>
"hl-operator">| <try_catch>
"hl-operator">| <goto_statement>
"hl-operator">| <label_declaration>
"hl-operator">| <flow_marker>
<if_statement> "hl-definition">::= "IF" <condition> ":" <directive>+
("ELSE" "IF" <condition> ":" <directive>+)*
<optional_else_clause>
<optional_else_clause> "hl-definition">::= ("ELSE" ":" <directive>+) "hl-operator">| ε
<for_loop> "hl-definition">::= "FOR" "EACH" <iterator> "IN" <collection> ":" <directive>+
<while_loop> "hl-definition">::= "WHILE" <condition> ":" <directive>+
<try_catch> "hl-definition">::= "TRY" ":" <directive>+
"CATCH" <optional_exception_var> ":" <directive>+
<optional_exception_var> "hl-definition">::= <exception_var> "hl-operator">| ε
<exception_var> "hl-definition">::= <identifier>
<goto_statement> "hl-definition">::= "GOTO" <label_identifier>
<label_declaration> "hl-definition">::= <label_identifier> ":"
<label_identifier> "hl-definition">::= <identifier>
<flow_marker> "hl-definition">::= "START" <optional_label>
"hl-operator">| "LOOP" <optional_backto>
"hl-operator">| "END"
"hl-operator">| "STOP"
<optional_label> "hl-definition">::= <identifier> "hl-operator">| ε
<optional_backto> "hl-definition">::= ("BACKTO" <identifier>) "hl-operator">| ε

# Declaration Statement
<declaration_statement> "hl-definition">::= "SET" <variable_name> "=" <expression>
"hl-operator">| "DECLARE" <variable_name> ":" <type_annotation>
<type_annotation> "hl-definition">::= "string" "hl-operator">| "number" "hl-operator">| "boolean" "hl-operator">| "array" "hl-operator">| "object" "hl-operator">| "file" "hl-operator">| "context"

# Transform Statement
<transform_statement> "hl-definition">::= <backup_directive> <edit_directive> <optional_analyze_directive>
<backup_directive> "hl-definition">::= "BACKUP" <path> "TO" <backup_location>
"hl-operator">| "COPY" <path> "TO" <backup_location>
<edit_directive> "hl-definition">::= "WRITE" <path> <write_spec>
"hl-operator">| "EXECUTE" <edit_command> <path>
<edit_command> "hl-definition">::= <identifier>
<analyze_directive> "hl-definition">::= "ANALYZE" <verification_condition>
<optional_analyze_directive> "hl-definition">::= <analyze_directive> "hl-operator">| ε
<backup_location> "hl-definition">::= <path>
<edit_spec> "hl-definition">::= "WITH" <expression>
"hl-operator">| "USING" <template_name>
"hl-operator">| <string>
<write_spec> "hl-definition">::= "CONTENT" <string>
"hl-operator">| "FROM" <source_file>
"hl-operator">| "INTO" <destination>
"hl-operator">| <string>
<source_file> "hl-definition">::= <path>
<destination> "hl-definition">::= <path>
<verification_condition> "hl-definition">::= <condition>

# Discovery Statement
<discovery_statement> "hl-definition">::= <discovery_action> <optional_verification_check>
<discovery_action> "hl-definition">::= "GLOB" <pattern> <optional_scope>
"hl-operator">| "GREP" <search_pattern> <optional_search_scope>
"hl-operator">| "FIND" <search_term> "IN" <search_location>
<verification_check> "hl-definition">::= "IF" "exists" ":" <directive>+
"hl-operator">| "ANALYZE" <expression> <comparison_op> <expression>
<optional_verification_check> "hl-definition">::= <verification_check> "hl-operator">| ε
<optional_scope> "hl-definition">::= "IN" <scope> "hl-operator">| ε
<optional_search_scope> "hl-definition">::= "IN" <search_scope> "hl-operator">| ε
<scope> "hl-definition">::= <path>
<search_scope> "hl-definition">::= <path>
<search_location> "hl-definition">::= <path>
<search_pattern> "hl-definition">::= <string> "hl-operator">| <regex_literal>
<search_term> "hl-definition">::= <string>
<collection_var> "hl-definition">::= <variable_name>
```

Expression Rules

Grammar for **expressions**, operators, literals, and lexical elements.

```text
BNF Grammar105 lines# Expressions
<expression> "hl-definition">::= <pipeline_expr>
<pipeline_expr> "hl-definition">::= <logical_or_expr> ("">|>" <logical_or_expr>)*
<logical_or_expr> "hl-definition">::= <logical_and_expr> ("OR" <logical_and_expr>)*
<logical_and_expr> "hl-definition">::= <equality_expr> ("AND" <equality_expr>)*
<equality_expr> "hl-definition">::= <relational_expr> (("===" "hl-operator">| "!==") <relational_expr>)*
<relational_expr> "hl-definition">::= <additive_expr> (("<" "hl-operator">| ">" "hl-operator">| "<=" "hl-operator">| ">=") <additive_expr>)*
"hl-operator">| <additive_expr> "MATCHES" <pattern>
"hl-operator">| <additive_expr> "FOR" <expression>
"hl-operator">| <additive_expr> "BETWEEN" <expression>
<additive_expr> "hl-definition">::= <multiplicative_expr> (("+" "hl-operator">| "-") <multiplicative_expr>)*
<multiplicative_expr> "hl-definition">::= <unary_expr> (("*" "hl-operator">| "/" "hl-operator">| "%") <unary_expr>)*
<unary_expr> "hl-definition">::= ("!" "hl-operator">| "NOT" "hl-operator">| "-" "hl-operator">| "+") <postfix_expr>
"hl-operator">| <postfix_expr>
<postfix_expr> "hl-definition">::= <primary_expr> <postfix_op>*
<postfix_op> "hl-definition">::= "[" <expression> "]"
"hl-operator">| "." <identifier>
"hl-operator">| "(" <optional_arg_list> ")"
<primary_expr> "hl-definition">::= <array_literal>
"hl-operator">| <object_literal>
"hl-operator">| <literal>
"hl-operator">| <identifier>
"hl-operator">| "(" <expression> ")"
<array_literal> "hl-definition">::= "[" <optional_expression_list> "]"
<object_literal> "hl-definition">::= "{" <optional_key_value_pairs> "}"
<expression_list> "hl-definition">::= <expression> ("," <expression>)*
<optional_expression_list> "hl-definition">::= <expression_list> "hl-operator">| ε
<key_value_pair> "hl-definition">::= <object_key> ":" <expression>
<object_key> "hl-definition">::= <identifier> "hl-operator">| <string> "hl-operator">| <number>
<key_value_pairs> "hl-definition">::= <key_value_pair> ("," <key_value_pair>)*
<optional_key_value_pairs> "hl-definition">::= <key_value_pairs> "hl-operator">| ε
<function_call> "hl-definition">::= <function_name> "(" <optional_arg_list> ")"
<optional_arg_list> "hl-definition">::= <arg_list> "hl-operator">| ε
<condition> "hl-definition">::= <expression>
<boolean_expr> "hl-definition">::= <logical_or_expr>
<verification_expr> "hl-definition">::= <expression>
<term> "hl-definition">::= <multiplicative_expr>
<factor> "hl-definition">::= <primary_expr>
<pattern> "hl-definition">::= <string> "hl-operator">| <regex_literal>
<regex_literal> "hl-definition">::= "/" <regex_pattern> "/" <optional_regex_flags>
<optional_regex_flags> "hl-definition">::= <regex_flags> "hl-operator">| ε
<regex_pattern> "hl-definition">::= <any_regex_character>+
<regex_flags> "hl-definition">::= <letter>+
<comparison_op> "hl-definition">::= "===" "hl-operator">| "!==" "hl-operator">| "<" "hl-operator">| ">" "hl-operator">| "<=" "hl-operator">| ">="

# Lexical
<identifier> "hl-definition">::= <letter> (<letter> "hl-operator">| <digit> "hl-operator">| "_" "hl-operator">| "-")*
<variable_name> "hl-definition">::= <identifier>
<function_name> "hl-definition">::= <identifier>
<node_name> "hl-definition">::= <identifier>
<path> "hl-definition">::= <directory_path> "hl-operator">| <file_path>
<directory_path> "hl-definition">::= <path_segment> ("/" <path_segment>)* "/"
<file_path> "hl-definition">::= <path_segment> ("/" <path_segment>)* <optional_file_extension>
<path_segment> "hl-definition">::= <identifier>
<optional_file_extension> "hl-definition">::= ("." <identifier>) "hl-operator">| ε
<literal> "hl-definition">::= <number> "hl-operator">| <string> "hl-operator">| <boolean>
<number> "hl-definition">::= <digit>+ <optional_decimal>
<optional_decimal> "hl-definition">::= ("." <digit>+) "hl-operator">| ε
<string> "hl-definition">::= '"' <char>* '"' "hl-operator">| "'" <char>* "'"
<boolean> "hl-definition">::= "true" "hl-operator">| "false"
<digit> "hl-definition">::= "0" "hl-operator">| "1" "hl-operator">| "2" "hl-operator">| "3" "hl-operator">| "4" "hl-operator">| "5" "hl-operator">| "6" "hl-operator">| "7" "hl-operator">| "8" "hl-operator">| "9"
<letter> "hl-definition">::= "a".."z" "hl-operator">| "A".."Z"
<char> "hl-definition">::= <any_character>
<text> "hl-definition">::= <char>+
<yaml_content> "hl-definition">::= <text>
<any_character> "hl-definition">::= <letter> "hl-operator">| <digit> "hl-operator">| <whitespace> "hl-operator">| <symbol>
<symbol> "hl-definition">::= "_" "hl-operator">| "-" "hl-operator">| "." "hl-operator">| "," "hl-operator">| ":" "hl-operator">| ";" "hl-operator">| "!" "hl-operator">| "?" "hl-operator">| "@" "hl-operator">| "#" "hl-operator">| "$" "hl-operator">| "%" "hl-operator">| "^" "hl-operator">| "&" "hl-operator">| "*" "hl-operator">| "(" "hl-operator">| ")" "hl-operator">| "[" "hl-operator">| "]" "hl-operator">| "{" "hl-operator">| "}" "hl-operator">| "<" "hl-operator">| ">" "hl-operator">| "/" "hl-operator">| "\" "hl-operator">| "">|" "hl-operator">| "=" "hl-operator">| "+" "hl-operator">| "`" "hl-operator">| "~"
<any_regex_character> "hl-definition">::= <letter> "hl-operator">| <digit> "hl-operator">| <symbol>
<whitespace> "hl-definition">::= " " "hl-operator">| "	" "hl-operator">| "
" "hl-operator">| "
"

# Iteration Statement
<iteration_statement> "hl-definition">::= <loop_header> <loop_body>
<loop_header> "hl-definition">::= "FOR" "EACH" <iterator> "IN" <collection>
<loop_body> "hl-definition">::= ":" <directive>+ <optional_accumulation> <optional_recursion_limit>
<accumulation_statement> "hl-definition">::= "APPEND" <value> "TO" <accumulator>
"hl-operator">| "CREATE" <structure> "FROM" <iterator>
"hl-operator">| "EXTRACT" <components> "INTO" <structure>
"hl-operator">| "WRITE" <data> "INTO" <storage>
"hl-operator">| "COLLECT" <items> "INTO" <collection>
"hl-operator">| "SET" <state_var> "=" <state_expr>
<recursion_limit> "hl-definition">::= "MAX_DEPTH" "=" <number>
<optional_accumulation> "hl-definition">::= <accumulation_statement> "hl-operator">| ε
<optional_recursion_limit> "hl-definition">::= <recursion_limit> "hl-operator">| ε
<iterator> "hl-definition">::= <variable_name>
<collection> "hl-definition">::= <variable_name> "hl-operator">| <expression>
<value> "hl-definition">::= <expression>
<accumulator> "hl-definition">::= <variable_name>
<structure> "hl-definition">::= <variable_name>
<components> "hl-definition">::= <expression>
<data> "hl-definition">::= <expression>
<items> "hl-definition">::= <expression>
<storage> "hl-definition">::= <variable_name>
<state_var> "hl-definition">::= <variable_name>
<state_expr> "hl-definition">::= <expression>

# Function Declaration
<function_declaration> "hl-definition">::= "FUNCTION" <function_name> "(" <optional_param_list> ")" ":" <directive>+
<optional_param_list> "hl-definition">::= <param_list> "hl-operator">| ε
<param_list> "hl-definition">::= <parameter> ("," <parameter>)*
<parameter> "hl-definition">::= <variable_name>

# Announcement Statement
<announcement_statement> "hl-definition">::= "REPORT" <message>
<message> "hl-definition">::= <string> "hl-operator">| <expression>
```

Coordination Rules

Grammar for **async operations**, state machines, DAGs, and tool invocations.

```text
BNF Grammar120 lines# Await
<await_statement> "hl-definition">::= "AWAIT" <awaitable_expression> <optional_result_binding>
<awaitable_expression> "hl-definition">::= <identifier> "hl-operator">| <string> "hl-operator">| <tool_invocation>
<optional_result_binding> "hl-definition">::= "INTO" <identifier> "hl-operator">| ε

# Parallel
<parallel_block> "hl-definition">::= "PARALLEL" ":" <directive>+ "END"

# State Machine
<state_machine_declaration> "hl-definition">::= "STATE_MACHINE" <machine_name> ":" <state_definition>+ <transition_definition>+
<state_definition> "hl-definition">::= "STATE" <state_name> <optional_state_type>
<optional_entry_actions>
<optional_exit_actions>
<transition_definition> "hl-definition">::= "TRANSITION" "FROM" <state_name> "TO" <state_name>
"ON" <event_name>
<optional_guard>
<optional_transition_actions>
<optional_state_type> "hl-definition">::= ":" <state_type> "hl-operator">| ε
<optional_entry_actions> "hl-definition">::= "ENTRY" ":" <directive>+ "hl-operator">| ε
<optional_exit_actions> "hl-definition">::= "EXIT" ":" <directive>+ "hl-operator">| ε
<optional_guard> "hl-definition">::= "GUARD" ":" <condition> "hl-operator">| ε
<optional_transition_actions> "hl-definition">::= ":" <directive>+ "hl-operator">| ε
<machine_name> "hl-definition">::= <variable_name>
<state_name> "hl-definition">::= <variable_name>
<state_type> "hl-definition">::= <identifier>
<event_name> "hl-definition">::= <variable_name>

# DAG
<dag_declaration> "hl-definition">::= "DAG" <dag_name> ":" <dag_item>+ <optional_validation_gate>
<dag_item> "hl-definition">::= <node_definition> "hl-operator">| <parallel_group>
<node_definition> "hl-definition">::= "NODE" <node_name> <optional_node_type>
<optional_depends_on>
<optional_after>
<optional_before>
":" <directive>+
<parallel_group> "hl-definition">::= "PARALLEL_GROUP" ":" <node_name_list>
<dependency_list> "hl-definition">::= <node_name> ("," <node_name>)*
<dependent_list> "hl-definition">::= <node_name> ("," <node_name>)*
<node_name_list> "hl-definition">::= <node_name> ("," <node_name>)*
<optional_validation_gate> "hl-definition">::= <validation_gate> "hl-operator">| ε
<optional_node_type> "hl-definition">::= ":" <node_type> "hl-operator">| ε
<optional_depends_on> "hl-definition">::= "DEPENDS_ON" <dependency_list> "hl-operator">| ε
<optional_after> "hl-definition">::= "AFTER" <dependency_list> "hl-operator">| ε
<optional_before> "hl-definition">::= "BEFORE" <dependent_list> "hl-operator">| ε
<dag_name> "hl-definition">::= <variable_name>
<node_type> "hl-definition">::= <identifier>

# Priority Queue
<priority_queue_declaration> "hl-definition">::= "PRIORITY_QUEUE" <queue_name>
<optional_comparison>
":"
<priority_queue_operation> "hl-definition">::= <enqueue_statement>
"hl-operator">| <dequeue_statement>
"hl-operator">| <peek_statement>
"hl-operator">| <heapify_statement>
<enqueue_statement> "hl-definition">::= "ENQUEUE" <value> "TO" <queue_name>
<optional_priority>
<dequeue_statement> "hl-definition">::= "DEQUEUE" "FROM" <queue_name>
<optional_target>
<peek_statement> "hl-definition">::= "PEEK" <queue_name>
<optional_target>
<heapify_statement> "hl-definition">::= "HEAPIFY" <queue_name>
<comparison_function> "hl-definition">::= <function_name>
"hl-operator">| "(" <optional_param_list> ")" "→" <expression>
<optional_comparison> "hl-definition">::= "COMPARE_BY" <comparison_function> "hl-operator">| ε
<optional_priority> "hl-definition">::= "PRIORITY" "=" <priority_value> "hl-operator">| ε
<optional_target> "hl-definition">::= "TO" <target_variable> "hl-operator">| ε
<queue_name> "hl-definition">::= <variable_name>
<priority_value> "hl-definition">::= <number> "hl-operator">| <expression>
<target_variable> "hl-definition">::= <variable_name>

# Cross Reference
<cross_reference_statement> "hl-definition">::= <collect_from_statement>
"hl-operator">| <find_in_statement>
"hl-operator">| <reference_statement>
"hl-operator">| <link_statement>
<collect_from_statement> "hl-definition">::= "FROM" <file_path_pattern> "COLLECT" <selector> "TO" <target_variable>
<find_in_statement> "hl-definition">::= "FROM" <file_path_pattern> "FIND" <search_term> "TO" <target_variable>
<reference_statement> "hl-definition">::= "REFERENCE" <file_path_pattern> <optional_alias>
<link_statement> "hl-definition">::= "LINK" <source_expression> "TO" <file_reference>
<file_path_pattern> "hl-definition">::= <string> "hl-operator">| <glob_pattern>
<glob_pattern> "hl-definition">::= <string>
<file_reference> "hl-definition">::= <string> <optional_anchor>
<optional_anchor> "hl-definition">::= "#" <identifier> "hl-operator">| ε
<selector> "hl-definition">::= <expression> "hl-operator">| "*"
<search_term> "hl-definition">::= <string> "hl-operator">| <regex_literal>
<target_variable> "hl-definition">::= <variable_name>
<source_expression> "hl-definition">::= <expression>
<alias> "hl-definition">::= <identifier>
<optional_alias> "hl-definition">::= "AS" <alias> "hl-operator">| ε

# Tool Invocation
<tool_invocation> "hl-definition">::= <tool_verb> <tool_target> <optional_tool_param_clause> <optional_tool_result_clause>
<tool_verb> "hl-definition">::= "READ" "hl-operator">| "WRITE" "hl-operator">| "EDIT" "hl-operator">| "GLOB" "hl-operator">| "GREP"
"hl-operator">| "BASH" "hl-operator">| "BASH_OUTPUT" "hl-operator">| "KILL_SHELL"
"hl-operator">| "TASK" "hl-operator">| "TODO_WRITE" "hl-operator">| "ASK_USER"
"hl-operator">| "WEB_FETCH" "hl-operator">| "WEB_SEARCH"
"hl-operator">| "NOTEBOOK_EDIT"
"hl-operator">| "SKILL" "hl-operator">| "SLASH_COMMAND"
"hl-operator">| "MCP_EXECUTE"
<tool_target> "hl-definition">::= <string> "hl-operator">| <identifier> "hl-operator">| <file_path> "hl-operator">| <expression>
<optional_tool_param_clause> "hl-definition">::= <tool_param_clause> "hl-operator">| ε
<tool_param_clause> "hl-definition">::= "WITH" <tool_param_list>
"hl-operator">| "USING" <tool_param_list>
<tool_param_list> "hl-definition">::= <tool_param_pair> ("," <tool_param_pair>)*
<tool_param_pair> "hl-definition">::= <tool_param_name> ":" <tool_param_value>
"hl-operator">| <tool_param_name> "=" <tool_param_value>
"hl-operator">| <tool_param_name>
<tool_param_name> "hl-definition">::= <identifier>
<tool_param_value> "hl-definition">::= <string>
"hl-operator">| <number>
"hl-operator">| <boolean>
"hl-operator">| <identifier>
"hl-operator">| <array_literal>
"hl-operator">| <object_literal>
<optional_tool_result_clause> "hl-definition">::= <tool_result_clause> "hl-operator">| ε
<tool_result_clause> "hl-definition">::= "->" <tool_result_binding>
"hl-operator">| "INTO" <tool_result_binding>
"hl-operator">| "AS" <tool_result_binding>
<tool_result_binding> "hl-definition">::= <identifier>
```

Flowchart Rules

Grammar for **visual flow definitions**in various formats.

```text
BNF Grammar105 lines# Flowchart
<flowchart_declaration> "hl-definition">::= "FLOWCHART" <flowchart_name> <optional_flowchart_state> <optional_flowchart_layout> ":" <flowchart_body>
<optional_flowchart_layout> "hl-definition">::= "LAYOUT" <flowchart_layout> "hl-operator">| ε
<flowchart_body> "hl-definition">::= <flowchart_line>+ <optional_error_handler>
<optional_error_handler> "hl-definition">::= <error_handler> "hl-operator">| ε
<error_handler> "hl-definition">::= "ON" "ERROR" ":" <directive>+
<flowchart_line> "hl-definition">::= <flowchart_node>
"hl-operator">| <flowchart_edge>
"hl-operator">| <flowchart_branch>
"hl-operator">| <flowchart_merge>
"hl-operator">| <flowchart_loop>
<flowchart_node> "hl-definition">::= <node_label> <node_shape> <optional_shape_type> <optional_node_content>
<node_label> "hl-definition">::= <identifier> "hl-operator">| <string>
<node_shape> "hl-definition">::= "[" <text> "]"
"hl-operator">| "(" <text> ")"
"hl-operator">| "{" <text> "}"
"hl-operator">| "<" <text> ">"
"hl-operator">| "((" <text> "))"
"hl-operator">| "[[" <text> "]]"
<optional_shape_type> "hl-definition">::= ":" <flowchart_shape_types> "hl-operator">| ε
<optional_node_content> "hl-definition">::= <node_content> "hl-operator">| ε
<node_content> "hl-definition">::= ":" <node_block>
<node_block> "hl-definition">::= <directive>+
"hl-operator">| "EVALUATE" <condition>
"hl-operator">| "EXECUTE" <function_call>
"hl-operator">| "TRY" ":" <directive>+ "CATCH" ":" <directive>+
<optional_flowchart_state> "hl-definition">::= "WITH" "STATE" <state_declaration>+ "hl-operator">| ε
<state_declaration> "hl-definition">::= <variable_name> ":" <type_annotation> "=" <expression>
<flowchart_edge> "hl-definition">::= <edge_source> <edge_arrow> <edge_target> <optional_edge_label>
<edge_source> "hl-definition">::= <identifier>
<edge_target> "hl-definition">::= <identifier>
<edge_arrow> "hl-definition">::= "→" "hl-operator">| "↓" "hl-operator">| "↑" "hl-operator">| "←" "hl-operator">| "↔"
"hl-operator">| "-->" "hl-operator">| "--->" "hl-operator">| "==>" "hl-operator">| "-.->>"
"hl-operator">| "">|"
<optional_edge_label> "hl-definition">::= ":" <string> "hl-operator">| ε
<flowchart_branch> "hl-definition">::= <branch_source> "/" <branch_option>+
<branch_source> "hl-definition">::= <identifier>
<branch_option> "hl-definition">::= <branch_condition> "→" <branch_target>
<branch_condition> "hl-definition">::= <condition> "hl-operator">| <string>
<branch_target> "hl-definition">::= <identifier>
<flowchart_merge> "hl-definition">::= <merge_source>+ "◄" <merge_target>
<merge_source> "hl-definition">::= <identifier>
<merge_target> "hl-definition">::= <identifier>
<flowchart_loop> "hl-definition">::= "LOOP" <loop_source> "→" <loop_target> <optional_loop_limit>
<loop_source> "hl-definition">::= <identifier>
<loop_target> "hl-definition">::= <identifier>
<optional_loop_limit> "hl-definition">::= "MAX" <number> "hl-operator">| ε
<flowchart_shape_types> "hl-definition">::= "process"
"hl-operator">| "decision"
"hl-operator">| "start_end"
"hl-operator">| "input_output"
"hl-operator">| "subprocess"
"hl-operator">| "database"
<flowchart_layout> "hl-definition">::= "vertical" "hl-operator">| "horizontal" "hl-operator">| "lr" "hl-operator">| "rl" "hl-operator">| "tb" "hl-operator">| "bt"
<flowchart_name> "hl-definition">::= <variable_name>

# ASCII Flowchart
<ascii_flowchart_block> "hl-definition">::= <ascii_flowchart_line>+
<ascii_flowchart_line> "hl-definition">::= <ascii_node_line>
"hl-operator">| <ascii_connector_line>
"hl-operator">| <ascii_branch_line>
"hl-operator">| <ascii_merge_line>
<ascii_node_line> "hl-definition">::= <indent> <ascii_node>
<ascii_node> "hl-definition">::= "[" <text> "]"
"hl-operator">| "(" <text> ")"
"hl-operator">| "{" <text> "}"
"hl-operator">| "<" <text> ">"
<ascii_connector_line> "hl-definition">::= <indent> "">|"
"hl-operator">| <indent> "│"
"hl-operator">| <indent> "▼"
"hl-operator">| <indent> "▲"
"hl-operator">| <indent> "►"
"hl-operator">| <indent> "◄"
<ascii_branch_line> "hl-definition">::= <indent> "/" <indent> "\"
"hl-operator">| <indent> "▼" <indent> "▼"
<ascii_merge_line> "hl-definition">::= <indent> "\" <indent> "/"
"hl-operator">| <indent> "◄" "─" "┘"
<indent> "hl-definition">::= <whitespace>*

# Mermaid Flowchart
<mermaid_declaration> "hl-definition">::= "MERMAID" <mermaid_type> ":" <mermaid_body>
<mermaid_type> "hl-definition">::= "flowchart" "hl-operator">| "graph" "hl-operator">| "sequence" "hl-operator">| "class" "hl-operator">| "state" "hl-operator">| "er"
<mermaid_body> "hl-definition">::= <mermaid_line>+
<mermaid_line> "hl-definition">::= <mermaid_node_def>
"hl-operator">| <mermaid_connection>
"hl-operator">| <mermaid_subgraph>
"hl-operator">| <mermaid_style>
<mermaid_node_def> "hl-definition">::= <node_id> <mermaid_node_shape> <optional_node_text>
<node_id> "hl-definition">::= <identifier>
<mermaid_node_shape> "hl-definition">::= "[" <text> "]"
"hl-operator">| "(" <text> ")"
"hl-operator">| "{" <text> "}"
"hl-operator">| "((" <text> "))"
"hl-operator">| "[[" <text> "]]"
"hl-operator">| "[/" <text> "/]"
"hl-operator">| "[\" <text> "\]"
<optional_node_text> "hl-definition">::= <text> "hl-operator">| ε
<mermaid_connection> "hl-definition">::= <node_id> <mermaid_arrow> <node_id> <optional_connection_text>
<mermaid_arrow> "hl-definition">::= "-->" "hl-operator">| "--->" "hl-operator">| "==>" "hl-operator">| "-.->" "hl-operator">| "--"
<optional_connection_text> "hl-definition">::= "">|" <text> "">|" "hl-operator">| ε
<mermaid_subgraph> "hl-definition">::= "subgraph" <subgraph_title> <mermaid_line>+ "end"
<subgraph_title> "hl-definition">::= <string>
<mermaid_style> "hl-definition">::= "style" <node_id> <style_properties>
<style_properties> "hl-definition">::= <style_property> ("," <style_property>)*
<style_property> "hl-definition">::= <identifier> ":" <string>
```
