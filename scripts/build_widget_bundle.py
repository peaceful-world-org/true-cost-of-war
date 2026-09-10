#!/usr/bin/env python3
"""Build a reproducible static widget bundle from the current localized calculators.

This is deliberately a packaging step, not a runtime refactor. The source files
remain the existing <lang>/calculator.html documents. The output normalizes
future routes while also emitting compatibility copies for legacy iframe URLs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "data" / "routes.json"
DEFAULT_OUT = ROOT / "dist" / "true-cost-of-war"


def load_routes() -> dict:
    document = json.loads(ROUTES_PATH.read_text(encoding="utf-8"))
    if document.get("schemaVersion") != 1:
        raise SystemExit("data/routes.json: schemaVersion must be 1")
    languages = document.get("languages")
    if not isinstance(languages, dict) or not languages:
        raise SystemExit("data/routes.json: languages must be a non-empty object")
    return document


def safe_relative_route(route: str) -> Path:
    """Convert an absolute-style URL path to a safe relative filesystem path."""
    if not isinstance(route, str) or not route.startswith("/"):
        raise SystemExit(f"Invalid route {route!r}: route must start with /")
    pure = PurePosixPath(route.lstrip("/"))
    if not pure.parts or any(part in {"", ".", ".."} for part in pure.parts):
        raise SystemExit(f"Invalid route {route!r}: unsafe path")
    return Path(*pure.parts)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_route(source: Path, destination_root: Path, route: str) -> Path:
    relative = safe_relative_route(route)
    destination = destination_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    return destination


def build(out_dir: Path) -> dict:
    routes = load_routes()
    languages = routes["languages"]

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    seen_routes: dict[str, str] = {}
    outputs: list[dict] = []

    for language, config in sorted(languages.items()):
        if not isinstance(config, dict):
            raise SystemExit(f"data/routes.json: {language} config must be an object")

        source_rel = config.get("source")
        canonical = config.get("canonical")
        aliases = config.get("legacyAliases", [])
        if not isinstance(source_rel, str) or not isinstance(canonical, str):
            raise SystemExit(f"data/routes.json: {language} requires source and canonical strings")
        if not isinstance(aliases, list) or not all(isinstance(item, str) for item in aliases):
            raise SystemExit(f"data/routes.json: {language}.legacyAliases must be a string array")

        source = ROOT / source_rel
        if not source.is_file():
            raise SystemExit(f"Missing source file for {language}: {source_rel}")

        source_hash = sha256(source)
        language_routes = [(canonical, "canonical"), *((alias, "legacy-alias") for alias in aliases)]

        for route, route_kind in language_routes:
            previous = seen_routes.get(route)
            if previous is not None:
                raise SystemExit(f"Duplicate output route {route}: {previous} and {language}")
            seen_routes[route] = language

            destination = copy_route(source, out_dir, route)
            output_hash = sha256(destination)
            if output_hash != source_hash:
                raise SystemExit(f"Integrity failure while copying {source_rel} to {route}")

            outputs.append(
                {
                    "language": language,
                    "kind": route_kind,
                    "route": route,
                    "source": source_rel,
                    "sha256": source_hash,
                }
            )

    manifest = {
        "schemaVersion": 1,
        "basePath": routes.get("basePath", "/true-cost-of-war"),
        "generatedFrom": "data/routes.json",
        "outputs": outputs,
    }
    manifest_path = out_dir / "bundle-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output directory")
    args = parser.parse_args()

    out_dir = args.out if args.out.is_absolute() else ROOT / args.out
    manifest = build(out_dir.resolve())

    canonical = sum(1 for item in manifest["outputs"] if item["kind"] == "canonical")
    aliases = sum(1 for item in manifest["outputs"] if item["kind"] == "legacy-alias")
    print(f"Built widget bundle: {canonical} canonical routes + {aliases} legacy aliases")
    print(f"Output: {out_dir}")


if __name__ == "__main__":
    main()
