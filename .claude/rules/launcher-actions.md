> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that every operator-facing job in this monorepo reaches its operator through the root launcher, as one catalog entry that names its options, declares what it needs, and resolves to a command the operator can read before it runs.

%% META %%:
    intent: "One front door for every job a human runs, so the root never grows a second pile of near-duplicate scripts"
    objective: "A new job is discoverable from `./run` on the day it lands, on every platform, with no root file added"
    context: "Root carries `run`, `run.ps1`, `run-tests.sh`; `scripts/run.py` + `scripts/launcher/` hold the launcher; `scripts/` holds the shell jobs it dispatches to"
    criteria: "`./run --list` names the job, `./run --print <slug>` shows the exact command, and the shown command is the one that executes"
    priority: high
    trust: catalog = AUTHORITATIVE, root_script = FORBIDDEN, undocumented_action = INCOMPLETE

DECLARE job_kind: string
DECLARE action_slug: string
DECLARE dispatch_mode: string
DECLARE required_tools: array

SET dispatch_mode = "none"
SET required_tools = []

# PHASE 1: DOES IT BELONG IN THE CATALOG
    @purpose: "Separate the jobs an operator invokes from the code that machines invoke"

    RULE operator_facing_jobs_are_actions:
        WHEN the work is a job a human starts BY hand
             (start a stack, run a lane, sync a database, export secrets, prune a host):
            SET job_kind = "action"
            ALWAYS ADD it TO "scripts/launcher/catalog.py"
            NEVER ADD a new script TO the repository root
        WHEN the work is invoked BY a machine (CI step, Dockerfile CMD, systemd unit, cron):
            SET job_kind = "invoked"
            ALWAYS LEAVE it AS a directly callable script
            # `.github/workflows/e2e.yml` calls `bash run-tests.sh e2e`; the launcher
            # is a convenience over that script, never a dependency of it

    RULE the_root_is_closed:
        ALWAYS TREAT the root file set AS closed: "run", "run.ps1", "run-tests.sh"
        WHEN a change would add a fourth root script:
            REPORT the intent
            ADD an Action INSTEAD

    RULE both_kinds_can_be_true:
        WHEN a machine-invoked script ALSO has a human caller:
            KEEP the script callable directly
            ADD an Action that dispatches TO it
            NEVER FORK the logic INTO the launcher
            # a launcher entry wraps a script; it never becomes a second copy of it

    VALIDATION GATE:
        ✅ job_kind decided from who invokes it, not from how big it is
        ✅ no new file lands in the repository root
        ✅ a machine entry point stays callable without the launcher

# PHASE 2: AUTHOR THE ACTION
    @purpose: "An entry an operator can read: what it does, what it needs, what it will change"

    An `Action` (`scripts/launcher/actions.py`) is declarative. Fill every field that applies:

    | Field | Meaning | Omit when |
    |---|---|---|
    | `slug` | the CLI name (`./run <slug>`) | never |
    | `section` | `Run` \| `Test` \| `Maintenance` | never |
    | `label` | the menu line, lowercase, verb-first | never |
    | `summary` | one sentence: what it does to what | never |
    | `build` | `(Options) -> list[Step]` | never |
    | `choices` | one-of-N values, first is the default | there is no choice |
    | `flags` | booleans, `--flag` / `--no-flag` | there is no toggle |
    | `extra_hint` | describes what `-- ...` appends | it takes no extras |
    | `requires` | executables that must resolve | it shells out to nothing |
    | `warning` | the destructive or outward-facing consequence | it changes nothing lasting |

    RULE the_summary_states_the_effect:
        ALWAYS WRITE what the job does TO what
        NEVER WRITE which script it happens TO call
        # the operator picks by outcome; `--print` already shows the command

    RULE warn_on_consequence_not_on_complexity:
        WHEN the job drops or recreates data, overwrites a tracked file, or reaches
             a non-local environment:
            ALWAYS SET `warning` TO the consequence IN one clause
        NEVER SET `warning` merely BECAUSE the job is long or has many steps

    RULE declare_every_binary_you_shell_to:
        FOR EACH executable the built Step invokes:
            APPEND it TO required_tools
        ALWAYS SET `requires` = required_tools
        # `context.missing()` resolves these and the menu greys the gap; a missing
        # tool must surface before the command runs, not as a shell error after

    RULE defaults_are_the_safe_end:
        WHEN a flag selects between preview and mutation:
            ALWAYS DEFAULT TO the preview (`dry_run=True`, apply off)
        WHEN a choice selects an environment:
            ALWAYS ORDER the values so dev-like comes first
            # `Choice.default` is `values[0]`; ordering IS the default

    VALIDATION GATE:
        ✅ slug, section, label, summary and build are all present
        ✅ every executable the Step invokes appears in `requires`
        ✅ a destructive or outward-facing job carries a `warning`
        ✅ the first value of every choice is the safe one

