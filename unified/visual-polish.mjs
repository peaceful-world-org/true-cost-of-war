// Presentation ownership for the first-screen live session counter.
//
// The previous parity pass copied the legacy 80 ms render gate literally. At
// the current global-spend rate that means jumps of roughly six thousand
// dollars per paint, which is exactly the perceptual "chunking" we are trying
// to remove. The data model stays unchanged; only the presentation clock is
// made truly continuous.
//
// This layer owns the visible session-spend value and the three live equivalent
// counters after window load. Earlier unified modules keep references to the
// detached original nodes, so there is no competing formatter or flicker.

import { formattingProfile } from '../src/format.mjs';

const SECONDS_PER_YEAR = 31557600;
const SESSION_EQUIVALENTS = Object.freeze({ food: 62.5, health: 125, poverty: 1000 });

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((response) => response.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((response) => response.json()),
]);

const annualMilitarySpend = modelDocument.values.annualMilitarySpend;
const spendPerSecond = annualMilitarySpend / SECONDS_PER_YEAR;

let viewerSpend = null;
let sessionFood = null;
let sessionHealth = null;
let sessionPoverty = null;
let viewerNumberNode = null;
let viewerCurrency = null;
let viewerCurrencyAfterSpacer = null;
let accumulatedVisibleMs = 0;
let visibleStartedAt = document.hidden ? null : performance.now();
let animationFrameId = null;
let initialized = false;
const integerFormatters = new Map();

function languageKey() {
  return document.querySelector('#language')?.value || new URLSearchParams(location.search).get('lang') || 'en';
}

function currentMeta() {
  return manifest.languages[languageKey()] || manifest.languages.en;
}

function integerFormatter(meta) {
  const profile = formattingProfile(meta);
  const locale = profile.numberLocale || 'en-US';
  if (!integerFormatters.has(locale)) {
    integerFormatters.set(locale, new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }));
  }
  return integerFormatters.get(locale);
}

function formatInteger(value, meta) {
  return integerFormatter(meta).format(Math.max(0, Math.floor(Number(value) || 0)));
}

function currentVisibleMs(now = performance.now()) {
  if (visibleStartedAt === null) return accumulatedVisibleMs;
  return accumulatedVisibleMs + Math.max(0, now - visibleStartedAt);
}

function takeExclusiveOwnership(selector) {
  const existing = document.querySelector(selector);
  if (!existing) return null;
  const clone = existing.cloneNode(true);
  clone.classList.add('pw-flow-value');
  existing.replaceWith(clone);
  return clone;
}

function buildViewerMoneyDom(node, meta) {
  if (!node) return;
  const profile = formattingProfile(meta);
  const wrap = document.createElement('span');
  wrap.className = 'pw-flow-money';

  viewerCurrency = document.createElement('span');
  viewerCurrency.className = 'pw2-currency-sign';
  viewerCurrency.textContent = profile.currencySymbol || '$';

  const number = document.createElement('span');
  number.className = 'pw-flow-number';
  viewerNumberNode = document.createTextNode('0');
  number.append(viewerNumberNode);

  viewerCurrencyAfterSpacer = document.createTextNode('\u00a0');

  if (profile.currencyPosition === 'after') {
    wrap.append(number, viewerCurrencyAfterSpacer, viewerCurrency);
  } else {
    wrap.append(viewerCurrency, document.createTextNode('\u00a0'), number);
  }
  node.replaceChildren(wrap);
}

function refreshCurrencyPlacement() {
  if (!viewerSpend) return;
  buildViewerMoneyDom(viewerSpend, currentMeta());
}

function render(now) {
  animationFrameId = null;
  if (!viewerSpend || document.hidden) return;

  const meta = currentMeta();
  const elapsedSeconds = currentVisibleMs(now) / 1000;
  const spend = spendPerSecond * elapsedSeconds;

  // Keep the session-spend display as a full running integer instead of
  // collapsing to whole millions. At ~77k USD/s, compact "1m, 2m..." notation
  // necessarily freezes for many seconds at a time and destroys the sense of
  // flow. The rest of the calculator keeps the legacy compact formatting.
  const moneyText = formatInteger(spend, meta);
  if (viewerNumberNode && viewerNumberNode.nodeValue !== moneyText) {
    viewerNumberNode.nodeValue = moneyText;
  }

  const foodText = formatInteger(spend / SESSION_EQUIVALENTS.food, meta);
  const healthText = formatInteger(spend / SESSION_EQUIVALENTS.health, meta);
  const povertyText = formatInteger(spend / SESSION_EQUIVALENTS.poverty, meta);

  if (sessionFood && sessionFood.textContent !== foodText) sessionFood.textContent = foodText;
  if (sessionHealth && sessionHealth.textContent !== healthText) sessionHealth.textContent = healthText;
  if (sessionPoverty && sessionPoverty.textContent !== povertyText) sessionPoverty.textContent = povertyText;

  // No throttle: the visible values follow the display refresh cadence.
  animationFrameId = requestAnimationFrame(render);
}

function startLoop() {
  if (!document.hidden && animationFrameId === null) {
    animationFrameId = requestAnimationFrame(render);
  }
}

function initialize() {
  if (initialized) return;
  initialized = true;

  viewerSpend = takeExclusiveOwnership('#viewerSpend');
  sessionFood = takeExclusiveOwnership('#sessionFood');
  sessionHealth = takeExclusiveOwnership('#sessionHealth');
  sessionPoverty = takeExclusiveOwnership('#sessionPoverty');
  if (!viewerSpend) return;

  refreshCurrencyPlacement();
  accumulatedVisibleMs = 0;
  visibleStartedAt = document.hidden ? null : performance.now();

  document.querySelector('#language')?.addEventListener('change', () => {
    refreshCurrencyPlacement();
    startLoop();
  });

  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.hidden) {
      if (visibleStartedAt !== null) {
        accumulatedVisibleMs += Math.max(0, now - visibleStartedAt);
        visibleStartedAt = null;
      }
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else {
      visibleStartedAt = now;
      startLoop();
    }
  });

  document.documentElement.dataset.motionPolish = 'continuous-live-flow';
  startLoop();
}

// Wait until the earlier unified modules have captured their DOM references;
// replacing the visible nodes here makes this presentation layer their only
// writer without disturbing the shared calculation runtime.
if (document.readyState === 'complete') {
  queueMicrotask(initialize);
} else {
  window.addEventListener('load', initialize, { once: true });
}
