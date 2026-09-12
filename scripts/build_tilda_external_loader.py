#!/usr/bin/env python3
"""Build a single external JavaScript loader from the generated Tilda-native package.

The resulting loader is meant to be referenced by one tiny T123 script tag. It
reconstructs the already-tested native Shadow DOM package in the host page, so
Tilda never has to store the large calculator payload in its editor.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "dist" / "tilda"


def script_safe_json(value: str) -> str:
    return json.dumps(value, ensure_ascii=False).replace("</script", "<\\/script")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    args = parser.parse_args()

    out_dir = args.dir if args.dir.is_absolute() else ROOT / args.dir
    host_path = out_dir / f"{args.lang}-block-1.html"
    runtime_path = out_dir / f"{args.lang}-block-2.html"
    if not host_path.is_file() or not runtime_path.is_file():
        raise SystemExit("Build the Tilda native package before building the external loader")

    host_markup = host_path.read_text(encoding="utf-8")
    runtime_markup = runtime_path.read_text(encoding="utf-8")

    loader = f"""(()=>{{
  const current=document.currentScript;
  if(!current||!current.parentNode)throw new Error('True Cost of War loader has no insertion point');
  const anchor=document.createElement('span');
  anchor.hidden=true;
  current.parentNode.insertBefore(anchor,current);

  function install(markup){{
    const template=document.createElement('template');
    template.innerHTML=markup.trim();
    const scripts=Array.from(template.content.querySelectorAll('script'));
    scripts.forEach((script)=>script.remove());
    anchor.parentNode.insertBefore(template.content,anchor);
    for(const source of scripts){{
      const script=document.createElement('script');
      for(const attr of source.attributes)script.setAttribute(attr.name,attr.value);
      script.textContent=source.textContent;
      anchor.parentNode.insertBefore(script,anchor);
      script.remove();
    }}
  }}

  install({script_safe_json(host_markup)});
  install({script_safe_json(runtime_markup)});
  anchor.remove();
}})();
"""

    loader_path = out_dir / f"{args.lang}-loader.js"
    loader_path.write_text(loader, encoding="utf-8")

    preview = (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Tilda external loader smoke</title></head><body>'
        '<div id="tilda-sentinel">Tilda host page</div>'
        f'<script src="./{args.lang}-loader.js"></script>'
        '</body></html>'
    )
    (out_dir / f"{args.lang}-external-preview.html").write_text(preview, encoding="utf-8")

    print(f"Built external Tilda loader: {loader_path}")
    print(f"Loader bytes: {loader_path.stat().st_size}")


if __name__ == "__main__":
    main()
