import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  calculateLegacySnapshot,
  LEGACY_TIME_MODES,
  resolveLegacyPeriod,
} from '../src/runtime.mjs';

const baselineDocument = JSON.parse(
  await readFile(new URL('../data/model.json', import.meta.url), 'utf8'),
);
const model = baselineDocument.values;

test('shared runtime exposes every legacy timeframe used by the UI', () => {
  assert.deepEqual(LEGACY_TIME_MODES, [
    'year',
    '1year',
    '10years',
    'lifetime',
    'day',
    'hour',
    'minute',
    'since1945',
  ]);
});

test('fixed legacy timeframes preserve their exact annual fractions', () => {
  assert.equal(resolveLegacyPeriod({ mode: 'minute' }).fraction, 1 / 525_600);
  assert.equal(resolveLegacyPeriod({ mode: 'hour' }).fraction, 1 / 8_760);
  assert.equal(resolveLegacyPeriod({ mode: 'day' }).fraction, 1 / 365.25);
  assert.equal(resolveLegacyPeriod({ mode: '1year' }).fraction, 1);
  assert.equal(resolveLegacyPeriod({ mode: '10years' }).fraction, 10);
});

test('lifetime mode preserves legacy birth-year normalization', () => {
  const now = new Date(2026, 8, 10, 12, 0, 0);

  assert.equal(resolveLegacyPeriod({ mode: 'lifetime', birthYear: 1890, now }).startYear, 1990);
  assert.equal(resolveLegacyPeriod({ mode: 'lifetime', birthYear: 'not-a-year', now }).startYear, 1990);
  assert.equal(resolveLegacyPeriod({ mode: 'lifetime', birthYear: 2050, now }).startYear, 2026);
  assert.equal(resolveLegacyPeriod({ mode: 'lifetime', birthYear: 1990, now }).startYear, 1990);
});

test('year-to-date and since-1945 modes remain live date-based periods', () => {
  const now = new Date(2026, 8, 10, 12, 0, 0);
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;

  const expectedYtd = (now.getTime() - new Date(2026, 0, 1).getTime()) / yearMs;
  const expectedSince1945 = (now.getTime() - new Date(1945, 0, 1).getTime()) / yearMs;

  assert.equal(resolveLegacyPeriod({ mode: 'year', now }).fraction, expectedYtd);
  assert.equal(resolveLegacyPeriod({ mode: 'since1945', now }).fraction, expectedSince1945);
});

test('snapshot combines one period calculation with one shared arithmetic engine', () => {
  const result = calculateLegacySnapshot({
    model,
    mode: '1year',
    sharePercent: 10,
    now: new Date(2026, 8, 10, 12, 0, 0),
  });

  assert.equal(result.totals.militarySpend, 2_440_000_000_000);
  assert.equal(result.totals.totalDeaths, 750_000);
  assert.equal(result.totals.economicSetback, 3_545_000_000_000);
  assert.equal(result.opportunityCosts.redirected, 244_000_000_000);
  assert.equal(result.opportunityCosts.schools, 48_800);
});

test('invalid modes and shares fail loudly', () => {
  assert.throws(() => resolveLegacyPeriod({ mode: 'century' }), /unsupported legacy time mode/);
  assert.throws(() => calculateLegacySnapshot({ model, sharePercent: -1 }), /sharePercent/);
  assert.throws(() => calculateLegacySnapshot({ model, sharePercent: 101 }), /sharePercent/);
});
