# Widget deployment map

Status: unified production bundle ready; hosting handoff still to be confirmed

The public Peaceful World pages embed calculator iframes from `https://widgets.peaceful-world.org/true-cost-of-war/`. Those public URLs must remain stable during the architecture migration so that Tilda pages and third-party embeds do not need to change at cutover time.

## Runtime architecture

The deployable product is now the shared multilingual runtime in `unified/`.

The older localized `calculator.html` files remain in the repository for two reasons only:

1. they are the extraction source for legacy wording used by `scripts/extract_legacy_locale_copy.py`;
2. they provide an explicit rollback/reference baseline during the first production rollout.

They are no longer copied into the production widget bundle.

## Public route compatibility

Current public iframe routes are preserved exactly:

| Language | Existing iframe route | Canonical route |
| --- | --- | --- |
| English | `/index.html` | `/index.html` |
| German | `/de/index.html` | `/de/index.html` |
| Spanish | `/index-es.html` | `/es/index.html` |
| French | `/index-fr.html` | `/fr/index.html` |
| Portuguese | `/pt/index.html` | `/pt/index.html` |
| Arabic | `/ar/index.html` | `/ar/index.html` |
| Persian | `/fa/index.html` | `/fa/index.html` |
| Russian | `/ru/index.html` | `/ru/index.html` |
| Hindi | `/index-hi.html` | `/hi/index.html` |
| Ukrainian | `/ukr/index.html` | `/ukr/index.html` |
| Chinese | `/zh-cn` | `/zh-cn/index.html` |

The machine-readable mapping lives in `data/routes.json`.

Every canonical/legacy file in the deployable bundle is now a tiny compatibility shim. It preserves the existing query string and hash, supplies the route language when `lang` is absent, and immediately enters the single runtime at `unified/index.html`. This preserves parameters such as `embed=1`, `mode`, `share`, and `year` while eliminating duplicated calculator logic.

## Reproducible production bundle

Run:

```bash
python scripts/build_widget_bundle.py
```

The command creates `dist/true-cost-of-war/` containing:

- `unified/` — the shared multilingual UI/runtime and locale files;
- `src/` — the shared calculation, formatting and active-time modules required by the runtime;
- `data/model.json` — the production legacy-baseline data model currently used by the calculator;
- generated `unified/legacy-copy.json` — localized wording extracted reproducibly from the existing published sources;
- all canonical public iframe routes plus the Spanish, French and Hindi legacy aliases as compatibility shims;
- `bundle-manifest.json` with route metadata and SHA-256 hashes for every packaged file.

The generated `dist/` directory is intentionally ignored by Git. GitHub Actions builds this bundle on every pull request and uploads it as a short-lived artifact, so a reviewed commit deterministically produces the exact directory intended for production.

## What changes for users at cutover

No Tilda iframe URL needs to change for the initial release. The public pages continue loading the same `widgets.peaceful-world.org/true-cost-of-war/...` addresses; those addresses simply hand off to the new unified runtime internally.

For embedded use (`?embed=1`), the unified runtime keeps the preview/header controls hidden and continues sending `pw2-resize` messages from the same origin. From the visitor's perspective this is intended to be an architecture replacement, not a redesign.

## Important deployment boundary

The build step does **not** deploy to `widgets.peaceful-world.org`.

The repository still does not identify the hosting provider or upload mechanism currently serving that subdomain. Automated production deployment must not be guessed or enabled until the actual host/account is confirmed.

## First production rollout

1. Confirm the hosting provider and exact upload/deploy mechanism for `widgets.peaceful-world.org`.
2. Back up or snapshot the current `/true-cost-of-war/` directory before replacing anything.
3. Build `dist/true-cost-of-war/` from the reviewed `main` commit.
4. Upload/replace the contents of the live `/true-cost-of-war/` directory atomically if the host supports it.
5. Verify the existing English and Russian embeds first, then one LTR and one RTL secondary language, then the remaining routes.
6. Check live timer behavior, timeframe switching, redistribution controls, info popovers, mobile layout and iframe auto-resize.
7. Keep the old files/snapshot available for immediate rollback during the first release window.
8. Only after the cutover is stable should new Tilda/embed snippets be migrated toward canonical routes and legacy aliases eventually retired.

The long-term target remains simple: a reviewed commit should deterministically produce the exact static bundle served in production.
