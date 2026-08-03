"""The launcher menu. Choosing an entry exits the UI so the command owns the real terminal."""

from __future__ import annotations

from textual import on
from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.widgets import Button, Checkbox, Footer, Header, Input, OptionList, Select
from textual.widgets.option_list import Option

from .actions import Action, Options
from .catalog import BY_SLUG, CATALOG, SECTIONS
from .panel import OptionPanel

Selection = tuple[Action, Options]


def menu_items() -> list[Option | None]:
    items: list[Option | None] = []
    for section in SECTIONS:
        if items:
            items.append(None)
        items.append(Option(section.upper(), disabled=True))
        for action in CATALOG:
            if action.section == section:
                items.append(Option(f"  {action.label}", id=action.slug))
    return items


class LauncherApp(App[Selection | None]):
    CSS_PATH = "styles.tcss"
    TITLE = "The Iron Foundry Project"
    SUB_TITLE = "run, test and maintain the monorepo"
    BINDINGS = [
        ("ctrl+r", "run", "Run"),
        ("escape", "quit", "Quit"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.panel = OptionPanel()

    def compose(self) -> ComposeResult:
        yield Header()
        with Horizontal():
            yield OptionList(*menu_items(), id="menu")
            yield self.panel
        yield Footer()

    @on(OptionList.OptionHighlighted, "#menu")
    async def highlight(self, event: OptionList.OptionHighlighted) -> None:
        action = BY_SLUG.get(str(event.option.id))
        if action is not None:
            await self.panel.show(action)

    @on(OptionList.OptionSelected, "#menu")
    def select(self) -> None:
        self.action_run()

    @on(Select.Changed)
    @on(Checkbox.Changed)
    @on(Input.Changed)
    def option_changed(self) -> None:
        self.panel.refresh_preview()

    @on(Button.Pressed, "#run")
    @on(Input.Submitted)
    def run_pressed(self) -> None:
        self.action_run()

    def action_run(self) -> None:
        if self.panel.action is not None:
            self.exit((self.panel.action, self.panel.values()))


def choose() -> Selection | None:
    return LauncherApp().run()
