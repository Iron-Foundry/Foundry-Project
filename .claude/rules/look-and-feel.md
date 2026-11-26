# Look and feel

**Scope:** how a session works on anything a person sees - a page, a control, a layout, a rendered image. The operator decides every look. A session builds the candidates the operator judges, on the preview bench, and moves a picked candidate into the product only on the operator's build word. `CLAUDE.md` cites this digest under `the_operator_picks_every_look`. The `crew-ui` agent executes it.

---

## The bench

The preview bench is the `previews/` folder at the repository root. Where the workspace runs the govlab gate, the folder is keyed `previews` in its paths file and excluded from the gate and the document checks.

- `the_bench_is_previewbench`: the bench is served by the previewbench desktop app on `http://localhost:3001`. The operator starts the app; a session never starts it. The app serves every registered project at `/p/<id>/`, this repository as `/p/the-foundry-project/`, and the active project at `/`. `GET http://localhost:3001/api/projects` lists the registered projects and their ids.
- `a_preview_is_served`: a written preview is served the turn it is written. Confirm the app serves with one `curl -s http://localhost:3001/api/projects`: the app answers with a JSON list, and a 404 or no answer means it does not serve. When it serves, writing `live.json` registers this repository on the bench and opens the page in the app, through the `PostToolUse` hook in `.claude/settings.local.json`. When it does not answer, start `python -m http.server 3001 --bind localhost --directory previews` in the background as the fallback, the row "the preview server" in `.claude/rules/standing-exceptions.md`. Hand over the `http://localhost:3001/...` address, never a file path.
- `the_bench_has_one_address`: the newest bench page is pointed at by `live.json` at the bench root, as `{ "path": "<aspect>/<page>.html", "note": "<what it asks>", "at": "<YYYY-MM-DD>" }`. Hand over `http://localhost:3001/p/the-foundry-project/live/` while the app serves, because `/live/` follows whichever project wrote its `live.json` last. Under the python fallback, hand over `http://localhost:3001/live/`.
- `a_width_variant_names_its_view`: a candidate drawn at a width carries `data-bench-size` naming its view, `phone`, `medium` or `wide`, with several views separated by spaces when one variant serves more than one. The renderer writes the attribute on the element that holds the whole variant, its label included. The previewbench width presets request the page with `?bench-size=<view>`, and the app hides every element whose `data-bench-size` does not name that view, so the operator sees only the variants of the chosen view. An element without the attribute, a heading, an option's name or the baseline, shows in every view. Under the python fallback or in a plain browser, every variant shows.
- `a_bench_page_links_relatively`: a bench page loads its stylesheet, art and scripts by relative path, so it renders the same at `/p/the-foundry-project/...` and at `/`. A path that starts with `/` resolves against the active project instead.
- `a_preview_cannot_reach_outside_its_root`: art a page needs comes from the product's dev server or is saved beside the page. A `../..` path climbs out of the server root and renders as a black box.
- `a_page_wears_the_product`: every bench page, a plan or a status page included, loads the product's compiled stylesheet and is built from the product's own classes. Never a home-made palette, a rounded card or a pill.
- `a_preview_defines_the_tokens_its_css_reads`: a page that inlines product CSS defines every custom property that CSS reads. An undefined `var(--x)` falls back silently.
- `a_preview_render_builds_first`: build the product stylesheet before a render when the compiled file is older than the newest source stylesheet.
- `a_comparison_is_one_table`: an options page is one table, one row per option, images at their render size.
- `outputs_are_webp`: a rendered image is lossless WebP, drawn at the pixel size it shows at. SVG only when the operator asks. Never PNG.

## Candidates

- `show_visual_options_dont_describe_them`: a looks decision gets every candidate built into one bench page on the real palette and surfaces. Never a text question. "Think of something" for a look is a looks decision too: build bold samples, never one quiet answer.
- `a_preview_draws_the_real_surface`: a candidate for a change to an existing surface copies that component's own markup, class strings and art. Never a simplified redrawing.
- `a_redesign_changes_the_structure`: "redesign" asks for new structure, hierarchy and surfaces. Icons, dividers and a new order on the same control are a restyle, never a candidate set alone. A complete rebuild draws every surface new.
- `a_look_option_is_a_new_look`: a set of looks a user chooses from draws new looks: frames, the user's own art, bold structure, depth. Never the product's own boxes under new names.
- `pronounced_keeps_the_element`: "make X more pronounced" keeps X's form and place and makes it bolder through fill, scale, crop, texture or edge. Never a new object, a hard shadow, an extrusion or rays.
- `new_candidates_lead_the_bench`: a bench page with several sets puts this round's candidates at the top. Accepted pages and the current state follow.
- `a_panel_is_seen_before_it_is_built`: a new panel kind is a bench page before it is product code, its empty and unlinked states included.

