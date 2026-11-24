<!-- AI COLLABORATIVE COORDINATION BOARD -->
# Multi-agent coordination for the project: concurrent Claude instances must not overlap or conflict.
# On session start (or first read mid-session): read this board, claim an Agent letter, declare your scope in the fixed schema below.
# Last agent to update refreshes the one-line projection in `{project.governance_policy}` ('<marker>: <one-liner> - Updated <path>'); agents that have read it append their letter '(A*), (B*), …'.
# Owns and Flags are claims and intentions rather than locks and messages: every agent re-infers the current world from this board and converges cooperatively, with no scheduler and no consensus step.

═══════════════════ PROTOCOL (permanent) ═══════════════════

## Board contract (STRICT)
- CURRENT TRUTH ONLY. Overwrite in place — no appending, no archaeology, no historical/DONE/SUPERSEDED/ACK markers, no diaries.
- Each record carries EXACTLY its fixed schema (below) and nothing else. Normalized records, not prose.
- Implementation detail, playbooks, root-cause analyses, troubleshooting, completed-milestone narrative DO NOT live here — they live in documents reached through a TYPED reference, `` `<kind>`: `<member>` ``, whose kind names the corpus that resolves it. A kind outside the declared set resolves vacuously and reads exactly like one that passed, so the set is closed: a durable-record kind is available only where the host declares that surface, and where it resolves ABSENT the finding is carried in prose rather than pointed at.
- DELETE a resolved flag or completed unit outright. A removed field reads as absence; a stale one manufactures a false belief.

## Fixed agent schema (Coordination layer)

**THE SPECIMEN IS FENCED, AND THE FENCE IS LOAD-BEARING.** This file is both the contract and the SEED —
a board is raised by copying it — so it must contain a record shape in order to state one, and every
scanner that reads a board would otherwise read these specimen lines as live records. A fenced specimen
is a record MENTIONED; an unfenced one is a record CLAIMED, and the board scanners skip the first.

```
  ┌─── AGENT X ─── one writer: X · others cite, never edit · anchored EDIT only, never a whole-file WRITE
  Agent X — ACTIVE | INACTIVE | INVOKED
    Owns:    <paths/concerns this agent claims exclusively — one line>
    Status:  <current unit + state — one line>
    Flags:   <actionable intentions to named agents; deleted once resolved, or —>
    Refs:    <typed pointers for all detail, each naming a declared kind>
  └─── END AGENT X
```

**THE DELIMITERS ARE STRUCTURAL, NOT DECORATION, AND `board/undelimitedRecord` FAILS A RECORD WITHOUT
THEM.** They give every block an anchor unique to its own writer, which is what makes an anchored EDIT
possible for a neighbour revising their own record. Without one, an agent rewriting its block has
nothing narrow to edit against and reaches for a whole-file WRITE — which succeeds, reports success to
the one who overwrote, and says nothing at all to the one overwritten.

**Edit inside your own delimiters. Never write the whole board.** An Edit against a file that moved
since you read it is REFUSED and tells you so; a whole-file Write is not. That difference is the entire
protection, and it is a property of the two mechanisms rather than of how careful either agent is.

## Fixed item schema (an addressed item inside `Flags`)

```
  Flags:   —
           ┌─── AGENT <letter>-<ordinal> ─── kind:<artifact | judgement> at:<ms> to:<letters | *>
           To <letter>[, <letter>][ AND <letter>] — the argument, across as many lines as it needs.
           └─── END AGENT <letter>-<ordinal>
```

**THIS SPECIMEN STATES WHAT THE FORM WRITES, AND THE FORM IS THE SOURCE.** Every operand after the closing
rule is metadata the tool ALLOCATES — the kind that selects the closure, the stamp, and the addressee set a
reader set resolves from — so a seat hand-authoring from a specimen that omits any of them produces an item
addressed to nobody, closeable by nobody, and well-formed to every check. Measured: three such items, from a
specimen carrying the kind as a middle-dot annotation the writer has never emitted. **A specimen a party
copies is read as the format**, so where it and the writer disagree the writer wins and the specimen is
corrected — and the reason to author an item through the form rather than from this block is that the form
cannot disagree with itself.

**THE FIELD OPENS WITH AN EM DASH AND THE FENCES FOLLOW.** A marker sharing the `Flags:` label line is
never recognised, so its item reads as an open with no close and the record fails.

**THE KIND SELECTS THE CLOSURE, WHICH IS WHY IT IS ON THE OPEN MARKER AND NOT IN PROSE.** An ARTIFACT
item asks for something that can exist and closes with a typed reference that RESOLVES; a JUDGEMENT
item asks for a reading and closes by acknowledger with **no reference**, because there is nothing for
one to point at. **A gate derives this schema from this file**, so a field the template does not
declare is a field no gate can check — which is how a decided field becomes unenforced by construction
rather than by decision.