# PHASE 3: BUILD THE STEPS
    @purpose: "Resolve to a real command, on this machine, without inventing a second implementation"

    A `Step` is `argv` + `cwd` + `env`. The builder returns a list; they run in order and
    stop at the first non-zero exit.

    RULE port_only_what_is_trivial:
        WHEN the underlying invocation is a handful of arguments (an `infisical run`
             wrapper, a `docker compose up`):
            BUILD it IN Python (see "scripts/launcher/stack.py")
            DELETE the shell twins it replaces
        WHEN the underlying script carries real logic (scheduling, traps, port
             detection, container lifecycle):
            ALWAYS DISPATCH TO the script
            NEVER REWRITE it INTO the launcher
            # `run-tests.sh` stays bash: its scheduler and WSL handling are tuned

    RULE one_twin_per_platform:
        WHEN the job has both a ".sh" and a ".ps1":
            USE `prefer_powershell()` TO pick: ".ps1" ON Windows, ".sh" elsewhere
            SET dispatch_mode = "twin"
            ALWAYS PASS each twin ITS OWN argument syntax
            # the shells disagree: `--env=prod --apply` vs `-Env prod -Apply`
        WHEN only one form exists:
            SET dispatch_mode = "single"
            ALWAYS DECLARE the interpreter IN `requires` SO the gap is reported

    RULE relative_paths_with_an_explicit_cwd:
        ALWAYS SET `cwd` = ROOT
        ALWAYS PASS a bash script AS a repo-relative path
        # the scripts resolve siblings off `$0` and run `docker compose` off the cwd;
        # an absolute Windows path handed to bash breaks both

    RULE the_launcher_environment_stops_at_the_launcher:
        WHEN uv exports state INTO the launcher's own process:
            APPEND that variable TO `runner.INHERIT_BLOCKLIST`
        # VIRTUAL_ENV leaked once and made every nested `uv run` warn per step

    VALIDATION GATE:
        ✅ no tuned script was reimplemented in Python
        ✅ the twin choice goes through `prefer_powershell()`, not an ad-hoc check
        ✅ `cwd` is ROOT and bash targets are repo-relative
        ✅ nothing from the launcher's own environment reaches the child

# PHASE 4: MAKE IT FINDABLE
    @purpose: "An action nobody can find is not available"

    RULE document_where_the_job_lives:
        WHEN the action wraps a script IN "scripts/":
            ADD or UPDATE its row IN "scripts/README.md"
        WHEN the action is built IN Python:
            NAME the module IN the "scripts/README.md" module table
        ALWAYS APPEND the stable location TO ".claude/INDEX.md"

    RULE the_readme_lists_only_the_front_door:
        ALWAYS KEEP the root "README.md" examples TO the everyday actions
        ALWAYS POINT the full surface AT "scripts/README.md"
        NEVER DUPLICATE the whole catalog IN two files
        # `./run --list` is generated from the catalog and never goes stale

    RULE a_replaced_script_leaves_no_reference:
        WHEN an action replaces a script:
            DELETE the script
            GREP its name ACROSS the repository
            UPDATE every doc, comment, and example that named it

    VALIDATION GATE:
        ✅ `scripts/README.md` names the new job or module
        ✅ `.claude/INDEX.md` carries the location
        ✅ grep for a deleted script's name returns only historical records

# PHASE 5: VERIFICATION
    @purpose: "Prove the entry resolves and runs, not that it parses"

    STEP 1:
        EXECUTE "./run --list"
        VERIFY the slug, its choices, and its flags ALL appear
    STEP 2:
        EXECUTE "./run --print <slug>" FOR the default options
        EXECUTE "./run --print <slug>" FOR each non-default choice AND flag
        VERIFY every argument reaches the right side of the twin
    STEP 3:
        EXECUTE the action's safest real invocation (preview, dry run, or read-only lane)
        VERIFY it exits 0 AND its output is free of launcher-introduced noise
    STEP 4:
        WHEN the action touches the test lanes:
            EXECUTE "./run test all"
            VERIFY the summary reads "All selected suites passed"

    RULE preview_is_the_contract:
        ALWAYS TREAT `--print` output AS what will execute
        WHEN the printed command differs FROM the executed one:
            FAIL "the preview lies"

    VALIDATION GATE:
        ✅ steps 1-3 clean
        ✅ every choice and flag was previewed, not just the defaults
        ✅ no warning or banner appears that the underlying script never produced

ALWAYS:
    - ADD an operator-facing job AS an Action, never as a root script
    - DECLARE every binary the job shells out to
    - DEFAULT a mutating flag TO its preview
    - DISPATCH TO a tuned script rather than reimplementing it
    - VERIFY WITH `--print` before running anything destructive

NEVER:
    - ADD a fourth script TO the repository root
    - FORK a script's logic INTO the launcher
    - MAKE a machine entry point (CI, Dockerfile, systemd) depend ON the launcher
    - SHIP an action absent FROM `scripts/README.md` and `.claude/INDEX.md`
    - LEAVE a deleted script's name IN a doc or comment
