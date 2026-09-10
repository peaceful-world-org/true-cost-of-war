#!/usr/bin/env python3
"""Validate widget route declarations against the current embed snippets.

The validator turns the route map into a CI invariant while production still
uses several historical URL conventions. It does not make network requests and
does not deploy anything.
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "data" / "routes.json"
WIDGET_HOST = "widgets.peaceful-world.org"

errors: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def safe_route(route: object, label: str) -> str | None:
    if not isinstance(route, str) or not route.startswith("/"):
        fail(f"{label}: route must be an absolute-style path beginning with /")
        return None
    if "?" in route or "#" in route:
        fail(f"{label}: query strings and fragments do not belong in routes.json")
        return None
    pure = PurePosixPath(route.lstrip("/"))
    if not pure.parts or any(part in {"", ".", ".."} for part in pure.parts):
        fail(f"{label}: unsafe route {route!r}")
        return None
    return "/" + pure.as_posix()


def index_equivalent(actual: str, canonical: str) -> bool:
    """Treat /lang and /lang/ as server-level aliases of /lang/index.html."""
    if not canonical.endswith("/index.html"):
        return False
    directory = canonical[: -len("/index.html")]
    return actual.rstrip("/") == directory.rstrip("/")


def extract_widget_routes(embed_path: Path, base_path: str) -> list[str]:
    text = embed_path.read_text(encoding="utf-8")
    iframe_sources = re.findall(
        r"<iframe\b[^>]*\bsrc=[\"']([^\"']+)[\"']",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    routes: list[str] = []
    for raw in iframe_sources:
        parsed = urlparse(html.unescape(raw.strip()))
        if parsed.hostname != WIDGET_HOST:
            continue
        if not parsed.path.startswith(base_path):
            fail(
                f"{embed_path.relative_to(ROOT)}: widget iframe path {parsed.path!r} "
                f"does not start with basePath {base_path!r}"
            )
            continue
        relative = parsed.path[len(base_path) :] or "/"
        if not relative.startswith("/"):
            relative = "/" + relative
        routes.append(relative)
    return routes


def main() -> int:
    try:
        document = json.loads(ROUTES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"data/routes.json: cannot read route manifest: {exc}")
        document = {}

    if document.get("schemaVersion") != 1:
        fail("data/routes.json: schemaVersion must be 1")

    base_path = document.get("basePath")
    if not isinstance(base_path, str) or not base_path.startswith("/"):
        fail("data/routes.json: basePath must be an absolute-style path")
        base_path = "/true-cost-of-war"
    base_path = base_path.rstrip("/")

    languages = document.get("languages")
    if not isinstance(languages, dict) or not languages:
        fail("data/routes.json: languages must be a non-empty object")
        languages = {}

    claimed_routes: dict[str, str] = {}

    for language, config in sorted(languages.items()):
        label = f"data/routes.json:{language}"
        if not isinstance(config, dict):
            fail(f"{label}: configuration must be an object")
            continue

        source_rel = config.get("source")
        canonical = safe_route(config.get("canonical"), f"{label}.canonical")
        aliases_raw = config.get("legacyAliases", [])
        if not isinstance(source_rel, str):
            fail(f"{label}.source: must be a string")
            continue
        if not isinstance(aliases_raw, list):
            fail(f"{label}.legacyAliases: must be an array")
            aliases_raw = []

        source_path = ROOT / source_rel
        if not source_path.is_file():
            fail(f"{label}: source file does not exist: {source_rel}")

        aliases: list[str] = []
        for index, raw_alias in enumerate(aliases_raw):
            alias = safe_route(raw_alias, f"{label}.legacyAliases[{index}]")
            if alias is not None:
                aliases.append(alias)

        for kind, route in [("canonical", canonical), *(("legacy alias", item) for item in aliases)]:
            if route is None:
                continue
            previous = claimed_routes.get(route)
            if previous is not None:
                fail(f"{label}: {kind} {route} duplicates route owned by {previous}")
            else:
                claimed_routes[route] = language

        embed_path = ROOT / language / "embed.html"
        if not embed_path.is_file():
            fail(f"{language}/embed.html: file is missing")
            continue

        observed = extract_widget_routes(embed_path, base_path)
        if len(observed) != 1:
            fail(
                f"{language}/embed.html: expected exactly one iframe pointing at "
                f"{WIDGET_HOST}{base_path}, found {len(observed)}"
            )
            continue

        actual = observed[0]
        accepted = set(aliases)
        if canonical is not None:
            accepted.add(canonical)

        if actual in accepted:
            if canonical is not None and actual != canonical:
                warn(f"{language}/embed.html: still uses legacy widget route {actual}; canonical is {canonical}")
        elif canonical is not None and index_equivalent(actual, canonical):
            warn(
                f"{language}/embed.html: uses directory form {actual}; "
                f"canonical file route is {canonical}"
            )
        else:
            fail(
                f"{language}/embed.html: iframe route {actual} is not declared for this language; "
                f"expected one of {sorted(accepted)}"
            )

    print("True Cost of War — widget route QA")
    print(f"Languages checked: {len(languages)}")
    print(f"Warnings: {len(warnings)}")
    for item in warnings:
        print(f"  WARN: {item}")

    if errors:
        print(f"\nFAILED: {len(errors)} problem(s)")
        for item in errors:
            print(f"  ERROR: {item}")
        return 1

    print("\nPASS: route manifest matches current embed snippets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
