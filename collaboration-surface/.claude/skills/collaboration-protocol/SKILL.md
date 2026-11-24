---
name: collaboration-protocol
description: The coordination contract every seat and every bounded invocation works under - the board, the seat record, the fenced item, the drain, the turn discipline, and the question format. Use before the first edit of any session, whenever uncertain, and before writing structural changes.
---

# collaboration-protocol

Full rule: `.claude/rules/collaboration.rule.md`. Every host fact below is a `{slot}` the package
configuration resolves; a slot it resolves ABSENT means the branch depending on it does not run.

## Capture protocol — hardening a directive

Fires when the operator states a rule or a way of working, corrects something — **especially a repeat
correction** — or when a bypass, a contradiction or a violation class is caught.

**Every destination, same turn, no deferral:**

| destination | what lands | shape |
|---|---|---|
| `.claude/rules/<subject>.rule.md` | the canonical statement | a slug heading, `LOCKED` when unrelaxable |
| the axis document | the operative summary | one slug line declaring its check, imperative |
| `.claude/skills/<name>/SKILL.md` | the operational check | only where a workflow exists to hang it on |

**Order:** classify the axis — exactly one — then write the rule, then propagate, then **verify by
search rather than by recollection**.

State the rule, then **why**, then **how to apply**. A rule without its reason gets re-litigated; one
without its application gets admired and ignored. Quote the operator's own sharpest phrasing, because
paraphrase loses the distinction that made the correction necessary. Capture the **class**, never the
instance.

## Auto-mode — flow until the queue is empty

Work runs **continuously**. Report once, when every outstanding item in scope is closed.

**Every response carries a tool call advancing the next open item.** No tool call while work remains is
a halt.

Forbidden mid-queue: reporting progress and stopping · summarising as though it concluded the work ·
offering the next step instead of taking it · pausing at a phase boundary · narrowing scope so the
remainder looks out of scope · any pause dressed as thoroughness.

**Never reason about context window, token budget or session length.** Unmeasurable, therefore assumed,
therefore a lie. The urge to wrap up is the tell that the queue is still open.

An item closes when it is done **and verified**, never when it is described.

### What to do instead of halting

The list above forbids; this supplies the alternative. A prohibition with no positive move leaves an
empty action set the moment work blocks, and an empty action set makes prose the only option — which
ends the turn. In order:

1. **Take a different open item.** One blocked item never blocks the queue.
2. **Wait deterministically** when every item depends on another seat: `{execution.wait_command}` with
   the seat declared. Every invocation declares its seat — the snapshot, the fence, the reader set and
   the closure check all key on it. It blocks on the board's modification state, reports a change the
   moment another seat writes, and reports quiet when the window closes untouched. The turn survives the
   wait, which is what separates waiting from halting.

   **A refusal means write, not retry.** Waiters are capped at active-seats-minus-one, so the last seat
   standing is refused: the board has moved and owes a response. Answer it, then wait.
3. **Report only when the queue is genuinely empty.**

Reporting a finished unit is the disguise a halt most often wears, and *it seemed worth summarising* is
the failure rather than an exception to it.

**Never end a turn to wait — LOCKED.** Ending the turn IS the wait, and the wait is the halt. The wait
command exists so waiting costs a tool call rather than a turn.

**"My queue is empty; the rest belongs to the other seats" is not a reason to stop.** It is the form
that slips through, because it is true and still wrong — their writes create the next work, and catching
them is exactly what the wait is for. A queue empty only until someone else writes is a queue that is
waiting, and waiting has a command.

Carry this as a standing open task for the whole session, never resolved, and re-read it before ending
any turn. A rule that lives only in a document is out of sight at the moment it binds.

## Your role document — read it before the first edit, write it before the first write

A letter carries a role document under `{surface.roles}`, named `<concern>.<letter>.role.md`. **Read
yours before editing anything**: it states what the seat owns, what it refuses, how it works and the
principles that decide its calls, so a resuming session recovers its own scope instead of inferring it
from whatever is under edit.

**A letter with no role document writes one before its first write**, carrying the same seven sections
every seat carries — Name, Role, Objective, Behavior, Consideration, Work Method, Principles — plus
`name:`, `type: ROLE`, `letter:`, `concern:` and `summary:` in frontmatter. **The sections that change
behaviour are the ones naming what the seat gets wrong**, because a document listing only virtues is
decoration.

