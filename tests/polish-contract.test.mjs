import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../unified/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../unified/visual-polish.css', import.meta.url), 'utf8');
const motion = readFileSync(new URL('../unified/visual-polish.mjs', import.meta.url), 'utf8');

test('polish layer is loaded last in the unified visual stack', () => {
  const valueParity = index.indexOf('./visual-value-parity.css');
  const polish = index.indexOf('./visual-polish.css');
  assert.ok(valueParity >= 0, 'value-parity stylesheet is present');
  assert.ok(polish > valueParity, 'polish stylesheet follows value-parity overrides');
  assert.match(index, /src="\.\/visual-polish\.mjs"/);
});

test('all parity info controls share one geometry token', () => {
  assert.match(css, /--pw-info-size:\s*20px/);
  assert.match(css, /\.pw-parity-info,\s*\n\.pw-parity-info-sm/);
  assert.match(css, /width:\s*var\(--pw-info-size\)\s*!important/);
  assert.match(css, /height:\s*var\(--pw-info-size\)\s*!important/);
  assert.match(css, /flex:\s*0 0 var\(--pw-info-size\)\s*!important/);
});

test('info placement distinguishes hero, metric cards and programme titles', () => {
  assert.match(css, /\.pw-hero-info-row[\s\S]*?display:\s*block/);
  assert.match(css, /\.pw-hero-info-row \.pw-lead[\s\S]*?display:\s*inline/);
  assert.match(css, /\.pw-reference-card \.pw-parity-label-row[\s\S]*?align-items:\s*flex-start/);
  assert.match(css, /\.pw-programme \.pw-parity-label-row[\s\S]*?justify-content:\s*flex-start/);
});

test('money counter keeps a calm 80 ms presentation cadence', () => {
  assert.match(motion, /const SECONDS_PER_YEAR = 31557600/);
  assert.match(motion, /const MONEY_CADENCE_MS = 80/);
  assert.match(motion, /annualMilitarySpend \/ SECONDS_PER_YEAR/);
  assert.match(motion, /performance\.now\(\)/);
  assert.match(motion, /now - lastMoneyPaintAt >= MONEY_CADENCE_MS/);
  assert.match(motion, /requestAnimationFrame\(render\)/);
});

test('derived equivalents render every animation frame instead of inheriting the money gate', () => {
  assert.match(motion, /function paintDerived\(spend, meta\)/);
  assert.match(motion, /paintDerived\(spend, meta\);/);
  assert.match(motion, /sessionFoodNode/);
  assert.match(motion, /sessionHealthNode/);
  assert.match(motion, /sessionPovertyNode/);
  assert.match(motion, /persistentNumberNode\(sessionFood\)/);
  assert.match(motion, /persistentNumberNode\(sessionHealth\)/);
  assert.match(motion, /persistentNumberNode\(sessionPoverty\)/);
  assert.doesNotMatch(motion, /sessionFood\.textContent\s*=/);
  assert.doesNotMatch(motion, /sessionHealth\.textContent\s*=/);
  assert.doesNotMatch(motion, /sessionPoverty\.textContent\s*=/);
});

test('live session values have exclusive visible DOM ownership', () => {
  for (const selector of ['#viewerSpend', '#sessionFood', '#sessionHealth', '#sessionPoverty']) {
    assert.ok(motion.includes(`'${selector}'`), `missing isolated live node ${selector}`);
  }
  assert.match(motion, /cloneNode\(true\)/);
  assert.match(motion, /existing\.replaceWith\(clone\)/);
  assert.doesNotMatch(motion, /\bnew\s+MutationObserver\s*\(/);
  assert.doesNotMatch(motion, /#mainCounterValue/);
});

test('session-spend display keeps a full running integer instead of compact million steps', () => {
  assert.match(motion, /formatInteger\(spend, meta\)/);
  assert.match(motion, /viewerNumberNode/);
  assert.match(motion, /pw-flow-number/);
  assert.doesNotMatch(motion, /pw2-val-unit/);
  assert.doesNotMatch(motion, /absolute >= 1e6/);
  assert.match(motion, /dataset\.motionPolish\s*=\s*'split-cadence-live-flow'/);
});

test('integer presentation follows the legacy round-to-nearest convention', () => {
  assert.match(motion, /Math\.round\(Number\(value\) \|\| 0\)/);
});

test('continuous numeric typography remains stable and anchored', () => {
  assert.match(css, /\.pw-flow-value[\s\S]*?font-variant-numeric:\s*tabular-nums\s*!important/);
  assert.match(css, /font-feature-settings:\s*"tnum" 1, "lnum" 1\s*!important/);
  assert.match(css, /\.pw-flow-money[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.pw-flow-number[\s\S]*?font-variant-numeric:\s*tabular-nums\s*!important/);
  assert.match(css, /\.pw-flow-value \.pw2-currency-sign[\s\S]*?font-size:\s*\.85em/);
  assert.match(css, /\.pw-flow-value[\s\S]*?transform:\s*none\s*!important/);
});
