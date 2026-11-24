<!-- AI COLLABORATIVE CHECKLIST SURFACE -->
# A planning surface: what remains, who holds each item, and what would prove each one done.
# Copy to `<subject>.checklist.md` in the declared checklists root. The checklist walk DERIVES its contract from here.
# Instantiate per project. Nothing raised from this template names a project, a party, a tool or a count.
# Model: `models/coordination.model.md` — the surface states what is true now and what remains, and nothing else.

═══════════════════ LIFETIME (declared, read rather than inferred) ═══════════════════

**THE VALUES ARE DRAWN FROM THE CLOSED SETS THE PARAMETER SURFACE DECLARES AND ARE NOT RESTATED HERE.** A
mechanism RESOLVES the members there; this surface class states what each axis SEPARATES.

**The file default:** retention `current-truth` — a closed task is DELETED rather than marked, because
deleting it is what makes the remaining set the work. Mutability `owner-rewritable` — a task's own owner
revises its row, and the surface's author revises the governing context. Removal authority `handler` — the
party that DID the work removes its row, since only they know it is done and a row removed by anyone else
records a completion nobody observed.

| section | axis | value | why |
|---|---|---|---|
| this LIFETIME block and the CONTRACT block | mutability | `frozen` | written from the template and never edited in a live surface — a correction lands in the template |
| the governing context | retention | `current-truth` | it states what this distribution is FOR, and it is corrected in place when the objective moves |
| a task row | retention | `until closed` | what ends it is the completion of what it asked for, tested against the tree rather than felt |

**AN ASSIGNMENT OUTRANKS SURFACE OWNERSHIP FOR THE ITEM IT NAMES, AND THAT IS DECLARED RATHER THAN ASSUMED.**
Otherwise a distribution can only assign work to whoever already owns the file, which makes every outcome
land in the seat that produced it. **An UNASSIGNED write into another party's surface remains a breach** — the
discriminator is the visible row, which is contestable where an edit is not.

═══════════════════ CONTRACT (permanent) ═══════════════════

## What a checklist carries, and what it refuses

**A CHECKLIST STATES WHAT IS TRUE NOW AND WHAT REMAINS.** It carries tasks, their contracts, and the
requirements binding them. It does not carry findings about defects already repaired, narrative about how
the surface came to be, commentary on its author's reasoning, inventories that drift into archaeology, or a
closed task left in place with a note explaining that it is closed.

**PAST ON A CHECKLIST INVITES RE-IMPLEMENTING FINISHED WORK**, because a reader cannot tell a finished row
from an open one without going to the tree — and it seeds confusion about intent, since a task written
against a state that has moved describes a destination nobody is still travelling toward.

**A TRANSCRIBED COUNT IS THE SAME FAILURE WEARING A NUMBER.** A surface stating how many rules, phases,
tasks, files or specs exist has copied a fact the pipeline derives, so it is wrong from the first change
nobody propagated while reading as current. **The enumeration is the fact; nothing restates it.**

## The identifier grammar

**EVERY TASK CARRIES AN IDENTIFIER UNIQUE ACROSS THE SURFACE, AND EVERY CITED IDENTIFIER RESOLVES TO A
DECLARED TASK.** The form is `<phase>.<group>.<task>`, positional and stable. A duplicated identifier makes
every citation of it ambiguous with no error anywhere; a citation surviving its task's deletion reads as a
live dependency. Both are decidable from the file alone and neither heals, because which of two colliding
rows should move, and whether a dangling citation should be rewritten or removed, are judgements.

**IDENTIFIERS ARE NEVER RENUMBERED TO CLOSE A GAP.** A deleted task leaves its number unused, because every
citation ever written resolves through it and renumbering silently re-points them.

## The task contract — every field, on every row

| field | states | rendered as | omitted means |
|---|---|---|---|
| method | how it is done, derived from the mechanism rather than from the defect's shape | the row's leading STATEMENT, carrying no marker because it is the row's own sentence | a builder inventing an approach the row was written to constrain |
| locus | the file, tree or surface the row acts on | `*file:*` | a row whose target is inferred from its prose, which two builders infer differently |
| evidence | what will be observable when it is done | `*evidence:*` | a completion claim resting on its author's account |
| owner | the party that will do it, or `unmeasured` with the rule that fills it | `*owner:*` | a row nobody picks up |
| validation | the mechanism that decides it, or the reason none can | `*verifier:*` | a row closed by its owner's judgement alone |
| non-goal | what this row deliberately does not do | `*not:*` | scope that grows silently, which is how a task becomes a project |
| done when | the condition, testable against the tree | `*done:*` | a row that closes when it feels finished |

**THE RENDERED FORM IS DECLARED HERE SO THE WALK DERIVES IT RATHER THAN TRANSCRIBING IT.** A check holding
its own marker set is a second copy of this contract, and the copy is what binds — so a field added to the
table above arrives in no check, every surface stays conformant to the copy, and nothing reports the
disagreement. **The field table answers WHAT a row carries and this column answers HOW**, and a derivation
needs both: naming only the fields leaves a check composing a marker from a field name, which is a spelling
guess wearing a derivation's clothes.

**A ROW IS ITS STATEMENT FOLLOWED BY ITS MARKED FIELDS, EACH SEPARATED BY THE SAME DIVIDER**, in the order
the table declares:

```
- [ ] <identifier> <the statement>. *file:* <locus> · *evidence:* <observable> · *owner:* <party> · *verifier:* <mechanism> · *not:* <non-goal> · *done:* <condition>
```

