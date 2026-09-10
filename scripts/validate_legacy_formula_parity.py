#!/usr/bin/env python3
"""Assert that every localized legacy calculator still implements one formula contract.

This is a temporary migration guard. The production files are duplicated today,
so a translation-specific edit can silently change arithmetic or timeframe
semantics. The guard remains useful until every locale calls the shared runtime.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ["ar", "de", "en", "es", "fa", "fr", "hi", "pt", "ru", "ukr", "zh-CN"]
EXPECTED_MODES = ["year", "1year", "10years", "lifetime", "day", "hour", "minute", "since1945"]

ASSIGNMENTS = {
    "military spending": r"const\s+mil\s*=\s*MODEL\.annualMilitarySpend\s*\*\s*fraction\s*;",
    "direct deaths": r"const\s+direct\s*=\s*MODEL\.annualDirectDeaths\s*\*\s*fraction\s*;",
    "indirect deaths": r"const\s+indirect\s*=\s*direct\s*\*\s*MODEL\.indirectMultiplier\s*;",
    "infrastructure damage": r"const\s+infra\s*=\s*MODEL\.annualInfraDamage\s*\*\s*fraction\s*;",
    "economic setback": r"const\s+econ\s*=\s*mil\s*\+\s*infra\s*\+\s*\(\(direct\s*\+\s*indirect\)\s*\*\s*MODEL\.economicValuePerDeath\)\s*;",
    "redirected spending": r"const\s+redirected\s*=\s*mil\s*\*\s*share\s*;",
    "life-years lost": r"\(direct\s*\+\s*indirect\)\s*\*\s*MODEL\.avgYearsLostPerDeath",
}

TIMEFRAME_RULES = {
    "minute": r"mode\s*===\s*['\"]minute['\"].*?fraction\s*=\s*1\s*/\s*525600",
    "hour": r"mode\s*===\s*['\"]hour['\"].*?fraction\s*=\s*1\s*/\s*8760",
    "day": r"mode\s*===\s*['\"]day['\"].*?fraction\s*=\s*1\s*/\s*365\.25",
    "1year": r"mode\s*===\s*['\"]1year['\"].*?fraction\s*=\s*1\s*;",
    "10years": r"mode\s*===\s*['\"]10years['\"].*?fraction\s*=\s*10\s*;",
    "since1945": r"mode\s*===\s*['\"]since1945['\"].*?new\s+Date\(1945\s*,\s*0\s*,\s*1\)",
    "lifetime": r"mode\s*===\s*['\"]lifetime['\"].*?new\s+Date\(bYear\s*,\s*0\s*,\s*1\)",
    "year": r"new\s+Date\(new\s+Date\(\)\.getFullYear\(\)\s*,\s*0\s*,\s*1\)",
}

OPPORTUNITY_KEYS = [
    "educationCost",
    "hungerCost",
    "healthCost",
    "waterCost",
    "electricityCost",
    "internetCost",
    "climateCost",
    "schoolCost",
]

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"{path.relative_to(ROOT)}: cannot read: {exc}")
        return ""


def extract_modes(text: str) -> list[str]:
    select = re.search(
        r"<select\b[^>]*id=['\"]pw2-modeSelect['\"][^>]*>(.*?)</select>",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not select:
        return []
    return re.findall(r"<option\b[^>]*value=['\"]([^'\"]+)['\"]", select.group(1), flags=re.IGNORECASE)


def check_language(language: str) -> None:
    path = ROOT / language / "calculator.html"
    label = f"{language}/calculator.html"
    if not path.is_file():
        fail(f"{label}: file is missing")
        return

    text = read(path)
    if not text:
        return

    modes = extract_modes(text)
    if modes != EXPECTED_MODES:
        fail(f"{label}: timeframe options drifted: {modes!r}")

    for name, pattern in ASSIGNMENTS.items():
        if not re.search(pattern, text, flags=re.DOTALL):
            fail(f"{label}: missing legacy formula contract for {name}")

    for mode, pattern in TIMEFRAME_RULES.items():
        if not re.search(pattern, text, flags=re.DOTALL):
            fail(f"{label}: timeframe arithmetic drifted for {mode}")

    for key in OPPORTUNITY_KEYS:
        pattern = rf"redirected\s*/\s*MODEL\.{re.escape(key)}"
        if not re.search(pattern, text):
            fail(f"{label}: opportunity-cost formula missing MODEL.{key}")

    if not re.search(r"if\s*\(bYear\s*>\s*currentYear\)\s*bYear\s*=\s*currentYear", text):
        fail(f"{label}: future birth-year clamp drifted")
    if not re.search(r"bYear\s*<\s*1920", text):
        fail(f"{label}: minimum birth-year fallback drifted")


print("True Cost of War — legacy formula parity")
for language in LANGUAGES:
    check_language(language)

if errors:
    print(f"FAILED: {len(errors)} problem(s)")
    for item in errors:
        print(f"  ERROR: {item}")
    sys.exit(1)

print(f"PASS: {len(LANGUAGES)} localized calculators implement the same legacy formula contract")
print("Migration target: replace this duplicated contract with src/runtime.mjs")
