#!/usr/bin/env python3
"""Smoke-test the built unified preview in a real headless browser.

This intentionally uses the Chrome/Chromium already present on GitHub-hosted
Ubuntu runners, so the project does not gain a browser-test dependency. The
checks are behavioural enough to catch broken module loading, locale/RTL
initialisation, URL-state regressions, mobile disclosure regressions and embed
bootstrap failures before the preview is deployed.
"""

from __future__ import annotations

import html
import json
import shutil
import subprocess
import threading
from dataclasses import dataclass
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist" / "shadow-v2"
UNIFIED = SITE / "unified"
MANIFEST = UNIFIED / "locales" / "manifest.json"

TARGET_IDS = {
    "title",
    "mainCounterValue",
    "viewerSpend",
    "shareLabel",
    "currentPeriod",
    "debug",
    "programmeToggle",
}


class SnapshotParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.html_attrs: dict[str, str | None] = {}
        self.text: dict[str, list[str]] = {key: [] for key in TARGET_IDS}
        self._tag_targets: list[str | None] = []
        self._active: list[str] = []
        self.programmes = 0
        self.mobile_extras = 0
        self.hidden_mobile_extras = 0
        self.toggle_hidden = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "html":
            self.html_attrs = values

        target = values.get("id") if values.get("id") in TARGET_IDS else None
        self._tag_targets.append(target)
        if target:
            self._active.append(target)

        classes = set((values.get("class") or "").split())
        if "pw-programme" in classes and values.get("data-programme"):
            self.programmes += 1
            if values.get("data-mobile-extra") == "true":
                self.mobile_extras += 1
                if "hidden" in values:
                    self.hidden_mobile_extras += 1

        if values.get("id") == "programmeToggle":
            self.toggle_hidden = "hidden" in values

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "html":
            self.html_attrs = values

    def handle_endtag(self, tag: str) -> None:
        if not self._tag_targets:
            return
        target = self._tag_targets.pop()
        if target and self._active and self._active[-1] == target:
            self._active.pop()

    def handle_data(self, data: str) -> None:
        for target in self._active:
            self.text[target].append(data)

    def value(self, target: str) -> str:
        return " ".join("".join(self.text[target]).split())


@dataclass(frozen=True)
class Case:
    name: str
    language: str
    mode: str = "1year"
    share: int = 25
    year: int = 1990
    width: int = 1280
    height: int = 900
    embed: bool = False


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        pass


def fail(message: str) -> None:
    raise AssertionError(message)


def browser_binary() -> str:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise SystemExit("Browser smoke: Chrome/Chromium binary not found on runner")


def dump_dom(browser: str, url: str, width: int, height: int) -> str:
    command = [
        browser,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--hide-scrollbars",
        f"--window-size={width},{height}",
        "--virtual-time-budget=2200",
        "--dump-dom",
        url,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=35, check=False)
    if result.returncode != 0:
        stderr = result.stderr.strip()[-2000:]
        raise SystemExit(f"Browser smoke: Chrome failed for {url}: exit={result.returncode}\n{stderr}")
    if "<html" not in result.stdout:
        raise SystemExit(f"Browser smoke: Chrome returned no DOM for {url}")
    return result.stdout


def parse(dom: str) -> SnapshotParser:
    parser = SnapshotParser()
    parser.feed(dom)
    return parser


def assert_case(case: Case, page: SnapshotParser, manifest: dict) -> None:
    meta = manifest["languages"][case.language]
    lang = page.html_attrs.get("lang")
    direction = page.html_attrs.get("dir")
    classes = set((page.html_attrs.get("class") or "").split())

    if lang != meta["htmlLang"]:
        fail(f"{case.name}: html lang={lang!r}, expected {meta['htmlLang']!r}")
    if direction != meta["dir"]:
        fail(f"{case.name}: html dir={direction!r}, expected {meta['dir']!r}")
    if case.embed != ("pw-embed-mode" in classes):
        fail(f"{case.name}: embed class mismatch")

    debug = html.unescape(page.value("debug"))
    if f"language: {case.language} (" not in debug:
        fail(f"{case.name}: diagnostics did not initialise requested language")
    if f"mode: {case.mode}" not in debug:
        fail(f"{case.name}: diagnostics did not initialise requested mode")

    if not page.value("title") or page.value("title") == "The True Cost of War" and case.language != "en":
        fail(f"{case.name}: localized title did not render")
    if page.value("mainCounterValue") in {"", "—"}:
        fail(f"{case.name}: main counter remained at placeholder")
    if page.value("viewerSpend") in {"", "—"}:
        fail(f"{case.name}: session counter remained at placeholder")
    if page.value("shareLabel") != f"{case.share}%":
        fail(f"{case.name}: share label={page.value('shareLabel')!r}, expected {case.share}%")
    if page.programmes != 8:
        fail(f"{case.name}: rendered {page.programmes} programme rows, expected 8")

    mobile = case.width <= 600
    if mobile:
        if page.mobile_extras != 5 or page.hidden_mobile_extras != 5:
            fail(
                f"{case.name}: mobile disclosure expected 5 hidden extras, "
                f"got extras={page.mobile_extras}, hidden={page.hidden_mobile_extras}"
            )
        if page.toggle_hidden is not False:
            fail(f"{case.name}: mobile programme toggle should be available")
    else:
        if page.hidden_mobile_extras != 0:
            fail(f"{case.name}: desktop should not hide extra programme rows")
        if page.toggle_hidden is not True:
            fail(f"{case.name}: desktop programme toggle should stay hidden")


def main() -> None:
    if not MANIFEST.is_file():
        raise SystemExit("Browser smoke: built unified manifest is missing; build the candidate first")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    languages = list(manifest.get("languages", {}))
    if len(languages) != 11:
        raise SystemExit(f"Browser smoke: expected 11 languages, found {len(languages)}")

    browser = browser_binary()
    handler = partial(QuietHandler, directory=str(SITE))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}/unified/"

    cases = [Case(name=f"locale-{language}", language=language) for language in languages]
    cases += [
        Case("ru-lifetime", "ru", mode="lifetime", share=10, year=1990),
        Case("en-minute", "en", mode="minute", share=50, year=1988),
        Case("ar-rtl-mobile", "ar", mode="day", share=25, year=1991, width=390, height=844),
        Case("fa-rtl-embed", "fa", mode="hour", share=50, year=1987, width=430, height=900, embed=True),
    ]

    try:
        for case in cases:
            query = {
                "lang": case.language,
                "mode": case.mode,
                "share": str(case.share),
                "year": str(case.year),
            }
            if case.embed:
                query["embed"] = "1"
            url = f"{base}?{urlencode(query)}"
            page = parse(dump_dom(browser, url, case.width, case.height))
            assert_case(case, page, manifest)
            print(f"PASS: {case.name}")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print(f"PASS: browser smoke succeeded for {len(cases)} real-browser cases")


if __name__ == "__main__":
    main()
