// Presentation ownership for the first-screen live session counter.
//
// The production calculator feels calmer for a simple reason: it keeps a
// requestAnimationFrame loop running, but it does not repaint the visible live
// values on every display frame. Its live presentation is sampled at roughly
// 80 ms. The previous preview pass removed that gate, so the low-order digits
// changed about 60 times per second and visibly flickered.
//
// This keeps the production-style 80 ms presentation cadence while preserving
// the newer full running integer. In other words, the counter stays alive past
// $1m instead of collapsing into whole-million steps, but its low-order digits
// no longer churn on every screen refresh.
//
// This layer owns the visible session-spend value and the three live equivalent
// counters after window load. Earlier unified modules keep references to the
// detached original nodes, so there is no competing formatter or flicker.

import { formattingProfile } from '../src/format.mjs';

const SECONDS_PER_YEAR = 31557600;
const ORIGINAL_LIVE_CADENCE_MS = 80;
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
let lastVisiblePaintAt = Number.NEGATIVE_INFINITY;
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

function paintVisibleValues(now) {
  const meta = currentMeta();
  const elapsedSeconds = currentVisibleMs(now) / 1000;
  const spend = spendPerSecond * elapsedSeconds;

  // Keep the full amount at every scale. This deliberately differs from the
  // legacy compact formatter only at $1m+, where whole-million notation caused
  // long visible freezes. The cadence, not the numeric scale, is what we port
  // from production here.
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

  lastVisiblePaintAt = now;
}

function render(now) {
  animationFrameId = null;
  if (!viewerSpend || document.hidden) return;

  // Match the production calculator's perceived cadence: rAF remains the clock,
  // but DOM text is repainted only about every 80 ms. This removes the 60 Hz
  // low-order digit shimmer without introducing a setInterval drift clock.
  if (now - lastVisiblePaintAt >= ORIGINAL_LIVE_CADENCE_MS) {
    paintVisibleValues(now);
  }

  animationFrameId = requestAnimationFrame(render);
}

function startLoop({ paintImmediately = false } = {}) {
  if (paintImmediately) lastVisiblePaintAt = Number.NEGATIVE_INFINITY;
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
  lastVisiblePaintAt = Number.NEGATIVE_INFINITY;

  document.querySelector('#language')?.addEventListener('change', () => {
    refreshCurrencyPlacement();
    startLoop({ paintImmediately: true });
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
      startLoop({ paintImmediately: true });
    }
  });

  document.documentElement.dataset.motionPolish = 'original-cadence-continuous-value';
  startLoop({ paintImmediately: true });
}

// Wait until the earlier unified modules have captured their DOM references;
// replacing the visible nodes here makes this presentation layer their only
// writer without disturbing the shared calculation runtime.
if (document.readyState === 'complete') {
  queueMicrotask(initialize);
} else {
  window.addEventListener('load', initialize, { once: true });
}
