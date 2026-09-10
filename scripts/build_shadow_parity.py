#!/usr/bin/env python3
"""Generate full-UI shadow parity pages for every localized calculator.

Production calculator files remain untouched. At build time each current
localized calculator keeps its DOM, CSS, copy and interactions, while only the
final inline arithmetic block is replaced with a call to the shared runtime.

Outputs live exclusively inside the GitHub Actions shadow artifact under
`dist/shadow-v2/parity/<language>/index.html` and are explicitly noindex.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "data" / "routes.json"
OUT_ROOT = ROOT / "dist" / "shadow-v2" / "parity"

FORMULA_BLOCK = re.compile(
    r"""
    const\s+mil\s*=\s*MODEL\.annualMilitarySpend\s*\*\s*fraction\s*;\s*
    const\s+direct\s*=\s*MODEL\.annualDirectDeaths\s*\*\s*fraction\s*;\s*
    const\s+indirect\s*=\s*direct\s*\*\s*MODEL\.indirectMultiplier\s*;\s*
    const\s+infra\s*=\s*MODEL\.annualInfraDamage\s*\*\s*fraction\s*;\s*
    const\s+econ\s*=\s*mil\s*\+\s*infra\s*\+\s*\(\(direct\s*\+\s*indirect\)\s*\*\s*MODEL\.economicValuePerDeath\)\s*;\s*
    const\s+redirected\s*=\s*mil\s*\*\s*share\s*;
    """,
    flags=re.VERBOSE,
)

REPLACEMENT = """const shadowSnapshot = calculateLegacySnapshot({
          model: MODEL,
          mode,
          birthYear: els.birthYear ? els.birthYear.value : 1990,
          sharePercent: val,
          now: new Date(now),
        });
        const {
          militarySpend: mil,
          directDeaths: direct,
          indirectDeaths: indirect,
          infrastructureDamage: infra,
          economicSetback: econ,
        } = shadowSnapshot.totals;
        const redirected = shadowSnapshot.opportunityCosts.redirected;"""

KNOWN_SHADOW_DIFFERENCES = {
    "ru": [
        "minute/hour totals use the shared 525600/8760 divisors instead of the legacy ru/calculator.html 525960/8766 typo; tracked in issue #14"
    ]
}


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def load_sources() -> list[tuple[str, Path]]:
    document = json.loads(ROUTES_PATH.read_text(encoding="utf-8"))
    if document.get("schemaVersion") != 1:
        raise SystemExit("data/routes.json: schemaVersion must be 1")

    languages = document.get("languages")
    if not isinstance(languages, dict) or not languages:
        raise SystemExit("data/routes.json: languages must be a non-empty object")

    sources: list[tuple[str, Path]] = []
    for language, config in sorted(languages.items()):
        if not isinstance(config, dict) or not isinstance(config.get("source"), str):
            raise SystemExit(f"data/routes.json: {language} must declare a source")
        source = ROOT / config["source"]
        if not source.is_file():
            raise SystemExit(f"{language}: source file does not exist: {config['source']}")
        sources.append((language, source))
    return sources


def transform(language: str, source: Path) -> tuple[Path, dict]:
    html = source.read_text(encoding="utf-8")

    script_start = html.rfind("<script>")
    if script_start < 0:
        raise SystemExit(f"{source.relative_to(ROOT)}: final inline <script> not found")

    script_end = html.find("</script>", script_start)
    if script_end < 0:
        raise SystemExit(f"{source.relative_to(ROOT)}: final inline script is unterminated")

    final_script = html[script_start:script_end]
    matches = list(FORMULA_BLOCK.finditer(final_script))
    if len(matches) != 1:
        raise SystemExit(
            f"{source.relative_to(ROOT)}: expected exactly one legacy arithmetic block, found {len(matches)}"
        )

    module_open = (
        '<script type="module">\n'
        "      import { calculateLegacySnapshot } from '../../src/runtime.mjs';\n"
        f"      console.info('True Cost of War: shadow parity runtime ({language})');"
    )
    transformed_script = final_script.replace("<script>", module_open, 1)
    transformed_script, replacements = FORMULA_BLOCK.subn(REPLACEMENT, transformed_script, count=1)
    if replacements != 1:
        raise SystemExit(f"{source.relative_to(ROOT)}: failed to replace legacy arithmetic block")

    transformed = html[:script_start] + transformed_script + html[script_end:]
    transformed = transformed.replace(
        "<head>",
        '<head>\n  <meta name="robots" content="noindex,nofollow,noarchive">',
        1,
    )

    if "const mil = MODEL.annualMilitarySpend * fraction" in transformed:
        raise SystemExit(f"{source.relative_to(ROOT)}: generated page still contains legacy military assignment")
    if "calculateLegacySnapshot" not in transformed:
        raise SystemExit(f"{source.relative_to(ROOT)}: generated page is not wired to shared runtime")
    if 'name="robots" content="noindex,nofollow,noarchive"' not in transformed:
        raise SystemExit(f"{source.relative_to(ROOT)}: generated page is missing noindex metadata")

    out_dir = OUT_ROOT / language
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / "index.html"
    output.write_text(transformed, encoding="utf-8")

    entry = {
        "language": language,
        "source": source.relative_to(ROOT).as_posix(),
        "sourceSha256": sha256_bytes(source.read_bytes()),
        "output": output.relative_to(ROOT / "dist" / "shadow-v2").as_posix(),
        "outputSha256": sha256_bytes(output.read_bytes()),
        "runtime": "src/runtime.mjs",
        "knownDifferences": KNOWN_SHADOW_DIFFERENCES.get(language, []),
    }
    return output, entry


def main() -> None:
    sources = load_sources()
    entries: list[dict] = []

    for language, source in sources:
        _, entry = transform(language, source)
        entries.append(entry)

    manifest = {
        "schemaVersion": 2,
        "status": "shadow-not-production",
        "migration": "DOM/CSS/copy remain localized legacy UI; headline arithmetic is supplied by the shared runtime",
        "runtime": "src/runtime.mjs",
        "languageCount": len(entries),
        "languages": entries,
    }
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUT_ROOT / "parity-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    if len(entries) != 11:
        raise SystemExit(f"Expected 11 localized parity pages, built {len(entries)}")

    print(f"Built {len(entries)} localized shadow parity pages on the shared runtime")
    print("Production files changed: 0")
    for entry in entries:
        suffix = " (known migration difference)" if entry["knownDifferences"] else ""
        print(f"  {entry['language']}: {entry['output']}{suffix}")


if __name__ == "__main__":
    main()
