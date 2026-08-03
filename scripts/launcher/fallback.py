"""A dependency-free numbered menu, used when Textual cannot start."""

from __future__ import annotations

from .actions import Action, Options
from .catalog import CATALOG, SECTIONS

Selection = tuple[Action, Options]


def ask(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def show_menu() -> None:
    for section in SECTIONS:
        print(f"\n{section.upper()}")
        for index, action in enumerate(CATALOG, start=1):
            if action.section == section:
                print(f"  {index:>2}  {action.label:<32}{action.slug}")


def collect(action: Action) -> Options:
    options = action.defaults()
    for choice in action.choices:
        allowed = " | ".join(choice.values)
        raw = ask(f"{choice.label} [{allowed}] ({choice.default}): ")
        if raw in choice.values:
            options[choice.key] = raw
    for flag in action.flags:
        hint = "Y/n" if flag.default else "y/N"
        raw = ask(f"{flag.label} [{hint}]: ").lower()
        if raw:
            options[flag.key] = raw.startswith("y")
    if action.extra_hint:
        options["extra"] = ask(f"Extra arguments ({action.extra_hint}): ")
    return options


def choose() -> Selection | None:
    show_menu()
    raw = ask("\nSelect a number (blank to quit): ")
    if not raw:
        return None
    try:
        action = CATALOG[int(raw) - 1]
    except (ValueError, IndexError):
        print(f"No entry {raw!r}.")
        return None
    if action.warning:
        print(f"! {action.warning}")
    return action, collect(action)