**OWNER AND VALIDATION ARE TWO FIELDS AND TAKE TWO MARKERS, WHICH IS THE ONE PLACE THIS DECLARATION
SEPARATES WHAT A ROW MAY HAVE COLLAPSED.** A party is not a mechanism: a row naming a party where the
mechanism belongs states that the work is decided by whoever did it, which is exactly the state the
validation field exists to refuse — and the two read identically once one marker carries both.

**A METHOD CLAUSE IS AUTHORED FROM THE MECHANISM AND NEVER FROM THE DEFECT'S SHAPE.** A rule is delivered
once to a reader who quotes it; a row is delivered once to a builder who ACTS — so the obligation to open the
mechanism is identical and the cost of skipping it is not.

**`unmeasured` IS A REAL OWNER VALUE AND STATES ITS FILLING RULE.** Where an operation may be refused for one
party and permitted for another, naming a party in advance authors a row that party may be unable to
discharge; the rule that fills it is the row's operand.

## The declared axes — a walk reads these from here rather than transcribing them

**THE SUBSTRATE CYCLE.** A phase declares its genesis, and phases order by dependency and then by genesis. A
phase never depends on a later-genesis output than it produces.

`existence` → `difference` → `relation` → `structure` → `transformation` → `constraint` → `emergence`

**THE DEPENDENCY AXES.** Every phase declares all four; an axis with nothing on it carries the evidence that
it was assessed and found empty.

| axis | asks |
|---|---|
| Z (sequential) | what this phase consumes from the phase before it |
| X (lateral) | which items inside this phase are peer-independent |
| Y (diagonal) | what this phase shares with a phase it does not directly follow |
| W (propagation) | what changes downstream when this phase lands |

**THE RIPPLE DIMENSIONS.** Every phase renders each dimension with the entity it touches, what lies
downstream, and the consequence if it is omitted. **Impact is recorded as NAMED ENTITIES rather than as
counts**, and a dimension with no impact carries the evidence that it was assessed and found empty rather
than being silently dropped.

`registry` · `contracts` · `persistence` · `security` · `infrastructure` · `performance` · `observability` ·
`enforcement` · `consumers`

**THE GENERATION GATES.** These resolve while the surface is PRODUCED and each carries its result and its
evidence. They are separate from the phase gates, which run when the checklist is EXECUTED and ship
unchecked — and conflating the two lets a surface whose generation gates passed read as one whose execution
gates did.

| gate | owes |
|---|---|
| tel-priority | the selected branch as argmax(utility − cost) over the ADMISSIBLE set, with the rejected branches named and the reason each fails |
| constrain | every item tracing to the selected branch, and the limit-breach set empty over the limits that RESOLVE |
| ver-stop | every item naming what measured it and the surface it lands in, each falsifiable by opening that surface |
| ter-stop | saturation AND completion AND verification, stated as conditions rather than as a judgement that the work feels done |

**A GATE THAT NAMES NO EVIDENCE IS CEREMONY AND FAILS.**

**THE CONFIDENCE THRESHOLD.** The surface declares a confidence, and a material claim below the declared
threshold is carried with what would raise it rather than asserted. *No contradiction found* is not support.

## The principle disposition

**EVERY PRINCIPLE THE CATALOG DECLARES IS DISPOSITIONED — `applies`, `recommended`, `uncertain` or `n/a` —
WITH ITS REASON AND ITS VALIDATOR.** An absent disposition makes an oversight indistinguishable from an
assessed decision, which is the same distinction the empty-versus-missing rule draws everywhere else here.
An `n/a` states what was checked and found inapplicable rather than what was skipped.

## Ownership resolution

**EVERY OWNER AND EVERY VALIDATOR BINDING RESOLVES TO A PARTY THE COORDINATION SURFACE DECLARES ACTIVE**, and
the roster is DERIVED rather than declared here. A row bound to an absent party can be built and never
retired, which is the same shape as an item addressed to a party that does not exist.

## Gate

- A closed task present on the surface fails; deleting it is what makes the remaining set the work.
- A status marker, a past-tense narrative or a history heading fails wherever it appears.
- A digit-form count immediately followed by a noun naming a set the pipeline derives fails.
- Every task carries every contract field; an absent field fails as unstated rather than as permissive.
- Every identifier is unique, and every cited identifier resolves to a declared task.
- Every phase renders all four dependency axes and every ripple dimension, including the empty ones.
- Every generation gate carries a result AND its evidence.
- Every owner and validator binding resolves to a party the coordination surface declares active.

═══════════════════ CHECKLIST ═══════════════════

### PHASE — existence

### PHASE — difference

### PHASE — relation

### PHASE — structure

### PHASE — transformation

### PHASE — constraint

### PHASE — emergence

**A surface raised from this template carries no task until its distribution is known.** The section is born
present and empty, which is distinguishable from a populated one — an ABSENT section states nothing, and that
is what makes an oversight read exactly like a decision.

**WHAT A RAISE CARRIES IS THE PERMANENT BLOCKS AND ONE BARE PHASE SPAN PER STAGE OF THE SUBSTRATE CYCLE**, so
a raised surface is a checklist by the walk's own test while asking its reader for nothing. The phase contract
— the dependency axes, the ripple chain, the genesis stage — binds a surface PUT TO WORK rather than one
merely raised, and a bare span states an intended cycle without claiming work it cannot close.

**EVERYTHING BELOW IS AUTHORED RATHER THAN RENDERED, and the order is the shape the author fills:** the title,
the attribution the delivered surface must carry, what this surface DISTRIBUTES and which identifier it
CLOSES, the declared confidence and the principle catalog it dispositions against, the governing context, the
generation gates, the principle disposition, then each phase span carrying its genesis, its loop class, its
severity, its dependency axes, its ripple chain and its tasks — and finally the appendices: where each
artifact lands, the evidence inventory, and what the distribution deliberately excludes with the reason for
each exclusion.
