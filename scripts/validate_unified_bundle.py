#!/usr/bin/env python3
"""Fail CI when the built unified preview references a missing local asset."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "dist" / "shadow-v2"
UNIFIED = BUNDLE / "unified"

IMPORT_RE = re.compile(r"(?:import|export)\s+(?:[^'\"\n]*?\s+from\s+)?['\"]([^'\"]+)['\"]")
CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\()?['\"]?([^'\")\s]+)")


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.robots: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "script" and values.get("src"):
            self.assets.append(values["src"])
        if tag == "link" and values.get("href") and values.get("rel") == "stylesheet":
            self.assets.append(values["href"])
        if tag == "meta" and values.get("name", "").lower() == "robots":
            self.robots.append(values.get("content", ""))


def local_path(base: Path, reference: str) -> Path | None:
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc or reference.startswith("#"):
        return None
    return (base / parsed.path).resolve()


def assert_inside_bundle(path: Path, label: str) -> None:
    try:
        path.relative_to(BUNDLE.resolve())
    except ValueError as exc:
        raise SystemExit(f"{label}: path escapes built preview bundle: {path}") from exc


def validate_html(path: Path) -> list[Path]:
    if not path.is_file():
        raise SystemExit(f"missing built HTML: {path.relative_to(ROOT)}")
    parser = AssetParser()
    parser.feed(path.read_text(encoding="utf-8"))
    if not any("noindex" in value.lower() for value in parser.robots):
        raise SystemExit(f"{path.relative_to(ROOT)}: preview page must remain noindex")

    resolved: list[Path] = []
    for reference in parser.assets:
        target = local_path(path.parent, reference)
        if target is None:
            continue
        assert_inside_bundle(target, reference)
        if not target.is_file():
            raise SystemExit(f"{path.relative_to(ROOT)} references missing asset {reference}")
        resolved.append(target)
    return resolved


def validate_module(path: Path, seen: set[Path]) -> None:
    path = path.resolve()
    if path in seen:
        return
    seen.add(path)
    text = path.read_text(encoding="utf-8")
    for reference in IMPORT_RE.findall(text):
        if not reference.startswith("."):
            continue
        target = local_path(path.parent, reference)
        if target is None:
            continue
        assert_inside_bundle(target, reference)
        if not target.is_file():
            raise SystemExit(f"{path.relative_to(BUNDLE)} imports missing module {reference}")
        validate_module(target, seen)


def validate_css(path: Path, seen: set[Path]) -> None:
    path = path.resolve()
    if path in seen:
        return
    seen.add(path)
    text = path.read_text(encoding="utf-8")
    for reference in CSS_IMPORT_RE.findall(text):
        target = local_path(path.parent, reference)
        if target is None:
            continue
        assert_inside_bundle(target, reference)
        if not target.is_file():
            raise SystemExit(f"{path.relative_to(BUNDLE)} imports missing stylesheet {reference}")
        validate_css(target, seen)


def main() -> None:
    entry_assets = validate_html(UNIFIED / "index.html")
    validate_html(UNIFIED / "embed-smoke.html")

    required_runtime_files = [
        UNIFIED / "legacy-copy.json",
        UNIFIED / "locales" / "manifest.json",
        BUNDLE / "data" / "model.json",
        BUNDLE / "src" / "runtime.mjs",
        BUNDLE / "src" / "format.mjs",
    ]
    for path in required_runtime_files:
        if not path.is_file():
            raise SystemExit(f"missing runtime dependency: {path.relative_to(ROOT)}")

    modules: set[Path] = set()
    styles: set[Path] = set()
    for asset in entry_assets:
        if asset.suffix == ".mjs":
            validate_module(asset, modules)
        elif asset.suffix == ".css":
            validate_css(asset, styles)

    print(
        f"PASS: unified preview bundle resolves {len(modules)} JS modules and "
        f"{len(styles)} stylesheets with required runtime data present"
    )


if __name__ == "__main__":
    main()
