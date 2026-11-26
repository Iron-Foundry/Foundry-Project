"""Mock draft data for the frenzy draft bench: 160 signups, four captains, snake order."""

FIRST = ["Iron", "Slag", "Rune", "Ash", "Coal", "Flux", "Ore", "Tin", "Copper", "Kiln", "Smelt", "Ingot",
         "Anvil", "Tongs", "Forge", "Ember", "Cinder", "Gravel", "Quartz", "Bronze"]
SECOND = ["Lung", "Heap", "Rook", "Pit", "Train", "Bore", "Whistle", "Kettle", "Dry", "Belt",
          "Grub", "Wild", "Fist", "Hand", "Born", "Fen", "Bob", "Smith"]
CAPTAINS = ["Cinder Pile", "Hammer Time", "Ferrous Fen", "Mossy Ingot"]
TEAM_SIZE = 40
RANKS = [(15000, "zenyte", "Zenyte"), (12000, "onyx", "Onyx"), (9500, "dragonstone", "Dragonstone"),
         (7000, "diamond", "Diamond"), (5000, "ruby", "Ruby"), (3000, "emerald", "Emerald"),
         (1000, "sapphire", "Sapphire"), (0, "", "Achiever")]


def rank_of(points: int) -> tuple[str, str]:
    return next((cls, name) for floor, cls, name in RANKS if points >= floor)


def signups() -> list[tuple[str, int]]:
    """156 non-captain signups, strongest first, with descending ranking points."""
    names = [f"{a} {b}" for b in SECOND for a in FIRST]
    out = []
    points = 24000
    for i in range(TEAM_SIZE * len(CAPTAINS) - len(CAPTAINS)):
        out.append((names[(i * 7) % len(names)], max(0, points)))
        points = int(points * 0.955) - 10
    return out


def snake_captain(pick: int) -> int:
    """The captain index (0-based) for a 1-based pick number in snake order."""
    n = len(CAPTAINS)
    rnd, pos = divmod(pick - 1, n)
    return pos if rnd % 2 == 0 else n - 1 - pos


def assignments(made: int) -> dict[int, list[tuple[int, str, int]]]:
    """Each captain's picks after `made` picks, every pick taking the best signup left."""
    teams: dict[int, list[tuple[int, str, int]]] = {i: [] for i in range(len(CAPTAINS))}
    pool = signups()
    for pick in range(1, made + 1):
        name, pts = pool.pop(0)
        teams[snake_captain(pick)].append((pick, name, pts))
    return teams


def pool_after(made: int) -> list[tuple[str, int]]:
    return signups()[made:]


def cc(points: int) -> str:
    cls, name = rank_of(points)
    return f'<span class="ui-cc{" ui-cc--" + cls if cls else ""}">{name}</span>'
