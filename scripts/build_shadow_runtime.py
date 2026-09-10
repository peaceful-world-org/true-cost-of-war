#!/usr/bin/env python3
"""Build the isolated shadow runtime artifact used for parity work.

Nothing produced by this script is mapped to a production route. The artifact
contains exactly one baseline data file plus the shared engine/runtime modules
and the diagnostic preview page.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "shadow-v2"

FILES = {
    "preview/shadow-v2/index.html": "index.html",
    "src/legacy-engine.mjs": "src/legacy-engine.mjs",
    "src/runtime.mjs": "src/runtime.mjs",
    "data/model.json": "data/model.json",
    "data/model-v2.candidate.json": "research/model-v2.candidate.json",
}


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    outputs = []
    for source_rel, destination_rel in FILES.items():
        source = ROOT / source_rel
        if not source.is_file():
            raise SystemExit(f"Missing shadow runtime source: {source_rel}")

        destination = OUT / destination_rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        outputs.append(
            {
                "source": source_rel,
                "path": destination_rel,
                "sha256": digest(destination),
            }
        )

    manifest = {
        "schemaVersion": 1,
        "status": "shadow-not-production",
        "entrypoint": "index.html",
        "runtimeData": "data/model.json",
        "researchOnlyData": "research/model-v2.candidate.json",
        "outputs": outputs,
    }
    (OUT / "shadow-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Built isolated shadow runtime: {OUT}")
    print("Production routes changed: 0")


if __name__ == "__main__":
    main()
