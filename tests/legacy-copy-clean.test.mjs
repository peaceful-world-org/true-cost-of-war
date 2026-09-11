import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeLegacyCopy, stripLegacyInfoMarkers } from '../unified/legacy-copy-clean.mjs';

test('legacy inline info marker is removed from visible extracted copy', () => {
  assert.equal(
    stripLegacyInfoMarkers('Универсальное базовое образование i'),
    'Универсальное базовое образование',
  );
  assert.equal(
    stripLegacyInfoMarkers('Нерешенные гуманитарные кризисы. i'),
    'Нерешенные гуманитарные кризисы.',
  );
  assert.equal(
    stripLegacyInfoMarkers('Value i, followed by more copy'),
    'Value, followed by more copy',
  );
});

test('ordinary letter sequences are not altered', () => {
  assert.equal(stripLegacyInfoMarkers('iPhone and WiFi remain text'), 'iPhone and WiFi remain text');
  assert.equal(stripLegacyInfoMarkers('capital I remains'), 'capital I remains');
});

test('sanitizer cleans visible fields recursively but preserves tooltip copy', () => {
  const cleaned = sanitizeLegacyCopy({
    hero: { lead: 'Visible explanation i', tooltip: 'Tooltip may mention i' },
    programmes: [{ label: 'Education i', note: 'Normal note' }],
  });

  assert.equal(cleaned.hero.lead, 'Visible explanation');
  assert.equal(cleaned.hero.tooltip, 'Tooltip may mention i');
  assert.equal(cleaned.programmes[0].label, 'Education');
  assert.equal(cleaned.programmes[0].note, 'Normal note');
});
