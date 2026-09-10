#!/usr/bin/env python3
"""Baseline QA for the True Cost of War static application.

The checker protects the current product while the calculator is modernised.
`data/model.json` is the machine-readable legacy baseline. It is deliberately
not treated as a methodological endorsement: evidence review happens in a
separate phase.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "data" / "model.json"
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


def load_canonical_model() -> tuple[dict[str, float], dict[str, dict[str, float]]]:
    if not MODEL_PATH.is_file():
        fail("data/model.json: canonical model file is missing")
        return {}, {}

    try:
        document = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"data/model.json: cannot parse canonical model: {exc}")
        return {}, {}

    if document.get("schemaVersion") != 1:
        fail("data/model.json: schemaVersion must be 1")

    values = document.get("values")
    if not isinstance(values, dict):
        fail("data/model.json: values must be an object")
        values = {}

    missing = sorted(REQUIRED_MODEL_KEYS - values.keys())
    extra = sorted(values.keys() - REQUIRED_MODEL_KEYS)
    if missing:
        fail(f"data/model.json: missing canonical keys: {', '.join(missing)}")
    if extra:
        warn(f"data/model.json: unrecognised canonical keys: {', '.join(extra)}")

    canonical: dict[str, float] = {}
    for key, value in values.items():
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            fail(f"data/model.json: {key} must be numeric")
            continue
        numeric = float(value)
        if numeric <= 0:
            fail(f"data/model.json: {key} must be positive, got {value}")
        canonical[key] = numeric

    raw_overrides = document.get("legacyOverrides", {})
    if not isinstance(raw_overrides, dict):
        fail("data/model.json: legacyOverrides must be an object")
        raw_overrides = {}

    overrides: dict[str, dict[str, float]] = {}
    for path, patch in raw_overrides.items():
        if not isinstance(path, str) or not isinstance(patch, dict):
            fail("data/model.json: every legacy override must map a path to an object")
            continue
        parsed_patch: dict[str, float] = {}
        for key, value in patch.items():
            if key not in REQUIRED_MODEL_KEYS:
                fail(f"data/model.json: override {path} uses unknown key {key}")
                continue
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                fail(f"data/model.json: override {path}.{key} must be numeric")
                continue
            parsed_patch[key] = float(value)
        overrides[path] = parsed_patch

    return canonical, overrides


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


def expected_model_for(path: str, canonical: dict[str, float], overrides: dict[str, dict[str, float]]) -> dict[str, float]:
    expected = dict(canonical)
    expected.update(overrides.get(path, {}))
    return expected


print("True Cost of War — baseline QA")
print(f"Checking {len(LANGUAGES)} language variants against data/model.json...\n")

canonical, legacy_overrides = load_canonical_model()
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
            models[label] = extract_model(text, label)
            if '<meta name="description"' not in text.lower():
                warn(f"{label}: no meta description (SEO improvement candidate)")
        elif "@latest" in text:
            warn(f"{label}: external dependency uses @latest; pinning a version is recommended")

# All duplicated runtime models must now match the explicit canonical baseline,
# except for legacy differences documented by exact file path in model.json.
if canonical:
    for label, model in sorted(models.items()):
        if not model:
            continue
        expected = expected_model_for(label, canonical, legacy_overrides)
        differing = sorted(
            key for key in REQUIRED_MODEL_KEYS if model.get(key) != expected.get(key)
        )
        if differing:
            fail(
                f"{label}: MODEL drifted from data/model.json for keys: "
                f"{', '.join(differing)}"
            )

# Make stale override entries visible. Once a legacy difference is removed from
# runtime code, its exception should be deleted from data/model.json too.
for override_path in sorted(legacy_overrides):
    if override_path not in models:
        warn(f"data/model.json: legacy override points to unchecked path: {override_path}")
    elif models[override_path] == canonical:
        warn(f"data/model.json: legacy override for {override_path} is no longer needed")

# Lightweight numerical guardrails catch accidental zeroes/order-of-magnitude
# mistakes while still allowing evidence-based updates to the canonical file.
for label, model in sorted(models.items()):
    if not model:
        continue
    military = model.get("annualMilitarySpend", 0)
    if not 1e11 <= military <= 1e14:
        fail(f"{label}: annualMilitarySpend outside guardrail: {military}")
    multiplier = model.get("indirectMultiplier", 0)
    if not 0 < multiplier <= 20:
        fail(f"{label}: indirectMultiplier outside guardrail: {multiplier}")
    school = model.get("schoolCost", 0)
    if not 1e5 <= school <= 1e9:
        fail(f"{label}: schoolCost outside guardrail: {school}")

print(f"Warnings: {len(warnings)}")
for item in warnings:
    print(f"  WARN: {item}")

if errors:
    print(f"\nFAILED: {len(errors)} problem(s)")
    for item in errors:
        print(f"  ERROR: {item}")
    sys.exit(1)

print("\nPASS: baseline integrity checks succeeded")
