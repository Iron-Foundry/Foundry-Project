"""Argument parsing and the launch flow shared by the menu and the direct command form."""

from __future__ import annotations

import shlex
import sys

from .actions import Action, ActionError, Options
from .catalog import BY_SLUG, CATALOG, SECTIONS
from .context import missing
from .runner import run

USAGE = """usage: ./run [action] [choice ...] [--flag] [-- extra args]

  ./run                                open the menu
  ./run --list                         print every action and its options
  ./run test fast                      run one test lane
  ./run backfill-events prod --apply   pass a choice and a flag
  ./run dev -- cache-tiles             append extra arguments
  ./run --print prod                   show the commands without running them

On Windows the same actions are reached through .\\run.ps1
"""


def listing() -> str:
    lines: list[str] = []
    for section in SECTIONS:
        lines.append(f"\n{section.upper()}")
        for action in CATALOG:
            if action.section != section:
                continue
            lines.append(f"  {action.slug:<20}{action.summary}")
            for choice in action.choices:
                values = " | ".join(choice.values)
                lines.append(
                    f"{'':<22}<{choice.key}>  {values}  (default {choice.default})"
                )
            for flag in action.flags:
                state = "on" if flag.default else "off"
                lines.append(
                    f"{'':<22}--{flag.key.replace('_', '-')}  {flag.label} (default {state})"
                )
            if action.extra_hint:
                lines.append(f"{'':<22}-- ...  {action.extra_hint}")
    return "\n".join(lines)


def parse(action: Action, tokens: list[str]) -> Options:
    options = action.defaults()
    flags = {f"--{flag.key.replace('_', '-')}": flag.key for flag in action.flags}
    positional: list[str] = []
    extra: list[str] = []
    passthrough = False
    for token in tokens:
        if passthrough:
            extra.append(token)
        elif token == "--":
            passthrough = True
        elif token in flags:
            options[flags[token]] = True
        elif token.startswith("--no-") and f"--{token[5:]}" in flags:
            options[flags[f"--{token[5:]}"]] = False
        else:
            positional.append(token)

    for choice, value in zip(action.choices, positional, strict=False):
        if value not in choice.values:
            allowed = ", ".join(choice.values)
            raise ActionError(f"{action.slug}: {choice.key} must be one of {allowed}")
        options[choice.key] = value

    leftover = positional[len(action.choices) :]
    if action.extra_hint:
        options["extra"] = shlex.join([*leftover, *extra])
    elif leftover or extra:
        raise ActionError(
            f"{action.slug}: unexpected argument {(leftover + extra)[0]!r}"
        )
    return options


def launch(action: Action, options: Options, preview: bool = False) -> int:
    absent = missing(action.requires)
    if absent and not preview:
        print(f"warning: not found on PATH: {', '.join(absent)}", file=sys.stderr)
    try:
        steps = action.steps(options)
    except ActionError as error:
        print(error, file=sys.stderr)
        return 1
    if preview:
        print("\n".join(f"$ {step.display()}" for step in steps))
        return 0
    return run(steps)


def headless(argv: list[str], preview: bool = False) -> int:
    action = BY_SLUG.get(argv[0])
    if action is None:
        print(f"unknown action {argv[0]!r}\n\n{USAGE}", file=sys.stderr)
        return 2
    try:
        options = parse(action, argv[1:])
    except ActionError as error:
        print(error, file=sys.stderr)
        return 2
    return launch(action, options, preview)


def menu() -> int:
    if not (sys.stdin.isatty() and sys.stdout.isatty()):
        print(f"{USAGE}{listing()}", file=sys.stderr)
        return 2
    try:
        from .app import choose as chooser
    except ImportError:
        from .fallback import choose as chooser
    selection = chooser()
    if selection is None:
        return 0
    return launch(*selection)


def main(argv: list[str]) -> int:
    preview = bool(argv) and argv[0] in ("-n", "--print")
    if preview:
        argv = argv[1:]
    if argv and argv[0] in ("-h", "--help", "help"):
        print(USAGE)
        return 0
    if argv and argv[0] in ("-l", "--list", "list"):
        print(listing())
        return 0
    if argv:
        return headless(argv, preview)
    return menu()