## The operator's decision

- `consult_before_layout`: a layout, design or styling change needs the plan approved first. A diagnosis is not a licence to edit.
- `refine_without_asking`: while a picked look is refined, put each round on the bench and read the feedback. Never ask the operator to pick between refinements. The operator says when the look is done.
- `settle_the_page_first`: refine a chosen page shape part by part in its own look first. What a press on it opens waits until the operator approves the page.
- `a_pick_is_not_a_build`: a pick on the bench ("lets do D4") moves the bench on. Product code changes only on the operator's build word.
- `a_pick_word_shared_by_options_is_asked`: when a pick word fits more than one option, ask which option before building.
- `a_pick_moves_whole`: a picked option moves into the product with its markup and its CSS order. Compare the product with the option before calling the pick applied.
- `a_build_keeps_the_previews_values`: a port to another medium copies the preview's constants and its measured computed styles. Never a re-derivation.

## Scope of a change

- `change_the_named_part_only`: a request changes the part it names, and only the properties it names. "Move it and make it smaller" never changes its colour.
- `a_stated_reason_reaches_every_match`: a request with a reason ("only two options") changes every element on the surface the reason fits, never the named one alone.
- `ui_work_is_the_controls`: "the UI needs work" asks for better controls, never a new layout. A new control lands once, in the product's shared controls folder, for the whole product.

## Controls and layout

- `no_invented_controls`: every control on a page or a surface is a class the product already has, at its real size and colour. Find the nearest existing use first. A new look or colour is the operator's call.
- `a_label_is_not_a_control`: a pressable element and a plain label never share one look. `a` and `button` are pressable. Every other element is plain.
- `a_product_control_replaces_the_native`: a dropdown, a number, a date and time and a file input are the product's own controls, never the browser's native ones, once the product has them.
- `a_rail_fits_its_content`: a sidebar or a rail is as tall as its content. A sticky rail taller than the window sticks by its foot, never with a scroll of its own.
- `scrolling_is_virtual`: a listing is a virtual infinite scroll at every width. Pages are a view option a reader switches to.
- `detail_opens_a_modal`: a listing's "show more" opens a dialog, never an expanding row. A card is never compacted past the point its art and name identify it.
- `an_editor_costs_the_box_nothing`: an editing control goes over the page or beside a measured box, never inside it. Edit and read render the same size.
- `one_frame_per_surface`: a framed surface uses one frame whole. Never stack a rail, end caps and a well into one piece.
- `art_is_for_its_subject`: a banner or a piece of art shows what its subject is, from that subject's own art. Never one template with only the content changed.

## Motion and tokens

- `nothing_repaints_forever`: no infinite animation, transition loop, frame loop, timer re-render or auto-poll. Motion runs on interaction, finitely, and stops. Animate `transform` or `opacity` only. Honour `prefers-reduced-motion`. Never `will-change` something static. A continuous effect needs the operator's approval, listed as an exception.
- `approved_loops`: the operator approves these continuous effects. Each one stops under `prefers-reduced-motion`.

| effect | where |
| --- | --- |
| The Tile Race progress bar pans and shifts its hue without end | `.tilerace-progress-track` in `web-app/styles/globals.css` |
- `type_sizes_are_rem`: a type size is a rem token, never a px value. The reader's text size is the root font size.
- `classes_are_tokens`: a class names a theme token or a native step, never a bracket value. A missing value becomes a token first.

## Measure before handover

- `measure_against_the_siblings`: a change to one card, row or control is measured against its siblings at every breakpoint before it ships. A type check and a build never see a layout.
- `a_bench_is_measured_before_handover`: probe a bench in both Chromium and Firefox for content outside its section, page-anchored pieces and surfaces off their width. One probe run per change, and no numbers in the handover unless one is a defect.
- `a_layout_is_measured_in_both_engines`: Firefox sizes a fit-content flex box from its items' content, never their `flex-basis`.
- `captures_are_asked_for`: a screenshot or a capture runs only when the operator asks this turn. Never offer one as a verification step.

## Precedence

`CLAUDE.md` > this digest > `.claude/agents/crew-ui.md` > memory.
