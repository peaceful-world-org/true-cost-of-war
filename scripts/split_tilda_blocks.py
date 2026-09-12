#!/usr/bin/env python3
"""Split generated Tilda HTML into small T123-safe transport blocks.

Tilda's T123 editor can reject large custom-code payloads with a "too much text"
message. The native calculator build is intentionally self-contained, so this
packager transports the already-built host/runtime as JSON strings across a
sequence of small T123 blocks and reconstructs them in the browser.

No calculator source, arithmetic, copy, or styles are changed by this step.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "dist" / "tilda"
DEFAULT_MAX_BYTES = 42_000


def fail(message: str) -> None:
    raise SystemExit(message)


def script_safe(value: str) -> str:
    return value.replace("</script", "<\\/script")


def block_bytes(value: str) -> int:
    return len(value.encode("utf-8"))


def payload_block(namespace: str, bucket: str, chunk: str) -> str:
    encoded = json.dumps(chunk, ensure_ascii=False)
    return script_safe(
        "<script>\n"
        "(()=>{const p=globalThis["
        + json.dumps(namespace)
        + "];if(!p)throw new Error('Tilda split transport is not initialized');"
        + "p["
        + json.dumps(bucket)
        + "].push("
        + encoded
        + ");})();\n"
        "</script>"
    )


def split_payload(namespace: str, bucket: str, text: str, max_bytes: int) -> list[str]:
    if not text:
        return [payload_block(namespace, bucket, "")]

    blocks: list[str] = []
    start = 0
    while start < len(text):
        low = 1
        high = len(text) - start
        best = 0
        while low <= high:
            mid = (low + high) // 2
            candidate = payload_block(namespace, bucket, text[start : start + mid])
            if block_bytes(candidate) <= max_bytes:
                best = mid
                low = mid + 1
            else:
                high = mid - 1
        if best <= 0:
            fail(f"Unable to fit even one character of {bucket} under {max_bytes} bytes")
        blocks.append(payload_block(namespace, bucket, text[start : start + best]))
        start += best
    return blocks


def init_block(namespace: str, anchor_id: str) -> str:
    return f"""<div id={json.dumps(anchor_id)}></div>
<script>
(()=>{{
  globalThis[{json.dumps(namespace)}] = {{ host: [], runtime: [], anchorId: {json.dumps(anchor_id)} }};
}})();
</script>"""


def final_block(namespace: str) -> str:
    return f"""<script>
(()=>{{
  const p = globalThis[{json.dumps(namespace)}];
  if (!p) throw new Error('Tilda split transport is missing');
  const anchor = document.getElementById(p.anchorId);
  if (!anchor) throw new Error('Tilda split anchor is missing');

  function install(markup) {{
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    const scripts = Array.from(template.content.querySelectorAll('script'));
    scripts.forEach((script) => script.remove());
    anchor.parentNode.insertBefore(template.content, anchor);
    for (const source of scripts) {{
      const script = document.createElement('script');
      for (const attr of source.attributes) script.setAttribute(attr.name, attr.value);
      script.textContent = source.textContent;
      anchor.parentNode.insertBefore(script, anchor);
      script.remove();
    }}
  }}

  install(p.host.join(''));
  install(p.runtime.join(''));
  anchor.remove();
  delete globalThis[{json.dumps(namespace)}];
}})();
</script>"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    parser.add_argument("--max-block-bytes", type=int, default=DEFAULT_MAX_BYTES)
    args = parser.parse_args()

    out_dir = args.dir if args.dir.is_absolute() else ROOT / args.dir
    language = re.sub(r"[^a-z0-9-]+", "-", args.lang.lower())
    host_path = out_dir / f"{args.lang}-block-1.html"
    runtime_path = out_dir / f"{args.lang}-block-2.html"
    if not host_path.is_file() or not runtime_path.is_file():
        fail("Build the Tilda native package before splitting it")

    host = host_path.read_text(encoding="utf-8")
    runtime = runtime_path.read_text(encoding="utf-8")
    namespace = f"__PW_TCOW_TILDA_SPLIT_{language.upper().replace('-', '_')}__"
    anchor_id = f"pw-tcow-tilda-split-anchor-{language}"

    blocks = [init_block(namespace, anchor_id)]
    blocks.extend(split_payload(namespace, "host", host, args.max_block_bytes))
    blocks.extend(split_payload(namespace, "runtime", runtime, args.max_block_bytes))
    blocks.append(final_block(namespace))

    for index, block in enumerate(blocks, start=1):
        size = block_bytes(block)
        if size > args.max_block_bytes:
            fail(f"Generated block {index} is {size} bytes, above limit {args.max_block_bytes}")
        (out_dir / f"{args.lang}-t123-{index:02d}.html").write_text(block + "\n", encoding="utf-8")

    combined = "\n".join(blocks)
    (out_dir / f"{args.lang}-t123-all.html").write_text(combined + "\n", encoding="utf-8")
    preview = (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Tilda split transport smoke</title></head><body>'
        '<div id="tilda-sentinel">Tilda host page</div>'
        + combined
        + "</body></html>"
    )
    (out_dir / f"{args.lang}-t123-preview.html").write_text(preview + "\n", encoding="utf-8")

    manifest = {
        "schemaVersion": 1,
        "delivery": "tilda-t123-split-transport",
        "language": args.lang,
        "maxBlockBytes": args.max_block_bytes,
        "blockCount": len(blocks),
        "blocks": [
            {
                "file": f"{args.lang}-t123-{index:02d}.html",
                "bytes": block_bytes(block),
            }
            for index, block in enumerate(blocks, start=1)
        ],
        "pasteOrder": [f"{args.lang}-t123-{index:02d}.html" for index in range(1, len(blocks) + 1)],
        "sourceFiles": [host_path.name, runtime_path.name],
    }
    (out_dir / f"{args.lang}-t123-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    sizes = [block_bytes(block) for block in blocks]
    print(f"Split Tilda package for {args.lang}: {len(blocks)} T123 blocks")
    print("Block sizes: " + ", ".join(str(size) for size in sizes))
    print(f"Largest block: {max(sizes)} bytes (limit {args.max_block_bytes})")


if __name__ == "__main__":
    main()
