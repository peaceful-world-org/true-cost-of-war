#!/usr/bin/env python3
"""Import approved localization rows from the Google Sheet CSV export.

The editorial master lives in the Google Sheet "True Cost of War — Localization
Matrix". This command intentionally does not make the Sheet a live production
dependency. Instead, approved rows become a small, reviewable Git diff in
``unified/localization-overrides.mjs`` and then go through the normal PR/CI
pipeline.

Expected workflow:

1. Edit translations in the Google Sheet.
2. Put ``READY`` in the row's ``Sync status`` column. To sync only selected
   languages, use e.g. ``READY:ru,es``.
3. Export the ``Localization Matrix`` tab as CSV.
4. Run ``python scripts/localization_sheet_sync.py path/to/export.csv``.
5. Review the diff, run QA, and merge through a PR.

Use ``CLEAR`` or ``CLEAR:ru,es`` to remove overrides and return those cells to
the repository fallback copy.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES_PATH = ROOT / "unified" / "localization-overrides.mjs"
START_MARKER = "/* LOCALIZATION_JSON_START */"
END_MARKER = "/* LOCALIZATION_JSON_END */"

SOURCE_GROUPS = {
    "Production copy": "production",
    "Runtime locale": "locale_runtime",
    "Shared UI / buttons": "shared_ui",
    "Daily share card": "daily_share",
    "Dissemination extras": "dissemination",
}

LANGUAGE_COLUMNS = {
    "en": "English (EN)",
    "ru": "Русский (RU)",
    "ukr": "Українська (UKR)",
    "es": "Español (ES)",
    "ar": "العربية (AR)",
    "hi": "हिन्दी (HI)",
    "fr": "Français (FR)",
    "pt": "Português (PT)",
    "fa": "فارسی (FA)",
    "de": "Deutsch (DE)",
    "zh-CN": "中文 (ZH-CN)",
}

READY_ACTIONS = {"READY", "SYNC", "APPROVED"}
CLEAR_ACTIONS = {"CLEAR", "REVERT"}


def fail(message: str) -> None:
    raise SystemExit(message)


def read_override_module() -> tuple[str, dict]:
    source = OVERRIDES_PATH.read_text(encoding="utf-8")
    start = source.find(START_MARKER)
    end = source.find(END_MARKER)
    if start < 0 or end < 0 or end <= start:
        fail(f"{OVERRIDES_PATH.relative_to(ROOT)}: localization JSON markers are missing")
    payload_start = start + len(START_MARKER)
    payload = source[payload_start:end].strip()
    try:
        document = json.loads(payload)
    except json.JSONDecodeError as exc:
        fail(f"{OVERRIDES_PATH.relative_to(ROOT)}: invalid embedded JSON: {exc}")
    if document.get("schemaVersion") != 1 or not isinstance(document.get("languages"), dict):
        fail(f"{OVERRIDES_PATH.relative_to(ROOT)}: unsupported localization override schema")
    return source, document


def write_override_module(source: str, document: dict) -> None:
    start = source.find(START_MARKER)
    end = source.find(END_MARKER)
    payload_start = start + len(START_MARKER)
    rendered = " " + json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + " "
    updated = source[:payload_start] + rendered + source[end:]
    OVERRIDES_PATH.write_text(updated, encoding="utf-8")


def deep_set(root: dict, path: str, value: str) -> None:
    parts = [part for part in path.split(".") if part]
    if not parts:
        fail("Localization row has an empty Key")
    current = root
    for part in parts[:-1]:
        existing = current.get(part)
        if existing is None:
            existing = {}
            current[part] = existing
        if not isinstance(existing, dict):
            fail(f"Cannot descend into non-object override path: {path}")
        current = existing
    current[parts[-1]] = value


def deep_delete(root: dict, path: str) -> bool:
    parts = [part for part in path.split(".") if part]
    if not parts:
        return False
    stack: list[tuple[dict, str]] = []
    current = root
    for part in parts[:-1]:
        child = current.get(part)
        if not isinstance(child, dict):
            return False
        stack.append((current, part))
        current = child
    if parts[-1] not in current:
        return False
    del current[parts[-1]]
    for parent, key in reversed(stack):
        child = parent.get(key)
        if isinstance(child, dict) and not child:
            del parent[key]
        else:
            break
    return True


def parse_status(raw: str) -> tuple[str | None, set[str] | None]:
    value = (raw or "").strip()
    if not value:
        return None, None
    action_raw, _, language_raw = value.partition(":")
    action = action_raw.strip().upper()
    if action not in READY_ACTIONS | CLEAR_ACTIONS:
        return None, None
    if not language_raw.strip():
        return action, None
    requested = {item.strip() for item in language_raw.split(",") if item.strip()}
    unknown = requested - set(LANGUAGE_COLUMNS)
    if unknown:
        fail(f"Unknown language code(s) in Sync status {value!r}: {', '.join(sorted(unknown))}")
    return action, requested


def validate_placeholders(row_id: str, row: dict[str, str], languages: set[str]) -> None:
    english = row.get(LANGUAGE_COLUMNS["en"], "") or ""
    required = set(re.findall(r"\{[A-Za-z0-9_]+\}", english))
    if not required:
        return
    for language in languages:
        value = row.get(LANGUAGE_COLUMNS[language], "") or ""
        missing = required - set(re.findall(r"\{[A-Za-z0-9_]+\}", value))
        if missing:
            fail(
                f"{row_id} / {language}: missing placeholder(s) "
                + ", ".join(sorted(missing))
            )


def clean_empty_containers(document: dict) -> None:
    languages = document.get("languages", {})
    for language in list(languages):
        groups = languages[language]
        if not isinstance(groups, dict):
            continue
        for group in list(groups):
            if groups[group] == {}:
                del groups[group]
        if not groups:
            del languages[language]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="CSV export of the Localization Matrix tab")
    parser.add_argument("--status-column", default="Sync status")
    parser.add_argument("--all", action="store_true", help="Import every row instead of only READY/SYNC rows")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing")
    args = parser.parse_args()

    if not args.csv.is_file():
        fail(f"CSV file not found: {args.csv}")

    source, document = read_override_module()
    changed = 0
    cleared = 0
    selected_rows = 0

    with args.csv.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required_headers = {"ID", "Source", "Key", *LANGUAGE_COLUMNS.values()}
        missing_headers = required_headers - set(reader.fieldnames or [])
        if missing_headers:
            fail("CSV is missing columns: " + ", ".join(sorted(missing_headers)))
        if not args.all and args.status_column not in (reader.fieldnames or []):
            fail(
                f"CSV is missing {args.status_column!r}. Add that column to the Google Sheet "
                "or use --all for an intentional full import."
            )

        for row_number, row in enumerate(reader, start=2):
            row_id = (row.get("ID") or "").strip()
            if not row_id:
                continue
            source_label = (row.get("Source") or "").strip()
            group = SOURCE_GROUPS.get(source_label)
            if not group:
                fail(f"Row {row_number} ({row_id}): unsupported Source {source_label!r}")
            key = (row.get("Key") or "").strip()
            if not key:
                fail(f"Row {row_number} ({row_id}): empty Key")

            if args.all:
                action, requested_languages = "READY", None
            else:
                action, requested_languages = parse_status(row.get(args.status_column, ""))
                if action is None:
                    continue

            selected_rows += 1
            languages = requested_languages or set(LANGUAGE_COLUMNS)

            if action in READY_ACTIONS:
                validate_placeholders(row_id, row, languages)
                for language in sorted(languages):
                    column = LANGUAGE_COLUMNS[language]
                    value = (row.get(column) or "").strip()
                    if not value:
                        fail(f"Row {row_number} ({row_id}) / {language}: approved cell is empty")
                    language_doc = document["languages"].setdefault(language, {})
                    group_doc = language_doc.setdefault(group, {})
                    deep_set(group_doc, key, value)
                    changed += 1
            else:
                for language in sorted(languages):
                    language_doc = document["languages"].get(language)
                    if not isinstance(language_doc, dict):
                        continue
                    group_doc = language_doc.get(group)
                    if isinstance(group_doc, dict) and deep_delete(group_doc, key):
                        cleared += 1

    clean_empty_containers(document)

    if selected_rows == 0:
        print("No rows marked READY/SYNC/APPROVED/CLEAR; nothing to do.")
        return

    if args.dry_run:
        print(f"DRY RUN: {selected_rows} row(s), {changed} value(s) to write, {cleared} override(s) to clear")
        return

    write_override_module(source, document)
    print(f"Updated {OVERRIDES_PATH.relative_to(ROOT)}")
    print(f"Rows selected: {selected_rows}")
    print(f"Values written: {changed}")
    print(f"Overrides cleared: {cleared}")


if __name__ == "__main__":
    main()
