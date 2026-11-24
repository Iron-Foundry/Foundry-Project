# Wording

**Scope:** the operator's own wording rules. They bind every sentence a session writes: a reply, a document, a commit, a changelog line, and the copy a product ships. The register itself is `.claude/rules/ste100.md`. This digest holds the vocabulary and the copy rules that sit on top of it. `CLAUDE.md` cites it under `wording_is_the_operators`.

---

## The register

- `ste100_is_the_register`: every sentence you send or save is ASD-STE100. One topic. Present tense. Active voice. Articles kept. Under 20 words for an instruction, 25 for a description. Check each sentence before you send it. The ruleset is `.claude/rules/ste100.md`.
- `short_responses`: answer first, in the fewest complete words. No preamble, no filler, no self-recap.
- `no_em_dashes`: never write an em dash (U+2014) in a file or a reply. Use a hyphen, `. `, `: `, parentheses, or one of `• → ← ° > < » «`.
- `docs_are_terse`: a loaded document costs tokens every session. Write a fact as a table row or a one-line bullet. Keep a reason only where breaking the rule fails silently, and keep it to one clause.

## The vocabulary

| slug | the rule |
|---|---|
| `say_all_never_every` | Copy says "all", never "every": "All notifications", never "Every notification". |
| `say_image_never_picture` | Copy, an API name and an API doc say "image" or "images", never "picture". A code identifier keeps its spelling. |
| `say_notification_never_notice` | Copy names an inbox item a "notification", never a "notice". |
| `an_action_is_a_plain_verb` | An action label opens with a plain verb: Fetch, Create, Edit, Remove, Restore, Preview, Upload. Never "Take X away", "Read X", "Replace X", "Measure X", "Let go of X" or "Put X back". |
| `no_group_labels` | Copy never labels a group of things "Each <thing>" or "The whole <thing>", a current reading "Now", or a range "two dates". Name the group by what it holds. |
| `one_word_one_role` | A word that names one thing never names a second one. When a word already has a meaning in the code, copy uses another word for the other thing. |

## Who writes the copy

- `the_operator_writes_the_copy`: a complaint about bad wording waits for the operator's exact lines. Never draft a rewrite unasked. A request to edit a title or a description gets drafts to pick from, and a rejected set gets a new set.
- `the_operator_names_the_feature`: a feature carries the name the operator gives it, in the copy, the path, the identifiers, the docs and the memory. Never invent a name. A working label needs the operator's word before it reaches any of those.
- `pasted_copy_takes_plain_quotes`: copy the operator pastes keeps its words, but each curly quote or apostrophe becomes a plain `'` or `"`.
- `a_copy_change_goes_to_its_source`: a text change on a surface edits the source string that every copy reads. Never swap the text at one render.
- `a_title_request_covers_the_snippet`: a request to change a page title also changes its description, in one pass.

## What copy says

- `a_surface_does_not_explain_itself`: a heading, a banner line or a frame carries facts, such as a name, a count or a date. Never a sentence that explains how the site or a feature works.
- `a_page_head_lists_no_features`: a page title or description says what the page is for. Never a list such as "requirements, stats and chat".
- `copy_is_plain`: copy is plain and specific. Never giddy, never salesy, never a superlative the product cannot prove.
- `dont_invent_domain_requirements`: ship a requirement in the operator's words. Never expand it into specifics the operator did not state. Never assert how a third-party domain works. Ask one question instead.
- `a_mockup_shows_realistic_content`: content that does not exist yet is realistic mock entries with varied length and tone, labelled once as mock in the page intro. Never blank boxes or "placeholder text".
- `a_mock_state_is_one_the_product_allows`: a mock never shows a missing required field or a failed check that the form already enforces.
- `no_empty_alt_text`: every image carries alt text that names it. Never write `alt=""`.

## Names in code

- `test_names_are_short`: a test name is at most seven words, `test` included. The detail lives in the body.
- `a_revision_is_named_before_it_is_run`: a migration id is a noun phrase, or a verb plus its object, in the words the columns already use, at most 32 characters.
- `name_for_the_result`: a function is named for what it returns or does. Never `handle*`, `process*`, `doWork` or `*Data`.

## Precedence

`CLAUDE.md` > this digest > `.claude/rules/ste100.md` > memory.
