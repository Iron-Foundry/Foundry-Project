---
name: docker-host-shared-stacks
description: the Docker host is shared with unrelated stacks and their data volumes, so cleanup must never prune volumes, containers, or tagged images
metadata:
  type: project
---

The machine running `foundry-project` is not a disposable build host. It also runs
traefik, grafana, prometheus, node-exporter, copyparty and dinkproxy, and holds
their named data volumes (`vps_grafana-data`, `vps_prometheus-data`,
`vps_npm-letsencrypt`, `clanvsclan_mongodb_data`, `ironfoundry_pip-cache`), most of
which show as unattached. Two long-exited containers (`calendar-redirect`,
`dinkproxy-dink-proxy-1`) are deliberately kept.

**Why:** `docker system prune`, `--volumes`, or `image prune -a` on this box would
destroy another project's database or force re-pulls for a service that happens to
be stopped. Unattached does not mean unwanted here.

**How to apply:** reclaim disk only with the three targeted prunes in
`scripts/docker-cleanup.sh` (dangling images by age, BuildKit cache by age then by
size ceiling), scheduled by `scripts/systemd/docker-cleanup.timer`. Never add a
volume, container, or network prune to it. Docker 28.5 / buildx 0.29 on this host
takes `--max-used-space`, not the older `--keep-storage`.
