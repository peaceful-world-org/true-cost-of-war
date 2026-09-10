#!/usr/bin/env python3
"""Baseline QA for the True Cost of War static application.

The goal is intentionally conservative: catch accidental regressions without
changing the current product or freezing future data/model improvements.
Known legacy inconsistencies are reported as warnings until the shared data
layer is introduced.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ["ar", "de", "en", "es", "fa", "fr", "hi", "pt", "ru", "ukr", "zh-CN"]
REQUIRED_MODEL_KEYS = {
    "annualMilitarySpend",
    "annualDirectDeaths",
    "indirectMultiplier",
    "annualInfraDamage",
    "avgYearsLostPerDeath",
    "economicValuePerDeath",
    "educationCost",
    "hungerCost",
    "healthCost",
    "waterCost",
    "electricityCost",
    "internetCost",
    "climateCost",
    "schoolCost",
}

errors: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as exc:  # pragma: no cover - CI diagnostics
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")
        return ""


def extract_model(text: str, label: str) -> dict[str, float]:
    match = re.search(r"const\s+MODEL\s*=\s*\{(.*?)\}\s*;", text, flags=re.S)
    if not match:
        fail(f"{label}: const MODEL object not found")
        return {}

    model: dict[str, float] = {}
    for key, raw in re.findall(r"([A-Za-z_]\w*)\s*:\s*([0-9.+\-eE]+)", match.group(1)):
        try:
            model[key] = float(raw)
        except ValueError:
            fail(f"{label}: MODEL.{key} has an invalid numeric value: {raw}")

    missing = sorted(REQUIRED_MODEL_KEYS - model.keys())
    if missing:
        fail(f"{label}: MODEL is missing keys: {', '.join(missing)}")

    for key, value in model.items():
        if value <= 0:
            fail(f"{label}: MODEL.{key} must be positive, got {value}")

    return model


def extract_last_inline_script(text: str, label: str) -> str | None:
    start = text.rfind("<script>")
    if start < 0:
        fail(f"{label}: no inline <script> block found")
        return None
    end = text.find("</script>", start)
    if end < 0:
        fail(f"{label}: final inline <script> has no closing </script>")
        return None
    return text[start + len("<script>") : end]


def node_syntax_check(script: str, label: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
        handle.write(script)
        temp_path = Path(handle.name)
    try:
        proc = subprocess.run(
            ["node", "--check", str(temp_path)],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        if proc.returncode != 0:
            fail(f"{label}: JavaScript syntax check failed:\n{proc.stdout.strip()}")
    finally:
        temp_path.unlink(missing_ok=True)


def basic_html_checks(text: str, label: str, *, calculator: bool) -> None:
    lowered = text.lower()
    if any(marker in text for marker in ("<<<<<<<", ">>>>>>>")):
        fail(f"{label}: unresolved merge-conflict marker found")

    # calculator.html files are standalone documents. embed.html files are
    # intentionally embeddable HTML fragments, so document-level tags are not
    # required there.
    if calculator:
        if "<!doctype html" not in lowered:
            fail(f"{label}: missing HTML doctype")
        if 'name="viewport"' not in lowered and "name='viewport'" not in lowered:
            fail(f"{label}: missing viewport meta tag")
        if "<title>" not in lowered:
            fail(f"{label}: missing <title>")
        if "pw2-widget-container" not in text:
            fail(f"{label}: widget container marker is missing")
        if "PUBLIC_PAGE_URL" not in text:
            fail(f"{label}: PUBLIC_PAGE_URL is missing")
        # Source-link placement differs in the legacy localized files. Keep this
        # visible without blocking CI until methodology/source data is unified.
        if "sipri.org" not in lowered:
            warn(f"{label}: SIPRI source link is not present in this document")
        if "ucdp.uu.se" not in lowered:
            warn(f"{label}: UCDP source link is not present in this document")
    else:
        if "pw-share-widget" not in text:
            fail(f"{label}: embed widget marker is missing")


print("True Cost of War — baseline QA")
print(f"Checking {len(LANGUAGES)} language variants...\n")

models: dict[str, dict[str, float]] = {}

for language in LANGUAGES:
    for filename in ("calculator.html", "embed.html"):
        path = ROOT / language / filename
        label = f"{language}/{filename}"
        if not path.is_file():
            fail(f"{label}: required file is missing")
            continue

        text = read(path)
        basic_html_checks(text, label, calculator=(filename == "calculator.html"))

        script = extract_last_inline_script(text, label)
        if script is not None:
            node_syntax_check(script, label)

        if filename == "calculator.html":
            models[language] = extract_model(text, label)
            if '<meta name="description"' not in text.lower():
                warn(f"{label}: no meta description (SEO improvement candidate)")
        elif "@latest" in text:
            warn(f"{label}: external dependency uses @latest; pinning a version is recommended")

# The current architecture duplicates model data across localized HTML files.
# Existing divergences are technical debt, not a reason to disable all CI.
# Report them clearly; after the shared data layer lands this becomes a hard
# invariant by construction.
if "en" in models and models["en"]:
    baseline = models["en"]
    for language, model in sorted(models.items()):
        if not model or language == "en":
            continue
        if model != baseline:
            differing = sorted(
                key for key in set(baseline) | set(model) if baseline.get(key) != model.get(key)
            )
            warn(
                f"{language}/calculator.html: MODEL differs from en/calculator.html "
                f"for keys: {', '.join(differing)}"
            )

# Lightweight numerical guardrails catch accidental zeroes/order-of-magnitude
# mistakes in every language while still allowing evidence-based updates.
for language, model in sorted(models.items()):
    if not model:
        continue
    military = model.get("annualMilitarySpend", 0)
    if not 1e11 <= military <= 1e14:
        fail(f"{language}/calculator.html: annualMilitarySpend outside guardrail: {military}")
    multiplier = model.get("indirectMultiplier", 0)
    if not 0 < multiplier <= 20:
        fail(f"{language}/calculator.html: indirectMultiplier outside guardrail: {multiplier}")
    school = model.get("schoolCost", 0)
    if not 1e5 <= school <= 1e9:
        fail(f"{language}/calculator.html: schoolCost outside guardrail: {school}")

print(f"Warnings: {len(warnings)}")
for item in warnings:
    print(f"  WARN: {item}")

if errors:
    print(f"\nFAILED: {len(errors)} problem(s)")
    for item in errors:
        print(f"  ERROR: {item}")
    sys.exit(1)

print("\nPASS: baseline integrity checks succeeded")
