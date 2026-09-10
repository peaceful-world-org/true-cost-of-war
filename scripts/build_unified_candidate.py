#!/usr/bin/env python3
"""Build the single-template multilingual candidate into the preview artifact.

The candidate is intentionally isolated from production. It uses one HTML
shell, one CSS file, one JavaScript application, the shared calculation
runtime, a small shareable-state helper, and one JSON locale file per supported
language.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "unified"
OUT = ROOT / "dist" / "shadow-v2" / "unified"
ROUTES = ROOT / "data" / "routes.json"

REQUIRED_TOP_LEVEL = {
    "pageTitle",
    "eyebrow",
    "title",
    "lead",
    "language",
    "timeframe",
    "birthYear",
    "redirectedShare",
    "opportunityTitle",
    "legacyLink",
    "legacyNote",
    "metrics",
    "modes",
}
REQUIRED_METRICS = {
    "militarySpend",
    "directDeaths",
    "indirectDeaths",
    "lifeYearsLost",
    "infrastructureDamage",
    "economicSetback",
    "redirectedAmount",
    "schoolsEquivalent",
    "educationMultiples",
    "healthMultiples",
}
REQUIRED_MODES = {"year", "1year", "10years", "lifetime", "day", "hour", "minute", "since1945"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"{path.relative_to(ROOT)}: invalid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"{path.relative_to(ROOT)}: root must be an object")
    return value


def validate() -> list[str]:
    for required in (
        SOURCE / "index.html",
        SOURCE / "app.css",
        SOURCE / "app.mjs",
        SOURCE / "state.mjs",
        SOURCE / "locales" / "manifest.json",
    ):
        if not required.is_file():
            raise SystemExit(f"Missing unified candidate source: {required.relative_to(ROOT)}")

    route_doc = load_json(ROUTES)
    route_languages = set(route_doc.get("languages", {}))
    if not route_languages:
        raise SystemExit("data/routes.json: no languages found")

    locale_manifest = load_json(SOURCE / "locales" / "manifest.json")
    manifest_languages = locale_manifest.get("languages")
    if not isinstance(manifest_languages, dict):
        raise SystemExit("unified/locales/manifest.json: languages must be an object")
    if set(manifest_languages) != route_languages:
        missing = sorted(route_languages - set(manifest_languages))
        extra = sorted(set(manifest_languages) - route_languages)
        raise SystemExit(f"Unified locale manifest does not match route languages; missing={missing}, extra={extra}")

    for language in sorted(route_languages):
        meta = manifest_languages[language]
        if not isinstance(meta, dict):
            raise SystemExit(f"unified/locales/manifest.json:{language}: metadata must be an object")
        for key in ("displayName", "htmlLang", "intlLocale", "dir"):
            if not isinstance(meta.get(key), str) or not meta[key].strip():
                raise SystemExit(f"unified/locales/manifest.json:{language}: invalid {key}")
        if meta["dir"] not in {"ltr", "rtl"}:
            raise SystemExit(f"unified/locales/manifest.json:{language}: dir must be ltr or rtl")
        if language in {"ar", "fa"} and meta["dir"] != "rtl":
            raise SystemExit(f"unified/locales/manifest.json:{language}: RTL language must declare dir=rtl")

        locale_path = SOURCE / "locales" / f"{language}.json"
        locale = load_json(locale_path)
        missing_top = sorted(REQUIRED_TOP_LEVEL - set(locale))
        if missing_top:
            raise SystemExit(f"{locale_path.relative_to(ROOT)}: missing keys: {', '.join(missing_top)}")
        if not isinstance(locale.get("metrics"), dict) or set(locale["metrics"]) != REQUIRED_METRICS:
            raise SystemExit(f"{locale_path.relative_to(ROOT)}: metrics keys do not match unified schema")
        if not isinstance(locale.get("modes"), dict) or set(locale["modes"]) != REQUIRED_MODES:
            raise SystemExit(f"{locale_path.relative_to(ROOT)}: mode keys do not match unified schema")

        for group in (locale, locale["metrics"], locale["modes"]):
            for key, value in group.items():
                if isinstance(value, dict):
                    continue
                if not isinstance(value, str) or not value.strip():
                    raise SystemExit(f"{locale_path.relative_to(ROOT)}: {key} must be a non-empty string")

    index = (SOURCE / "index.html").read_text(encoding="utf-8")
    if 'name="robots" content="noindex,nofollow,noarchive"' not in index:
        raise SystemExit("unified/index.html must remain noindex")
    if '<script type="module" src="./app.mjs"></script>' not in index:
        raise SystemExit("unified/index.html must load the shared app module")

    app = (SOURCE / "app.mjs").read_text(encoding="utf-8")
    if "calculateLegacySnapshot" not in app or "../src/runtime.mjs" not in app:
        raise SystemExit("unified/app.mjs must use the shared calculation runtime")
    if "../data/model.json" not in app:
        raise SystemExit("unified/app.mjs must load the canonical legacy data file")
    if "./state.mjs" not in app or "readCandidateState" not in app or "writeCandidateState" not in app:
        raise SystemExit("unified/app.mjs must use the shareable preview state helper")

    return sorted(route_languages)


def main() -> None:
    languages = validate()

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SOURCE, OUT)

    outputs = []
    for path in sorted(p for p in OUT.rglob("*") if p.is_file()):
        outputs.append({
            "path": path.relative_to(ROOT / "dist" / "shadow-v2").as_posix(),
            "sha256": digest(path),
        })

    manifest = {
        "schemaVersion": 1,
        "status": "preview-not-production",
        "candidate": "unified-v0.2",
        "architecture": "one HTML + one CSS + one JS app + one state helper + one locale JSON per language + shared data/runtime",
        "languageCount": len(languages),
        "languages": languages,
        "outputs": outputs,
    }
    (OUT / "build-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Built unified candidate v0.2 for {len(languages)} languages")
    print("Production files changed: 0")
    print("Preview entrypoint: unified/index.html?lang=<language>")


if __name__ == "__main__":
    main()
