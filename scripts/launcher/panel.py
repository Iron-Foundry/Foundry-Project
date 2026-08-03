"""The detail pane: an action's summary, its option controls, and the command it resolves to."""

from __future__ import annotations

from collections.abc import Iterator

from textual.containers import VerticalScroll
from textual.widget import Widget
from textual.widgets import Button, Checkbox, Input, Label, Select, Static

from .actions import Action, ActionError, Options
from .context import missing


class OptionPanel(VerticalScroll):
    """Rebuilds itself for whichever action the menu has highlighted."""

    def __init__(self) -> None:
        super().__init__(id="detail")
        self.action: Action | None = None

    async def show(self, action: Action) -> None:
        self.action = action
        await self.remove_children()
        await self.mount_all(list(self._controls(action)))
        self.refresh_preview()

    def _controls(self, action: Action) -> Iterator[Widget]:
        yield Static(action.summary, classes="summary")
        if action.warning:
            yield Static(f"! {action.warning}", classes="warning")
        absent = missing(action.requires)
        if absent:
            yield Static(f"! not on PATH: {', '.join(absent)}", classes="warning")
        for choice in action.choices:
            yield Label(choice.label)
            yield Select(
                [(value, value) for value in choice.values],
                value=choice.default,
                allow_blank=False,
                id=f"c_{choice.key}",
            )
        for flag in action.flags:
            yield Checkbox(flag.label, value=flag.default, id=f"f_{flag.key}")
        if action.extra_hint:
            yield Label("Extra arguments")
            yield Input(placeholder=action.extra_hint, id="extra")
        yield Static("", id="preview", classes="preview", markup=False)
        yield Button("Run", variant="primary", id="run")

    def values(self) -> Options:
        options: Options = {}
        if self.action is None:
            return options
        for choice in self.action.choices:
            options[choice.key] = str(self.query_one(f"#c_{choice.key}", Select).value)
        for flag in self.action.flags:
            options[flag.key] = self.query_one(f"#f_{flag.key}", Checkbox).value
        if self.action.extra_hint:
            options["extra"] = self.query_one("#extra", Input).value
        return options

    def refresh_preview(self) -> None:
        if self.action is None:
            return
        preview = self.query_one("#preview", Static)
        try:
            steps = self.action.steps(self.values())
        except (ActionError, ValueError) as error:
            preview.update(str(error))
            return
        preview.update("\n".join(f"$ {step.display()}" for step in steps))
