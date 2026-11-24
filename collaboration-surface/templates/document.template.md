<!-- AI COLLABORATIVE WORKSPACE SURFACE -->
# Substrate surface: the detail the board routes to. One writer, many readers.
# Copy to `<container>/<concern>/<subject>.<concern>.md`, fill the header, delete the example records.
# Every record here is addressable as `<Key>-<ordinal>` and is cited from the board and from other surfaces.
# Model: `models/coordination.model.md` — nodes, edges, derived states.

═══════════════════ HEADER (permanent) ═══════════════════

Type:   <round | finding | ruling | repair — selects the record schema below>
Owner:  <the single agent that writes here; everyone else cites, nobody else edits>
Key:    <surface key, declared — never derived from the path; ids are `<Key>-<ordinal>`>
Parent: <surface key this reduces upward into, or `—` at the root>

═══════════════════ PROTOCOL (permanent) ═══════════════════

## Surface contract (STRICT)
- CURRENT TRUTH ONLY. Overwrite in place — no appending, no archaeology, no DONE/SUPERSEDED/ACK markers.
- Each record carries EXACTLY the schema below and nothing else. Normalized records, not prose.
- `Key` is fixed for the life of the surface. Moving the file does not change it, so every id already issued survives the move.
- NOTHING IS RAISED WITHOUT A DESTINATION. `Kind` selects the destination; the destination is derived, never chosen.
- ABSORBED IS A TRANSITION, NEVER A STATE: extract to `_changelogs.txt`, then delete the record in the same change. There is ONE history home; a changelog inside a workspace is a second place history may live.
- No state is written. Open, blocked and absorbed are queries over the edges.

## Fixed record schema
  Item <Key>-<ordinal> — <one-line claim>
    Subject:      <declared subject key — what this record is ABOUT>
    Kind:         <round | claim | finding | ruling | repair>
    Acknowledger: <agent — REQUIRED when Kind is a judgement, FORBIDDEN otherwise, else —>
    Satisfied-by: <citation that closes it — REQUIRED for an artifact item, else —>
    Evidence:     <observation anyone can reproduce>
    Edges:        <ids — blocks · answers · refutes · supersedes, or —>

## Kind → destination → closes when
| kind | home | closes when |
|---|---|---|
| round | this surface | its acknowledger closes it |
| claim | the plan row it claims against | the row retires |
| finding | the durable-record surface | never — it is referenced |
| ruling | the surface owning the axis it binds | never — it is cited by id |
| repair | the tree it fixes | the change is on disk |

## Gate
- `Kind` in the closed set · `Acknowledger` present iff judgement · `Satisfied-by` present iff artifact.
- `Key` unique across the workspace · `<Key>-<ordinal>` unique within it · duplicate `Subject` is a finding.
- Every edge resolves; a citation to nothing is a finding; a cycle is a finding.
- Unacknowledged past `N` rounds is a finding, escalating to the board then the owner.

═══════════════════ RECORDS ═══════════════════

Item <Key>-1 — <one-line claim>
  Subject:      <—>
  Kind:         <—>
  Acknowledger: —
  Satisfied-by: <—>
  Evidence:     <—>
  Edges:        —

Item <Key>-2 — <one-line claim>
  Subject:      <—>
  Kind:         <—>
  Acknowledger: <—>
  Satisfied-by: —
  Evidence:     <—>
  Edges:        —

═══════════════════ OPEN (unresolved only) ═══════════════════

- (none)
