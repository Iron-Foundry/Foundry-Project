# Code shape

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that every source file stays under its line ceiling, that every function is pure and does exactly one thing, and that clarity comes from names and reused patterns rather than from comments.

**Where it binds:** every tree a session writes code in. Where a tree's own gate holds a line or function cap (the govlab `file-length` and `long-function` concerns, a line-count script, a linter rule), that gate's number is the hard cap and these ceilings are the target beneath it. `CLAUDE.md` cites this digest under `code_is_shaped`.

%% META %%:
    intent: "A file you can hold in your head, built from functions you can reason about without reading their bodies"
    objective: "No source file exceeds its ceiling, no function does two jobs, and no comment restates what the code already says"
    context: "Ceilings are a smell detector, not a budget. A file at 148 lines doing three unrelated jobs fails this policy; a 240-line table component that renders one table passes"
    criteria: "Every file under its tier's ceiling, every extracted unit named for its result, every surviving comment answering WHY"
    priority: high
    trust: measured_line_count = TRUSTED, estimated_line_count = UNTRUSTED

DECLARE standard_ceiling: number
DECLARE design_ceiling: number
DECLARE stylesheet_ceiling: number
DECLARE exempt_kinds: array

SET standard_ceiling = 150     # logic, state, hooks, servers, utilities, types
SET design_ceiling = 250       # markup- or token-dense files, PHASE 2 defines the test
SET stylesheet_ceiling = 500   # every stylesheet
SET exempt_kinds = ["data_module", "generated", "vendored"]

# PHASE 1: MEASURE BEFORE JUDGING
    @purpose: "The ceiling is a fact about the file, not an impression of it"

    RULE count_it_dont_estimate:
        ALWAYS MEASURE the file WITH `wc -l` BEFORE claiming it is over or under
        # total physical lines - blanks, imports and comments all count
        NEVER ESTIMATE a line count FROM having read the file

    RULE check_at_write_time:
        WHEN creating a file OR adding to one:
            MEASURE the result
            IF result > ceiling FOR its tier:
                SPLIT it IN the same change
                NEVER DEFER the split (`caught_means_fixed`)

    RULE inherited_breaches_split_on_contact:
        WHEN an existing over-ceiling file is edited FOR an unrelated reason:
            SPLIT it AS part of that change
        NEVER OPEN a standalone pass TO bring untouched files under the ceiling

    VALIDATION GATE:
        ✅ every file in the diff measured, not estimated
        ✅ nothing in the diff lands over its ceiling
        ✅ no file rewritten purely to chase the number

# PHASE 2: WHICH CEILING APPLIES
    @purpose: "Two tiers, and a test that decides between them without argument"

    RULE standard_is_the_default:
        ALWAYS APPLY standard_ceiling UNLESS the design test below passes

    RULE design_ceiling_must_be_earned:
        APPLY design_ceiling only WHEN the file is BOTH:
            - dominated BY markup or design tokens, NOT by branching, AND
            - a SINGLE coherent surface (one component, one page, one palette)
        NEVER CLAIM the design ceiling FOR a file that merely happens TO be long
        NEVER SPLIT one visual surface INTO fragments purely TO satisfy standard_ceiling

    RULE data_modules_are_exempt:
        WHEN a module is a literal table AND contains no branching:
            EXEMPT it FROM both ceilings
        REQUIRE the module TO export data AND nothing else
        WHEN logic appears IN a data module:
            MOVE the logic OUT; the exemption dies WITH the first `if`

    VALIDATION GATE:
        ✅ every design-ceiling claim satisfies BOTH halves of the test
        ✅ no exempt data module carries branching or behaviour

# PHASE 3: HOW TO SPLIT
    @purpose: "The split must reduce total complexity, not relocate it"

    RULE split_along_a_seam:
        # a module is named for the role it plays; a helper bucket plays none
        ALWAYS SPLIT at a boundary that already exists IN the file:
            - pure computation OUT of a component (sorters, derivations, formatters)
            - one repeated block OUT as one component
            - a self-contained sub-surface OUT as its own file
        NEVER SPLIT at an arbitrary line
        NEVER CREATE a `helpers` / `utils` grab bag - name the module FOR what it holds

    RULE extraction_must_pay:
        REQUIRE the extracted unit TO be independently nameable AND independently readable
        IF the caller must read the extracted body TO understand the call site:
            REJECT the extraction - the seam was wrong

    RULE colocate_the_pure_part:
        WHEN a component needs a pure transform:
            EXPORT it FROM the component's own module OR a named sibling

