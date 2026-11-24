---
name: file-placement
description: Name and place any file created, moved or renamed under a governed root - the concern grammar, the ordered-role depth rule, the determination protocol for choosing a concern, and the ladder for proposing a new vocabulary word. Use before writing any new file, before creating any folder, and whenever a file resists classification.
---

# file-placement

Every file created under a governed root is **born conformant** — named and placed correctly at
creation, never queued for a later conversion.

Digest: `.claude/rules/taxonomy.rule.md`. The closed vocabularies and the declared roots are the
package configuration's, and the placement and naming checks read them from there rather than from a
document, so a word this skill spells and a word the configuration declares can never disagree.

## 0. Is it governed?

**A governed root is one the configuration declares. No declaration, no enforcement** — outside them
the grammar does not apply and nothing is renamed to satisfy it.

Three classes sit outside, each for a stated reason: a tree carrying another system's ownership
markers, whose names are identifiers that system resolves at run time; a tree holding material
authored elsewhere, declared once as an upstream root so the naming, tense and reference checks
exempt it together; and the vocabulary's own definition, which cannot be governed by the grammar it
declares.

Exempt inside a governed root: ecosystem-fixed names resolved by exact string. A compound marker in a
filename is name-exempt and **never** placement-exempt.

## 1. Determine the concern — read, do not guess

```text
1. READ the file. what does it actually do?
2. NAME the concern — the narrowest accurate tag, not a saturated one
3. CHECK the vocabulary in order:
     in the configuration -> use it
     in the rejections    -> use the concern it points to
     none of the above    -> UNRESOLVED. a finding, not a blocker —
                             it usually means the file does two things
4. VERIFY the name against the content, never against the old filename
5. one concern per file. two concerns = split, never a compromise tag
```

Narrowest wins: a coordinator over a service. Irreducible overlap breaks domain-ward:
`domain > application > processing > runtime > infrastructure > operations > product`.

Common redirects: a checker is a `validator` · a scanner is an `analyzer` or an `inspector` · a parser
is a `reader` · a fixer is a `transformer` · a walker is an `iterator` · an index is a `registry` · a
document is a `reference` · a checklist is a `specification`. `manager`, `handler`, `helper` and
`util` are not concerns — they name stature or nothing, so they classify nothing.

## 2. Place it

```text
container(1) → subject(2, optional) → concern(3) → file       depth within the declared cap
```

Roles resolve `container < subject < concern`, each depth consuming a role strictly later than the
last. Skippable, never repeated, never revisited. **The file's parent is always a concern folder.**

A **subject folder** exists *if and only if* the container holds two or more sets of one concern that
must not merge. One set gets a bare concern folder.

A **bucket** holds one collection concern, files and never folders, and the depth cap does not apply
inside one.

## 3. Name it

```text
<subject>.<concern>.<ext>              standard
<subject>.<variant>.<concern>.<ext>    overflow
```

The concern tag equals the parent folder's label in the plurality form the configuration records — a
collection concern plural in both, a single-unit concern with a plural folder and a singular tag, a
mass concern singular in both.

A **variant** appears only on a genuine collision within one folder, or to name a facet the subject
alone does not. Otherwise one compound kebab subject and no variant.

**The member never restates the set.** Inside a concern folder, the file names its own subject rather
than repeating the folder.

Resolution is positional: a concern tag is a legal subject. The one bar is subject ≠ concern.

## 4. Overflow relieves sideways

A collision takes the **variant slot**. Breadth takes a **sibling subject folder**. Depth is never the
relief — the cap is *why* both slots exist, and removing it degenerates both into nesting.

## 5. Undeclared word? Work the ladder

1. **Pick an existing word** — most undeclared words are a synonym or a process-name for something
   declared.
2. **Reason it** — a subject is a noun the system HAS, a concern is a role a file PLAYS.
3. **Is-a test** — a file IS-A this word → it is a concern. The system HAS-A it → it is a subject.
4. **If it fails, the filename is wrong.** Rename the file rather than bending the vocabulary.
5. **If the file has two roles, the file is wrong.** Split it.
6. **Only if it survives, propose it** — approved, reasoning shown, never silently and never to make
   a check pass.

**An identity another surface allocates is DERIVED into a slot and never declared into the array.** A
vocabulary that grows by one word per instance is not closed, and copying an allocator's output into a
second list makes two owners of one fact that disagree the moment one moves.

Never add a word so a check passes, and never answer a finding with an ignore list — that hides the
violation and every future one under the same name.

## 6. Before renaming anything existing

Enumerate every **pattern-referenced** surface first, and verify afterwards that each resolves the
same set. The reference-bearing fields across the governed documents form a reference graph encoded in
text, and the segment tool derives it — the count is read from its report rather than stated here,
because a transcribed count is a derived fact maintained by hand. A missed rename resolves to nothing,
errors nowhere, and disconnects the graph silently.

**A rename is a create at its destination**, so the destination is read before the write and the two
names are never both live.

Structure is machine-decidable and safely repaired. **Classification is judgement and never
automated.**
