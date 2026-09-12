# Tilda-native deployment

Status: Russian production-cutover experiment

The current public calculator is embedded directly in Tilda HTML blocks. The unified runtime can now be packaged the same way, without an iframe and without a separate widget host.

## Build

```bash
python scripts/build_tilda_embed.py --lang ru --max-block-bytes 150000
```

The builder creates `dist/tilda/` with:

- `ru-block-1.html` — Shadow DOM host, production markup and isolated/minified CSS;
- `ru-block-2.html` — minified unified JavaScript runtime plus Russian copy/data;
- `ru-single.html` — both blocks combined, useful if one T123 block accepts the full payload;
- `ru-preview.html` — standalone browser-smoke harness;
- `ru-manifest.json` — block sizes and deployment notes.

The current Russian build is roughly 80 KB + 135 KB. The 150 KB value above is an internal live-test guardrail, not a documented Tilda platform limit. Tilda's public T123 documentation confirms support for HTML, CSS and JavaScript but does not publish a payload-size limit. If the editor rejects either block, the next packaging step is to split the payload further without changing the calculator runtime.

## Why Shadow DOM

The unified visual layer intentionally contains broad selectors such as `body`, headings, buttons and form controls. Tilda recommends avoiding universal or generic selectors in custom code because they can affect the rest of the page. The Tilda build therefore mounts the calculator inside an open Shadow DOM and rewrites the runtime's DOM queries to that isolated root.

The production calculation engine and `data/model.json` are not changed by this packaging step.

## First live test

1. Duplicate the Russian calculator page in Tilda or create a temporary unindexed test page.
2. Add two T123 HTML blocks at the position of the old calculator.
3. Paste `ru-block-1.html` into the first block.
4. Paste `ru-block-2.html` into the second block immediately after it.
5. Publish the test page.
6. Check desktop and mobile: counter motion, timeframe selector, redistribution slider, programme disclosure, info tooltips, share output and download.
7. Compare the result against the stabilized GitHub preview.

If the page works cleanly, the same builder can generate the remaining language packages without creating separate calculator codebases.

## Important behavior

- No iframe is used.
- The calculator does not rewrite the Tilda page title.
- Calculator state changes do not rewrite the Tilda page URL.
- Only the requested language's locale/copy is embedded, keeping the payload smaller.
- Tilda CSS cannot leak into the calculator and calculator CSS cannot leak into Tilda.
- The existing iframe-oriented widget bundle remains available as an optional third-party embed path; it is not required for the Tilda cutover.
