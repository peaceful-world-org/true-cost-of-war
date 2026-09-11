// UX-only presentation layer for the first-screen live counters.
//
// This deliberately mirrors the original calculator's behaviour: values are
// sampled at an 80 ms cadence, the whole number element never moves, and the
// displayed precision decreases as the session total grows. That keeps the
// early counter visibly alive without making million-scale values flicker.

import { formatInteger, formattingProfile } from '../src/format.mjs';

const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const LIVE_CADENCE_MS = 80;
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
let lastPaintAt = 0;

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

// Exact display strategy of the original short money formatter:
//   < $1m   -> whole dollars
//   $1m+    -> whole millions
//   $1b+    -> 1-2 decimals
//   $1t+    -> 1 decimal
// The arithmetic remains continuous; only visible precision is reduced as the
// number grows, which is what prevents the million-range counter from flashing.
function formatLegacyLiveMoney(value, meta) {
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
    minimumFractionDigits = 1;
    maximumFractionDigits = 1;
  } else if (absolute >= 1e9) {
    scaled = absolute / 1e9;
    unit = profile.units.billion;
    minimumFractionDigits = 1;
    maximumFractionDigits = 2;
  } else if (absolute >= 1e6) {
    scaled = absolute / 1e6;
    unit = profile.units.million;
    maximumFractionDigits = 0;
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

function renderLive(now = performance.now()) {
  const seconds = elapsedActiveMs(now) / 1000;
  const spend = perSecond * seconds;
  const meta = currentMeta();

  writeOwned(viewerSpend, formatLegacyLiveMoney(spend, meta));
  writeOwned(sessionFood, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.food), meta));
  writeOwned(sessionHealth, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.health), meta));
  writeOwned(sessionPoverty, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.poverty), meta));
}

function frame(now) {
  frameId = null;
  if (!document.hidden && now - lastPaintAt >= LIVE_CADENCE_MS) {
    renderLive(now);
    lastPaintAt = now;
  }
  frameId = requestAnimationFrame(frame);
}

// app.mjs also computes canonical session state. If its formatter writes to one
// of these presentation nodes, restore the legacy-style representation before
// the browser paints the intermediate value.
const observer = new MutationObserver(() => {
  const overwritten = ownedNodes.some((node) => node.textContent !== lastRendered.get(node));
  if (overwritten && !document.hidden) renderLive(performance.now());
});
for (const node of ownedNodes) {
  node.classList.add('pw-flow-value');
  observer.observe(node, { childList: true, characterData: true, subtree: true });
}

document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  setActive(!document.hidden, now);
  lastPaintAt = 0;
  if (!document.hidden) renderLive(now);
});

const language = document.querySelector('#language');
language?.addEventListener('change', () => {
  lastPaintAt = 0;
  renderLive(performance.now());
});

document.documentElement.dataset.motionPolish = 'legacy-live-cadence';
renderLive(performance.now());
frameId = requestAnimationFrame(frame);
