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

test('live-flow enhancement covers the first-screen counters and respects reduced motion', () => {
  for (const selector of ['#mainCounterValue', '#viewerSpend', '#sessionFood', '#sessionHealth', '#sessionPoverty']) {
    assert.ok(motion.includes(`'${selector}'`), `motion target missing: ${selector}`);
  }
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /MutationObserver/);
  assert.match(motion, /cubic-bezier\(\.22,\.72,\.2,1\)/);
  assert.match(motion, /dataset\.motionPolish\s*=\s*'ready'/);
});
