---
name: vocabulary
summary: The closed concern vocabulary this deployment draws from. Adding a word is a deliberate SSOT edit, never a convenience.
type: taxonomy
concern: governance
status: current
validates: [paths]
---

# Concern vocabulary

The raw word list. The rules that turn it into a deterministic standard live in
`placement.project.taxonomy.md` — read that first; this file is the closed vocabulary it draws from.

The machine-readable form is `taxonomy.config.ts`. That file is authoritative for the gate; this one
is authoritative for a reader. They are cross-checked — **a tag in one and not the other is a bug in
whichever drifted.**

**The SSOT holds data, not reasoning.** It carries the declarations a rule reads. Every rule *about*
those declarations lives here, because a rule written into a config is a document wearing a schema
and no code ever reads it.

## Scope

54 concerns. The inherited set carried 310 across 43 sections including GAME ENGINE, WEB PLATFORM,
UI, EVENT-DRIVEN and STORAGE families. Those five are **dropped in full** — this deployment has no
renderer, no UI, no message bus, no database and no server tier, and the standard's own rule governs
the choice: a family that classifies nothing is not a closed set kept honest, it is unread words
that make the real set harder to search.

Each dropped family returns by SSOT edit if the surface ever lands. The trigger is recorded so the
answer to "why is there no concern for this?" is present rather than absent.

| dropped family | revival trigger |
|---|---|
| GAME ENGINE | authoring engine-side systems rather than configuring resources |
| WEB PLATFORM | a web surface authored in this repository |
| UI | an authored interface with presentation state |
| EVENT-DRIVEN | a message bus or event store we own |
| STORAGE | persistent state we author, beyond the control plane's own |

## How a word is read — position, not membership

Resolution is **positional, not lexical**. The concern is the last dot-segment before the extension,
the subject is the first, the variant sits between. A word is read by the slot it lands in, never by
which array declares it.

- **concern slot** — must be a declared concern tag. Closed set.
- **subject slot** — any declared subject **or any concern tag**, because a file may be about a class
  of things: a registry of rules, a validator of schemas.
- **variant slot** — drawn from `variants` ∪ `subjects`. A declared word like every other slot.
- **subject must not equal concern.** `config.config.ts` is degenerate — the subject carries no
  information.

The legal subject set is `subjects` ∪ every concern tag, so `subjects` lists only domain nouns that
are **not already concerns**, and the config's type assertions fail on a redundant redeclaration.

A concern word in the subject slot is legal only when the file's target *is* that class of thing.
`rule.registry.ts` is a registry of rules. That does not licence `rule.cache.ts` meaning "a cache
that internally holds rules" — that is a variant wearing a subject's clothes.

**A hyphen inside a slot is spelling; the dot is the only separator.** Kebab-case throughout. A
folder carries one word and never a dot.

## Adding a word is the last resort

**An undeclared word is not a licence to add it.** Work the steps in order.

1. **Pick an existing word.** The vocabulary is small on purpose. Most undeclared words are a
   synonym, an abbreviation, or a process-name for something already declared.
2. **Reason the word.** Subject = a noun naming a thing the system HAS. Variant = a noun that
   NARROWS a subject. Concern = a role a FILE PLAYS. Container = a grouping of modules. State which
   and why from the word's own meaning — never from where the file currently sits.
3. **Apply the is-a test.** Does a file IS-A this word? Then it is a role → `concerns`. Does the
   system merely HAS-A it? Then it is a domain noun → `subjects`.
4. **If it fails the reasoning, the filename is wrong.** Rename the file. Do not bend the vocabulary
   to fit a bad name.
5. **If the file has two roles, the file is wrong.** Split it. The ambiguity is the finding.
6. **Only if it survives, propose it.** Approved after the reasoning is shown. Never silently, never
   in bulk, never to make a check pass.

### Reject on sight

- **nominalised verbs and processes** — names what the system DOES, not what it HAS
- **adjectives** — no slot takes them
- **plurals as subjects** — a subject is singular
- **abbreviations duplicating a real word**
- **grouping labels** — `misc`, `common`, `shared`, `core`, `util`. Names a bucket, not a thing. This
  governs the subject slot; a grouping is exactly what a container is for. `base` is exempt, below.
- **measurements and properties** — data, not files
- **generic catch-alls** — `util`, `helper`, `handler`, `manager`, `thing`. They exclude nothing, so
  they classify nothing.
- **instance ids** — registry entries are content, not vocabulary
- **a word overlapping an existing entry**
- **a compound that swallowed a concern** — the tail is the concern, the head is the subject

> The inherited vocabulary declared `util`, `helper` and `handler` as concerns **and** rejected them
> as generic catch-alls. That contradiction is resolved here in the direction the rejection argues:
> none of the three is declared. A file reaching for `handler` takes `processor`, `coordinator` or
> `service` by what it actually does.

**`manager` is not a concern.** It names a stature, not a role, which is why it attaches to lifecycle
owners, caches, registries and coordinators alike. It resolves to `coordinator` (owns a lifecycle,
drives collaborators) or `service` (stateful capability). A file that cannot choose is doing both —
split it.

**`base` is the one sanctioned generic subject.** It means the file is generic over its subject and
would be byte-identical in any domain. Both tests must hold: generic over its type parameters, and
naming no domain noun anywhere in its source. A file mentioning any domain noun takes that noun
instead. `base` is not a home for files that resist classification.

## The concerns

Each tag carries exactly one canonical layer. The spine is
`domain > application > processing > runtime > infrastructure > operations > product`, ordered
domain-ward, and used **only as a tie-break**. It is the classification axis — what kind of thing a
file is — and says nothing about who may depend on whom.