# PHASE 4: FUNCTION SHAPE
    @purpose: "Pure, single-purpose, and named for its result"

    RULE one_thing_well:
        ALWAYS GIVE a function exactly one job, statable IN one sentence WITHOUT "and"
        NEVER MIX computing a value WITH emitting an effect (fetch, write, log, setState)

    RULE prefer_pure:
        ALWAYS WRITE the computation AS a pure function of its arguments
        NEVER READ module state, clocks, randomness, or `window` INSIDE it
        NEVER MUTATE an argument (copy, then sort/splice)
        WHEN a value is genuinely ambient (now, locale, random order):
            PASS it IN AS a parameter WITH a default

    RULE name_for_the_result:
        ALWAYS NAME a function FOR what it returns or does
        ALWAYS NAME a boolean AS a predicate: `isActive`, `hasLinkedGroup`
        NEVER NAME a function `handle`, `process`, `doWork`, `manage`, or `data`

    RULE reuse_before_reimplement:
        BEFORE writing a transform: SEARCH the codebase FOR one that already does it
        WHEN the same shape appears a THIRD time: EXTRACT it
        NEVER FORK a near-duplicate - parameterise the original
        NEVER GENERALISE on the first occurrence

    VALIDATION GATE:
        ✅ every new function describable in one "and"-free sentence
        ✅ computation separated from effect
        ✅ no argument mutated in place
        ✅ no third copy of a transform left unextracted

# PHASE 5: COMMENTS
    @purpose: "Comments earn their place by carrying what the code cannot"

    RULE a_stripped_tree_carries_no_comment:
        WHERE a comment stripper OR a no-comment rule reaches a file: WRITE no comment AT all
        ELSE: APPLY the two rules below

    RULE forbidden_comments:
        NEVER WRITE a comment that restates the line, labels a section, narrates the change,
            repeats the signature, carries a name, a date or a ticket number, or comments OUT code

    RULE permitted_comments:
        WRITE a comment only WHEN it carries an external constraint (an API's behaviour, a browser bug,
            a spec bound) OR a consequence of a change that fails SILENTLY
        WHEN the comment is design rationale: WRITE it TO `.claude/reference/` OR the memory store INSTEAD

    VALIDATION GATE:
        ✅ every surviving comment answers WHY or records an external constraint
        ✅ any block that needed a comment was extracted and named instead

# PHASE 6: FAILURE
    @purpose: "Fail fast, never silence"

    RULE fail_fast_never_silence:
        ALWAYS VALIDATE at the edge AND REFUSE to start ON invalid configuration
        ALWAYS LET an error raise TO the one boundary that translates it
        NEVER SWALLOW an exception OR RETURN a default that hides absence OR a failure
        NEVER RENDER a failure AS empty - a caught error is a state, not a blank
        # logging is not handling; a logged-and-continued failure is a silenced one

    RULE a_service_is_never_quiet:
        WHEN a pass or a service works for longer than a minute:
            LOG each stage AS it starts and ends, AND its progress at an interval

ALWAYS:
    - MEASURE with `wc -l` before asserting a file's size
    - WRITE pure functions that do one thing and are named for their result
    - EXTRACT a block instead of commenting it
    - REUSE an existing transform before writing a second one
    - SPLIT an over-ceiling file in the change that touches it

NEVER:
    - CLAIM the design ceiling for a file that is long rather than design-dense
    - SPLIT a file at an arbitrary line or into a `utils`/`helpers` bucket
    - MIX computation with effects, or mutate an argument
    - GENERALISE on the first occurrence, or fork a near-duplicate on the third
    - RUN a bulk pass over untouched files purely to chase line counts
