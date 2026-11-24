---
name: reasoning-templates
description: Execute the PAG reasoning protocols in .claude/templates/ when producing a plan, checklist, task breakdown, workflow, agent, or verification flow. Mandatory in plan mode - draft, then compare against the checklist template, then restructure. Use before writing any structured construct, not after.
---

# reasoning-templates

The templates in `.claude/templates/` are **executable protocols for reasoning**, not reference
docs. Producing a structured construct means walking the template's ten-node loop as stated.

Full rule: `.claude/rules/template.rule.md`.

## Which template

The dispatch key is each template's LAYER 0 genesis question.

| producing | template |
|---|---|
| plan, checklist, task breakdown | `checklist` |
| verdict on claims, audit, context check | `claim` |
| shared abstraction from repeated evidence | `pattern` |
| reusable specialised investigator | `agent` |
| a template from an executed document | `layer` |

## Plan mode — three steps, never one

1. **Draft** the plan from the task.
2. **Read `checklist`** and compare the draft to it node by node, gate by gate.
3. **Restructure** the plan to what the template enforces.

Step 3 is never skipped on the grounds that the draft already covers it. The draft is raw material;
the template is the authority.

## What the restructure adds

An ordinary plan lacks all of these:

- **Worth before work** — the branch is `argmax(utility − cost)` over admissible branches, with the
  ranking shown. Not the first workable idea.
- **Topology ordering** — dependency-topological then genesis. Severity routes failure; it never
  groups or orders phases.
- **Genesis consistency** — no phase depends on a later-genesis output than it produces. Such an
  inversion is a decomposition defect, not a tie to break.
- **Four dependency axes** per phase — sequential, lateral, diagonal, propagation.
- **Ripple chains** — affected entities carried as **names, never counts**. An empty dimension
  carries its applicability evidence rather than being omitted.
- **Evidence contracts** — every material claim carries evidence, a named refuter, and confidence at
  or above threshold. "No contradiction found" is not support.
- **Gate separation** — generation-time gates resolve during planning; future execution gates ship
  **unchecked**.
- **Explicit termination** — saturation AND completion AND verification. A self-assessed "done" does
  not terminate.

## The four gates always run

`tel-priority` · `constrain` · `ver-stop` · `ter-stop`. The epistemic axes are selectable; these are
not. A gate naming no evidence is ceremony and fails.

## Execution discipline

**Follow as stated.** Node order, contracts, typed decisions and invariants are not condensed or
partially applied.

**Mechanism transfers, catalogs re-derive.** The loop, typing and gates are domain-neutral. Where a
template's catalog assumes a construct this tree does not carry — a class hierarchy, a migration
surface, a build step, a registry — re-derive that catalog against the constructs that ARE here, and
where the slot naming one resolves ABSENT, do not run its branch. Substituting the mechanism is the
violation; re-deriving a catalog is the work. **An example catalog is the half a token sweep cannot
see**, so it is found by reading the protocol whole rather than by searching it.

**Executed only.** A descriptive artifact — reference, spec, contract, note — is not full-shaped.
Forcing the loop onto it is the Procrustean failure.

**Never consolidate the templates.** Each inlines the full structure so it stays independently
executable. This is the deliberate exception to the duplication rule.

**Attribution survives.** These are third-party IP under CC BY-SA. Never strip, move, or reword an
attribution line.
