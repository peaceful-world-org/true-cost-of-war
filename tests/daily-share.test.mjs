import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DAYS_PER_YEAR,
  dailyShareValues,
  fillValueTemplate,
  formatCompactPeople,
} from '../unified/daily-share.mjs';

const model = {
  annualMilitarySpend: 2_440_000_000_000,
  schoolCost: 5_000_000,
};

test('daily dissemination values reproduce the legacy one-day fact', () => {
  const fact = dailyShareValues(model);
  assert.equal(DAYS_PER_YEAR, 365.25);
  assert.ok(Math.abs(fact.dailySpend - (2_440_000_000_000 / 365.25)) < 0.01);
  assert.ok(Math.abs(fact.foodPeople - fact.dailySpend / 62.5) < 0.01);
  assert.ok(Math.abs(fact.healthPeople - fact.dailySpend / 125) < 0.01);
  assert.ok(Math.abs(fact.povertyPeople - fact.dailySpend / 1000) < 0.01);
  assert.equal(Math.floor(fact.schools), 1336);
});

test('compact people formatting keeps the familiar one-decimal daily figures', () => {
  const fact = dailyShareValues(model);
  const ru = { formatting: { numberLocale: 'ru-RU', units: { million: 'млн' } } };
  const en = { formatting: { numberLocale: 'en-US', units: { million: 'M' } } };

  assert.match(formatCompactPeople(fact.foodPeople, ru), /^106,9[\s\u00a0]млн$/u);
  assert.equal(formatCompactPeople(fact.healthPeople, en), '53.4M');
  assert.equal(fillValueTemplate('feed {value} people', '106.9M'), 'feed 106.9M people');
});

test('share presentation no longer depends on calculator scenario state', async () => {
  const source = await readFile(new URL('../unified/parity-share.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /calculateLegacySnapshot/u);
  assert.doesNotMatch(source, /querySelector\('#mode'\)/u);
  assert.doesNotMatch(source, /querySelector\('#birthYear'\)/u);
  assert.doesNotMatch(source, /querySelector\('#share'\)/u);
  assert.match(source, /function canonicalDailyFact\(\)/u);
  assert.match(source, /function summaryText\(\)[\s\S]*canonicalDailyFact\(\)/u);
  assert.match(source, /function buildCanvas\(\)[\s\S]*canonicalDailyFact\(\)/u);
});
