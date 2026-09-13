// Google Sheet localization bridge.
//
// This file stores only approved differences from the repository's built-in
// localization corpus. The full editorial matrix lives in Google Sheets; when
// a row is approved for sync, the bridge writes the changed values here.
//
// Keep LOCALIZATION_OVERRIDE_DATA valid JSON between the marker comments so
// Python build scripts can consume the same source as the browser runtime.

export const LOCALIZATION_OVERRIDE_DATA = /* LOCALIZATION_JSON_START */ {
  "schemaVersion": 1,
  "sheetId": "14Rwz_JvLjpeD13xWBDrmcKVj0JbgjDVcsgKhGruEljc",
  "languages": {}
} /* LOCALIZATION_JSON_END */;

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }
  return value;
}

function mergeObjects(base, override) {
  const result = cloneValue(base && typeof base === 'object' ? base : {});
  if (!override || typeof override !== 'object') return result;

  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeObjects(result[key], value);
    } else {
      result[key] = cloneValue(value);
    }
  }
  return result;
}

export function localizationOverrideLanguages() {
  return Object.keys(LOCALIZATION_OVERRIDE_DATA.languages || {});
}

export function localizationOverrideGroup(language, group) {
  return LOCALIZATION_OVERRIDE_DATA.languages?.[language]?.[group] || null;
}

export function hasLocalizationOverrideGroup(language, group) {
  const value = localizationOverrideGroup(language, group);
  return Boolean(value && typeof value === 'object' && Object.keys(value).length);
}

export function applyLocalizationOverrides(language, group, base = {}) {
  return mergeObjects(base, localizationOverrideGroup(language, group) || {});
}
