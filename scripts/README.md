# scripts

Host and database maintenance helpers. Each `.sh` has a `.ps1` twin where it is
meant to run from Windows; host-only jobs ship as `.sh` alone.

Everything here is also reachable from the launcher at the repo root - `./run` on
POSIX, `.\run.ps1` on Windows - which picks the right twin for the platform and
prompts for each script's options. See [The launcher](#the-launcher) below.

| Script | Purpose |
|---|---|
| `backfill-events.sh` / `.ps1` | Backfill historical event records |
| `docker-cleanup.sh` | Reclaim Docker build cache and dangling image layers (see below) |
| `export-secrets.sh` / `.ps1` | Export Infisical secrets to the local environment |
| `migrate-clan-rank-to-lowercase.sh` | One-off `users.clan_rank` migration to WOM role format |
| `run-tests.ps1` | PowerShell port of the root `run-tests.sh` monorepo test runner |
| `sync-db.sh` / `.ps1` | Sync prod Postgres to the local dev DB over an SSH tunnel |

## The launcher

`run.py` plus the `launcher/` package are the one entry point for running, testing
and maintaining the monorepo. The root shims hand the script to `uv`, which resolves
its PEP 723 dependencies on first run - there is nothing to install.

```bash
./run                      # open the menu
./run --list               # every action, its choices and its flags
./run --help               # the direct command form
./run --print prod         # resolve the commands without running them

./run dev                  # backend stack in Docker, then web-app natively
./run test fast            # one test lane
./run backfill-events prod --apply
./run dev -- cache-tiles   # anything after -- is appended to the command
```

Windows uses `.\run.ps1` with the same arguments.

Picking an entry closes the menu before the command starts, so the job owns a real
terminal: colours, prompts, Ctrl-C and long-running output all behave normally.

`launcher/catalog.py` is declarations only - each entry names its options, what it
needs on the machine and what it will change. The commands come from one of two
builder modules. `launcher/stack.py` builds in Python the invocations trivial enough
to express directly: the dev, staging and prod stacks (which replaced the
`rundev`/`runprod`/`runstaging` `.sh`/`.ps1` pairs that used to sit in the repo root)
and `reingest-cache`. `launcher/jobs.py` dispatches everything else to the scripts
documented above, choosing the `.ps1` twin on Windows and the `.sh` elsewhere - a
script with real logic of its own is never reimplemented in the launcher.

| Module | Role |
|---|---|
| `launcher/catalog.py` | Every menu entry: its options, requirements and warnings |
| `launcher/jobs.py` | The builders that dispatch to a script in `scripts/` |
| `launcher/stack.py` | The builders built in Python: the stacks, and `reingest-cache` |
| `launcher/actions.py` | The action/step model |
| `launcher/cli.py` | Argument parsing and the launch flow |
| `launcher/app.py`, `panel.py` | The Textual menu |
| `launcher/fallback.py` | Numbered prompt, used when Textual cannot start |
| `launcher/runner.py` | Runs the resolved steps with the terminal attached |

CI does not go through the launcher; `.github/workflows/e2e.yml` still calls
`bash run-tests.sh e2e` directly.

### reingest-cache

`osrs-cache-service` ingests a build only when OpenRS2's latest id differs from the
one in its `cache_builds` row, so a decoder that gains a field has nothing to
backfill it until Jagex ships a new cache. This action points that column away from
any real id and restarts the service, which fires the sync immediately and re-ingests
the same build from scratch.

```bash
./run reingest-cache prod            # show the ingested build, change nothing
./run reingest-cache prod --apply    # reopen the gate and restart the service
```

Clearing `is_current` instead does not work: `openrs2_cache_id` is unique, so
re-ingesting the same build collides on insert, and every read returns 503 while no
build is current. Nudging the id keeps the old build serving until the new one cuts
over. The run costs a full download, icon pass and tile bake - minutes, and roughly
double the volume use until it finishes, which retention then reclaims. If it fails
partway the old build stays current with the sentinel in place, so it retries every
`CACHE_SYNC_INTERVAL_HOURS`; put the real id back to stop that.

## docker-cleanup.sh

Runs daily at 04:00 (plus up to 30 min of jitter) via
`systemd/docker-cleanup.timer`, and can be run by hand at any time.

It performs exactly three operations:

```
docker image prune   --force --filter until=$IMAGE_UNTIL
docker builder prune --force --filter until=$CACHE_UNTIL
docker builder prune --force --max-used-space $CACHE_MAX_SPACE
```

The two cache passes are complementary: the age filter drops layers from builds
nobody is iterating on, and the ceiling caps whatever is left, so a heavy build
week cannot grow the cache without bound. BuildKit evicts least-recently-used
records first, so recent layers survive and rebuilds stay warm.

### Safety envelope

This host runs the `foundry-project` stack alongside unrelated ones (traefik,
grafana, prometheus, copyparty, dinkproxy) and holds their named data volumes,
so the job is deliberately narrow. It never:

- prunes volumes (no `docker volume prune`, no `--volumes`)
- removes a tagged image (`image prune` runs without `-a`, so only untagged
  `<none>` layers are eligible and no service is forced into a re-pull)
- removes containers or networks
- calls `docker system prune`
- touches anything newer than its age cutoff

### Tunables

| Variable | Default | Meaning |
|---|---|---|
| `IMAGE_UNTIL` | `72h` | Minimum age of a dangling image before it is eligible |
| `CACHE_UNTIL` | `168h` | Minimum age of an unused build cache record |
| `CACHE_MAX_SPACE` | `10GB` | Maximum build cache kept after the age pass |

Override them per run (`IMAGE_UNTIL=24h ./scripts/docker-cleanup.sh`) or
permanently with `Environment=` lines in the service unit.

### Operating

```bash
./scripts/docker-cleanup.sh --dry-run    # list candidates, remove nothing
./scripts/docker-cleanup.sh              # run now, prints usage before/after

systemctl list-timers docker-cleanup.timer          # when it next fires
systemctl status docker-cleanup.service             # last result
journalctl -u docker-cleanup.service -n 50          # last run's accounting
sudo systemctl start docker-cleanup.service         # force a run through systemd
```

### Install / uninstall

```bash
sudo cp scripts/systemd/docker-cleanup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now docker-cleanup.timer
```

```bash
sudo systemctl disable --now docker-cleanup.timer
sudo rm /etc/systemd/system/docker-cleanup.{service,timer}
sudo systemctl daemon-reload
```

The unit runs as `salt:docker` (the socket is `root:docker`), so it needs no
root privileges beyond installing the unit files. `Persistent=true` means a run
missed while the box was down fires shortly after the next boot.
