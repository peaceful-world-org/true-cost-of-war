// Shared presentation formatter for the unified calculator.
//
// This module intentionally follows the legacy calculator's visual number
// conventions instead of Intl compact/currency notation. That keeps currency
// placement, units and Western digits stable across all supported languages
// while the architecture is consolidated.

const DEFAULT_UNITS = Object.freeze({ trillion: 'tn', billion: 'bn', million: 'm' });
const DEFAULT_PROFILE = Object.freeze({
  numberLocale: 'en-US',
  currencySymbol: '$',
  currencyPosition: 'before',
  currencyGap: '\u00a0',
  unitGap: '\u00a0',
  units: DEFAULT_UNITS,
  perSecond: '/s',
});

function profileOf(meta = {}) {
  const formatting = meta.formatting || {};
  return {
    ...DEFAULT_PROFILE,
    ...formatting,
    units: { ...DEFAULT_UNITS, ...(formatting.units || {}) },
  };
}

function normalizeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number;
}

function localized(value, locale, options = {}) {
  return normalizeNumber(value).toLocaleString(locale || 'en-US', options);
}

export function formatInteger(value, meta = {}) {
  const profile = profileOf(meta);
  return localized(Math.round(normalizeNumber(value)), profile.numberLocale, {
    maximumFractionDigits: 0,
  });
}

export function formatRatio(value, meta = {}, { maximumFractionDigits = 1 } = {}) {
  const profile = profileOf(meta);
  const number = normalizeNumber(value);
  return localized(number, profile.numberLocale, {
    minimumFractionDigits: number < 10 ? 1 : 0,
    maximumFractionDigits,
  });
}

export function formatMoney(value, meta = {}, { short = false } = {}) {
  const profile = profileOf(meta);
  const numeric = Math.abs(normalizeNumber(value));
  let scaled = numeric;
  let unit = '';
  let minimumFractionDigits = 0;
  let maximumFractionDigits = 0;

  if (numeric >= 1e12) {
    scaled = numeric / 1e12;
    unit = profile.units.trillion;
    minimumFractionDigits = short ? 1 : 2;
    maximumFractionDigits = short ? 1 : 3;
  } else if (numeric >= 1e9) {
    scaled = numeric / 1e9;
    unit = profile.units.billion;
    minimumFractionDigits = short ? 1 : 2;
    maximumFractionDigits = 2;
  } else if (numeric >= 1e6) {
    scaled = numeric / 1e6;
    unit = profile.units.million;
    minimumFractionDigits = short ? 1 : 2;
    maximumFractionDigits = 2;
  }

  const number = localized(scaled, profile.numberLocale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
  const signedNumber = normalizeNumber(value) < 0 ? `-${number}` : number;
  const currency = profile.currencySymbol || '$';
  const currencyGap = profile.currencyGap ?? '\u00a0';
  const unitText = unit ? `${profile.unitGap ?? '\u00a0'}${unit}` : '';

  if (profile.currencyPosition === 'after') {
    return `${signedNumber}${unitText}${currencyGap}${currency}`;
  }
  return `${currency}${currencyGap}${signedNumber}${unitText}`;
}

export function formatPerSecond(value, meta = {}) {
  const profile = profileOf(meta);
  return `${formatMoney(value, meta)}${profile.perSecond || '/s'}`;
}

export function formatElapsed(seconds) {
  const whole = Math.max(0, Math.floor(normalizeNumber(seconds)));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function formattingProfile(meta = {}) {
  return profileOf(meta);
}
