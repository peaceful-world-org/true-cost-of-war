#!/usr/bin/env python3
"""Real-browser smoke test for the generated split Tilda-native RU embed."""

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
PAGE = SITE / "ru-t123-preview.html"
HOST_ID = "pw-tcow-tilda-ru"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        pass


def browser_binary() -> str:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise SystemExit("Tilda smoke: Chrome/Chromium binary not found")


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
        "--virtual-time-budget=5000",
        "--dump-dom",
        url,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=45, check=False)
    if result.returncode != 0:
        raise SystemExit(f"Tilda smoke: browser failed: {result.stderr[-2000:]}")
    return result.stdout


def host_attrs(dom: str) -> dict[str, str]:
    match = re.search(rf'<div\b([^>]*\bid="{re.escape(HOST_ID)}"[^>]*)>', dom)
    if not match:
        raise AssertionError("Tilda smoke: generated host element is missing")
    attrs: dict[str, str] = {}
    for name, value in re.findall(r'([:\w-]+)="([^"]*)"', match.group(1)):
        attrs[name] = value
    return attrs


def assert_case(name: str, attrs: dict[str, str]) -> None:
    if attrs.get("data-pw-ready") != "true":
        raise AssertionError(f"{name}: widget did not reach ready state: {attrs}")
    if attrs.get("data-pw-language") != "ru":
        raise AssertionError(f"{name}: wrong language: {attrs.get('data-pw-language')!r}")
    if not attrs.get("data-pw-title"):
        raise AssertionError(f"{name}: localized title is empty")
    if attrs.get("data-pw-counter") in {None, "", "—"}:
        raise AssertionError(f"{name}: main counter stayed at placeholder")
    if attrs.get("data-pw-session") in {None, "", "—"}:
        raise AssertionError(f"{name}: session counter stayed at placeholder")
    if attrs.get("data-pw-smoke") != "pass":
        raise AssertionError(f"{name}: interaction harness did not complete")
    if attrs.get("data-pw-smoke-share") != "25%":
        raise AssertionError(f"{name}: slider interaction did not update to 25%")
    if attrs.get("data-pw-smoke-info") != "true":
        raise AssertionError(f"{name}: info tooltip did not open")
    if attrs.get("data-pw-error"):
        raise AssertionError(f"{name}: runtime error: {attrs['data-pw-error']}")


def main() -> None:
    if not PAGE.is_file():
        raise SystemExit("Tilda smoke: build dist/tilda/ru-t123-preview.html first")

    browser = browser_binary()
    handler = partial(QuietHandler, directory=str(SITE))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/{PAGE.name}"

    try:
        for name, width, height in (("desktop", 1280, 1000), ("mobile", 390, 844)):
            attrs = host_attrs(dump_dom(browser, url, width, height))
            assert_case(name, attrs)
            print(f"PASS: Tilda {name} split smoke")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("PASS: split Tilda-native RU embed renders and responds in a real browser")


if __name__ == "__main__":
    main()
