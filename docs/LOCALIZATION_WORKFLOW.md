# Localization workflow

## Source of truth

The editorial localization master is the Google Sheet:

**True Cost of War — Localization Matrix**  
`https://docs.google.com/spreadsheets/d/14Rwz_JvLjpeD13xWBDrmcKVj0JbgjDVcsgKhGruEljc`

The spreadsheet contains one row per user-facing text element and one column per language. It currently covers production calculator copy, runtime labels, shared buttons/UI, the daily share card, and dissemination copy.

GitHub remains the deployable/runtime source of truth. Spreadsheet edits never change production directly. Approved changes are synchronized into a small override layer, reviewed as a pull request, and pass the normal QA pipeline before release.

## Syncing an approved translation

1. Edit the translation in the `Localization Matrix` tab.
2. Put `READY` in the row's `Sync status` column.
   - `READY` — sync every language cell in that row.
   - `READY:ru,es` — sync only the listed language codes.
   - `CLEAR` — remove the row's overrides and return to repository fallback copy.
   - `CLEAR:ru,es` — clear only the listed languages.
3. Export only the `Localization Matrix` tab as CSV.
4. Run:

   ```bash
   python scripts/localization_sheet_sync.py path/to/Localization-Matrix.csv
   ```

5. Review the change in `unified/localization-overrides.mjs`.
6. Run QA and merge through a pull request.
7. After merge, mark the row as synced in the Sheet.

`--dry-run` validates an export without writing. `--all` is reserved for intentional bulk imports, for example when bootstrapping a new language.

## Runtime behavior

The repository keeps its existing localized files as fallbacks. `unified/localization-overrides.mjs` contains only approved Sheet differences. Overrides are deep-merged at runtime for these groups:

- `production` — long-form calculator copy extracted from the historical localized calculator sources;
- `locale_runtime` — labels and mode names normally loaded from `unified/locales/*.json`;
- `shared_ui` — buttons and dissemination UI from `unified/ui-copy.mjs`;
- `daily_share` — text used in the daily share summary and social card;
- `dissemination` — optional secondary dissemination copy.

This means an editorial change does not require duplicating the calculator or editing the large historical HTML files.

## Adding another language

The shared runtime means a new language is a localization/data task rather than a new calculator implementation. The intended checklist is:

1. add the language metadata/formatting profile to `unified/locales/manifest.json`;
2. add its public route to `data/routes.json`;
3. add a language column to the Google Sheet and translate the matrix;
4. sync the approved localization rows;
5. add or generate the corresponding Tilda loader and run desktop/mobile QA;
6. create the language-specific Tilda landing page and use its loader.

RTL languages also require a visual check even when automated tests pass.
