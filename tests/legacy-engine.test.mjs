import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  calculateLegacyOpportunityCosts,
  calculateLegacyTotals,
  validateLegacyModel,
} from '../src/legacy-engine.mjs';

const baselineDocument = JSON.parse(
  await readFile(new URL('../data/model.json', import.meta.url), 'utf8'),
);
const model = baselineDocument.values;

test('canonical legacy model is accepted by the shared engine', () => {
  assert.equal(validateLegacyModel(model), model);
});

test('one annualized year reproduces the legacy headline arithmetic', () => {
  const result = calculateLegacyTotals(model, 1);

  assert.equal(result.militarySpend, 2_440_000_000_000);
  assert.equal(result.directDeaths, 150_000);
  assert.equal(result.indirectDeaths, 600_000);
  assert.equal(result.totalDeaths, 750_000);
  assert.equal(result.infrastructureDamage, 730_000_000_000);
  assert.equal(result.lifeYearsLost, 29_250_000);
  assert.equal(result.economicSetback, 3_545_000_000_000);
});

test('legacy annualized arithmetic remains linear for fractional periods', () => {
  const annual = calculateLegacyTotals(model, 1);
  const quarter = calculateLegacyTotals(model, 0.25);

  for (const key of [
    'militarySpend',
    'directDeaths',
    'indirectDeaths',
    'totalDeaths',
    'infrastructureDamage',
    'lifeYearsLost',
    'economicSetback',
  ]) {
    assert.equal(quarter[key], annual[key] * 0.25, key);
  }
});

test('opportunity-cost arithmetic uses the selected share of military spending', () => {
  const annual = calculateLegacyTotals(model, 1);
  const result = calculateLegacyOpportunityCosts(model, annual.militarySpend, 0.1);

  assert.equal(result.redirected, 244_000_000_000);
  assert.equal(result.schools, 48_800);
  assert.equal(result.education, result.redirected / model.educationCost);
  assert.equal(result.hunger, result.redirected / model.hungerCost);
  assert.equal(result.health, result.redirected / model.healthCost);
  assert.equal(result.water, result.redirected / model.waterCost);
  assert.equal(result.electricity, result.redirected / model.electricityCost);
  assert.equal(result.internet, result.redirected / model.internetCost);
  assert.equal(result.climate, result.redirected / model.climateCost);
});

test('invalid inputs fail loudly instead of producing silent NaN values', () => {
  assert.throws(() => calculateLegacyTotals(model, -1), /fraction/);
  assert.throws(() => calculateLegacyOpportunityCosts(model, 100, 1.1), /share/);
  assert.throws(
    () => validateLegacyModel({ ...model, annualMilitarySpend: 0 }),
    /annualMilitarySpend/,
  );
});
