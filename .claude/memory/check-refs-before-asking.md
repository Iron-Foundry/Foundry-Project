---
name: check-refs-before-asking
description: check D:\claude-git-references before asking the user to clone a reference repo
metadata:
  type: feedback
---

Before asking (via AskUserQuestion) to clone a reference repo into `D:\claude-git-references`, ALWAYS `ls` that directory (or `D:\claude-git-references\INDEX.md`) first - several repos are already cloned (runelite-repo, clansocket-osrs-cache-extractor-repo, cache-mediawiki-repo, osrs-wiki-maps-repo, discord.py-repo, wise-old-man-repo, wom.py-repo).

**Why:** user was asked to approve cloning RuneLite when `runelite-repo` was already present. The pre-ask confirmation in the research rule is for repos NOT yet cloned.

**How to apply:** the "AskUserQuestion before adding a new reference repo" step only applies to repos absent from the folder. Check existence first; if present, just use it. See [[memory-location]].
