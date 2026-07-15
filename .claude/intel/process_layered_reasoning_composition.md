---
name: layered-reasoning-composition
description: Claude-facing method manual — how to restructure any document or prompt onto the six-layer reasoning model and convert it into an executable template, and how to embed that structure implicitly. Read this before converting a doc/prompt or embedding the layered shape. For Claude's own consumption.
type: reference
domain: [ai-governance, process]
keywords: [layered-reasoning, six-layers, template-conversion, evidence-gate, contract, embodiment, structural-signature, adapter, fence]
owner: BanesLab
created: 2026-07-15
last-verified: 2026-07-15
version: 1
staleness-days: -1
max-lines: 450
depends-on: [note-on-ai-reasoning-in-layers.md]
supersedes:
---

Read this whenever asked to (a) convert a document or prompt into an executable `template_*`, or (b) embed the six-layer reasoning structure into a doc/prompt implicitly (by composition, never by naming it). The layering model below is embedded in full — do not need to open the note.

---

## 0. The core thesis (why any of this matters)

A rule is only as strong as the **layer it is attached to**. A principle merely *present* in context influences framing but controls nothing; the same principle placed inside the layer that owns the next transformation becomes enforceable because it participates in a real control loop: `input → classification → action → check → correction → termination`. So context is not a flat list of instructions — it is a **layered program**. The design move, every time: **place each rule at the abstraction layer where its decision is made, and express it as that layer's start-to-end control procedure.** "Be rigorous" at the top is weak; "for every claim, verify freshness and reject the unsupported" *inside the evaluation layer* is strong because it has executable consequences.

## 1. The six reasoning layers (roles, not a fixed count)

1. **Interpretive** — *what the situation means.* Framing, definitions, priorities, what is trusted vs untrusted, the intent and its **direction** (introduce / retain / remove / analyze / mention).
2. **Planning** — *goals into ordered subgoals.* Decomposition, dependency sequencing, resource allocation.
3. **Procedural** — *the algorithm for carrying out a step.* Principles here become execution constraints.
4. **Evaluation** — *does the result satisfy the goal.* Tests, thresholds, rubrics — the checks with teeth.
5. **Recovery** — *what happens when a check fails.* Retry, escalate, revert, refuse — bounded.
6. **Termination** — *when the process is complete.* Prevents premature stop AND endless iteration.