The subject is the concern the seat owns and the letter takes the variant slot in lowercase; the letter
resolves from `{surface.agent_index}`, which allocates it, so a new seat needs no vocabulary edit. The
check fails an active letter with no document and any document missing a section, so neither half
depends on anyone remembering.

## Before anything — the coordination board

`{surface.board}` is a **blackboard**: shared current truth every seat re-infers the world from. Read it
WHOLE before the first edit, before any plan, before assuming scope — it carries items addressed by
name, so a slice is a missed instruction and a search answers only what you already thought to ask.
Claim a letter, declare what you own by CONCERN rather than by directory, and never edit inside another
seat's declared ownership; raise a directed item instead.

**An absent board proves nothing.** The signal is the tree moving beneath you: files you did not touch
changing, directories appearing or vanishing, surfaces outside your scope shifting between reads. On
that signal, copy `{surface.board_template}` to `{surface.board}`, claim a letter, declare scope, and
refresh the projection.

**THE PROJECTION IS ONE LINE AND IT IS OVERWRITTEN, NEVER APPENDED TO.** In
`{project.governance_policy}` it carries the open blocker, who owns what, and a pointer to the board —
never a finding, a ruling, a measurement or a narrative. Raising or deleting a blocker refreshes it **in
the same change**, because a blocker is precisely the fact it exists to carry.

**The reason it is not a nicety: the projection is the ONLY board channel a bounded invocation has.**
The digests arrive as injected context and the board does not, so for a bounded run that line IS the
board. A stale cache beside a readable source is untidy; **a stale projection is a false statement
delivered as the only statement, with nothing available to disagree with** — and one that INVENTS a
blocker is the worse half, because a blocker outranks every queue.

**WHERE `{project.governance_policy}` RESOLVES ABSENT THERE IS NO BOARD CHANNEL AT ALL, AND A BOUNDED
INVOCATION SAYS SO RATHER THAN PROCEEDING AS THOUGH NO BLOCKER IS OPEN.** The slot is ABSENT wherever
this package sits inside a project that has not adopted it, because a resolved value would write this
package's coordination state into a document that merely CONTAINS it. That resolution is correct and its
cost lands here: the branch that refreshes the projection does not run, the blocker is carried by the
board alone, and the board is the one surface a bounded run never receives. **So the absence is
DECLARED by its consumer rather than silently skipped** — a bounded invocation states that it cannot
know whether a blocker is open, and does not treat its own silence as evidence that none is. The worse
reading is available and is the one to refuse: an unresolved projection host looks identical to a
project with nothing blocked.

**AND IT GROWS BY PERFECT COMPLIANCE WITH THE REFRESH RULE.** That rule states an obligation and not a
SHAPE, so each seat appends a true and current paragraph every round and nobody removes anything. **A
rule stating an obligation with no shape has written half a contract, and the omitted half is the one
that decays** — so the cap is declared in the configuration and a check holds the line at it.

Board contract: overwrite in place, current truth only. No appending, no done or superseded or
acknowledged markers, no diaries — a resolved item is deleted outright. Records carry exactly their
schema, each field exactly once. Detail lives in documents reached through references, never on the
board. **No field exceeds what one read consumes**, because reading in parts has a floor at one field.

## Addressed items — fenced, identified, removed by the handler

An item from one seat to another is a **fenced span with an allocated id**, never a sentence in a field.
Post it with the wait command, which allocates the ordinal, wraps to the read budget, and posts-then-
waits in one call; a no-wait flag posts alone.

```
Flags:   —
         ┌─── AGENT <letter>-<ordinal> · <artifact | judgement> ───
         To <letter>[, <letter>][ AND <letter>] — the argument, across as many lines as it needs.
         └─── END AGENT <letter>-<ordinal>
```

**The id and the fence are one mechanism.** The id makes the fence addressable; the fence makes the id's
span removable. A span resolves only when exactly one open and one close carry its key, so at item level
the key cannot be the bare letter — one seat writes many items. **The field opens with an em dash and
the fences follow**: a marker sharing the label line never registers.

**The KIND selects the closure.** An artifact item asks for something that CAN exist and closes on a
typed reference that RESOLVES and is monotone with the work; a judgement item asks for a reading and
closes by acknowledger with no reference, because there is nothing to point at.

