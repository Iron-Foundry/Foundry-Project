---
name: tilerace-channel-permissions
description: tile race managed-channel perms are event-wide grant-only toggles applied in place with set_permissions, never a channel rebuild
metadata:
  type: project
---

Tile race Discord channel permissions are **event-wide** grant-only toggles on
`tilerace_events.discord_permissions` (JSONB, migration `0062`), carried in
every provisioning command as `permissions` and applied by discord-server onto
the channels that already exist.

Toggle set (canonical list in `api-backend/app/routers/tilerace/_discord_perms.py`
`TOGGLES` and `fixtures/tilerace_discord.json` `permission_toggles`):
`pin_messages`, `manage_messages`, `mention_everyone`, `manage_threads`,
`manage_channel`, `voice_moderation`. The toggle -> discord flag tables live in
`discord-server/features/tilerace/perms.py`.

**Why:** the event runs live with data that cannot be dropped, so a permission
change must never tear a channel down. Two properties make that hold:

- Every toggle only ever **grants**. An off toggle leaves the flag `None`
  (inherited), never `False`, so switching one off cannot strip a permission the
  role holds server-wide.
- The bot reconciles with `channel.set_permissions(role, overwrite=...)`, which
  replaces only that role's overwrite entry - an overwrite added by hand in
  Discord survives, and `overwrites_for(role) == desired` short-circuits so an
  unchanged channel costs no API call.

`pin_messages` is Discord's own narrow permission (discord.py 2.7, `1 << 51`),
deliberately NOT `manage_messages`: a team can pin without gaining the power to
delete each other's messages. `manage_messages` is its own separate toggle.

**How to apply:** add a toggle in four places at once - `TOGGLES`,
`DiscordPermissionsPatch`, the fixture's `permission_toggles`, and the grant
table in `perms.py`. `test_every_contract_toggle_is_wired_to_something` fails a
toggle that grants nothing. Never add a toggle that denies. See
[[tilerace-discord-provisioning]] for the command/result seam itself.
