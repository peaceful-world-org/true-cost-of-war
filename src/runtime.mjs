import {
  calculateLegacyOpportunityCosts,
  calculateLegacyTotals,
  validateLegacyModel,
} from './legacy-engine.mjs';

export const LEGACY_TIME_MODES = Object.freeze([
  'year',
  '1year',
  '10years',
  'lifetime',
  'day',
  'hour',
  'minute',
  'since1945',
]);

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function finiteDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError('now must be a valid date');
  }
  return date;
}

function startOfLocalYear(year) {
  return new Date(year, 0, 1).getTime();
}

export function resolveLegacyPeriod({ mode = 'year', birthYear = 1990, now = new Date() } = {}) {
  if (!LEGACY_TIME_MODES.includes(mode)) {
    throw new RangeError(`unsupported legacy time mode: ${mode}`);
  }

  const current = finiteDate(now);
  const nowMs = current.getTime();
  const currentYear = current.getFullYear();

  if (mode === 'minute') return { mode, fraction: 1 / 525_600, labelKey: 'minute' };
  if (mode === 'hour') return { mode, fraction: 1 / 8_760, labelKey: 'hour' };
  if (mode === 'day') return { mode, fraction: 1 / 365.25, labelKey: 'day' };
  if (mode === '1year') return { mode, fraction: 1, labelKey: 'last365days' };
  if (mode === '10years') return { mode, fraction: 10, labelKey: 'last10years' };

  if (mode === 'since1945') {
    return {
      mode,
      fraction: (nowMs - startOfLocalYear(1945)) / YEAR_MS,
      labelKey: 'since1945',
      startYear: 1945,
    };
  }

  if (mode === 'lifetime') {
    let normalizedBirthYear = Number.parseInt(String(birthYear), 10);
    if (!Number.isFinite(normalizedBirthYear) || normalizedBirthYear < 1920) {
      normalizedBirthYear = 1990;
    }
    if (normalizedBirthYear > currentYear) {
      normalizedBirthYear = currentYear;
    }

    return {
      mode,
      fraction: (nowMs - startOfLocalYear(normalizedBirthYear)) / YEAR_MS,
      labelKey: 'lifetime',
      startYear: normalizedBirthYear,
    };
  }

  return {
    mode: 'year',
    fraction: (nowMs - startOfLocalYear(currentYear)) / YEAR_MS,
    labelKey: 'yearToDate',
    startYear: currentYear,
  };
}

export function calculateLegacySnapshot({
  model,
  mode = 'year',
  birthYear = 1990,
  sharePercent = 10,
  now = new Date(),
} = {}) {
  validateLegacyModel(model);

  const numericShare = Number(sharePercent);
  if (!Number.isFinite(numericShare) || numericShare < 0 || numericShare > 100) {
    throw new RangeError('sharePercent must be between 0 and 100');
  }

  const period = resolveLegacyPeriod({ mode, birthYear, now });
  const totals = calculateLegacyTotals(model, period.fraction);
  const opportunityCosts = calculateLegacyOpportunityCosts(
    model,
    totals.militarySpend,
    numericShare / 100,
  );

  return {
    period,
    sharePercent: numericShare,
    totals,
    opportunityCosts,
  };
}
