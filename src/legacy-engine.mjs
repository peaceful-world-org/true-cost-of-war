// Pure calculation core extracted from the legacy calculator arithmetic.
//
// IMPORTANT: this module is not wired into production yet. It exists so the
// current formulas can be regression-tested before the localized HTML copies
// are replaced by a shared runtime and, later, evidence-aware historical data.

const REQUIRED_KEYS = [
  'annualMilitarySpend',
  'annualDirectDeaths',
  'indirectMultiplier',
  'annualInfraDamage',
  'avgYearsLostPerDeath',
  'economicValuePerDeath',
  'educationCost',
  'hungerCost',
  'healthCost',
  'waterCost',
  'electricityCost',
  'internetCost',
  'climateCost',
  'schoolCost',
];

function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite non-negative number`);
  }
}

export function validateLegacyModel(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    throw new TypeError('model must be an object');
  }

  for (const key of REQUIRED_KEYS) {
    const value = model[key];
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`model.${key} must be a finite positive number`);
    }
  }

  return model;
}

export function calculateLegacyTotals(model, fraction) {
  validateLegacyModel(model);
  assertFiniteNonNegative(fraction, 'fraction');

  const militarySpend = model.annualMilitarySpend * fraction;
  const directDeaths = model.annualDirectDeaths * fraction;
  const indirectDeaths = directDeaths * model.indirectMultiplier;
  const infrastructureDamage = model.annualInfraDamage * fraction;
  const totalDeaths = directDeaths + indirectDeaths;
  const lifeYearsLost = totalDeaths * model.avgYearsLostPerDeath;
  const economicSetback =
    militarySpend +
    infrastructureDamage +
    totalDeaths * model.economicValuePerDeath;

  return {
    fraction,
    militarySpend,
    directDeaths,
    indirectDeaths,
    totalDeaths,
    infrastructureDamage,
    lifeYearsLost,
    economicSetback,
  };
}

export function calculateLegacyOpportunityCosts(model, militarySpend, share) {
  validateLegacyModel(model);
  assertFiniteNonNegative(militarySpend, 'militarySpend');
  assertFiniteNonNegative(share, 'share');
  if (share > 1) {
    throw new RangeError('share must be between 0 and 1');
  }

  const redirected = militarySpend * share;

  return {
    redirected,
    education: redirected / model.educationCost,
    hunger: redirected / model.hungerCost,
    health: redirected / model.healthCost,
    water: redirected / model.waterCost,
    electricity: redirected / model.electricityCost,
    internet: redirected / model.internetCost,
    climate: redirected / model.climateCost,
    schools: redirected / model.schoolCost,
  };
}

export const LEGACY_MODEL_KEYS = Object.freeze([...REQUIRED_KEYS]);
