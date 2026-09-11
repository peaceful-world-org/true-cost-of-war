// UX-only presentation layer for genuinely smooth first-screen live counters.
//
// Important: do not animate the whole number element. The previous version
// translated each value on every text mutation, which made the counter visibly
// bounce. This layer now owns only the rapidly changing session values and
// renders their numeric progression directly on requestAnimationFrame.

import { formatInteger, formattingProfile } from '../src/format.mjs';

const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
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

function formatLiveSessionMoney(value, meta) {
  const profile = formattingProfile(meta);
  const original = Number.isFinite(Number(value)) ? Number(value) : 0;
  const absolute = Math.abs(original);
  let scaled = absolute;
  let unit = '';
  let decimals = 0;

  // Session totals normally live in the million range. Three fixed decimals
  // make the lowest visible place worth $1,000, so at the current global rate
  // the display can advance on essentially every 60 Hz frame without adding
  // fake motion. Higher ranges retain sensible compact notation for unusually
  // long sessions.
  if (absolute >= 1e12) {
    scaled = absolute / 1e12;
    unit = profile.units.trillion;
    decimals = 5;
  } else if (absolute >= 1e9) {
    scaled = absolute / 1e9;
    unit = profile.units.billion;
    decimals = 5;
  } else if (absolute >= 1e6) {
    scaled = absolute / 1e6;
    unit = profile.units.million;
    decimals = 3;
  }

  const number = scaled.toLocaleString(profile.numberLocale || 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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

  writeOwned(viewerSpend, formatLiveSessionMoney(spend, meta));
  writeOwned(sessionFood, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.food), meta));
  writeOwned(sessionHealth, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.health), meta));
  writeOwned(sessionPoverty, formatInteger(Math.floor(spend / SESSION_EQUIVALENTS.poverty), meta));
}

function frame(now) {
  frameId = null;
  if (!document.hidden) renderLive(now);
  frameId = requestAnimationFrame(frame);
}

// app.mjs still computes the canonical session state. If its coarser formatter
// writes into these presentation nodes, restore the smooth presentation in the
// same microtask checkpoint so the intermediate coarse value is not painted.
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
  if (!document.hidden) renderLive(now);
});

const language = document.querySelector('#language');
language?.addEventListener('change', () => renderLive(performance.now()));

document.documentElement.dataset.motionPolish = 'continuous-live';
renderLive(performance.now());
frameId = requestAnimationFrame(frame);
