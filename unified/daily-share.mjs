// Canonical dissemination fact used by both the text summary and infographic.
// It intentionally ignores calculator mode, birth year and redistribution share:
// the public-facing fact is always one day of global military expenditure.

export const DAYS_PER_YEAR = 365.25;
export const FOOD_COST_PER_PERSON = 62.5;
export const HEALTH_COST_PER_PERSON = 125;
export const POVERTY_COST_PER_PERSON = 1000;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function dailyShareValues(model = {}) {
  const annualMilitarySpend = Math.max(0, finiteNumber(model.annualMilitarySpend));
  const schoolCost = Math.max(1, finiteNumber(model.schoolCost, 5_000_000));
  const dailySpend = annualMilitarySpend / DAYS_PER_YEAR;

  return Object.freeze({
    dailySpend,
    foodPeople: dailySpend / FOOD_COST_PER_PERSON,
    healthPeople: dailySpend / HEALTH_COST_PER_PERSON,
    povertyPeople: dailySpend / POVERTY_COST_PER_PERSON,
    schools: dailySpend / schoolCost,
  });
}

export function formatCompactPeople(value, meta = {}) {
  const formatting = meta.formatting || {};
  const locale = formatting.numberLocale || meta.intlLocale || 'en-US';
  const numeric = Math.max(0, finiteNumber(value));

  if (numeric >= 1e6) {
    const millions = (numeric / 1e6).toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    const millionUnit = formatting.units?.million || 'M';
    const unitGap = formatting.unitGap ?? (millionUnit === 'M' ? '' : '\u00a0');
    return `${millions}${unitGap}${millionUnit}`;
  }

  return Math.round(numeric).toLocaleString(locale, { maximumFractionDigits: 0 });
}

export function fillValueTemplate(template, value) {
  const source = String(template || '').trim();
  if (!source) return String(value);
  return source.includes('{value}') ? source.replace('{value}', String(value)) : `${source} ${value}`;
}