**THE ID AND THE FENCE ARE ONE MECHANISM.** The id makes the fence addressable and the fence makes the
id's span removable. A span resolves only when exactly one open and one close carry its key, and at
item level the key cannot be the bare agent letter because one agent writes many items.

**THE AGENT WHO HANDLED AN ITEM REMOVES IT, NEVER THE AUTHOR** — handling and removing are one
operation, so no item sits handled-but-standing waiting for its author to notice. Removal is gated on
the item's READER SET, so nobody clears traffic aimed at somebody else. **One writer per record binds
hand editing and not the tool**: a span dropped by id under a witness read is the mechanism the fence
exists for. **Removal requires extraction to `_changelogs.txt` first** — deleting to make room is data
loss wearing the drain as a costume. Full protocol: the `board-items` layer of `README.md`, cited by LAYER
NAME because that document is GENERATED from the manifest and carries named layers rather than numbered
sections — an ordinal is an artifact of hand-authored numbering and resolves to nothing the moment the
document re-renders, in the one block every seat reads first.

## Repository layer — a POINTER, never a transcribed verdict
Gate verdicts are DERIVED. The board names where they live and restates none of them:

  Gate verdicts are DERIVED, never transcribed here. Read `_generated/<aggregate>.report.generated.json`.

**A State field carrying a verdict is a cache with no invalidation** — true when written and false the
moment any agent writes anything, with nothing reporting the disagreement. Every seat here independently
reached that conclusion about its own Status field and answered it by refusing to assert a verdict;
the artifact section was the same construct one section down. **And the obvious repair is refused for a
stronger reason than the defect**: having the pipeline write the field would make a gate rewrite a
surface every agent writes concurrently, which is the lost-write construct with a gate's authority.

## Waiting on another agent (never end the turn to wait)
Run `npm run await -- --agent <LETTER> [--file <surface>]`. **The agent is mandatory** — the snapshot, the
fence, the reader set and the closure check all key on it, so an undeclared caller can be given no diff and
cannot be told what was addressed to it. **There is no `--timeout`**: the invocation already bounds the call,
so a second bound inside the tool controlled nothing.

**ON A FAILED INVOCATION, READ THE SURFACE — NEVER INFER FROM THE TRACE.** Two outages look identical at the
terminal, a stack trace and a non-zero exit, and they take OPPOSITE recoveries. A failure at module resolution
happens before the process starts, so nothing is written and re-posting is correct. A failure inside the tool
happens after it ran, and this form performs its append EARLY — so the write landed, only the reporting died,
and re-posting DUPLICATES. **The RECEIPT settles the ordinary case and the surface settles the rest.** Every successful append prints the
allocated id and the surface it landed on: no receipt means the append did not complete and re-posting is
correct, a receipt beside a trace means it did and re-posting duplicates. Where the receipt is absent for
another reason — a killed process, a lost terminal, output nobody kept — the surface is the authority, because
whether an effect happened exists in the surface and never in the channel the caller is reading. **That order
is this tool's own ruling applied to itself:** the receipt is the author's account and cheap, the surface is the
fact and authoritative, and one read of it is right in both measured cases and in the ones nobody has met.
**The surface read needs something to search by**, which is a property of how a write is addressed rather than
of the surface: a named field is addressable, an item is addressable only by its content because its id is
allocated on success — so a short or generic body is the case where the receipt matters most.

**AND ONE FAULT PRODUCES BOTH BRANCHES, WHICH IS WHY THE DISCRIMINATOR IS THE RECEIPT AND NEVER THE TRACE.**
The same throw, in the same function, takes OPPOSITE recoveries depending on whether the invocation carried a
WRITE: a call that posted and then waited has its item on the surface and a retry duplicates, while a call
that only waited wrote nothing and a retry is correct. **Measured on one defect within one minute by two
parties**, each reading the identical stack and each right about its own recovery — because the fault sat
after one caller's append and before the other's nothing.

**So the trace names the mechanism and the receipt names what happened.** Two parties comparing traces would
have concluded they disagreed; comparing receipts, they agree exactly. **A retry decision is taken from the
invocation's own output rather than from a peer's account of the same failure**, however identical the two
look.

**AND A CRASH IN THE WAIT DOES NOT MEAN THE TOOL IS DOWN.** Where the fault sits in the waiting path, every
write form still completes — posting, marking, closing and field writes are unaffected, and the no-wait
spelling returns cleanly. **A seat blocked by it posts rather than waits**, and reads the failure as one path
rather than as an outage. That is a much smaller state than a failure at module resolution, which takes every
form with it and is distinguishable by the trace naming a load rather than a call.

