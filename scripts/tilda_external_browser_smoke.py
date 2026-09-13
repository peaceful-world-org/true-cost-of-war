#!/usr/bin/env python3
"""Real-browser smoke test for the external Tilda loader."""

from __future__ import annotations

import re
import shutil
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist" / "tilda"
PAGE = SITE / "ru-external-preview.html"
HOST_ID = "pw-tcow-tilda-ru"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        pass


def browser_binary() -> str:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise SystemExit("External Tilda smoke: Chrome/Chromium binary not found")


def dump_dom(browser: str, url: str, width: int, height: int) -> str:
    result = subprocess.run(
        [
            browser,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            f"--window-size={width},{height}",
            "--virtual-time-budget=5000",
            "--dump-dom",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=45,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"External Tilda smoke: browser failed: {result.stderr[-2000:]}")
    return result.stdout


def attrs(dom: str) -> dict[str, str]:
    match = re.search(rf'<div\b([^>]*\bid="{re.escape(HOST_ID)}"[^>]*)>', dom)
    if not match:
        raise AssertionError("External Tilda smoke: calculator host is missing")
    return dict(re.findall(r'([:\w-]+)="([^"]*)"', match.group(1)))


def assert_case(name: str, values: dict[str, str]) -> None:
    if values.get("data-pw-ready") != "true":
        raise AssertionError(f"{name}: loader did not reach ready state: {values}")
    if values.get("data-pw-language") != "ru":
        raise AssertionError(f"{name}: wrong language")
    if values.get("data-pw-counter") in {None, "", "—"}:
        raise AssertionError(f"{name}: main counter did not render")
    if values.get("data-pw-session") in {None, "", "—"}:
        raise AssertionError(f"{name}: session counter did not render")
    expected_tooltip = "mobile-inline" if name == "mobile" else "pass"
    if values.get("data-pw-tooltip-scroll") != expected_tooltip:
        raise AssertionError(
            f"{name}: scrolled tooltip placement failed: "
            f"{values.get('data-pw-tooltip-scroll')!r}"
        )
    if values.get("data-pw-error"):
        raise AssertionError(f"{name}: runtime error: {values['data-pw-error']}")


def main() -> None:
    if not PAGE.is_file():
        raise SystemExit("Build dist/tilda/ru-external-preview.html first")
    browser = browser_binary()
    handler = partial(QuietHandler, directory=str(SITE))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/{PAGE.name}"
    try:
        for name, width, height in (("desktop", 1280, 1000), ("mobile", 390, 844)):
            assert_case(name, attrs(dump_dom(browser, url, width, height)))
            print(f"PASS: external Tilda {name} smoke")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
    print("PASS: external Tilda loader renders in a real browser")


if __name__ == "__main__":
    main()
