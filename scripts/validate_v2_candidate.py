#!/usr/bin/env python3
"""Validate the research-only v2 candidate data schema.

This intentionally does not validate scientific truth. It validates structure,
basic numeric sanity and, critically, that the candidate file is not wired into
the legacy production runtime before methodology approval.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "model-v2.candidate.json"
LANGUAGES = ["ar", "de", "en", "es", "fa", "fr", "hi", "pt", "ru", "ukr", "zh-CN"]

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def positive_numbers(node: Any, trail: str = "root") -> None:
    """Reject negative numeric quantities while allowing null research slots."""
    if isinstance(node, bool):
        return
    if isinstance(node, (int, float)):
        if node < 0:
            fail(f"{trail}: negative numeric value {node}")
        return
    if isinstance(node, dict):
        for key, value in node.items():
            positive_numbers(value, f"{trail}.{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            positive_numbers(value, f"{trail}[{index}]")


def validate_source_urls(node: Any, trail: str = "root") -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            child = f"{trail}.{key}"
            if key in {"url", "sourceUrl"} and value is not None:
                if not isinstance(value, str) or not value.startswith("https://"):
                    fail(f"{child}: source URL must use https://")
            validate_source_urls(value, child)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            validate_source_urls(value, f"{trail}[{index}]")


try:
    document = json.loads(PATH.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as exc:
    print(f"FAILED: cannot parse {PATH.relative_to(ROOT)}: {exc}")
    sys.exit(1)

if document.get("schemaVersion") != 2:
    fail("schemaVersion must be 2")

if document.get("status") != "research-candidate-not-runtime":
    fail("status must remain research-candidate-not-runtime until an explicit reviewed migration")

headline = document.get("headlineMetrics")
benchmarks = document.get("opportunityCostBenchmarks")
if not isinstance(headline, dict) or not headline:
    fail("headlineMetrics must be a non-empty object")
if not isinstance(benchmarks, dict) or not benchmarks:
    fail("opportunityCostBenchmarks must be a non-empty object")

required_headline = {
    "globalMilitaryExpenditure",
    "directConflictDeaths",
    "indirectDeathMultiplier",
    "infrastructureDamage",
    "averageYearsOfLifeLost",
    "economicValuePerDeath",
}
if isinstance(headline, dict):
    missing = sorted(required_headline - headline.keys())
    if missing:
        fail(f"headlineMetrics missing keys: {', '.join(missing)}")

required_benchmarks = {
    "education",
    "primaryHealthCare",
    "hunger",
    "waterAndSanitation",
    "electricityAccess",
    "internetConnectivity",
    "climate",
    "schoolConstruction",
}
if isinstance(benchmarks, dict):
    missing = sorted(required_benchmarks - benchmarks.keys())
    if missing:
        fail(f"opportunityCostBenchmarks missing keys: {', '.join(missing)}")

positive_numbers(document)
validate_source_urls(document)

# The candidate evidence file is deliberately research-only. Wiring it into the
# current HTML runtime must happen later in a dedicated reviewed migration PR.
needle = "model-v2.candidate.json"
for language in LANGUAGES:
    for filename in ("calculator.html", "embed.html"):
        runtime_path = ROOT / language / filename
        if runtime_path.is_file() and needle in runtime_path.read_text(encoding="utf-8"):
            fail(f"{language}/{filename}: research candidate is referenced by production runtime")

if errors:
    print(f"FAILED: v2 candidate schema has {len(errors)} problem(s)")
    for error in errors:
        print(f"  ERROR: {error}")
    sys.exit(1)

print("PASS: v2 candidate schema is structurally valid and remains research-only")
