#!/usr/bin/env python3
"""Build a single external JavaScript loader from the generated Tilda-native package.

The resulting loader is meant to be referenced by one tiny T123 script tag. It
reconstructs the already-tested native Shadow DOM package in the host page, so
Tilda never has to store the large calculator payload in its editor.
"""

from __future__ import annotations

import argparse
import json
import re
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
    safe_language = re.sub(r"[^a-z0-9-]+", "-", args.lang.lower())
    host_id = f"pw-tcow-tilda-{safe_language}"

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

  // The native package uses CSS containment to isolate its layout. In the
  // external Tilda delivery that containment also becomes the containing block
  // for desktop position:fixed tooltips, so after page scroll their viewport
  // coordinates are interpreted relative to the calculator host. Relax only
  // that containment here; Shadow DOM still provides style isolation.
  const host=document.getElementById({json.dumps(host_id)});
  if(host?.shadowRoot){{
    const viewportStyle=document.createElement('style');
    viewportStyle.textContent=':host{{contain:none!important;}}';
    host.shadowRoot.append(viewportStyle);
  }}

  install({script_safe_json(runtime_markup)});
  anchor.remove();
}})();
"""

    loader_path = out_dir / f"{args.lang}-loader.js"
    loader_path.write_text(loader, encoding="utf-8")

    tooltip_harness = f"""
<script>
(function waitForCalculator(attempt = 0) {{
  const host = document.getElementById({json.dumps(host_id)});
  const root = host?.shadowRoot;
  if (!host || !root || host.dataset.pwReady !== 'true') {{
    if (attempt < 100) setTimeout(() => waitForCalculator(attempt + 1), 25);
    return;
  }}

  if (window.matchMedia('(max-width: 600px)').matches) {{
    host.dataset.pwTooltipScroll = 'mobile-inline';
    return;
  }}

  host.dataset.pwTooltipScroll = 'checking';
  const trigger = root.querySelector('.pw-parity-info[data-tooltip-key="infrastructure"]');
  if (!trigger) {{
    host.dataset.pwTooltipScroll = 'missing-trigger';
    return;
  }}

  trigger.scrollIntoView({{ block: 'center' }});
  setTimeout(() => {{
    trigger.click();
    setTimeout(() => {{
      const popover = root.querySelector('.pw-parity-popover:not([hidden])');
      if (!popover) {{
        host.dataset.pwTooltipScroll = 'missing-popover';
        return;
      }}
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const triggerCenter = (triggerRect.top + triggerRect.bottom) / 2;
      const popoverCenter = (popoverRect.top + popoverRect.bottom) / 2;
      const visible = popoverRect.bottom > 0 && popoverRect.top < window.innerHeight;
      const nearby = Math.abs(popoverCenter - triggerCenter) < 360;
      host.dataset.pwTooltipScroll = visible && nearby ? 'pass' : 'misplaced';
    }}, 50);
  }}, 50);
}})();
</script>
"""

    preview = (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Tilda external loader smoke</title></head><body>'
        '<div id="tilda-sentinel">Tilda host page</div>'
        + tooltip_harness
        + f'<script src="./{args.lang}-loader.js"></script>'
        + '</body></html>'
    )
    (out_dir / f"{args.lang}-external-preview.html").write_text(preview, encoding="utf-8")

    print(f"Built external Tilda loader: {loader_path}")
    print(f"Loader bytes: {loader_path.stat().st_size}")


if __name__ == "__main__":
    main()
