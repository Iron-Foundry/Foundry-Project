# scripts

Host and database maintenance helpers. Each `.sh` has a `.ps1` twin where it is
meant to run from Windows; host-only jobs ship as `.sh` alone.

| Script | Purpose |
|---|---|
| `backfill-events.sh` / `.ps1` | Backfill historical event records |
| `docker-cleanup.sh` | Reclaim Docker build cache and dangling image layers (see below) |
| `export-secrets.sh` / `.ps1` | Export Infisical secrets to the local environment |
| `migrate-clan-rank-to-lowercase.sh` | One-off `users.clan_rank` migration to WOM role format |
| `sync-db.sh` / `.ps1` | Sync prod Postgres to the local dev DB over an SSH tunnel |

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
