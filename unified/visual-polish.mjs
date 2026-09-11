// Presentation ownership for the first-screen live session counter.
//
// The money total and the three derived live equivalents need different visual
// treatment. The dollar amount changes by roughly 77k every second, so repainting
// it on every animation frame makes the low-order digits shimmer. The smaller
// food / health / poverty counters, however, look jerky when they inherit the
// same 80 ms gate because they jump in visibly large chunks.
//
// Keep the production-style 80 ms cadence only for the money total. The derived
// counters follow requestAnimationFrame and update persistent Text nodes, so
// they move in small frame-sized increments without rebuilding their DOM.

import { formattingProfile } from '../src/format.mjs';

const SECONDS_PER_YEAR = 31557600;
const MONEY_CADENCE_MS = 80;
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
let sessionFoodNode = null;
let sessionHealthNode = null;
let sessionPovertyNode = null;
let viewerCurrency = null;
let viewerCurrencyAfterSpacer = null;
let accumulatedVisibleMs = 0;
let visibleStartedAt = document.hidden ? null : performance.now();
let animationFrameId = null;
let lastMoneyPaintAt = Number.NEGATIVE_INFINITY;
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
  return integerFormatter(meta).format(Math.max(0, Math.round(Number(value) || 0)));
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

function persistentNumberNode(node) {
  if (!node) return null;
  const text = document.createTextNode(node.textContent || '0');
  node.replaceChildren(text);
  return text;
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

function writeTextNode(node, value) {
  if (node && node.nodeValue !== value) node.nodeValue = value;
}

function paintMoney(spend, meta, now) {
  writeTextNode(viewerNumberNode, formatInteger(spend, meta));
  lastMoneyPaintAt = now;
}

function paintDerived(spend, meta) {
  writeTextNode(sessionFoodNode, formatInteger(spend / SESSION_EQUIVALENTS.food, meta));
  writeTextNode(sessionHealthNode, formatInteger(spend / SESSION_EQUIVALENTS.health, meta));
  writeTextNode(sessionPovertyNode, formatInteger(spend / SESSION_EQUIVALENTS.poverty, meta));
}

function render(now) {
  animationFrameId = null;
  if (!viewerSpend || document.hidden) return;

  const meta = currentMeta();
  const elapsedSeconds = currentVisibleMs(now) / 1000;
  const spend = spendPerSecond * elapsedSeconds;

  // The large dollar total stays visually calm. At the current spend rate an
  // 80 ms sample is enough motion without a 60 Hz storm of changing digits.
  if (now - lastMoneyPaintAt >= MONEY_CADENCE_MS) {
    paintMoney(spend, meta, now);
  }

  // These counters are orders of magnitude smaller. Updating them every frame
  // means natural increments of roughly tens / tens / ones instead of the large
  // 80 ms chunks that looked like dropped frames.
  paintDerived(spend, meta);

  animationFrameId = requestAnimationFrame(render);
}

function startLoop({ paintMoneyImmediately = false } = {}) {
  if (paintMoneyImmediately) lastMoneyPaintAt = Number.NEGATIVE_INFINITY;
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
  sessionFoodNode = persistentNumberNode(sessionFood);
  sessionHealthNode = persistentNumberNode(sessionHealth);
  sessionPovertyNode = persistentNumberNode(sessionPoverty);

  accumulatedVisibleMs = 0;
  visibleStartedAt = document.hidden ? null : performance.now();
  lastMoneyPaintAt = Number.NEGATIVE_INFINITY;

  document.querySelector('#language')?.addEventListener('change', () => {
    refreshCurrencyPlacement();
    startLoop({ paintMoneyImmediately: true });
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
      startLoop({ paintMoneyImmediately: true });
    }
  });

  document.documentElement.dataset.motionPolish = 'split-cadence-live-flow';
  startLoop({ paintMoneyImmediately: true });
}

// Wait until the earlier unified modules have captured their DOM references;
// replacing the visible nodes here makes this presentation layer their only
// writer without disturbing the shared calculation runtime.
if (document.readyState === 'complete') {
  queueMicrotask(initialize);
} else {
  window.addEventListener('load', initialize, { once: true });
}
