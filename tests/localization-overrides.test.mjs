import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALIZATION_OVERRIDE_DATA, applyLocalizationOverrides } from '../unified/localization-overrides.mjs';

test('localization override bridge points to the editorial sheet', () => {
  assert.equal(LOCALIZATION_OVERRIDE_DATA.schemaVersion, 1);
  assert.equal(LOCALIZATION_OVERRIDE_DATA.sheetId, '14Rwz_JvLjpeD13xWBDrmcKVj0JbgjDVcsgKhGruEljc');
});

test('localization override merge preserves fallback fields', () => {
  LOCALIZATION_OVERRIDE_DATA.languages.testlang = {
    locale_runtime: { title: 'Override title', metrics: { militarySpend: 'Override metric' } },
  };
  try {
    const base = { title: 'Base title', lead: 'Base lead', metrics: { militarySpend: 'Base metric', directDeaths: 'Base deaths' } };
    const merged = applyLocalizationOverrides('testlang', 'locale_runtime', base);
    assert.equal(merged.title, 'Override title');
    assert.equal(merged.lead, 'Base lead');
    assert.equal(merged.metrics.militarySpend, 'Override metric');
    assert.equal(merged.metrics.directDeaths, 'Base deaths');
    assert.equal(base.title, 'Base title');
  } finally {
    delete LOCALIZATION_OVERRIDE_DATA.languages.testlang;
  }
});
