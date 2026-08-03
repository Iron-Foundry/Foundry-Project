"""Runs an action's steps in order, with stdin, stdout and stderr attached to this terminal."""

from __future__ import annotations

import os
import subprocess
import sys

from .actions import Step

DIM = "\033[2m"
RED = "\033[31m"
RESET = "\033[0m"

# uv runs this launcher inside its own script environment. Leaking that venv into
# the jobs makes every nested `uv run` warn that VIRTUAL_ENV does not match the
# module's own .venv, so the launcher's environment stops at the launcher.
INHERIT_BLOCKLIST = ("VIRTUAL_ENV", "UV_INTERNAL__PARENT_INTERPRETER")


def paint(text: str, colour: str) -> str:
    return f"{colour}{text}{RESET}" if sys.stdout.isatty() else text


def child_environment(overrides: dict[str, str]) -> dict[str, str]:
    environment = {
        key: value for key, value in os.environ.items() if key not in INHERIT_BLOCKLIST
    }
    environment.update(overrides)
    return environment


def run(steps: list[Step]) -> int:
    """Execute every step; stop at the first non-zero exit and return its code."""
    for step in steps:
        print(paint(f"$ {step.display()}", DIM), flush=True)
        environment = child_environment(step.env)
        try:
            code = subprocess.run(step.argv, cwd=step.cwd, env=environment).returncode
        except FileNotFoundError:
            print(f"{RED}{step.argv[0]}: not found{RESET}")
            return 127
        except KeyboardInterrupt:
            return 130
        if code != 0:
            return code
    return 0
