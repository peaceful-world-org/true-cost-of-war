#!/usr/bin/env python3
"""Build a self-contained, language-specific Tilda T123 embed from unified runtime.

The output is intentionally not an iframe. It mounts the existing unified UI in
an open Shadow DOM so the calculator's broad CSS selectors cannot leak into the
host Tilda page and Tilda styles cannot accidentally rewrite calculator layout.

The JavaScript bundle is built from temporary, Tilda-scoped copies of the
production modules. Runtime calculation/data sources are not modified.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNIFIED = ROOT / "unified"
SRC = ROOT / "src"
DATA = ROOT / "data"
DEFAULT_OUT = ROOT / "dist" / "tilda"
ESBUILD = "esbuild@0.25.10"
RECOMMENDED_BLOCK_BYTES = 60_000

SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
BODY_RE = re.compile(r"<body\b[^>]*>(.*?)</body>", re.IGNORECASE | re.DOTALL)
STYLESHEET_RE = re.compile(
    r'<link\s+rel=["\']stylesheet["\']\s+href=["\']\.\/([^"\']+)["\']\s*/?>',
    re.IGNORECASE,
)


def fail(message: str) -> None:
    raise SystemExit(message)


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"{path.relative_to(ROOT)}: unable to load JSON: {exc}")
    if not isinstance(value, dict):
        fail(f"{path.relative_to(ROOT)}: root must be an object")
    return value


def script_safe(value: str) -> str:
    return value.replace("</script", "<\\/script")


def run(command: list[str], *, cwd: Path) -> None:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        details = (result.stderr or result.stdout).strip()
        fail(f"Command failed: {' '.join(command)}\n{details}")


def extract_legacy_copy(output_path: Path) -> dict:
    relative = output_path.relative_to(ROOT)
    run(
        [sys.executable, "scripts/extract_legacy_locale_copy.py", "--output", relative.as_posix()],
        cwd=ROOT,
    )
    value = load_json(output_path)
    output_path.unlink(missing_ok=True)
    return value


def patch_module(path: Path, source: str) -> str:
    """Scope DOM ownership to the Tilda ShadowRoot without changing arithmetic."""
    source = source.replace(
        "document.querySelectorAll(",
        "globalThis.__PW_TCOW_TILDA__.root.querySelectorAll(",
    )
    source = source.replace(
        "document.querySelector(",
        "globalThis.__PW_TCOW_TILDA__.root.querySelector(",
    )
    source = source.replace(
        "document.documentElement",
        "globalThis.__PW_TCOW_TILDA__.host",
    )
    source = source.replace(
        "document.body",
        "globalThis.__PW_TCOW_TILDA__.root",
    )

    for quote in ("'", '"'):
        source = source.replace(
            f"document.addEventListener({quote}click{quote}",
            f"globalThis.__PW_TCOW_TILDA__.root.addEventListener({quote}click{quote}",
        )
        source = source.replace(
            f"document.addEventListener({quote}keydown{quote}",
            f"globalThis.__PW_TCOW_TILDA__.root.addEventListener({quote}keydown{quote}",
        )

    if path.name == "state.mjs":
        source = source.replace(
            "const requestedLanguage = params.get('lang');",
            "const requestedLanguage = globalThis.__PW_TCOW_TILDA__?.language || params.get('lang');",
        )

    if path.name == "app.mjs":
        source = re.sub(
            r"readCandidateState\(\s*location\.search,",
            "readCandidateState('',",
            source,
            count=1,
        )
        source = source.replace(
            "history.replaceState(null, '', next);",
            "globalThis.__PW_TCOW_TILDA__.stateUrl = next;",
        )
        source = source.replace(
            "document.title = locale.pageTitle;",
            "globalThis.__PW_TCOW_TILDA__.host.setAttribute('aria-label', locale.pageTitle);",
        )

    return source


def copy_and_patch_modules(temp_root: Path) -> None:
    shutil.copytree(UNIFIED, temp_root / "unified")
    shutil.copytree(SRC, temp_root / "src")
    for path in [*(temp_root / "unified").glob("*.mjs"), *(temp_root / "src").glob("*.mjs")]:
        source = path.read_text(encoding="utf-8")
        path.write_text(patch_module(path, source), encoding="utf-8")


def single_language_assets(language: str, legacy_document: dict) -> dict[str, object]:
    manifest = load_json(UNIFIED / "locales" / "manifest.json")
    languages = manifest.get("languages")
    if not isinstance(languages, dict) or language not in languages:
        fail(f"Unsupported unified language: {language}")

    locale = load_json(UNIFIED / "locales" / f"{language}.json")
    model = load_json(DATA / "model.json")
    legacy_languages = legacy_document.get("languages")
    if not isinstance(legacy_languages, dict) or language not in legacy_languages:
        fail(f"Generated legacy copy is missing language {language}")

    manifest_one = {**manifest, "languages": {language: languages[language]}}
    legacy_one = {**legacy_document, "languages": {language: legacy_languages[language]}}

    return {
        "./locales/manifest.json": manifest_one,
        f"./locales/{language}.json": locale,
        "../data/model.json": model,
        "./legacy-copy.json": legacy_one,
    }


def make_entry(language: str, assets: dict[str, object]) -> str:
    assets_js = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    language_js = json.dumps(language, ensure_ascii=False)
    return f"""
