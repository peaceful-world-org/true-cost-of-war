#!/usr/bin/env python3
"""Generate a visual-parity shadow page from the current English calculator.

The source calculator is left untouched. At build time we convert its final
inline script to an ES module and replace only the duplicated arithmetic block
with a call to the shared runtime. The resulting page therefore keeps the
current DOM, CSS, copy and interactions while exercising the new engine.

Output lives only inside the shadow GitHub Actions artifact.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "en" / "calculator.html"
OUT = ROOT / "dist" / "shadow-v2" / "parity" / "en"

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


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def main() -> None:
    html = SOURCE.read_text(encoding="utf-8")

    script_start = html.rfind("<script>")
    if script_start < 0:
        raise SystemExit("en/calculator.html: final inline <script> not found")

    script_end = html.find("</script>", script_start)
    if script_end < 0:
        raise SystemExit("en/calculator.html: final inline script is unterminated")

    final_script = html[script_start:script_end]
    matches = list(FORMULA_BLOCK.finditer(final_script))
    if len(matches) != 1:
        raise SystemExit(
            f"en/calculator.html: expected exactly one legacy arithmetic block, found {len(matches)}"
        )

    module_open = (
        '<script type="module">\n'
        "      import { calculateLegacySnapshot } from '../../src/runtime.mjs';\n"
        "      console.info('True Cost of War: shadow parity runtime');"
    )
    transformed_script = final_script.replace("<script>", module_open, 1)
    transformed_script, replacements = FORMULA_BLOCK.subn(REPLACEMENT, transformed_script, count=1)
    if replacements != 1:
        raise SystemExit("Failed to replace legacy arithmetic block")

    transformed = html[:script_start] + transformed_script + html[script_end:]
    transformed = transformed.replace(
        "<head>",
        '<head>\n  <meta name="robots" content="noindex,nofollow,noarchive">',
        1,
    )

    if "const mil = MODEL.annualMilitarySpend * fraction" in transformed:
        raise SystemExit("Generated parity page still contains the legacy military-spend assignment")
    if "calculateLegacySnapshot" not in transformed:
        raise SystemExit("Generated parity page is not wired to the shared runtime")

    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / "index.html"
    output.write_text(transformed, encoding="utf-8")

    manifest = {
        "schemaVersion": 1,
        "status": "shadow-not-production",
        "language": "en",
        "source": "en/calculator.html",
        "sourceSha256": sha256_bytes(SOURCE.read_bytes()),
        "output": "parity/en/index.html",
        "outputSha256": sha256_bytes(output.read_bytes()),
        "runtime": "src/runtime.mjs",
        "migration": "DOM/CSS/copy remain legacy; arithmetic is supplied by the shared runtime",
    }
    (OUT / "parity-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("Built English shadow parity page")
    print("Production files changed: 0")


if __name__ == "__main__":
    main()
