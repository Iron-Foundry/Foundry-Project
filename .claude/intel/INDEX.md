<!-- PAG intel index: the reasoning/authoring corpus behind this repo's Claude setup. Consult before writing or editing any PAG document (POLICY, template, or agent spec); load the specific file only when its domain is active. PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA. -->

# PAG Intel Index

The canonical PAG expression of this repo's rules lives at `.claude/rules/behavioral.md` and `.claude/rules/testing.md`. This directory holds the grammar, authoring guides, and reusable templates those documents are built from.

## Language reference (read before authoring PAG)
- `reference_pag_grammar.md` — formal PAG grammar: meta block, structure, operators, block forms. The spec.
- `reference_pag_keywords.md` — canonical PAG verb/keyword vocabulary (READ/WRITE/VALIDATE/ENFORCE...) with usage forms.
- `reference_pag_guide.md` — how to author a PAG document end to end: clarify purpose, choose structure, write the phases.

## Method / rules
- `process_layered_reasoning_composition.md` — the layered-reasoning composition process: core thesis + how to compose a multi-layer reasoning document.
- `reference_development_rules.md` — development-rules corpus (structural-enforcement directives + clarifications).
- `reference_claude_agents_frontmatter.md` — Claude agent frontmatter / tool-value reference for authoring agent specs.

## Templates (copy + fill for a new PAG document)
- `template_agent_creation.md` — author a new task-specific agent spec.
- `template_agent_audit.md` — audit an existing agent against registries + governance.
- `template_workflow_creation.md` — classify an objective and build a workflow document set.
- `template_checklist_creation.md` — establish authority/trust/intent, then build a checklist.
- `template_debugging.md` — reversible-baseline debugging protocol.
- `template_forensic_context_verification.md` — verify context claims against implementation evidence.
- `template_pattern_distillation.md` — measure a baseline and distill a reusable pattern.

<!-- append below: <file> -> <one-line hook> as you add intel documents -->
