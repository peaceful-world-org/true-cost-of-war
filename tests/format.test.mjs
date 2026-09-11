import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatElapsed,
  formatInteger,
  formatMoney,
  formatPerSecond,
  formatRatio,
} from '../src/format.mjs';

const ru = {
  formatting: {
    numberLocale: 'ru-RU',
    currencySymbol: '$',
    currencyPosition: 'before',
    units: { trillion: 'трлн', billion: 'млрд', million: 'млн' },
    perSecond: '/с',
  },
};

const en = {
  formatting: {
    numberLocale: 'en-US',
    currencySymbol: '$',
    currencyPosition: 'before',
    units: { trillion: 'tn', billion: 'bn', million: 'm' },
    perSecond: '/s',
  },
};

test('Russian money keeps dollar prefix and compact legacy units', () => {
  assert.equal(formatMoney(1_689_000_000_000, ru), '$\u00a01,689\u00a0трлн');
  assert.equal(formatMoney(507_470_000_000, ru), '$\u00a0507,47\u00a0млрд');
});

test('short money uses one decimal at trillion scale', () => {
  assert.equal(formatMoney(2_440_000_000_000, en, { short: true }), '$\u00a02.4\u00a0tn');
});

test('integer and ratio formatting use configured number locale', () => {
  assert.equal(formatInteger(103804.4, ru), '103\u00a0804');
  assert.equal(formatRatio(4.35, ru), '4,4');
});

test('per-second suffix is locale-configurable', () => {
  assert.equal(formatPerSecond(77_318, ru), '$\u00a077\u00a0318/с');
});

test('elapsed formatter is stable across minute and hour boundaries', () => {
  assert.equal(formatElapsed(7), '00:07');
  assert.equal(formatElapsed(67), '01:07');
  assert.equal(formatElapsed(3_667), '01:01:07');
});