These are **roles**. A source doc may realize them across a different number of *stages*: one role can split across stages (two procedural stages — e.g. TRACE then FIX), or fold (audit's measure+score in one). A doc with its own control flow gets its own stage set, but **every stage still carries the five-part contract + one evidence-bearing gate.** Observed stage counts so far: 4 (translation-audit), 5 (agent-audit), 6 (checklist/workflow/forensic/distillation), 7 (agent-creation), 8 (debugging). Count follows the source's real control flow — never padded to six.

## 2. The per-stage contract (five parts) + the gate

Every stage declares:
- **input** — what it consumes (only the prior stage's output contract).
- **transformation** — the rule that turns input into output.
- **constraint set** — the invariants that bind the transformation, stated *at the step*.
- **output contract** — the typed record it emits (the ONLY thing downstream reads).
- **handoff condition** — the single evidence-bearing gate that authorizes the next stage.

The **gate** carries: `rule_id`, one or more `[check … (evidence: …)]` lines that name what was examined, and a `result: pass -> STAGE N+1 | <fail> -> STAGE M (owner: <layer>)`. Gates may **fail backward** to the earliest stage that can supply the missing evidence (debug's gates do this). No gate passes without naming its evidence — a checkmark with no evidence is ceremony, which is the interpretive-pretending-to-be-evaluation smell.

## 3. The structural signature (implicit embodiment — the six tells)

To embed the shape WITHOUT naming it, a doc/prompt must, in order:
1. **Frame before it acts** — fix meaning/trust/intent first, don't jump to steps.
2. **Order by dependency** — sequenced subgoals, each precondition met above it; never a flat pile, never grouped by priority/severity.
3. **Constrain at the step** — how it's done + the invariants, right there, not hoisted to the top.
4. **Gate with evidence** — each unit ends in a pass/fail that names what it checked.
5. **Name the failure path** — say what happens on failure (fix/escalate/refuse), don't only imply wrongness.
6. **Declare done** — an explicit completion, with a bound if it loops.

Plus the two composition rules and the silence rule:
- each unit is `input → transformation → constraints → output → handoff`, chaining on output contracts;
- every rule lives where its decision is made (relocate, don't centralize);
- **never narrate the structure itself** (no "%% MODEL %%", no "this follows the six-layer model"). Naming it is annotation.

## 4. The pipeline (mandatory middle step)

`source file → restructure onto the six layers (explicit pre-step) → template_* artifact`. Never jump file→template — the layered restructure is where the real correctness fixes happen; skipping it just re-skins a flat doc. When doing this interactively, **show the layer mapping first** (a table: note-layer → owning stage(s)), then produce the template.

## 5. Discrimination — do NOT full-shape everything

- **Executed** docs (the AI or a human *runs* them: prompts, agent specs, generators, checklists, protocols, runbooks) → full six-tell shape.
- **Descriptive** docs (read to *understand*: references, specs, contracts, notes) → only tells #1 (frame-first) + #3 (constrain-in-place). Forcing gates/recovery/termination onto a doc with no control flow is the Procrustean failure the note warns against.

## 6. How to map ANY context onto the layers (the procedure)

1. **Read the source fully; verify its load-bearing claims** (claims_are_lies — never restructure on assumption).
2. **Enumerate its content units** — phases, rules, data tables, gates, the ALWAYS/NEVER tail.
3. **For each unit ask: "which decision does this govern?"** and assign it to the owning layer. A unit that frames → Interpretive; that decides structure/order → Planning; that executes a step → Procedural; that judges an outcome → Evaluation; that handles a failure → Recovery; that ends/reports → Termination.
4. **Look for these relocations (the actual fixes):**
   - lexical / substring bans → **semantic rubric at Evaluation** (key on the *relation* to a controlled concept, so "remove the word, keep the design" fails).
   - scattered / bolted-on failure handling → a **real Recovery stage**.
   - severity/priority used as a section grouping → **Recovery failure-routing** (severity decides block/disposition/investigate), never the ordering axis.
   - ambient "priming" prose (priority stacks, trust anchors) → an **Interpretive output contract** downstream stages read.
   - boolean checkmark `VALIDATION GATE`s → **evidence-bearing gates**.
   - missing/implicit completion → **explicit Termination** with a bound.
5. **Name stages operationally** by what they DO (matching the layer role), and keep the internal `owner:` tokens consistent with the stage names: ORIENTATION · PLANNING/DESIGN/SELECTION · COMPILATION/COMPOSITION/MIGRATION/TRACE/FIX · VALIDATION/ADJUDICATION/AUDIT/VERIFICATION · REPAIR/RECOVERY/CORRECTION/REMEDIATION · RENDERING/REPORTING/TERMINATION/SIGN-OFF.

## 7. Mechanics of the template_* artifact

- **Location/name:** `.claude/intel/template_<subject>.md`, underscores (matches `reference_`/`draft_` convention). `.claude/**` is harness-owned — exempt from doc-arch doc-name/doc-location gates.
- **Frontmatter:** `type: template`; `domain`, `keywords`, `owner`, `created`/`last-verified`, `version: 1`, `depends-on: [reference_development_rules.md]` (operational deps only). Write an operational `description` (what it produces + how to run), **no** model-narration.
- **Strip:** harness frontmatter (`model`/`color`/`initialPrompt`/`effort`/`permissionMode`), any meta-narration of the structure, and all history/archeology (overwrite_dont_annotate, feedback_docs_no_comparative_history_framing — no "was X now Y", no "WHAT CHANGED", no changelog).
- **Keep:** the PAG attribution blockquote if the source has one (legal, goes right under the frontmatter, OUTSIDE the fence); the `SEMANTIC OPERATION BOUNDARY` / runtime-adapter note (operational — it makes the core runtime-neutral); parameterize every host literal to `{project.*}` / `{convention.*}` / `{limits.*}` / `{model}`.
- **FENCE the executable body** in a code fence — the on-write formatter treats unfenced pseudocode as prose and will flatten all indentation and mangle `*`/`_` (turning `**/*x*` into `**/_x_`, `-\*`, etc.). Use ```` ```text ```` (the formatter may rewrite it to ```` ```py ````; both are safe — prettier formats neither). Frontmatter + the PAG line stay outside the fence.
- **Inside the fence:** `%% META %%` (priority/trust/objective/[stance]) → the adapter/boundary note → a one-line "each stage declares its contract; reads only prior output" → the stages → `CROSS-STAGE INVARIANTS` (ALWAYS/NEVER distilled from the source's rules).
- **Avoid bare `*` runs even inside the fence** for safety: write globs/greps as `glob("**", "*name*.ext")` / `grep("class .*<name>")` call-forms, not raw `**/*name*`. Use comment-banner stage headers (`# ==== / # STAGE N — NAME (role)`), not markdown `#` headings (they're structural text inside a fence anyway).

Per-stage skeleton (inside the fence):

```text
# ============================================================================
# STAGE N — NAME  (role: what the situation means / ... / when complete)
# ============================================================================
@purpose: "one line"
@cue: "SHORT_IMPERATIVE"

CONTRACT:
  input:        <prior stage's output contract>
  transform:    <a -> b -> c>
  constraints:  <invariants bound here>
  output:       <typed record { ... }>
  handoff:      <the single condition that authorizes the next stage>

<functions / data / SET-DECLARE body>

HANDOFF GATE (evidence-bearing):
  rule_id: "NAME"
  [check] <what> (evidence: <where>)
  result: pass -> STAGE N+1 | <fail> -> STAGE M (owner: <layer>)
```

## 8. Standing rules for the operation

- **Keep originals in place** unless explicitly told to replace; create the `template_*` beside them.
- **Repoint references only when instructed** — then grep the whole repo for the old name, update every *live* reference, and leave the superseded original's internal self-references with it. A fully-orphaned original is a deletion candidate (no-internal-legacy) but delete only on the user's say-so.
- **Harness frontmatter dropped ⇒ the template is the runtime-neutral core, not a drop-in agent replacement.** Say so when reporting.
- Watch for **duplicate copies** (e.g. `.claude/agents/generalised/`) — convert one, dedup first.

## 9. Exemplars on disk (reference shapes, varying stage counts)

`template_checklist_creation` (6) · `template_workflow_creation` (6) · `template_forensic_context_verification` (6) · `template_agent_creation` (7) · `template_agent_audit` (5) · `template_pattern_distillation` (6) · `template_translation_audit` (4) · `template_debugging` (8). When in doubt about shape, read the nearest-analogous one.

## Precedence

`CLAUDE.md` > `note-on-ai-reasoning-in-layers.md` (canon) > this manual > the exemplar templates on disk > memory.
