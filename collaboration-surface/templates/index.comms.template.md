<!-- LETTER INDEX — the letter-to-role binding. Rows are never removed; an INACTIVE row is reissued. -->
# Agent index. A letter is bound to a role while its seat runs, and a departed seat's letter is reissued.

**This is the letter pool, which is why it is not on the board.** The board is current-truth-only and a
resolved item is deleted from it; this file keeps every row it has issued, and **a row reading `INACTIVE`
is a free letter** — the next `--index` reissues the shortest one before it mints a longer identity. So
a departed seat hands its letter to the next seat rather than pushing every later seat further down the
alphabet.

**An agent surfacing for the first time is added here BEFORE its first write.** A letter is claimed by
adding or reissuing the row, never by using it. Writing under an unindexed letter is the same construct
as a task citing an agent the board does not declare: it reads as governed and resolves to nothing.

**The letter is the identity; the role is what the letter means WHILE ITS SEAT RUNS.** Two live seats
never share a letter, and a seat never changes letters. A citation of a letter resolves to its CURRENT
holder, so a durable record that must name a party across a reissue names the concern as well as the
letter.

═══════════════════ INDEX ═══════════════════

| letter | role | state |
|---|---|---|
| SAa | Agent audit — a persisted agent against the agent template and the quality contract | INVOKED |
| SAb | Agent creation — composing a new persisted agent from discovered domain evidence | INVOKED |
| SAd | Forensic verification — a claim against observable implementation evidence | INVOKED |

**THE `SA` LETTERS ARE THIS PACKAGE'S OWN BOUNDED-INVOCATION IDENTITIES AND THEY SHIP WITH IT.** They
are not a host's roster: a host's seats claim single letters from the top of the scheme, while these
three bind the capabilities the package carries. **`INVOKED` is what they are rather than what they may
do** — a party that runs only when called, holds a letter so its citations resolve, and is never in the
reader set because it does not exist between invocations and cannot respond. An item addressed to one
correctly dangles, which is the addressing check working rather than a conflict to repair.

**`state` takes the values `ACTIVE`, `INACTIVE` and `INVOKED`.** A seat's row moves between `ACTIVE` and
`INACTIVE` and back; its letter and role change only when an `INACTIVE` row is reissued to a new seat.

**A SEAT IS ACTIVE WHILE ITS SESSION PROCESS RUNS, AND THE TOOL PROBES IT ON EVERY CALL.** Every
invocation binds the caller's letter to the process id its host runtime names for the session, in the
generated seat-process record, and probes every other `ACTIVE` seat: one whose bound process
is gone on this host, or that has no bound process at all, is moved `INACTIVE` with the probe as its
warrant. A seat on another machine is probed from that machine. A seat calling under an `INACTIVE` row
is moved back to `ACTIVE`, and a call under a letter bound to a different running session is refused.

**A PEER MAY MOVE A SEAT THAT DEPARTED WITHOUT DECLARING**, because otherwise every edge quantifying over
active seats counts a party that cannot act and a discussion holds on a signature that will never arrive —
so the transition admits a FOREIGN letter and is never anonymous when it does: the mover states a warrant,
and the row carries one line naming the last foreign mover and under what, replaced on every transition.
**Every derived active set takes PRESENCE from the board's own records and STATE from this file**, so a
letter counts as active where it holds a board record and its row here reads `ACTIVE`; a letter holding a
record with no row here resolves as not active, because a marker no allocation stands behind is a claim
nothing can contradict. The two surfaces answer two halves of one question — this one answers *what does
this letter mean and what state is it in*, the board answers *which letters hold a seat*.

**`INVOKED` is the third value and it does not move**, which is why the column is mutable for a seat's row
and frozen for a bounded-invocation one: a party that exists only when called cannot take a transition,
and no other party takes one on its behalf. **So the surface carries two change-modes by ROW CLASS**, and
a reader taking the file-level word for either class inherits the other's. Naming the third value is what
makes the set closed — a vocabulary stated as two while its own contents hold three is closed in its
statement and open in its members, which is the state a closed set exists to refuse.

═══════════════════ ALLOCATION ═══════════════════

**Single letters first, then widen — and an `INACTIVE` row is free.**

```
A … Z                    single
Aa Ab Ac … Az            two-part, cycling the second position
Ba Bb Bc … Bz
AAa AAb AAc … AAz        three-part, cycling the last position
ABa ABb ABc … ABz
```

**The shortest identity no `ACTIVE` or `INVOKED` row holds is the one issued**, so nobody has to reason
about which tier a name belongs to, and the tier of a name carries no meaning — `Aa` is not junior to
`A`, it is simply the next one that was free.

**Reissuing a letter rewrites its row in place and deletes the previous holder's role document**
(`*.<letter>.role.md`). The board record under that letter is inherited as it stands, so the new holder
rewrites its `Owns` and `Status` before anything else, and an item written by or addressed to that letter
resolves to the new holder.

═══════════════════ ADDING A ROW ═══════════════════

1. Run `npm run await -- --agent <any> --index "<concern>"`. It takes the shortest free identity,
   reissuing an `INACTIVE` row before minting a longer one, and binds it to this session's process.
   **It refuses when this session's process already holds an `ACTIVE` letter**, and names that letter:
   a cleared conversation keeps its process, so it resumes its letter rather than claiming a second.
   A call under any other letter is refused the same way.
2. The row reads `ACTIVE` **before the first write to any other surface.**
3. Raise the role document with `--role`, then declare scope on the board by concern, never by directory.

**The role is stated as a CONCERN, not as a task list.** A concern survives the work changing under it;
a task list goes stale the first time the agent finishes something, and a stale role is worse than a
vague one because it reads as current.
