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

test('visible session-spend counter is a literal production timing port with one DOM owner', () => {
  assert.match(motion, /const ORIGINAL_SECONDS_PER_YEAR = 31557600/);
  assert.match(motion, /const ORIGINAL_LIVE_CADENCE_MS = 80/);
  assert.match(motion, /const ORIGINAL_TRANSITION_MS = 1200/);
  assert.match(motion, /annualMilitarySpend \/ ORIGINAL_SECONDS_PER_YEAR/);
  assert.match(motion, /activeTimeMs \+ \(Date\.now\(\) - lastVisibleTime\)/);
  assert.match(motion, /now - lastRenderTime < ORIGINAL_LIVE_CADENCE_MS/);
  assert.match(motion, /requestAnimationFrame\(render\)/);

  assert.match(motion, /takeExclusiveViewerOwnership/);
  assert.match(motion, /cloneNode\(true\)/);
  assert.match(motion, /existing\.replaceWith\(clone\)/);
  assert.doesNotMatch(motion, /\bnew\s+MutationObserver\s*\(/);
  assert.doesNotMatch(motion, /#mainCounterValue/);
  assert.doesNotMatch(motion, /\.animate\s*\(/);
  assert.doesNotMatch(motion, /translateY\s*\(/);
  assert.doesNotMatch(motion, /DERIVED_CADENCE_MS/);
});

test('session-spend formatter uses the exact production short-money precision thresholds', () => {
  assert.match(motion, /absolute >= 1e12[\s\S]*?minimumFractionDigits: 1, maximumFractionDigits: 1/);
  assert.match(motion, /absolute >= 1e9[\s\S]*?minimumFractionDigits: 1, maximumFractionDigits: 2/);
  assert.match(motion, /absolute >= 1e6[\s\S]*?maximumFractionDigits: 0/);
  assert.match(motion, /Math\.round\(absolute\)/);
  assert.match(motion, /pw2-currency-sign/);
  assert.match(motion, /pw2-val-unit/);
  assert.match(motion, /dataset\.motionPolish\s*=\s*'production-live-port'/);
});

test('production numeric typography remains stable and anchored', () => {
  assert.match(css, /\.pw-flow-value[\s\S]*?font-variant-numeric:\s*tabular-nums\s*!important/);
  assert.match(css, /font-feature-settings:\s*"tnum" 1, "lnum" 1\s*!important/);
  assert.match(css, /\.pw-flow-value \.pw2-currency-sign[\s\S]*?font-size:\s*\.85em/);
  assert.match(css, /\.pw-flow-value \.pw2-val-unit[\s\S]*?font-size:\s*\.55em/);
  assert.match(css, /\.pw-flow-value[\s\S]*?transform:\s*none\s*!important/);
});
