"""The action model: what a menu entry is, which options it exposes, and what it runs."""

from __future__ import annotations

import shlex
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

Options = dict[str, str | bool]


class ActionError(RuntimeError):
    """Raised when an action cannot be built on this machine."""


@dataclass(frozen=True)
class Step:
    """One command in an action's sequence, run with the terminal attached."""

    argv: list[str]
    cwd: Path | None = None
    env: dict[str, str] = field(default_factory=dict)

    def display(self) -> str:
        prefix = "".join(f"{key}={value} " for key, value in sorted(self.env.items()))
        return prefix + shlex.join(self.argv)


@dataclass(frozen=True)
class Choice:
    """A one-of-N option rendered as a select."""

    key: str
    label: str
    values: tuple[str, ...]

    @property
    def default(self) -> str:
        return self.values[0]


@dataclass(frozen=True)
class Flag:
    """A boolean option rendered as a checkbox."""

    key: str
    label: str
    default: bool = False


@dataclass(frozen=True)
class Action:
    slug: str
    section: str
    label: str
    summary: str
    build: Callable[[Options], list[Step]]
    choices: tuple[Choice, ...] = ()
    flags: tuple[Flag, ...] = ()
    extra_hint: str = ""
    requires: tuple[str, ...] = ()
    warning: str = ""

    def defaults(self) -> Options:
        options: Options = {choice.key: choice.default for choice in self.choices}
        options.update({flag.key: flag.default for flag in self.flags})
        if self.extra_hint:
            options["extra"] = ""
        return options

    def steps(self, options: Options | None = None) -> list[Step]:
        merged = self.defaults()
        merged.update(options or {})
        return self.build(merged)


def extra_args(options: Options) -> list[str]:
    return shlex.split(str(options.get("extra", "")))