const ns = globalThis.__PW_TCOW_TILDA__;
if (!ns?.root || !ns?.host) throw new Error('Tilda calculator host is not initialized');
ns.language = {language_js};
const assets = {assets_js};
const originalFetch = globalThis.fetch.bind(globalThis);
function requestKey(input) {{
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url || '';
}}
globalThis.fetch = (input, init) => {{
  const key = requestKey(input);
  if (Object.prototype.hasOwnProperty.call(assets, key)) {{
    return Promise.resolve(new Response(JSON.stringify(assets[key]), {{
      status: 200,
      headers: {{ 'Content-Type': 'application/json; charset=utf-8' }},
    }}));
  }}
  return originalFetch(input, init);
}};

(async () => {{
  try {{
    await import('./unified/app.mjs');
    await import('./unified/parity-b.mjs');
    await import('./unified/parity-share.mjs');
    await import('./unified/visual-polish.mjs');
    ns.host.dataset.pwReady = 'true';
    ns.host.dataset.pwLanguage = ns.language;
    ns.host.dataset.pwTitle = ns.root.querySelector('#title')?.textContent?.trim() || '';
    ns.host.dataset.pwCounter = ns.root.querySelector('#mainCounterValue')?.textContent?.trim() || '';
    ns.host.dataset.pwSession = ns.root.querySelector('#viewerSpend')?.textContent?.trim() || '';
    ns.host.dataset.pwShare = ns.root.querySelector('#shareLabel')?.textContent?.trim() || '';
    window.dispatchEvent(new CustomEvent('pw-tcow-ready', {{ detail: {{ language: ns.language, hostId: ns.host.id }} }}));
  }} catch (error) {{
    ns.host.dataset.pwError = String(error?.message || error);
    console.error('True Cost of War Tilda bootstrap failed', error);
  }} finally {{
    globalThis.fetch = originalFetch;
  }}
}})();
""".strip()


def build_css(temp_root: Path, stylesheet_names: list[str]) -> str:
    css_entry = temp_root / "tilda.css"
    imports = [name for name in stylesheet_names if name != "embed.css"]
    css_entry.write_text(
        "\n".join(f'@import "./unified/{name}";' for name in imports) + "\n",
        encoding="utf-8",
    )
    output = temp_root / "tilda.min.css"
    run(
        [
            "npx",
            "--yes",
            ESBUILD,
            css_entry.name,
            "--bundle",
            "--minify",
            "--loader:.css=css",
            f"--outfile={output.name}",
            "--log-level=warning",
        ],
        cwd=temp_root,
    )
    css = output.read_text(encoding="utf-8")
    css = css.replace(":root", ":host")
    css = re.sub(r"(?<![-\w])html(?=\{)", ":host", css)
    css = re.sub(r"(?<![-\w])body(?=\{)", ".pw-tilda-body", css)
    css += (
        ":host{display:block;width:100%;max-width:100%;contain:content;}"
        ".pw-preview-banner,.pw-compare,.pw-debug{display:none!important;}"
    )
    return css


def build_js(temp_root: Path, entry_source: str) -> str:
    entry = temp_root / "entry.mjs"
    entry.write_text(entry_source, encoding="utf-8")
    output = temp_root / "runtime.min.js"
    run(
        [
            "npx",
            "--yes",
            ESBUILD,
            entry.name,
            "--bundle",
            "--minify",
            "--format=esm",
            "--platform=browser",
            "--target=es2022",
            f"--outfile={output.name}",
            "--log-level=warning",
        ],
        cwd=temp_root,
    )
    bundled = output.read_text(encoding="utf-8")
    if re.search(r"(^|\n)\s*export\s", bundled):
        fail("Tilda runtime bundle unexpectedly contains a top-level export")
    # ESM output preserves top-level await used by the unified modules. Wrapping
    # the already-bundled source in one async IIFE makes it safe in a normal
    # inline <script> block while keeping the original module evaluation order.
    return "(async()=>{\n" + bundled + "\n})().catch(console.error);"


def extract_body_and_styles() -> tuple[str, list[str]]:
    index = (UNIFIED / "index.html").read_text(encoding="utf-8")
    body_match = BODY_RE.search(index)
    if not body_match:
        fail("unified/index.html: body element not found")
    body = SCRIPT_TAG_RE.sub("", body_match.group(1)).strip()
    styles = STYLESHEET_RE.findall(index)
    if not styles:
        fail("unified/index.html: no stylesheet links found")
    return body, styles


def host_block(language: str, body: str, css: str) -> tuple[str, str]:
    safe_language = re.sub(r"[^a-z0-9-]+", "-", language.lower())
    host_id = f"pw-tcow-tilda-{safe_language}"
    css_js = json.dumps(css, ensure_ascii=False)
    body_js = json.dumps(f'<div class="pw-tilda-body">{body}</div>', ensure_ascii=False)
    language_js = json.dumps(language, ensure_ascii=False)
    block = f"""<div id="{host_id}" data-pw-tcow-language={json.dumps(language)}></div>
