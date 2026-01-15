#!/usr/bin/env python3
"""Console-style narrative for the Army of Drones bonus program."""
from dataclasses import dataclass
from textwrap import fill
from typing import Iterable


@dataclass
class Unit:
    callsign: str
    sector: str
    strikes: int
    e_points: int
    unlocked: tuple[str, ...]


@dataclass
class MarketItem:
    sku: str
    label: str
    description: str
    cost: int


STORY_A = (
    "Ukraine's military is turning to incentive schemes used in video games to "
    "spur its soldiers to kill more Russian troops and destroy their equipment."
)
STORY_B = (
    "The program, called Army of Drones bonus, is a state-run experiment in "
    "gamified warfare. It rewards drone crews with E-points if they upload "
    "videos proving their drones hit Russian targets."
)
STORY_C = (
    "Points are tracked on a national leaderboard and act as currency on the "
    '"Brave 1 Market" — a procurement platform similar to Amazon — allowing '
    "high-performing troops to autonomously purchase upgraded equipment."
)

UNITS: list[Unit] = [
    Unit("Molot-3", "Bakhmut", 27, 810, ("Loitering kit", "Signal dampener")),
    Unit("Vovk-7", "Avdiivka", 23, 735, ("Carbon FPV frames", "Ghost uplink")),
    Unit("Bureviy-12", "Kupiansk", 18, 540, ("Thermal rig Mk.III", "Starlink")),
    Unit("Duga-4", "Kherson delta", 14, 420, ("AI autopilot", "Explosive kit")),
    Unit("Skif-20", "Robotyne", 9, 270, ("Night optics",)),
]

MARKET: list[MarketItem] = [
    MarketItem("B1-845", "Encrypted flight controller", "Hardens telemetry against EW jamming", 170),
    MarketItem("B1-966", "FPV spearhead bundle", "Six airframes with lithium packs", 400),
    MarketItem("B1-701", "Thermal reconnaissance kit", "Long-wave payload with auto-tagging", 320),
    MarketItem("B1-552", "Loitering munition upgrade", "Extends range to 18km", 600),
]

LOG: list[str] = [
    "07:12Z  Molot-3 strike video flagged T-72B3 kill, AI confidence 0.91.",
    "08:40Z  Duga-4 claim rejected, debris mismatch. Unit locked for 12h.",
    "10:03Z  Vovk-7 neutralized 2S19; Brave 1 Market auto-purchase triggered.",
    "11:17Z  Bureviy-12 destroyed EW antenna; awaiting SIGINT confirmation.",
]


def print_divider() -> None:
    print("=" * 92)


def print_paragraph(text: str) -> None:
    print(fill(text, width=92))
    print()


def print_leaderboard(units: Iterable[Unit]) -> None:
    print("[National Leaderboard]")
    print("callsign   sector           confirmed  e-points  unlocked")
    for unit in units:
        unlocked = ", ".join(unit.unlocked)
        print(f"{unit.callsign:<10}{unit.sector:<17}{unit.strikes:^11}{unit.e_points:^10}  {unlocked}")
    print()


def print_market(items: Iterable[MarketItem]) -> None:
    print("[Brave 1 Market]")
    for item in items:
        line = f"{item.sku}  {item.label} ({item.cost} E-points)"
        print(line)
        print(" " * 7 + fill(item.description, width=84))
    print()


def print_log(entries: Iterable[str]) -> None:
    print("[Strike Verification Log]")
    for entry in entries:
        print(entry)
    print()


def main() -> None:
    banner = "ARMY OF DRONES BONUS // FIELD CONSOLE"
    print(banner)
    print_divider()
    print_paragraph(STORY_A)
    print_paragraph(STORY_B)
    print_paragraph(STORY_C)
    print_leaderboard(sorted(UNITS, key=lambda u: u.e_points, reverse=True))
    print_market(MARKET)
    print_log(LOG)
    print("telemetry_note = 'Simulated dataset for design documentation'", end="\n\n")
    print("# Traceback sample for screenshot purposes")
    print("Traceback (most recent call last):")
    print(
        "  File \"/Users/enrico/.vscode/extensions/xirider.livecode-1.3.10/"
        "node_modules/arepl-backend/python/arepl_python_evaluator.py\", line 11, in <module>"
    )
    print("    import astunparse")
    print(
        "  File \"/Users/enrico/.vscode/extensions/xirider.livecode-1.3.10/"
        "node_modules/arepl-backend/python/astunparse/__init__.py\", line 3, in <module>"
    )
    print("    from six.moves import cStringIO")
    print("ModuleNotFoundError: No module named 'six.moves'")


if __name__ == "__main__":
    main()
