# Reasoning templates

The templates in `.claude/templates/` are **protocols for my reasoning**, executed when producing a
structured construct. They are not reference material and are not optional.

## `templates_are_executed` (LOCKED)

A template is a program. Producing a plan, checklist, task set, workflow, agent, or verification
flow means **walking its ten-node loop as stated** and emitting the artifact the loop terminates on.

Reading a template and writing something template-shaped is not execution. Skimming it for ideas is
not execution. The nodes, their contracts, their gates, and their order are the procedure.

## `recurring_shape_is_a_template` (LOCKED)

**IF A SHAPE RECURS, IT IS A TEMPLATE.** A second instance of an artifact shape is the trigger, not a
signal to watch: the template is authored BEFORE that second instance is written, and every later instance
is RAISED from it rather than derived, copied or recalled.

### Why

**A shape with no template is re-derived by whoever needs it next, and each derivation is locally
reasonable.** The author reads a sibling, infers the contract from what that sibling happens to contain, and
produces something close enough that nothing objects — so the drift is invisible at every step and the
divergence is discovered only when a check derives its contract from one of them.

**Measured, twice, and the second time by the party that holds the template tree.** Four parties produced
four formats for one surface from four sources, on a rule every one of them broke identically, with the
contract one directory away and unread — which is a DELIVERY failure rather than four lapses. Then a planning
surface was authored by reading a sibling planning surface, because no template for that shape existed; the
contract came out close and the derivation was the defect, since a sibling carries one instance's choices
and a template carries the constraint.

**The control is the surface whose shape nobody has ever invented.** Where a template IS delivered and a form
renders it, no party has produced a divergent instance — so the discriminator is delivery rather than care.

### How to apply it

1. **The second instance is the trigger.** One instance is an artifact; two is a shape, and the second is
   authored from a template or it is authored twice.
2. **The template carries the CONTRACT and never one instance's content.** Its declared vocabularies — the
   axes, the dimensions, the gates, the field set — are what a check reads, so the check derives from the
   template rather than transcribing it and the two cannot drift.
3. **A raise form renders it.** A template that must be copied by hand is a template whose next instance is
   still derived; the form is what makes raising cheaper than recalling.
4. **A raised surface's contract block is FROZEN.** A correction lands in the template and reaches every
   later instance, never in the instance where only its author will see it.

### What it does not license

**It is not a reason to template a one-off.** A shape that has occurred once has no evidence of recurrence,
and a template raised from a single instance encodes that instance's accidents as a contract. The trigger is
the second instance, which is also the first moment the invariant part is distinguishable from the incidental
part.

## `template_selector_is_genesis`

Each template's LAYER 0 asks a distinct "how does X come to be?". That question is the dispatch key.

| producing | template | genesis |
|---|---|---|
| a plan, checklist, task breakdown | `checklist` | how does anything come to be? |
| a verdict on claims, an audit, a context check | `claim` | how does a verdict come to be? |
| a shared abstraction from repeated evidence | `pattern` | how does a base come to be? |
| a reusable specialised investigator | `agent` | how does the agent come to be? |
| a template from an executed document | `layer` | how does the template come to be? |

When two could apply, the artifact being terminated on decides. When none applies, say so rather
than forcing one.

## `plan_is_drafted_then_restructured` (LOCKED)

Planning is a three-step sequence, never one step:

1. **Draft.** Write the first plan from the task.
2. **Compare.** Read `checklist` and compare the draft against it — node by node, gate by gate.
3. **Restructure.** Rewrite the plan to what the template enforces. The template is the authority;
   the draft is raw material.

The restructure is not cosmetic. It adds what an ordinary plan lacks and cannot be skipped because
the draft "already covers it":

- worth-before-work — the selected branch is `argmax(utility − cost)` over *admissible* branches,
  with the ranking shown, not the first workable idea
- topology ordering — dependency-topological **then** genesis
- genesis consistency — a phase never depends on a later-genesis output than it produces
- the four dependency axes — sequential, lateral, diagonal, propagation — present per phase
- evidence contracts — every material claim carries its evidence, a named refuter, and a confidence
  at or above threshold; "no contradiction found" is not support
- explicit termination — done means saturation AND completion AND verification, never self-assessed

## `follow_template_as_stated`

The template is executed as written. Its node order, mandatory gates, typed decisions, contracts and
invariants are not adapted to taste, condensed for brevity, or partially applied.

## `mechanism_transfers_catalogs_rederive`

Where a template's vocabulary does not fit the tree it runs in, the **mechanism transfers and the
catalog is re-derived** — the loop, the typing and the gates are domain-neutral, while a principle or
pattern catalog is re-resolved against the constructs that actually exist. Where the slot naming a
construct resolves ABSENT, the branch reading it does not run rather than being re-pointed at the
nearest thing available. Substituting the mechanism is the violation; re-deriving a catalog is the work.

