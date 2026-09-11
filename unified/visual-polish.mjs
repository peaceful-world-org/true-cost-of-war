// Final presentation ownership for the first-screen session-spend counter.
//
// Important: this is a literal port of the production calculator behaviour,
// not a new animation. The reference implementation uses active visible time,
// a requestAnimationFrame loop, an 80 ms live gate after the initial 1200 ms
// transition window, and the legacy short-money formatter. We preserve those
// mechanics here exactly while keeping the unified calculation architecture.
//
// app.mjs already holds a reference to #viewerSpend. At window load we replace
// that one visible node with a clone. The old app reference then points to the
// detached node and cannot flash a competing formatter into the live UI. This
// module becomes the sole writer of the visible session-spend value.

import { formattingProfile } from '../src/format.mjs';

const ORIGINAL_SECONDS_PER_YEAR = 31557600;
const ORIGINAL_LIVE_CADENCE_MS = 80;
const ORIGINAL_TRANSITION_MS = 1200;

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((response) => response.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((response) => response.json()),
]);

const annualMilitarySpend = modelDocument.values.annualMilitarySpend;
const spendPerSecond = annualMilitarySpend / ORIGINAL_SECONDS_PER_YEAR;

let viewerSpend = null;
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

function cleanNumber(value) {
  return String(value).replace(/[\s\u202F\u00A0]/g, '\u00A0');
}

// Exact `formatMoneyHTML(value, true)` thresholds used by the production RU
// calculator. Locale metadata only supplies the already-established unified
// number locale / unit labels; the precision rules are the legacy rules.
function originalShortMoneyParts(value, meta) {
  const profile = formattingProfile(meta);
  const original = Number.isFinite(Number(value)) ? Number(value) : 0;
  const absolute = Math.abs(original);
  let scaled = absolute;
  let unit = '';
  let options = {};

  if (absolute >= 1e12) {
    scaled = absolute / 1e12;
    unit = profile.units.trillion;
    options = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  } else if (absolute >= 1e9) {
    scaled = absolute / 1e9;
    unit = profile.units.billion;
    options = { minimumFractionDigits: 1, maximumFractionDigits: 2 };
  } else if (absolute >= 1e6) {
    scaled = absolute / 1e6;
    unit = profile.units.million;
    options = { maximumFractionDigits: 0 };
  } else {
    scaled = Math.round(absolute);
    options = { maximumFractionDigits: 0 };
  }

  const localized = cleanNumber(scaled.toLocaleString(profile.numberLocale || 'en-US', options));
  return {
    number: original < 0 ? `-${localized}` : localized,
    unit,
    currency: profile.currencySymbol || '$',
    currencyPosition: profile.currencyPosition || 'before',
  };
}

// Reproduce the production DOM structure too: currency sign is its own smaller
// span, the number itself is nowrap, and the unit is a separate smaller span.
function writeOriginalMoney(node, value, meta) {
  if (!node) return;
  const parts = originalShortMoneyParts(value, meta);
  const numberWrap = document.createElement('span');
  numberWrap.style.whiteSpace = 'nowrap';

  const currency = document.createElement('span');
  currency.className = 'pw2-currency-sign';
  currency.textContent = parts.currency;

  if (parts.currencyPosition === 'after') {
    numberWrap.append(document.createTextNode(parts.number));
  } else {
    numberWrap.append(currency, document.createTextNode(`\u00a0${parts.number}`));
  }

  const children = [numberWrap];
  if (parts.unit) {
    const unit = document.createElement('span');
    unit.className = 'pw2-val-unit';
    unit.textContent = parts.unit;
    children.push(unit);
  }
  if (parts.currencyPosition === 'after') {
    children.push(document.createTextNode('\u00a0'), currency);
  }

  node.replaceChildren(...children);
}

function requestUpdate() {
  if (!document.hidden && animationFrameId === null) {
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

  // This line intentionally mirrors production: after the 1200 ms transition
  // window, live modes paint at most once every 80 ms. During the transition
  // window the same rAF loop is allowed to paint every frame.
  if (!isAnimating && live && now - lastRenderTime < ORIGINAL_LIVE_CADENCE_MS) {
    animationFrameId = requestAnimationFrame(render);
    return;
  }
  lastRenderTime = now;

  const currentActiveTime = document.hidden
    ? activeTimeMs
    : activeTimeMs + (Date.now() - lastVisibleTime);
  const visitSpend = spendPerSecond * (currentActiveTime / 1000);
  writeOriginalMoney(viewerSpend, visitSpend, currentMeta());

  if (live || isAnimating) animationFrameId = requestAnimationFrame(render);
}

function takeExclusiveViewerOwnership() {
  const existing = document.querySelector('#viewerSpend');
  if (!existing) return null;
  const clone = existing.cloneNode(true);
  clone.classList.add('pw-flow-value');
  existing.replaceWith(clone);
  return clone;
}

function initialize() {
  if (initialized) return;
  initialized = true;
  viewerSpend = takeExclusiveViewerOwnership();
  if (!viewerSpend) return;

  // Start from the same active-time origin and immediately enter the reference
  // render loop. No MutationObserver and no second visible formatter remain.
  lastVisibleTime = Date.now();
  lastModeChangeTime = Date.now();
  lastRenderTime = 0;
  requestUpdate();

  const mode = document.querySelector('#mode');
  const handleModeChange = () => {
    lastModeChangeTime = Date.now();
    requestUpdate();
  };
  mode?.addEventListener('input', handleModeChange);
  mode?.addEventListener('change', handleModeChange);

  document.querySelector('#language')?.addEventListener('change', requestUpdate);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      activeTimeMs += Date.now() - lastVisibleTime;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else {
      lastVisibleTime = Date.now();
      const modeValue = currentMode();
      if (isLiveMode(modeValue) || Date.now() - lastModeChangeTime < ORIGINAL_TRANSITION_MS) {
        lastRenderTime = Date.now();
        requestUpdate();
      }
    }
  });

  document.documentElement.dataset.motionPolish = 'production-live-port';
}

// Waiting for load is deliberate: all earlier module scripts have captured
// their DOM references by then, so replacing #viewerSpend cleanly isolates the
// visible value without changing the rest of the unified runtime.
if (document.readyState === 'complete') {
  queueMicrotask(initialize);
} else {
  window.addEventListener('load', initialize, { once: true });
}
