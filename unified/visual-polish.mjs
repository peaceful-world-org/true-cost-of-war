// UX-only presentation layer for the first-screen live counters.
//
// Goal: preserve the calm scale-aware behaviour of the original calculator,
// while removing the visible 80 ms stepping that made the sub-million counter
// feel jerky in the unified build.
//
// Below $1m the monetary counter follows active time on every animation frame,
// so the count-up reads as one continuous flow. At $1m+ visible precision drops
// sharply: one decimal in millions, then progressively coarser billion/trillion
// notation. The number element itself never moves, fades or blurs.

import { formatInteger, formattingProfile } from '../src/format.mjs';

const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const MILLION_THRESHOLD = 1e6;
const DERIVED_CADENCE_MS = 250;
const SESSION_EQUIVALENTS = Object.freeze({ food: 62.5, health: 125, poverty: 1000 });

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((response) => response.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((response) => response.json()),
]);

const perSecond = modelDocument.values.annualMilitarySpend / REFERENCE_SECONDS_PER_YEAR;
const viewerSpend = document.querySelector('#viewerSpend');
const sessionFood = document.querySelector('#sessionFood');
const sessionHealth = document.querySelector('#sessionHealth');
const sessionPoverty = document.querySelector('#sessionPoverty');
const ownedNodes = [viewerSpend, sessionFood, sessionHealth, sessionPoverty].filter(Boolean);
const lastRendered = new Map();

let accumulatedMs = 0;
let activeSince = document.hidden ? null : performance.now();
let frameId = null;
let lastDerivedPaintAt = 0;

function languageKey() {
  return document.querySelector('#language')?.value || new URLSearchParams(location.search).get('lang') || 'en';
}

function currentMeta() {
  return manifest.languages[languageKey()] || manifest.languages.en;
}

function elapsedActiveMs(now = performance.now()) {
  return accumulatedMs + (activeSince === null ? 0 : Math.max(0, now - activeSince));
}

function setActive(active, now = performance.now()) {
  if (active) {
    if (activeSince === null) activeSince = now;
    return;
  }
  if (activeSince !== null) {
    accumulatedMs += Math.max(0, now - activeSince);
    activeSince = null;
  }
}

// Scale-aware display strategy tuned for perceptual flow:
//   < $1m   -> whole dollars, updated every animation frame
//   $1m+    -> one decimal million (calm, but still visibly alive)
//   $1b+    -> up to three decimals in billions
//   $1t+    -> up to three decimals in trillions
// This keeps the early count-up fluid, then progressively reduces the number
// of changing digits as the magnitude grows.
function formatFlowMoney(value, meta) {
  const profile = formattingProfile(meta);
  const original = Number.isFinite(Number(value)) ? Number(value) : 0;
  const absolute = Math.abs(original);
  let scaled = absolute;
  let unit = '';
  let minimumFractionDigits = 0;
  let maximumFractionDigits = 0;

  if (absolute >= 1e12) {
    scaled = absolute / 1e12;
    unit = profile.units.trillion;
    maximumFractionDigits = 3;
  } else if (absolute >= 1e9) {
    scaled = absolute / 1e9;
    unit = profile.units.billion;
    maximumFractionDigits = 3;
  } else if (absolute >= MILLION_THRESHOLD) {
    scaled = absolute / 1e6;
    unit = profile.units.million;
    minimumFractionDigits = 1;
    maximumFractionDigits = 1;
  } else {
    scaled = Math.round(absolute);
  }

  const number = scaled.toLocaleString(profile.numberLocale || 'en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
  const signed = original < 0 ? `-${number}` : number;
  const currency = profile.currencySymbol || '$';
  const currencyGap = profile.currencyGap ?? '\u00a0';
  const unitText = unit ? `${profile.unitGap ?? '\u00a0'}${unit}` : '';

  return profile.currencyPosition === 'after'
    ? `${signed}${unitText}${currencyGap}${currency}`
    : `${currency}${currencyGap}${signed}${unitText}`;
}

function writeOwned(node, value) {
  if (!node) return;
  const text = String(value);
  lastRendered.set(node, text);
  if (node.textContent !== text) node.textContent = text;
}

function currentSession(now = performance.now()) {
  const seconds = elapsedActiveMs(now) / 1000;
  return {
    seconds,
    spend: perSecond * seconds,
    meta: currentMeta(),
  };
}

function renderViewer(now = performance.now()) {
  const { spend, meta } = currentSession(now);
  writeOwned(viewerSpend, formatFlowMoney(spend, meta));
}

function renderDerived(now = performance.now()) {
  const { spend, meta } = currentSession(now);
  writeOwned(sessionFood, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.food), meta));
  writeOwned(sessionHealth, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.health), meta));
  writeOwned(sessionPoverty, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.poverty), meta));
}

function frame(now) {
  frameId = null;
  if (!document.hidden) {
    // The dominant money counter follows the browser's display cadence. This is
    // what removes the visible 80 ms staircase below $1m. Because formatFlowMoney
    // reduces precision at larger scales, DOM text stops changing every frame
    // once the total reaches the million range.
    renderViewer(now);

    if (now - lastDerivedPaintAt >= DERIVED_CADENCE_MS) {
      renderDerived(now);
      lastDerivedPaintAt = now;
    }
  }
  frameId = requestAnimationFrame(frame);
}

// app.mjs / parity-b.mjs still calculate canonical values for the rest of the
// interface. If either writes into a presentation node owned here, restore the
// most recent polished value in the same microtask checkpoint. This prevents
// competing formatters from flashing between frames.
const observer = new MutationObserver(() => {
  for (const node of ownedNodes) {
    const expected = lastRendered.get(node);
    if (expected !== undefined && node.textContent !== expected) node.textContent = expected;
  }
});
for (const node of ownedNodes) {
  node.classList.add('pw-flow-value');
  observer.observe(node, { childList: true, characterData: true, subtree: true });
}

document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  setActive(!document.hidden, now);
  lastDerivedPaintAt = 0;
  if (!document.hidden) {
    renderViewer(now);
    renderDerived(now);
  }
});

const language = document.querySelector('#language');
language?.addEventListener('change', () => {
  const now = performance.now();
  lastDerivedPaintAt = 0;
  renderViewer(now);
  renderDerived(now);
});

document.documentElement.dataset.motionPolish = 'smooth-scale-aware-flow';
renderViewer(performance.now());
renderDerived(performance.now());
frameId = requestAnimationFrame(frame);
