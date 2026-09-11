// Strict presentation port of the production live-session counter.
//
// Do not "improve" this loop independently. Its timing, active-time accounting,
// rounding and update cadence intentionally mirror the current production
// calculator. The only adaptation is mapping production element names and
// locale metadata into the unified shell.

import { formattingProfile } from '../src/format.mjs';

const ORIGINAL_SECONDS_PER_YEAR = 31557600;
const ORIGINAL_LIVE_CADENCE_MS = 80;
const ORIGINAL_TRANSITION_MS = 1200;

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((response) => response.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((response) => response.json()),
]);

const annualMilitarySpend = modelDocument.values.annualMilitarySpend;

let viewerSpend = null;
let sessionFood = null;
let sessionHealth = null;
let sessionPoverty = null;

// These variables deliberately match the production implementation.
let activeTimeMs = 0;
let lastVisibleTime = Date.now();
let lastModeChangeTime = Date.now();
let animationFrameId = null;
let lastRenderTime = 0;
let initialized = false;

function languageKey() {
  return document.querySelector('#language')?.value || new URLSearchParams(location.search).get('lang') || 'en';
}

function currentMeta() {
  return manifest.languages[languageKey()] || manifest.languages.en;
}

function currentMode() {
  return document.querySelector('#mode')?.value || 'year';
}

function isLiveMode(mode = currentMode()) {
  return mode === 'year' || mode === 'since1945' || mode === 'lifetime';
}

function setTxt(el, text) {
  if (el && el.textContent !== String(text)) el.textContent = text;
}

function setHtml(el, html) {
  if (el && el.innerHTML !== String(html)) el.innerHTML = html;
}

function cleanNumber(value) {
  return String(value).replace(/[\s\u202F\u00A0]/g, '\u00A0');
}

// Same scale thresholds and precision as production formatMoneyHTML(value, true).
// Locale metadata only replaces the hard-coded language/unit labels from each
// old localized HTML file.
function formatMoneyHTML(value, short = false) {
  const profile = formattingProfile(currentMeta());
  const locale = profile.numberLocale || 'en-US';
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const absolute = Math.abs(numericValue);

  let num = 0;
  let unit = '';

  if (absolute >= 1e12) {
    num = (absolute / 1e12).toLocaleString(locale, {
      minimumFractionDigits: short ? 1 : 2,
      maximumFractionDigits: short ? 1 : 3,
    });
    unit = profile.units.trillion;
  } else if (absolute >= 1e9) {
    num = (absolute / 1e9).toLocaleString(locale, {
      minimumFractionDigits: short ? 1 : 2,
      maximumFractionDigits: 2,
    });
    unit = profile.units.billion;
  } else if (absolute >= 1e6) {
    num = (absolute / 1e6).toLocaleString(locale, { maximumFractionDigits: 0 });
    unit = profile.units.million;
  } else {
    num = Math.round(absolute).toLocaleString(locale);
  }

  const cleanNum = cleanNumber(num);
  const signedNum = numericValue < 0 ? `-${cleanNum}` : cleanNum;
  const currency = profile.currencySymbol || '$';
  const unitHtml = unit ? `<span class="pw2-val-unit">${unit}</span>` : '';

  if (profile.currencyPosition === 'after') {
    return `<span style="white-space: nowrap;">${signedNum}&nbsp;<span class="pw2-currency-sign">${currency}</span></span>${unitHtml}`;
  }

  return `<span style="white-space: nowrap;"><span class="pw2-currency-sign">${currency}</span>&nbsp;${signedNum}</span>${unitHtml}`;
}

// Literal production integer formatter.
function formatInt(value) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

function takeExclusiveOwnership(selector) {
  const existing = document.querySelector(selector);
  if (!existing) return null;
  const clone = existing.cloneNode(true);
  clone.classList.add('pw-flow-value');
  existing.replaceWith(clone);
  return clone;
}

// Literal production scheduling model: rAF owns the loop, while live paints are
// gated at 80 ms after the initial 1200 ms transition window.
function requestUpdate() {
  if (!document.hidden && !animationFrameId) {
    animationFrameId = requestAnimationFrame(render);
  }
}

function render() {
  animationFrameId = null;
  if (!viewerSpend || document.hidden) return;

  const mode = currentMode();
  const live = isLiveMode(mode);

  const timeSinceChange = Date.now() - lastModeChangeTime;
  const isAnimating = Math.min(timeSinceChange / ORIGINAL_TRANSITION_MS, 1) < 1;

  const now = Date.now();
  if (!isAnimating && live && now - lastRenderTime < ORIGINAL_LIVE_CADENCE_MS) {
    animationFrameId = requestAnimationFrame(render);
    return;
  }
  lastRenderTime = now;

  // Literal production active-visible-time calculation.
  const currentActiveTime = document.hidden
    ? activeTimeMs
    : activeTimeMs + (Date.now() - lastVisibleTime);

  const visitSpend = (annualMilitarySpend / ORIGINAL_SECONDS_PER_YEAR) * (currentActiveTime / 1000);

  // These four writes are intentionally kept together, exactly as in production.
  setHtml(viewerSpend, formatMoneyHTML(visitSpend, true));
  setTxt(sessionFood, formatInt(Math.floor(visitSpend / 62.5)));
  setTxt(sessionHealth, formatInt(Math.floor(visitSpend / 125)));
  setTxt(sessionPoverty, formatInt(Math.floor(visitSpend / 1000)));

  if (live || isAnimating) animationFrameId = requestAnimationFrame(render);
  else animationFrameId = null;
}

function initialize() {
  if (initialized) return;
  initialized = true;

  // app.mjs has already captured the old nodes. Replacing them once gives this
  // strict production port exclusive ownership of the visible four values and
  // prevents the unified formatter from competing with the production loop.
  viewerSpend = takeExclusiveOwnership('#viewerSpend');
  sessionFood = takeExclusiveOwnership('#sessionFood');
  sessionHealth = takeExclusiveOwnership('#sessionHealth');
  sessionPoverty = takeExclusiveOwnership('#sessionPoverty');
  if (!viewerSpend) return;

  activeTimeMs = 0;
  lastVisibleTime = Date.now();
  lastModeChangeTime = Date.now();
  lastRenderTime = 0;
  requestUpdate();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      activeTimeMs += Date.now() - lastVisibleTime;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else {
      lastVisibleTime = Date.now();
      const mode = currentMode();
      if (isLiveMode(mode) || Date.now() - lastModeChangeTime < ORIGINAL_TRANSITION_MS) {
        lastRenderTime = Date.now();
        requestUpdate();
      }
    }
  });

  const handleInput = () => {
    requestUpdate();
  };

  const handleModeChange = () => {
    lastModeChangeTime = Date.now();
    handleInput();
  };

  document.querySelector('#mode')?.addEventListener('change', handleModeChange);
  document.querySelector('#birthYear')?.addEventListener('input', handleModeChange);
  document.querySelector('#share')?.addEventListener('input', handleInput);
  for (const chip of document.querySelectorAll('.pw-scenario-chip')) {
    chip.addEventListener('click', handleInput);
  }

  // The old production pages are separate per language; unified has an inline
  // switch, so only this adapter event is new.
  document.querySelector('#language')?.addEventListener('change', handleInput);

  document.documentElement.dataset.motionPolish = 'strict-production-live-port';
}

// Wait until the earlier unified modules have captured their DOM references.
if (document.readyState === 'complete') {
  queueMicrotask(initialize);
} else {
  window.addEventListener('load', initialize, { once: true });
}
