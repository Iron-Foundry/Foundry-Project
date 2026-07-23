---
name: mirror-add-remove-features
description: any add-shaped feature (command, service method) needs a matching remove counterpart in the same change, and vice versa
metadata:
  type: feedback
---

Whenever adding an "add X" feature (command, service method, endpoint), always
build the matching "remove X" counterpart in the same change - and vice versa.

**Why:** user said "always mirror features for add/remove" after I shipped
`/ticket addrole` (bulk-add every member of a role to a ticket) without a
`/ticket removerole` counterpart.

**How to apply:** before considering an add/remove-shaped feature done, check
the other direction exists too. Example: discord-server ticket management
(`features/tickets/`) has `add_user`/`remove_user` and now
`add_role`/`remove_role` in `ticket_service.py`, each with a matching
`/ticket add`/`/ticket remove` and `/ticket addrole`/`/ticket removerole`
command plus a help-registry entry. Apply the same pairing standard in other
services (permission grants, role assignment, list membership, etc.) unless
the user explicitly says only one direction is needed.