**An example catalog is the half no token scan reaches**, so it is found by reading a protocol whole:
its loop can be perfectly domain-neutral while its examples assume a construct the tree does not carry.

## `four_gates_always_run`

`tel-priority` (worth), `constrain` (admissibility after realisation), `ver-stop` (evidence), and
`ter-stop` (termination) run on every execution. The selectable epistemic axes run when-relevant;
these four never fold.

A gate that names no evidence is ceremony and fails.

## `decisions_are_typed`

Every decision resolves to its declared shape. A gate owing a ranking is not satisfied by a boolean,
and a gate owing a boolean is not satisfied by a ranking. An untyped decision is a defect.

## `severity_routes_never_orders`

Severity is metadata that routes a failure to its handler. It is never a grouping axis and never an
ordering axis — ordering is dependency-topological, then genesis.

Severity also never softens a verdict. A gate returns pass or fail; severity decides what gets
repaired first among the failures, not which failures are tolerable.

## `ripple_carries_names`

Impact is recorded as named entities, never as counts. "Three files affected" is not an impact
record; the three names are. A dimension with no impact carries the evidence that it was assessed
and found empty, never silent omission.

## `generation_gates_are_not_execution_gates`

Gates resolved while *producing* an artifact are separated from the gates that will run when the
artifact is *executed*. The latter ship unchecked, and that is stated rather than conflated — an
artifact whose generation gates passed is not an artifact whose execution gates passed.

## `repair_from_earliest_owner`

A failed gate routes backward to the **earliest** node that can supply the missing evidence, not to
the nearest. Repair invalidates every dependent record forward; a downstream record is never
restored after an upstream repair. Repair is bounded, and exhaustion terminates as blocked rather
than as success.

## `descriptive_is_not_full_shaped`

Only an *executed* artifact — one that is run — takes the full loop. A *descriptive* artifact
(reference, spec, contract, note) is not full-shaped; forcing the loop onto it is the Procrustean
failure the meta-template names.

## `templates_stay_independent`

Each template inlines the whole structure by design. This is the one place the duplication rule is
deliberately overruled: never refactor the templates toward a shared imported spine, because the
shared structure is what makes each one independently executable.

## `attribution_survives`

The templates are third-party IP under CC BY-SA. Any artifact deriving from them carries its
attribution. Attribution lines are never stripped, moved inside a fence, or reworded.

**AND THE ATTRIBUTION LIVES IN THE SURFACE THE CONSUMER RECEIVES.** Stripping is not only an edit that
deletes the line — **an intermediary that discards the field carrying it strips it just as completely**,
and does so silently on every use. Measured: every persisted agent specification carried exactly one
mention of the rights holder, in a frontmatter field the harness discards, **so every invocation ran
PAG-derived material with its CC BY-SA notice removed at the delivery boundary.** That is a licence
exposure rather than a style finding, and no reading of the artifact on disk reveals it.

**The obligation is discharged where the material is delivered and nowhere else.** An artifact that
displays its attribution to a reader opening the file, while withholding it from the consumer that runs
the derived content, has satisfied the appearance of the rule against the wrong audience.

**SO *NEVER MOVED* BINDS THE DELIVERY AND NOT THE BYTE OFFSET, AND THE TWO READINGS DIVERGE EXACTLY ONCE:
when a notice sits in a surface the consumer never receives.** Relocating a notice INTO the delivered
surface is COMPLIANCE — it is the first time the obligation is discharged at all. Removing it FROM the
delivered surface is the breach the rule exists to name. **A copy in a surface no consumer receives is
not a second discharge; it is a second location**, and deleting it removes nothing the licence protects.

**The test is the audience, and it is checkable rather than a matter of taste**: if every reader the
remaining copy serves is already served by the delivered one, the extra copy protects nobody. Here the
body line is verbatim, unfenced, first in the delivered text and first in the file's prose — **so it
reaches the human opening the file and the consumer running the derived content, which are the only two
audiences that exist.** A discarded frontmatter field reaches neither.

**This is stated because a rule whose wording admits two opposite actions cannot be obeyed.** One reading
demands deleting the undelivered duplicate; the other forbids touching it. The artifact after the edit is
identical either way, so nothing downstream can tell a compliant relocation from a strip — **which is
precisely why the discriminator has to be written into the rule rather than left to the editor's
intent.** **Where a new gate and a LOCKED rule disagree, the gate is evidence that the rule's wording is
under-specified and never licence to act against it**: the wording is repaired first, and the edit
follows.

**The defect was found by an ASYMMETRY between two checks one line apart**, and that is the transferable
part. The identity check deliberately read the delivered body, on the stated reasoning that the body is
what arrives; the attribution check beside it read the whole file. **Two fields, adjacent functions, one
applying the delivery reasoning and the other not — and the one that did not was carrying the LOCKED
rule.** A reasoning adopted for one field and not propagated to its neighbours is invisible precisely
because both checks look correct in isolation.