### Structure and contract — infrastructure / domain

| folder | file tag | layer |
|---|---|---|
| `contracts` | `.contract.` | infrastructure |
| `specifications` | `.specification.` | domain |
| `schemas` | `.schemas.` | infrastructure |
| `types` | `.types.` | infrastructure |
| `constants` | `.constants.` | infrastructure |
| `predicates` | `.predicate.` | infrastructure |
| `guards` | `.guard.` | infrastructure |

### Dependency and extension — infrastructure

| folder | file tag |
|---|---|
| `registries` | `.registry.` |
| `resolvers` | `.resolver.` |
| `loaders` | `.loader.` |
| `factories` | `.factory.` |
| `manifests` | `.manifest.` |
| `bindings` | `.binding.` |
| `plugins` | `.plugin.` |
| `config` | `.config.` |
| `caches` | `.cache.` |

### Domain modelling — domain

| folder | file tag |
|---|---|
| `rules` | `.rule.` |
| `policies` | `.policy.` |
| `models` | `.model.` |
| `invariants` | `.invariant.` |
| `constraints` | `.constraint.` |
| `records` | `.record.` |
| `collections` | `.collection.` |
| `snapshots` | `.snapshot.` |

### Application services — application

| folder | file tag |
|---|---|
| `coordinators` | `.coordinator.` |
| `orchestrators` | `.orchestrator.` |
| `services` | `.service.` |
| `stages` | `.stage.` |
| `steps` | `.step.` |

### Serialization and processing — processing

| folder | file tag |
|---|---|
| `readers` | `.reader.` |
| `writers` | `.writer.` |
| `transformers` | `.transformer.` |
| `normalizers` | `.normalizer.` |
| `formatters` | `.formatter.` |
| `pipelines` | `.pipeline.` |
| `processors` | `.processor.` |
| `filters` | `.filter.` |
| `validators` | `.validator.` |
| `matchers` | `.matcher.` |
| `comparators` | `.comparator.` |
| `iterators` | `.iterator.` |
| `generators` | `.generator.` |
| `analyzers` | `.analyzer.` |
| `inspectors` | `.inspector.` |

### Failure and reporting — operations

| folder | file tag |
|---|---|
| `errors` | `.error.` |
| `results` | `.result.` |
| `reporters` | `.reporter.` |
| `reports` | `.report.` |
| `taxonomy` | `.taxonomy.` |

### Runtime and product

| folder | file tag | layer |
|---|---|---|
| `entrypoints` | `.entrypoint.` | runtime |
| `runners` | `.runner.` | product |
| `fixtures` | `.fixture.` | product |
| `references` | `.reference.` | product |
| `templates` | `.template.` | product |

### Plurality

| form | folder | file tag | example |
|---|---|---|---|
| collection — one file defines many members | plural | **plural** | `schemas/` ⇒ `record.schemas.ts` |
| single-unit — one instance per file | plural | singular | `validators/` ⇒ `placement.validator.ts` |
| mass / uncountable | singular | singular | `config/`, `taxonomy/` |

Collection concerns here: `schemas`, `types`, `constants`. Mass concerns: `config`, `taxonomy`.
Everything else is single-unit.

## Covered by a meta concern — do not add

The rejected list is the useful half of a closed vocabulary. Each entry reads like a deployment
concern and is already an agnostic one.

| tempting tag | classify as | why |
|---|---|---|
| `checker`, `linter` | `validator` | it decides valid or invalid |
| `scanner` | `analyzer` or `inspector` | it reads and derives, it does not judge |
| `parser`, `lexer`, `tokenizer` | `reader` | it turns a format into structure |
| `fixer`, `healer`, `repairer` | `transformer` | it maps input state to output state |
| `walker`, `crawler` | `iterator` | it yields members of a set |
| `gate` | `predicate` or `validator` | a gate is a decision, not a thing |
| `index` | `registry` | a lookup structure is a registry |
| `helper`, `util` | none — the file has a real role | find it and name it |
| `manager` | `coordinator` or `service` | split by what it actually does |
| `handler` | `processor` or `coordinator` | it names stature, not role |
| `doc`, `guide`, `note` | `reference` | authored knowledge is a reference |
| `digest`, `summary` | `reference` or `rule` | by whether it informs or obliges |
| `checklist`, `plan` | `specification` | it declares required end state |
| `inventory` | `registry` | a named set of known members |
| `changelog` | none — structurally exempt | history has one home, outside the taxonomy |

`digest` deserves a line: it is a cryptographic concern in the inherited vocabulary and a
rule-summary in our prose. Declaring it would collide two meanings on one tag, so it is declared
neither way — a rule expansion is a `rule`, and a knowledge summary is a `reference`.

## The subjects

**The subject array is the one slot whose members are a project's own nouns**, so it is not listed
here: it lives in the configuration, where a host adds what it HAS and nothing else. A subject list
transcribed into prose is a second vocabulary that disagrees with the compiled one the first time
either moves — and the compiled one is the copy the assertions check.

What the array holds is decided by one rule and it is the same in every host: **a noun this deployment
actually has, excluding every word already a concern tag.** A word that names stature rather than
substance — a manager, a handler, a helper, a util — classifies nothing and is refused whatever the
host.

The array is closed. An undeclared word is an approved edit to the configuration, never a naming choice
made at authoring time, and the cross-slot assertions compiled beside it reject a subject that shadows a
concern tag before a single file is placed.

## The variants

`claude` · `comms` · `project`

A variant is present only on a genuine collision within one folder, or to name a facet the subject
alone does not. No collision and no facet means one compound kebab subject and no variant.
