#!/usr/bin/env python3
"""Validate the generated source-driven copy used by the unified preview."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ROOT / "data" / "routes.json"
COPY = ROOT / "unified" / "legacy-copy.json"

PROGRAMMES = {
    "education", "hunger", "health", "water", "electricity", "internet", "climate", "schools"
}
METRICS = {"personal", "direct", "indirect", "infrastructure", "life", "economicLoss"}
HERO = {"subtitle", "livePrefix", "liveSuffix", "liveTemplate", "lead", "tooltip", "mainCaption", "mainTooltip"}
SESSION = {"title", "note", "alternatives", "foodTemplate", "healthTemplate", "povertyTemplate"}
OPPORTUNITY = {
    "title", "intro", "scenarioTitle", "scenarioTooltip", "scenarioSpectrum",
    "fundHeading", "fundSubtitle", "showMore", "programmes",
}
NARRATIVE = {
    "scaleHeading", "scaleTitle", "day", "month", "year", "missionHeading", "missionCopy",
    "impactTitle", "impact", "cta", "ctaHref", "philosophyTitle", "philosophyCopy", "quote",
    "quoteSource", "closing",
}


def load(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise SystemExit(f"{path.relative_to(ROOT)}: root must be an object")
    return value


def non_empty(value, label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f"{label}: expected non-empty string")


def main() -> None:
    routes = load(ROUTES).get("languages", {})
    document = load(COPY)
    if document.get("schemaVersion") != 1:
        raise SystemExit("unified/legacy-copy.json: schemaVersion must be 1")
    languages = document.get("languages")
    if not isinstance(languages, dict):
        raise SystemExit("unified/legacy-copy.json: languages must be an object")
    if set(languages) != set(routes):
        raise SystemExit(
            f"legacy copy language mismatch: missing={sorted(set(routes)-set(languages))}, "
            f"extra={sorted(set(languages)-set(routes))}"
        )

    for language, data in languages.items():
        if data.get("source") != routes[language]["source"]:
            raise SystemExit(f"{language}: extracted source does not match data/routes.json")

        hero = data.get("hero", {})
        session = data.get("session", {})
        metrics = data.get("metrics", {})
        economic = data.get("economic", {})
        opportunity = data.get("opportunity", {})
        narrative = data.get("narrative", {})

        missing = HERO - set(hero)
        if missing:
            raise SystemExit(f"{language}: hero missing {sorted(missing)}")
        missing = SESSION - set(session)
        if missing:
            raise SystemExit(f"{language}: session missing {sorted(missing)}")
        if set(metrics) != METRICS:
            raise SystemExit(f"{language}: metric copy keys do not match contract")
        if set(opportunity) != OPPORTUNITY:
            raise SystemExit(f"{language}: opportunity copy keys do not match contract")
        if set(opportunity.get("programmes", {})) != PROGRAMMES:
            raise SystemExit(f"{language}: programme copy keys do not match contract")
        missing = NARRATIVE - set(narrative)
        if missing:
            raise SystemExit(f"{language}: narrative missing {sorted(missing)}")

        for key in HERO:
            # Prefix/suffix may legitimately be empty when the number comes first/last.
            if key not in {"livePrefix", "liveSuffix"}:
                non_empty(hero[key], f"{language}.hero.{key}")
        non_empty(hero["liveTemplate"], f"{language}.hero.liveTemplate")
        if "{value}" not in hero["liveTemplate"]:
            raise SystemExit(f"{language}.hero.liveTemplate: missing {{value}} marker")

        for key in SESSION:
            non_empty(session[key], f"{language}.session.{key}")
        for key in ("foodTemplate", "healthTemplate", "povertyTemplate"):
            if "{value}" not in session[key]:
                raise SystemExit(f"{language}.session.{key}: missing {{value}} marker")

        for metric_key, metric in metrics.items():
            for key in ("label", "description", "tooltip"):
                non_empty(metric.get(key), f"{language}.metrics.{metric_key}.{key}")

        for key in ("title", "intro"):
            non_empty(economic.get(key), f"{language}.economic.{key}")
        for key in OPPORTUNITY - {"programmes"}:
            non_empty(opportunity.get(key), f"{language}.opportunity.{key}")
        for programme_key, programme in opportunity["programmes"].items():
            for key in ("label", "note", "tooltip", "initialValue"):
                non_empty(programme.get(key), f"{language}.opportunity.programmes.{programme_key}.{key}")
        for key in NARRATIVE:
            non_empty(narrative.get(key), f"{language}.narrative.{key}")

    print(f"PASS: generated parity copy is complete for {len(languages)} source languages")


if __name__ == "__main__":
    main()