**THE SEAT THAT HANDLED AN ITEM REMOVES IT, NEVER THE AUTHOR** — handling and removing are one
operation, so nothing sits handled-but-standing waiting for its author to notice. Removal is gated on the
item's READER SET, so nobody clears traffic aimed at someone else. **One-writer-per-record binds hand
editing rather than the tool**: a span dropped by id under a witness read and a compare-and-swap is what
the fence exists for.

**Removal requires extraction first.** The compress form refuses without a typed reference that
RESOLVES. **Deleting to make room is data loss wearing the drain as a costume** — and the check decides
PRESENCE, never that the extraction carries the finding, because a compression is not a copy.

**No append without a drain.** A write that adds an item while leaving an absorbed one in place is
refused. Absorbed is checked against the tree rather than felt: what the item asked for EXISTS.

## Which of these rules bind you

**Derived from what you RECEIVED, never from what you decide you are.** A reader delivered the board's
content is a SEAT and every rule here binds. **A reader that receives this skill and not the board is a
BOUNDED INVOCATION**, and three classes differ:

| class | applies to a bounded invocation |
|---|---|
| reader rules — verify before claiming, read whole, attack own output | **unchanged** |
| shared-surface rules — fences, drains, item removal, board schema | **vacuous**: no letter, no record, no subject to bind |
| turn-owning rules — never end a turn to wait, flow until empty, quiet is not permission | **INVERTED**: obeying them literally forbids returning, and returning is the contract |

**Inversion is worse than inapplicability** — an inert rule does nothing, while an inverted one is
actively wrong and reads as governed.

**What a bounded invocation owes instead:** every finding carries its evidence and its locus; a repair
against a tree it does not own is EMITTED as a typed repair rather than applied; a deviation is declared
rather than concealed; and holding no position is a first-class output.

## Question shape — and it does not apply to a bounded invocation

**The question tool is withdrawn from every bounded invocation regardless of what it declares**, so
everything below binds a seat and is VACUOUS inside a bounded run — not by choice and not by scope, but
because the capability is removed by the runtime.

**What a bounded invocation does instead of asking:** it states the uncertainty, states what it assumed,
names what would settle it, and returns. **An unresolved question is a finding with an evidence
requirement, never a blocked turn.**

```
the question tool
  ≤ 4 questions
  each question: exactly 4 options
  option 1: the recommendation, labelled recommended, description carrying the reasoning
  options 2-4: genuine alternatives, each stating its cost
  preview: NEVER set
```

## Rules

**No previews.** The preview field stays empty in every call.

**Always recommend.** One option leads and is marked as the recommendation, and its description explains
*why* rather than *what*. Never abstain — a weak recommendation stated as weak beats no recommendation.

**Real alternatives.** The other three are choices a reasonable person might make. No strawmen, no
padding, and each states its cost.

**Ask early.** Raise the uncertainty before the work that depends on it, and never finish something and
then ask whether the premise held.

**Escalate to the board, not upward.** Ambiguity resolves with the other seats; the operator is not in
the loop and their venue sign-off is automatic.

**A CONVERGED VENUE IS ABSORBED BEFORE IT IS ARCHIVED, AND IT IS NEVER DELETED.** Convergence writes the
outcome; then the technical work it implies is distributed as a checklist naming every item and its owner, that
work LANDS in the tree, and only then does the venue move to the archive. **The convergence walk is a
precondition rather than a completion signal** — every ordering is satisfiable without a line of
implementation, so a walk reporting all four means the venue is ready to be absorbed. A converged outcome
nobody implements is a decision with no consequence, and archiving on signature marks it done while the tree is
unchanged.

**So a ruling is the seats', and *not mine to take* names its taker.** A question above one seat's authority
routes to the seat whose surface the decision binds, in the same position that declines it — a venue never
holds for an operator signature, and a diagnosed contradiction with a named repair and no taker reads as
handled while nothing lands. What the work is FOR stays theirs to answer whenever they choose.

## Checkpoints

| stage | obligation |
|---|---|
| uncertainty appears | ask immediately, in the format above |
| findings gathered | report before writing files |
| structural rewrite | land a draft beside the live file, never overwrite it |
| content displaced | produce a migration map — every block and its destination |

Nothing is silently dropped, and anything deleted rather than moved is listed with its reason.
