---
name: integration-seed-ids-before-commit
description: capture a seeded row's id into a local right after flush() - reading it after commit() raises MissingGreenlet in the api-backend integration suite
metadata:
  type: project
---

In an api-backend integration test, capture a seeded row's primary key into a
local variable immediately after `await session.flush()`. Reading
`instance.id` **after** `await session.commit()` fails with
`sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called`.

```python
session.add(event)
await session.flush()
event_id = event.id      # capture here
...
await session.commit()
return event_id          # not event.id
```

**Why:** `commit()` expires the instance, so the next attribute access issues a
lazy refresh SELECT. Outside the greenlet the async driver runs in, that sync IO
raises rather than awaiting. The traceback points deep into
`sqlalchemy/util/_concurrency_py3k.py` and names no test line, so it reads like
an event-loop or fixture problem rather than the one-line ordering mistake it is.

**How to apply:** every `_seed_*` helper in `app/tests/integration/` follows this
shape already - copy an existing one rather than writing the commit-then-read
version. Applies to any expired attribute after commit, not just `id`.
Related: [[api-test-app-instance]], [[integration-testing]].
