---
name: pag-rulesets
description: Convention - repo rulesets are authored as PAG POLICY docs in .claude/rules/; CLAUDE.md keeps terse one-liners as loaded authority
metadata:
  type: project
---

Rulesets in this repo are authored in PAG (Pattern Abstract Grammar) as
`type: POLICY` documents under `.claude/rules/`, following the grammar in
`.claude/intel/` (`reference_pag_grammar.md`, `reference_pag_guide.md`,
`reference_pag_keywords.md`). Established 2026-07-23 at user direction.

**Why:** the user wants rulesets expressed in the PAG structural grammar (phase
+ VALIDATION GATE + ALWAYS/NEVER/WHEN, slug-keyed), consistent with the
BanesLab intel toolkit already in `.claude/intel/`.

**How to apply:**
- New ruleset -> a PAG POLICY at `.claude/rules/<name>.md` (`THIS POLICY
  ENFORCES ...`, `%% META %%`, phase-gated where it has flow, ALWAYS/NEVER/WHEN).
- Existing PAG rulesets: `.claude/rules/behavioral.md` (full CLAUDE.md rule
  corpus, slug-keyed) and `.claude/rules/testing.md` ([[tests-follow-code]]).
- CLAUDE.md's `# BEHAVIORAL RULES` one-liners stay the LOADED, highest-precedence
  authority; the PAG docs are the canonical formal expression, deliberately kept
  OUT of CLAUDE.md so the always-loaded file stays token-frugal (`# AXIOM`).
- Precedence unchanged: AXIOM > CLAUDE.md rules > `.claude/rules/*` > memory.
- The older prose digests (`agent-invocation.md`, `memory.md`) are not yet PAG;
  convert on touch if asked.
