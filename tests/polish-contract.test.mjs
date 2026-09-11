import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../unified/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../unified/visual-polish.css', import.meta.url), 'utf8');
const motion = readFileSync(new URL('../unified/visual-polish.mjs', import.meta.url), 'utf8');
const parity = readFileSync(new URL('../unified/parity-b.mjs', import.meta.url), 'utf8');

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
  assert.match(css, /display:\s*inline-flex/);
  assert.match(css, /align-items:\s*center/);
  assert.match(css, /justify-content:\s*center/);
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

test('mobile info controls stay grouped with scenario and mission text', () => {
  assert.match(css, /\.pw-scenario-title-row\s*\{[\s\S]*?display:\s*inline-flex[\s\S]*?align-items:\s*center[\s\S]*?gap:\s*var\(--pw-info-gap\)/);
  assert.match(css, /\.pw-scenario-title-row > \.pw-parity-info\s*\{[\s\S]*?margin-inline-start:\s*0[\s\S]*?align-self:\s*center/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.pw-scenario-title-row\s*\{[\s\S]*?flex:\s*1 1 auto[\s\S]*?gap:\s*6px/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.pw-mission-primary-copy \.pw-parity-info,[\s\S]*?\.pw-mission-impact-highlight \.pw-parity-info\s*\{[\s\S]*?margin-inline-start:\s*4px[\s\S]*?top:\s*0/);
});

test('live session loop preserves the production timing constants and clock', () => {
  assert.match(motion, /const ORIGINAL_SECONDS_PER_YEAR = 31557600/);
  assert.match(motion, /const ORIGINAL_LIVE_CADENCE_MS = 80/);
  assert.match(motion, /const ORIGINAL_TRANSITION_MS = 1200/);
  assert.match(motion, /let activeTimeMs = 0/);
  assert.match(motion, /let lastVisibleTime = Date\.now\(\)/);
  assert.match(motion, /let lastModeChangeTime = Date\.now\(\)/);
  assert.match(motion, /let lastRenderTime = 0/);
  assert.doesNotMatch(motion, /performance\.now\(\)/);
});

test('all four live values share the same production render gate', () => {
  assert.match(motion, /now - lastRenderTime < ORIGINAL_LIVE_CADENCE_MS/);
  assert.match(motion, /animationFrameId = requestAnimationFrame\(render\)/);
  assert.match(motion, /activeTimeMs \+ \(Date\.now\(\) - lastVisibleTime\)/);
  assert.match(motion, /\(annualMilitarySpend \/ ORIGINAL_SECONDS_PER_YEAR\) \* \(currentActiveTime \/ 1000\)/);

  const money = motion.indexOf('setHtml(viewerSpend, formatMoneyHTML(visitSpend, true));');
  const food = motion.indexOf('setTxt(sessionFood, formatInt(Math.floor(visitSpend / 62.5)));');
  const health = motion.indexOf('setTxt(sessionHealth, formatInt(Math.floor(visitSpend / 125)));');
  const poverty = motion.indexOf('setTxt(sessionPoverty, formatInt(Math.floor(visitSpend / 1000)));');
  assert.ok(money >= 0 && food > money && health > food && poverty > health, 'four production writes remain together and ordered');

  assert.doesNotMatch(motion, /paintMoney/);
  assert.doesNotMatch(motion, /paintDerived/);
  assert.doesNotMatch(motion, /persistentNumberNode/);
  assert.doesNotMatch(motion, /MONEY_CADENCE_MS/);
});

test('parity layer cannot become a second writer for session equivalents', () => {
  assert.doesNotMatch(parity, /setText\(el\.sessionFood,/);
  assert.doesNotMatch(parity, /setText\(el\.sessionHealth,/);
  assert.doesNotMatch(parity, /setText\(el\.sessionPoverty,/);
  assert.doesNotMatch(parity, /function elapsedSeconds\s*\(/);
  assert.doesNotMatch(parity, /SESSION_EQUIVALENTS/);
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

test('session money uses the production compact-money thresholds', () => {
  assert.match(motion, /absolute >= 1e12[\s\S]*?minimumFractionDigits: short \? 1 : 2[\s\S]*?maximumFractionDigits: short \? 1 : 3/);
  assert.match(motion, /absolute >= 1e9[\s\S]*?minimumFractionDigits: short \? 1 : 2[\s\S]*?maximumFractionDigits: 2/);
  assert.match(motion, /absolute >= 1e6[\s\S]*?maximumFractionDigits: 0/);
  assert.match(motion, /Math\.round\(absolute\)\.toLocaleString/);
  assert.match(motion, /pw2-currency-sign/);
  assert.match(motion, /pw2-val-unit/);
});

test('derived integer formatting and visibility behavior match production', () => {
  assert.match(motion, /Math\.round\(value\)\.toString\(\)\.replace/);
  assert.match(motion, /activeTimeMs \+= Date\.now\(\) - lastVisibleTime/);
  assert.match(motion, /lastVisibleTime = Date\.now\(\)/);
  assert.match(motion, /lastModeChangeTime = Date\.now\(\)/);
  assert.match(motion, /dataset\.motionPolish = 'strict-production-live-port'/);
});

test('production numeric typography remains anchored', () => {
  assert.match(css, /\.pw-flow-value[\s\S]*?font-variant-numeric:\s*tabular-nums\s*!important/);
  assert.match(css, /font-feature-settings:\s*"tnum" 1, "lnum" 1\s*!important/);
  assert.match(css, /\.pw-flow-value \.pw2-currency-sign[\s\S]*?font-size:\s*\.85em/);
  assert.match(css, /\.pw-flow-value \.pw2-val-unit[\s\S]*?font-size:\s*\.55em/);
  assert.match(css, /\.pw-flow-value[\s\S]*?transform:\s*none\s*!important/);
});
