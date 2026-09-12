#!/usr/bin/env python3
"""Build the production-ready static widget bundle from the unified runtime.

The public site still points at several historical iframe URLs. The bundle
therefore keeps every declared canonical/legacy route as a tiny compatibility
shim, but all of those shims now enter the same multilingual application at
``unified/index.html``. Query parameters (including ``embed=1``) and hashes are
preserved, while the route supplies the default language when ``lang`` is not
already present.

This is a deterministic packaging step only. It does not upload anything to
``widgets.peaceful-world.org``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "data" / "routes.json"
UNIFIED_SOURCE = ROOT / "unified"
EXTRACT_COPY_SCRIPT = ROOT / "scripts" / "extract_legacy_locale_copy.py"
DEFAULT_OUT = ROOT / "dist" / "true-cost-of-war"

RUNTIME_FILES = {
    "src/legacy-engine.mjs": "src/legacy-engine.mjs",
    "src/runtime.mjs": "src/runtime.mjs",
    "src/format.mjs": "src/format.mjs",
    "src/active-time.mjs": "src/active-time.mjs",
    "data/model.json": "data/model.json",
}


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


def copy_file(source_rel: str, destination_root: Path, destination_rel: str) -> Path:
    source = ROOT / source_rel
    if not source.is_file():
        raise SystemExit(f"Missing production runtime source: {source_rel}")
    destination = destination_root / destination_rel
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    if sha256(source) != sha256(destination):
        raise SystemExit(f"Integrity failure while copying {source_rel}")
    return destination


def route_target(relative_route: Path) -> str:
    """Return a relative URL from a compatibility route to unified/index.html."""
    depth = len(relative_route.parent.parts)
    return "../" * depth + "unified/index.html"


def redirect_document(language: str, target: str) -> str:
    target_js = json.dumps(target, ensure_ascii=False)
    language_js = json.dumps(language, ensure_ascii=False)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>True Cost of War</title>
</head>
<body>
<script>
(() => {{
  const target = new URL({target_js}, window.location.href);
  const params = new URLSearchParams(window.location.search);
  if (!params.has('lang')) params.set('lang', {language_js});
  target.search = params.toString();
  target.hash = window.location.hash;
  window.location.replace(target.href);
}})();
</script>
<noscript>This interactive model requires JavaScript.</noscript>
</body>
</html>
"""


def copy_unified_runtime(out_dir: Path) -> None:
    if not (UNIFIED_SOURCE / "index.html").is_file():
        raise SystemExit("Missing unified/index.html")

    destination = out_dir / "unified"
    shutil.copytree(
        UNIFIED_SOURCE,
        destination,
        ignore=shutil.ignore_patterns("*.md", "*-smoke.html", "legacy-copy.json"),
    )

    for source_rel, destination_rel in RUNTIME_FILES.items():
        copy_file(source_rel, out_dir, destination_rel)

    generated_copy = destination / "legacy-copy.json"
    generated_copy_rel = generated_copy.relative_to(ROOT).as_posix()
    subprocess.run(
        [sys.executable, str(EXTRACT_COPY_SCRIPT), "--output", generated_copy_rel],
        cwd=ROOT,
        check=True,
    )
    if not generated_copy.is_file():
        raise SystemExit("Failed to generate unified/legacy-copy.json")


def write_route_shim(out_dir: Path, route: str, language: str) -> tuple[Path, str]:
    relative = safe_relative_route(route)
    destination = out_dir / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    target = route_target(relative)
    destination.write_text(redirect_document(language, target), encoding="utf-8")
    return destination, target


def inventory(out_dir: Path) -> list[dict]:
    files: list[dict] = []
    for path in sorted(item for item in out_dir.rglob("*") if item.is_file()):
        if path.name == "bundle-manifest.json":
            continue
        files.append(
            {
                "path": path.relative_to(out_dir).as_posix(),
                "sha256": sha256(path),
            }
        )
    return files


def build(out_dir: Path) -> dict:
    routes = load_routes()
    languages = routes["languages"]

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    copy_unified_runtime(out_dir)

    seen_routes: dict[str, str] = {}
    route_outputs: list[dict] = []

    for language, config in sorted(languages.items()):
        if not isinstance(config, dict):
            raise SystemExit(f"data/routes.json: {language} config must be an object")

        canonical = config.get("canonical")
        aliases = config.get("legacyAliases", [])
        if not isinstance(canonical, str):
            raise SystemExit(f"data/routes.json: {language} requires a canonical string")
        if not isinstance(aliases, list) or not all(isinstance(item, str) for item in aliases):
            raise SystemExit(f"data/routes.json: {language}.legacyAliases must be a string array")

        language_routes = [(canonical, "canonical"), *((alias, "legacy-alias") for alias in aliases)]
        for route, route_kind in language_routes:
            previous = seen_routes.get(route)
            if previous is not None:
                raise SystemExit(f"Duplicate output route {route}: {previous} and {language}")
            seen_routes[route] = language

            destination, target = write_route_shim(out_dir, route, language)
            text = destination.read_text(encoding="utf-8")
            if "window.location.replace(target.href)" not in text or target not in text:
                raise SystemExit(f"Invalid compatibility shim generated for {route}")

            route_outputs.append(
                {
                    "language": language,
                    "kind": route_kind,
                    "route": route,
                    "target": target,
                    "sha256": sha256(destination),
                }
            )

    required = [
        out_dir / "unified" / "index.html",
        out_dir / "unified" / "legacy-copy.json",
        out_dir / "src" / "runtime.mjs",
        out_dir / "src" / "format.mjs",
        out_dir / "src" / "active-time.mjs",
        out_dir / "src" / "legacy-engine.mjs",
        out_dir / "data" / "model.json",
    ]
    missing = [path.relative_to(out_dir).as_posix() for path in required if not path.is_file()]
    if missing:
        raise SystemExit(f"Production bundle is missing required files: {', '.join(missing)}")

    manifest = {
        "schemaVersion": 2,
        "status": "deployable-not-deployed",
        "basePath": routes.get("basePath", "/true-cost-of-war"),
        "architecture": "unified-multilingual-runtime",
        "entrypoint": "unified/index.html",
        "generatedFrom": ["unified/", "src/", "data/model.json", "data/routes.json"],
        "routes": route_outputs,
        "files": inventory(out_dir),
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

    canonical = sum(1 for item in manifest["routes"] if item["kind"] == "canonical")
    aliases = sum(1 for item in manifest["routes"] if item["kind"] == "legacy-alias")
    print(f"Built unified production bundle: {canonical} canonical routes + {aliases} legacy aliases")
    print(f"Unified entrypoint: {manifest['entrypoint']}")
    print(f"Output: {out_dir}")
    print("Deployment performed: no")


if __name__ == "__main__":
    main()
