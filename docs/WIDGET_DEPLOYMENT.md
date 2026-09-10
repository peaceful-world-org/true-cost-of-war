# Widget deployment map

Status: transitional architecture

The public Peaceful World pages embed calculator iframes from `https://widgets.peaceful-world.org/true-cost-of-war/`. The repository previously had no documented build or deployment workflow for that subdomain, and the iframe URLs use several historical naming conventions.

## What is known

The source-of-truth files currently remain the localized `calculator.html` files in this repository. The public landing pages on `peaceful-world.org` are Tilda pages that include iframe snippets pointing at `widgets.peaceful-world.org`.

Current legacy iframe routes found in the localized embed snippets include:

| Language | Source file | Existing iframe route | Proposed canonical route |
| --- | --- | --- | --- |
| English | `en/calculator.html` | `/index.html` | `/index.html` |
| German | `de/calculator.html` | `/de/index.html` | `/de/index.html` |
| Spanish | `es/calculator.html` | `/index-es.html` | `/es/index.html` |
| French | `fr/calculator.html` | `/index-fr.html` | `/fr/index.html` |
| Portuguese | `pt/calculator.html` | `/pt/index.html` | `/pt/index.html` |
| Arabic | `ar/calculator.html` | `/ar/index.html` | `/ar/index.html` |
| Persian | `fa/calculator.html` | `/fa/index.html` | `/fa/index.html` |
| Russian | `ru/calculator.html` | `/ru/index.html` | `/ru/index.html` |
| Hindi | `hi/calculator.html` | `/index-hi.html` | `/hi/index.html` |
| Ukrainian | `ukr/calculator.html` | `/ukr/index.html` | `/ukr/index.html` |
| Chinese | `zh-CN/calculator.html` | `/zh-cn` | `/zh-cn/index.html` |

The machine-readable mapping lives in `data/routes.json`.

## Reproducible bundle

Run:

```bash
python scripts/build_widget_bundle.py
```

The command creates `dist/true-cost-of-war/` from the current localized calculator sources. It emits:

- one canonical route per language;
- compatibility copies for legacy Spanish, French and Hindi file-style routes;
- `bundle-manifest.json` containing the source path and SHA-256 hash for every generated output.

The generated `dist/` directory is intentionally ignored by Git. GitHub Actions builds the bundle on every pull request and uploads it as a short-lived workflow artifact. This means every reviewed commit can now produce a deterministic deployable package even before the hosting provider is automated.

## Important boundary

This build step does **not** deploy to `widgets.peaceful-world.org` and does not change any live iframe URL.

The actual hosting/deployment mechanism for the `widgets.peaceful-world.org` subdomain is not represented in this repository and still needs to be confirmed. Until that is known, automated production deployment must not be enabled.

## Migration plan

1. Confirm which hosting provider currently serves `widgets.peaceful-world.org` and how files are uploaded.
2. Compare the generated bundle with the live files before the first automated deployment.
3. Preserve all existing public iframe URLs during migration.
4. Point new embed snippets to canonical routes only.
5. Add an explicit production deployment workflow with protected credentials/environment if the host supports automation.
6. After old embeds have had sufficient migration time, decide whether legacy aliases can be retired.

The long-term target is simple: a reviewed commit should deterministically produce the exact static bundle served in production.
