import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SHELL_UI_COPY } from '../unified/ui-copy.mjs';

const manifest = JSON.parse(
  await readFile(new URL('../unified/locales/manifest.json', import.meta.url), 'utf8'),
);

const REQUIRED_KEYS = [
  'developmentAllocation',
  'defenceAllocation',
  'showLess',
  'shareTitle',
  'shareIntro',
  'shareText',
  'shareCard',
  'copy',
  'copied',
  'download',
  'period',
  'military',
  'redirected',
  'copyFallback',
];

test('unified shell UI copy covers every manifest language', () => {
  assert.deepEqual(
    Object.keys(SHELL_UI_COPY).sort(),
    Object.keys(manifest.languages).sort(),
  );
});

test('every shell UI locale has the complete non-empty key set', () => {
  for (const [language, copy] of Object.entries(SHELL_UI_COPY)) {
    assert.deepEqual(Object.keys(copy).sort(), [...REQUIRED_KEYS].sort(), language);
    for (const key of REQUIRED_KEYS) {
      assert.equal(typeof copy[key], 'string', `${language}.${key} must be a string`);
      assert.ok(copy[key].trim(), `${language}.${key} must not be empty`);
    }
  }
});
