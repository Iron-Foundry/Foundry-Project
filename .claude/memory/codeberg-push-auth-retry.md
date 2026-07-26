---
name: codeberg-push-auth-retry
description: git push to Codeberg sometimes fails with an expired-credentials error even when creds are fine - just retry the push
metadata:
  type: feedback
---

`git push` to the Codeberg remote (`https://codeberg.org/IronFoundry/...`) can fail
with "Credentials are incorrect or have expired" / "Authentication failed" even when
nothing is actually wrong with auth. A fresh token gets picked up on retry.

**Why:** user confirmed this is a known Codeberg upstream quirk - the credential
helper's token goes briefly stale and refreshes on the next attempt. Not a real auth
problem most of the time.

**How to apply:** if `git push` to this repo's Codeberg remote fails with an
auth/credentials error, just run `git push` again immediately before telling the user
push failed or asking them to re-auth. Only escalate to the user if the retry also
fails.

**Two distinct failures - only the first is retryable:**

- `Credentials are incorrect or have expired. Retry your command` - the quirk. Retry.
- `could not read Username for 'https://codeberg.org': terminal prompts disabled` -
  NOT the quirk. Git Credential Manager (`credential.helper` is
  `git-credential-manager.exe`, set per-repo, no global helper) discarded the stale
  token, has nothing cached, and needs its interactive window. Claude's shell runs
  non-interactive, so every retry fails identically. Stop retrying and hand the user
  the push command to run with `!`; GCM prompts once and caches for the rest.
