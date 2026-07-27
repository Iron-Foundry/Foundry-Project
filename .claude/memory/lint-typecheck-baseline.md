---
name: lint-typecheck-baseline
description: The ruff/pyright hardening baseline for all five Python modules, and the two rule families deliberately excluded
metadata:
  type: project
---

All five Python modules (api-backend, discord-server, discord-utils, discord-event,
osrs-cache-service) run the SAME ruff select list and the same `pyrightconfig.json`
(typeCheckingMode standard, pythonVersion 3.14, `pythonPlatform: "Linux"` plus the
extra rules: unnecessary type-ignore / isinstance / cast / comparison / contains,
missing parameter type, missing type argument, deprecated, constant redefinition).
Gate: `./run-tests.sh lint`. Established 2026-07-27; every module green.

`reportMissingTypeArgument` was turned on and its 979 findings cleared the same
day. Every JSONB `Mapped[...]` column now carries its real element type, which
surfaced two columns whose annotation contradicted the writer: `transcripts.entries`
and `surveys.questions` were declared `Mapped[list]` but hold a dict (both readers
already branch on `isinstance(raw, dict)`, so they are typed as the honest
`list[Any] | dict[str, Any]` union). `Any` is used only where the payload really is
free-form JSON (frenzy `activities`/`multipliers`, the osrs-cache proxy endpoints,
info-panel `live_data`), never as a shortcut for a knowable type.

Two families were measured and deliberately REJECTED, do not "helpfully" add them:

- ruff `TC*` (typing-only-import): moving imports into `TYPE_CHECKING` breaks
  FastAPI/Pydantic runtime annotation resolution. ~400 findings, all unsafe here.
- pyright `reportPrivateUsage` (244 findings): the repo's own convention is
  cross-module `_helpers.py` / `_constants.py` modules, so the rule fights the
  architecture rather than finding defects.

`reportImplicitOverride` (~126) is real but left off; full `strict` is 6301 errors
and is not the target.

`pythonPlatform: "Linux"` matters: it matches the Docker runtime, and it is what
makes the `os.startfile` `# type: ignore` in discord-event's preview_chart.py
correct instead of "unnecessary" when checked on a Windows dev box.

Related: [[integration-testing]], [[tests-follow-code]].