<script>
(() => {{
  const host = document.getElementById({json.dumps(host_id)});
  if (!host) throw new Error('True Cost of War Tilda host not found');
  const root = host.shadowRoot || host.attachShadow({{ mode: 'open' }});
  root.replaceChildren();
  const style = document.createElement('style');
  style.textContent = {css_js};
  const shell = document.createElement('div');
  shell.innerHTML = {body_js};
  root.append(style, ...shell.childNodes);
  globalThis.__PW_TCOW_TILDA__ = {{ host, root, language: {language_js}, stateUrl: '' }};
  host.dataset.pwReady = 'false';
}})();
</script>"""
    return host_id, block


def preview_document(host_id: str, single: str) -> str:
    harness = f"""
<script>
window.addEventListener('pw-tcow-ready', () => {{
  const host = document.getElementById({json.dumps(host_id)});
  const root = host?.shadowRoot;
  const share = root?.querySelector('#share');
  if (!share) {{ host.dataset.pwSmoke = 'missing-share'; return; }}
  share.value = '25';
  share.dispatchEvent(new Event('input', {{ bubbles: true }}));
  share.dispatchEvent(new Event('change', {{ bubbles: true }}));
  setTimeout(() => {{
    host.dataset.pwSmokeShare = root.querySelector('#shareLabel')?.textContent?.trim() || '';
    const info = root.querySelector('.pw-parity-info');
    if (info) {{
      info.click();
      host.dataset.pwSmokeInfo = info.getAttribute('aria-expanded') || '';
    }}
    host.dataset.pwSmoke = 'pass';
  }}, 180);
}}, {{ once: true }});
</script>
"""
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>Tilda native embed smoke</title></head><body>"
        "<div id=\"tilda-sentinel\">Tilda host page</div>"
        + single
        + harness
        + "</body></html>"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", default="ru", help="Unified language key to package")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output directory")
    parser.add_argument(
        "--max-block-bytes",
        type=int,
        default=RECOMMENDED_BLOCK_BYTES,
        help="Recommended T123 block-size guardrail",
    )
    args = parser.parse_args()

    language = args.lang
    out_dir = args.out if args.out.is_absolute() else ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    legacy_temp = out_dir / ".legacy-copy.tmp.json"
    legacy_document = extract_legacy_copy(legacy_temp)
    assets = single_language_assets(language, legacy_document)
    body, stylesheets = extract_body_and_styles()

    with tempfile.TemporaryDirectory(prefix="tcow-tilda-", dir=out_dir) as temp_name:
        temp_root = Path(temp_name)
        copy_and_patch_modules(temp_root)
        css = build_css(temp_root, stylesheets)
        js = build_js(temp_root, make_entry(language, assets))

    host_id, block_one = host_block(language, body, css)
    block_two = f"<script>\n{script_safe(js)}\n</script>"
    single = block_one + "\n" + block_two

    files = {
        f"{language}-block-1.html": block_one,
        f"{language}-block-2.html": block_two,
        f"{language}-single.html": single,
        f"{language}-preview.html": preview_document(host_id, single),
    }
    for filename, content in files.items():
        (out_dir / filename).write_text(content + "\n", encoding="utf-8")

    block_sizes = [len(block_one.encode("utf-8")), len(block_two.encode("utf-8"))]
    manifest = {
        "schemaVersion": 1,
        "delivery": "tilda-native-shadow-dom",
        "language": language,
        "source": "unified runtime",
        "hostId": host_id,
        "blocks": [
            {"file": f"{language}-block-1.html", "bytes": block_sizes[0]},
            {"file": f"{language}-block-2.html", "bytes": block_sizes[1]},
        ],
        "singleFile": f"{language}-single.html",
        "previewFile": f"{language}-preview.html",
        "recommendedBlockBytes": args.max_block_bytes,
        "fitsRecommendedBlockSize": all(size <= args.max_block_bytes for size in block_sizes),
        "notes": [
            "Paste block 1 before block 2 on the same Tilda page.",
            "No iframe is used; the calculator renders directly into a Shadow DOM.",
            "The host page URL/title are not rewritten by calculator state changes.",
            "Only the selected language copy is embedded in this build.",
        ],
    }
    (out_dir / f"{language}-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Built Tilda-native unified embed for {language}")
    print(f"Block sizes: {block_sizes[0]} bytes + {block_sizes[1]} bytes")
    print(f"Output: {out_dir}")
    if not manifest["fitsRecommendedBlockSize"]:
        fail(
            "Tilda embed was built, but at least one block exceeds the configured "
            f"{args.max_block_bytes}-byte guardrail"
        )


if __name__ == "__main__":
    main()
