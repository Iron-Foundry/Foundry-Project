---
name: semver-bump-scope
description: Which version bumps Claude may make unprompted, and that Python bumps go through uv only
metadata:
  type: feedback
---

Bump **MINOR**, **PATCH**, and prerelease tags (**alpha**, **beta**, **rc**) on
your own initiative when a change warrants it. **Never bump MAJOR.** You may
recommend one and say why, but the user decides when a major release happens.

Python modules are bumped **only** through uv's own semantics:

```bash
uv version --bump patch     # or minor, alpha, beta, rc
uv version --bump stable    # drop the prerelease tag
```

Never hand-edit `version` in `pyproject.toml`, and do not pass an explicit
version string when a `--bump` level expresses the intent. `--no-sync` skips the
venv re-sync when only the number is changing.

web-app is not a Python project, so it uses
`npm version --no-git-tag-version <level>` against `package.json` - the same
major restriction applies.

**Why:** a major bump is a product signal about breaking changes and release
readiness, not a mechanical consequence of a diff. uv keeps `pyproject.toml` and
`uv.lock` consistent and validates the level, which hand-editing does not.

**How to apply:** when a change needs a version move, pick the level yourself up
to minor and run the uv command. If the change is genuinely breaking, make the
change, leave the version alone, and tell the user a major bump looks due and
why.

Related: [[semver-and-version-endpoints]].