**THE CALL COVERS ONE SURFACE AND THE DEFAULT IS THIS BOARD, WHICH IS STATED HERE RATHER THAN LEFT TO BE
DISCOVERED.** A wait reports what changed on the surface it is GIVEN, so the form as written watches
coordination state — correct while the open item is who owns what, and wrong the moment the open item is an
ARGUMENT, which lives in a venue. A seat following an unqualified form waits on the board for a whole
discussion and receives record fields instead of the positions it is blocked on, with every call returning
real changes so nothing looks broken.

**AND NAMING THE VENUE PRODUCES THE OPPOSITE GAP, SO THE REPAIR IS BOTH HALVES.** A wait keyed to a venue
delivers no board diff at all, and items addressed to that seat stand absorbed while it argues elsewhere.
So: the wait NAMES the surface the argument is on, and the board is READ WHOLE regardless — nothing delivers
a board change to a seat waiting somewhere else, and the read obligation is what covers the surface the wait
is not on. **The output is consumed whole in either case**: no pipe, no bound, no pattern match, because the
diff IS the delivery and a filter chosen for the confirmation line discards every peer write in the same
stream.

It blocks on the board's modification time, returns `CHANGED` the moment another agent writes and
`QUIET` if the window closes untouched, and reports what changed since that agent last looked. `BLOCKED`
means the board owes your response: write first, then wait. Take a different open item before waiting at
all; wait only when every item depends on someone else.

## Shared operational refs (registry — pointers to canonical explanations, never inline)
- <one line per cross-agent hazard or protocol → `` `<kind>`: `<member>` `` in a declared kind; add as discovered, keep the pointer only and never the explanation>

═══════════════════ COORDINATION (actors) ═══════════════════

Agent tracking: <letter>(*) · <letter>(*)   (Active = * ; Inactive = (*))
Letter → role while its seat runs; a departed seat's letter is reissued; a new agent is indexed BEFORE its first write → `index`: `_agent-index.md`

**THE ROSTER IS NOT LISTED HERE.** Letters come from the agent index, which is the pool that binds a
letter to a role while its seat runs — so this template carries the record SHAPE and never a set of
agents. **A template naming specific letters is a roster in two places**, and the copy nobody
maintains is the one a reader takes.

**EVERY RECORD IS FENCED. THERE IS NO UNFENCED FORM.** The delimiter is what gives an agent a span to
edit against; without one the only thing left to match is the whole file, so the agent reaches for a
whole-file write — which succeeds, reports success to whoever overwrote, and says nothing at all to
whoever was overwritten. `board/undelimitedRecord` fails a record without its pair.

```
┌─── AGENT <letter> ─── one writer: <letter> · others cite, never edit · anchored EDIT only, never a whole-file WRITE
Agent <letter> — <ACTIVE | INACTIVE | INVOKED>
  Owns:    <paths and concerns claimed exclusively — by CONCERN, never by directory>
  Status:  <current unit and state>
  Flags:   —
  Refs:    <pointers, including the arrival of any new surface>
└─── END AGENT <letter>
```

**A SEAT UNFENCES ITS OWN COPY OF THAT BLOCK AND FILLS IT.** Claiming a letter is: add the index row,
then paste this block below **outside** a fence with the placeholders resolved. Until a seat does that
the board carries no records, which is the correct state of a board nobody has claimed yet.

**THE STATE MARKER IS WHAT THE READER SET DERIVES FROM, SO IT DECIDES WHO CAN BE ADDRESSED.** `ACTIVE`
is a seat that runs continuously and can respond to a write. `INACTIVE` is a seat that has stopped.
**`INVOKED` is a party that runs only when called** — it holds a letter and a record so its citations
resolve and it can write, and it is never in the reader set because it does not exist between
invocations and cannot respond. **An item addressed to an `INVOKED` record correctly dangles**, which
is the addressing check working rather than a conflict to repair.

**The word names WHAT THE PARTY IS, never the consequence.** A value like *write-only* would bake the
reader-set decision into the state, which is an emitter stating the consumer's filtering decision — the
same defect as a severity tier. **How it runs is the discriminator; not being addressable falls out of
it.** The await peer count derives from `ACTIVE` alone, so an `INVOKED` record cannot deadlock a cap
that exists to stop simultaneous parking by something that never parks.

Open questions (unresolved only)
- (none)

═══════════════════ REPOSITORY STATE (artifacts) ═══════════════════

Gate verdicts are DERIVED, never transcribed here. Read `_generated/<aggregate>.report.generated.json`.
