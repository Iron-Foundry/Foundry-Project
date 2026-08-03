---
name: no-invented-names
description: Name new commands/tools/modules for what they do, never coin a product-style name
metadata:
  type: feedback
---

Do not invent names. A new command, script, module or directory gets a plain
descriptive name drawn from vocabulary the repo already uses (`run`, `launcher`,
`scripts`, `stack`), not a coined product or brand-flavoured one. Rejected on
2026-08-03: naming the root launcher `foundry` / `foundry_tui`; it shipped as
`./run` + `scripts/launcher/` instead.

**Why:** a branded name is one more thing to learn and it says nothing about what
the thing does. The project name is already the repo; the tooling inside it should
read as plain description.

**How to apply:** when adding a command or module, pick the verb or noun for its
job and check the repo already speaks that way. If no plain name fits, ask rather
than coin one. Watch for collisions before proposing (`./scripts` was impossible
here because `scripts/` is a directory). See [[root-launcher]].
