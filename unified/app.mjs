import { calculateLegacySnapshot } from '../src/runtime.mjs';
import {
  formatElapsed,
  formatInteger,
  formatMoney,
  formatPerSecond,
  formatRatio,
} from '../src/format.mjs';
import { createActiveTimeTracker } from '../src/active-time.mjs';
import { readCandidateState, writeCandidateState } from './state.mjs';
import {
  applyLocalizationOverrides,
  hasLocalizationOverrideGroup,
} from './localization-overrides.mjs';

const DEFAULT_LANGUAGE = 'en';
const MODE_ORDER = ['year', '1year', '10years', 'lifetime', 'day', 'hour', 'minute', 'since1945'];
const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const LIVE_THROTTLE_MS = 80;
const MODE_EASE_MS = 1200;
const URL_SYNC_DELAY_MS = 250;

const elements = {
  eyebrow: document.querySelector('#eyebrow'),
  title: document.querySelector('#title'),
  lead: document.querySelector('#lead'),
  liveMetricLabel: document.querySelector('#liveMetricLabel'),
  liveRate: document.querySelector('#liveRate'),
  currentPeriod: document.querySelector('#currentPeriod'),
  languageLabel: document.querySelector('#languageLabel'),
  timeframeLabel: document.querySelector('#timeframeLabel'),
  birthYearLabel: document.querySelector('#birthYearLabel'),
  shareLabelText: document.querySelector('#shareLabelText'),
  scenarioTitle: document.querySelector('#scenarioTitle'),
  language: document.querySelector('#language'),
  mode: document.querySelector('#mode'),
  birthControl: document.querySelector('#birthControl'),
  birthYear: document.querySelector('#birthYear'),
  share: document.querySelector('#share'),
  shareLabel: document.querySelector('#shareLabel'),
  shareProgress: document.querySelector('#shareProgress'),
  scenarioChips: [...document.querySelectorAll('.pw-scenario-chip')],
  mainCounterValue: document.querySelector('#mainCounterValue'),
  mainCounterLabel: document.querySelector('#mainCounterLabel'),
  sessionMetricLabel: document.querySelector('#sessionMetricLabel'),
  viewerElapsed: document.querySelector('#viewerElapsed'),
  viewerSpend: document.querySelector('#viewerSpend'),
  viewerRedirected: document.querySelector('#viewerRedirected'),
  headlineMetrics: document.querySelector('#headlineMetrics'),
  opportunityTitle: document.querySelector('#opportunityTitle'),
  opportunityMetrics: document.querySelector('#opportunityMetrics'),
  methodMilitaryLabel: document.querySelector('#methodMilitaryLabel'),
  methodMilitaryValue: document.querySelector('#methodMilitaryValue'),
  methodDeathsLabel: document.querySelector('#methodDeathsLabel'),
  methodDeathsValue: document.querySelector('#methodDeathsValue'),
  legacyLink: document.querySelector('#legacyLink'),
  legacyNote: document.querySelector('#legacyNote'),
  debug: document.querySelector('#debug'),
};

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then(requireJson),
  fetch('../data/model.json', { cache: 'no-store' }).then(requireJson),
]);

const languages = manifest.languages;
const model = modelDocument.values;
const perSecond = model.annualMilitarySpend / REFERENCE_SECONDS_PER_YEAR;
const activeViewing = createActiveTimeTracker({ initiallyActive: !document.hidden });

let currentLocale = null;
let currentLanguage = DEFAULT_LANGUAGE;
let animationFrameId = null;
let lastLiveRenderAt = 0;
let urlSyncTimer = null;
let lastSnapshot = null;
let lastDisplayedValues = null;
let modeTransition = null;
const cardOutputs = new Map();

function requireJson(response) {
  if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
  return response.json();
}

function setText(element, value) {
  if (!element) return;
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function resolveBrowserLanguage() {
  const browser = (navigator.language || '').toLowerCase();
  const direct = Object.keys(languages).find((key) => key.toLowerCase() === browser);
  if (direct) return direct;
  const base = browser.split('-')[0];
  const byBase = Object.entries(languages).find(([, meta]) => meta.htmlLang.toLowerCase().split('-')[0] === base);
  return byBase ? byBase[0] : DEFAULT_LANGUAGE;
}

const initialState = readCandidateState(
  location.search,
  Object.keys(languages),
  resolveBrowserLanguage(),
);
currentLanguage = initialState.language;
elements.share.value = initialState.share;
elements.birthYear.value = initialState.birthYear;

function currentMeta() {
  return languages[currentLanguage];
}

function populateLanguages() {
  elements.language.replaceChildren();
  for (const [key, meta] of Object.entries(languages)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = meta.displayName;
    elements.language.append(option);
  }
  elements.language.value = currentLanguage;
}

async function loadLocale(language, requestedMode = elements.mode.value || initialState.mode) {
  const meta = languages[language];
  if (!meta) throw new RangeError(`Unsupported language: ${language}`);

  let locale = {};
  const response = await fetch(`./locales/${language}.json`, { cache: 'no-store' });
  if (response.ok) {
    locale = await response.json();
  } else if (!hasLocalizationOverrideGroup(language, 'locale_runtime')) {
    throw new Error(`${response.url}: HTTP ${response.status}`);
  }
  locale = applyLocalizationOverrides(language, 'locale_runtime', locale);
  validateLocale(locale, language);

  currentLanguage = language;
  currentLocale = locale;
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dir = meta.dir;
  document.title = locale.pageTitle;
  elements.language.value = language;

  applyStaticCopy();
  populateModes(requestedMode);
  buildCards();
  modeTransition = null;
  renderNow();
  queueUrlSync();
}

function validateLocale(locale, language) {
  const required = ['pageTitle', 'eyebrow', 'title', 'lead', 'language', 'timeframe', 'birthYear', 'redirectedShare', 'opportunityTitle', 'legacyLink', 'legacyNote', 'metrics', 'modes'];
  for (const key of required) {
    if (!Object.hasOwn(locale, key)) throw new Error(`${language}.json missing ${key}`);
  }
  for (const mode of MODE_ORDER) {
    if (!locale.modes[mode]) throw new Error(`${language}.json missing modes.${mode}`);
  }
  const formatting = languages[language]?.formatting;
  if (!formatting?.numberLocale || !formatting?.units?.trillion || !formatting?.units?.billion || !formatting?.units?.million) {
    throw new Error(`manifest formatting profile incomplete for ${language}`);
  }
}

function applyStaticCopy() {
  const t = currentLocale;
  setText(elements.eyebrow, t.eyebrow);
  setText(elements.title, t.title);
  setText(elements.lead, t.lead);
  setText(elements.languageLabel, t.language);
  setText(elements.timeframeLabel, t.timeframe);
  setText(elements.birthYearLabel, t.birthYear);
  setText(elements.shareLabelText, t.redirectedShare);
  setText(elements.scenarioTitle, t.redirectedShare);
  setText(elements.opportunityTitle, t.opportunityTitle);
  setText(elements.liveMetricLabel, t.metrics.militarySpend);
  setText(elements.mainCounterLabel, t.metrics.militarySpend);
  setText(elements.sessionMetricLabel, t.metrics.militarySpend);
  setText(elements.methodMilitaryLabel, t.metrics.militarySpend);
  setText(elements.methodDeathsLabel, t.metrics.directDeaths);
  setText(elements.legacyLink, t.legacyLink);
  elements.legacyLink.href = `../parity/${currentLanguage}/`;
  setText(elements.legacyNote, t.legacyNote);
}

function populateModes(requestedMode = 'year') {
  const previous = MODE_ORDER.includes(requestedMode) ? requestedMode : 'year';
  elements.mode.replaceChildren();
  for (const mode of MODE_ORDER) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = currentLocale.modes[mode];
    elements.mode.append(option);
  }
  elements.mode.value = previous;
}

const formulaInfo = {
  directDeaths: 'annualDirectDeaths × selected period',
  indirectDeaths: 'directDeaths × indirectMultiplier',
  lifeYearsLost: '(directDeaths + indirectDeaths) × avgYearsLostPerDeath',
  infrastructureDamage: 'annualInfraDamage × selected period',
  economicSetback: 'militarySpend + infrastructureDamage + deaths × economicValuePerDeath',
  redirectedAmount: 'militarySpend × selected share',
  schoolsEquivalent: 'redirectedAmount ÷ schoolCost',
  educationMultiples: 'redirectedAmount ÷ educationCost',
  healthMultiples: 'redirectedAmount ÷ healthCost',
};

function closeInfoPopovers(except = null) {
  for (const popover of document.querySelectorAll('.pw-card-popover:not([hidden])')) {
    if (popover !== except) popover.hidden = true;
  }
  for (const button of document.querySelectorAll('.pw-info-button[aria-expanded="true"]')) {
    if (!except || button.nextElementSibling !== except) button.setAttribute('aria-expanded', 'false');
  }
}

function metricCard(key, label, kind = 'money') {
  const article = document.createElement('article');
  article.className = 'pw-card pw-glow';
  article.dataset.kind = kind;
  article.dataset.metric = key;

  const head = document.createElement('div');
  head.className = 'pw-card-head';
  const name = document.createElement('span');
  name.className = 'pw-card-label';
  name.textContent = label;
  head.append(name);

  const info = formulaInfo[key];
  if (info) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-info-button';
    button.textContent = 'i';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', 'false');

    const popover = document.createElement('div');
    popover.className = 'pw-card-popover';
    popover.hidden = true;
    const strong = document.createElement('strong');
    strong.textContent = label;
    const code = document.createElement('code');
    code.textContent = info;
    popover.append(strong, code);

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = popover.hidden;
      closeInfoPopovers(open ? popover : null);
      popover.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    });
    popover.addEventListener('click', (event) => event.stopPropagation());
    head.append(button, popover);
  }

  const output = document.createElement('div');
  output.className = 'pw-card-value';
  output.textContent = '—';
  cardOutputs.set(key, output);
  article.append(head, output);
  return article;
}

function buildCards() {
  cardOutputs.clear();
  closeInfoPopovers();
  const t = currentLocale.metrics;

  elements.headlineMetrics.replaceChildren(
    metricCard('directDeaths', t.directDeaths, 'danger-direct'),
    metricCard('indirectDeaths', t.indirectDeaths, 'danger-indirect'),
    metricCard('lifeYearsLost', t.lifeYearsLost, 'neutral'),
    metricCard('infrastructureDamage', t.infrastructureDamage, 'neutral'),
    metricCard('economicSetback', t.economicSetback, 'neutral'),
  );

  elements.opportunityMetrics.replaceChildren(
    metricCard('redirectedAmount', t.redirectedAmount, 'peace'),
    metricCard('schoolsEquivalent', t.schoolsEquivalent, 'peace'),
    metricCard('educationMultiples', t.educationMultiples, 'peace'),
    metricCard('healthMultiples', t.healthMultiples, 'peace'),
  );
  installGlowTracking();
}

function currentState(snapshot = lastSnapshot || calculateSnapshot()) {
  return {
    language: currentLanguage,
    mode: snapshot.period.mode,
    birthYear: elements.birthYear.value,
    share: snapshot.sharePercent,
  };
}

function syncUrl() {
  if (!currentLocale) return;
  const next = writeCandidateState(location.href, currentState());
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next !== current) history.replaceState(null, '', next);
}

function queueUrlSync() {
  if (urlSyncTimer !== null) window.clearTimeout(urlSyncTimer);
  urlSyncTimer = window.setTimeout(() => {
    urlSyncTimer = null;
    syncUrl();
  }, URL_SYNC_DELAY_MS);
}

function calculateSnapshot(now = new Date()) {
  return calculateLegacySnapshot({
    model,
    mode: elements.mode.value || 'year',
    birthYear: elements.birthYear.value,
    sharePercent: elements.share.value,
    now,
  });
}

function shareProgressPercent(sharePercent) {
  const min = Number(elements.share.min) || 5;
  const max = Number(elements.share.max) || 50;
  return ((sharePercent - min) / (max - min)) * 100;
}

function updateScenarioControls(snapshot) {
  setText(elements.shareLabel, `${snapshot.sharePercent}%`);
  elements.shareProgress.style.width = `${Math.max(0, Math.min(100, shareProgressPercent(snapshot.sharePercent)))}%`;
  elements.share.style.setProperty('--rangeFill', `${Math.max(0, Math.min(100, shareProgressPercent(snapshot.sharePercent)))}%`);
  for (const chip of elements.scenarioChips) {
    const active = Number(chip.dataset.share) === snapshot.sharePercent;
    chip.classList.toggle('pw-active', active);
    chip.setAttribute('aria-pressed', String(active));
  }
}

function valuesFromSnapshot(snapshot) {
  return {
    militarySpend: snapshot.totals.militarySpend,
    directDeaths: snapshot.totals.directDeaths,
    indirectDeaths: snapshot.totals.indirectDeaths,
    lifeYearsLost: snapshot.totals.lifeYearsLost,
    infrastructureDamage: snapshot.totals.infrastructureDamage,
    economicSetback: snapshot.totals.economicSetback,
    redirectedAmount: snapshot.opportunityCosts.redirected,
    schoolsEquivalent: snapshot.opportunityCosts.schools,
    educationMultiples: snapshot.opportunityCosts.education,
    healthMultiples: snapshot.opportunityCosts.health,
  };
}

function interpolateValues(from, to, amount) {
  const result = {};
  for (const [key, target] of Object.entries(to)) {
    const start = Number(from?.[key]);
    result[key] = Number.isFinite(start) ? start + (target - start) * amount : target;
  }
  return result;
}

function displayValues(targetValues, frameTime) {
  if (!modeTransition) return targetValues;
  const progress = Math.max(0, Math.min(1, (frameTime - modeTransition.startedAt) / MODE_EASE_MS));
  const eased = 1 - Math.pow(1 - progress, 5);
  const values = interpolateValues(modeTransition.from, targetValues, eased);
  if (progress >= 1) modeTransition = null;
  return values;
}

function updateCardValues(values) {
  const meta = currentMeta();
  setText(cardOutputs.get('directDeaths'), formatInteger(values.directDeaths, meta));
  setText(cardOutputs.get('indirectDeaths'), formatInteger(values.indirectDeaths, meta));
  setText(cardOutputs.get('lifeYearsLost'), formatInteger(values.lifeYearsLost, meta));
  setText(cardOutputs.get('infrastructureDamage'), formatMoney(values.infrastructureDamage, meta));
  setText(cardOutputs.get('economicSetback'), formatMoney(values.economicSetback, meta, { short: true }));
  setText(cardOutputs.get('redirectedAmount'), formatMoney(values.redirectedAmount, meta));
  setText(cardOutputs.get('schoolsEquivalent'), formatInteger(values.schoolsEquivalent, meta));
  setText(cardOutputs.get('educationMultiples'), formatRatio(values.educationMultiples, meta));
  setText(cardOutputs.get('healthMultiples'), formatRatio(values.healthMultiples, meta));
}

function updateDynamicValues(now = new Date(), frameTime = performance.now()) {
  if (!currentLocale) return null;

  const snapshot = calculateSnapshot(now);
  lastSnapshot = snapshot;
  const target = valuesFromSnapshot(snapshot);
  const displayed = displayValues(target, frameTime);
  lastDisplayedValues = displayed;
  const meta = currentMeta();

  document.documentElement.classList.toggle('pw-is-live', snapshot.period.mode === 'year');
  setText(elements.currentPeriod, currentLocale.modes[snapshot.period.mode]);
  setText(elements.mainCounterValue, formatMoney(displayed.militarySpend, meta));
  setText(elements.liveRate, formatPerSecond(perSecond, meta));
  updateCardValues(displayed);

  const activeSeconds = activeViewing.elapsedSeconds(frameTime);
  const sessionSpend = perSecond * activeSeconds;
  const sessionRedirected = sessionSpend * (snapshot.sharePercent / 100);
  setText(elements.viewerElapsed, formatElapsed(activeSeconds));
  setText(elements.viewerSpend, formatMoney(sessionSpend, meta));
  setText(elements.viewerRedirected, `${snapshot.sharePercent}% → ${formatMoney(sessionRedirected, meta)}`);

  const lifetime = snapshot.period.mode === 'lifetime';
  elements.birthControl.hidden = !lifetime;
  elements.birthYear.disabled = !lifetime;
  updateScenarioControls(snapshot);
  return snapshot;
}

function updateStaticDiagnostics(snapshot) {
  const meta = currentMeta();
  setText(elements.methodMilitaryValue, formatMoney(model.annualMilitarySpend, meta));
  setText(elements.methodDeathsValue, formatInteger(model.annualDirectDeaths, meta));

  elements.debug.textContent = [
    `candidate: unified-v0.4-sprint-a`,
    `language: ${currentLanguage} (${meta.intlLocale}, ${meta.dir})`,
    `format number locale: ${meta.formatting.numberLocale}`,
    `template: unified/index.html`,
    `css: unified/app.css`,
    `js: unified/app.mjs`,
    `state: unified/state.mjs`,
    `locale: unified/locales/${currentLanguage}.json + approved sheet overrides`,
    `data: data/model.json schemaVersion=${modelDocument.schemaVersion}`,
    `runtime: src/runtime.mjs`,
    `formatter: src/format.mjs`,
    `active clock: src/active-time.mjs`,
    `live throttle: ${LIVE_THROTTLE_MS}ms`,
    `mode ease: ${MODE_EASE_MS}ms`,
    `seconds/year for live rate: ${REFERENCE_SECONDS_PER_YEAR}`,
    `mode: ${snapshot.period.mode}`,
    `annual fraction: ${snapshot.period.fraction}`,
    `session clock: active-visible-time only`,
    `production files changed: 0`,
  ].join('\n');
}

function renderNow({ updateDiagnostics = true } = {}) {
  if (!currentLocale) return;
  const frameTime = performance.now();
  const snapshot = updateDynamicValues(new Date(), frameTime);
  if (updateDiagnostics && snapshot) updateStaticDiagnostics(snapshot);
}

function startModeTransition() {
  modeTransition = {
    startedAt: performance.now(),
    from: { ...(lastDisplayedValues || valuesFromSnapshot(lastSnapshot || calculateSnapshot())) },
  };
}

function installGlowTracking() {
  for (const surface of document.querySelectorAll('.pw-glow:not([data-glow-ready])')) {
    surface.dataset.glowReady = 'true';
    surface.addEventListener('pointermove', (event) => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
      surface.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    });
  }
}

function ensureLiveLoop() {
  if (animationFrameId !== null || document.hidden) return;
  animationFrameId = window.requestAnimationFrame(liveFrame);
}

function liveFrame(frameTime) {
  animationFrameId = null;
  if (document.hidden) return;

  if (frameTime - lastLiveRenderAt >= LIVE_THROTTLE_MS) {
    updateDynamicValues(new Date(), frameTime);
    lastLiveRenderAt = frameTime;
  }
  ensureLiveLoop();
}

function handleVisibilityChange() {
  const frameTime = performance.now();
  activeViewing.setActive(!document.hidden, frameTime);

  if (document.hidden) {
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    return;
  }

  lastLiveRenderAt = 0;
  renderNow({ updateDiagnostics: false });
  ensureLiveLoop();
}

elements.language.addEventListener('change', () => loadLocale(elements.language.value, elements.mode.value));
elements.mode.addEventListener('change', () => {
  startModeTransition();
  renderNow();
  queueUrlSync();
});
elements.birthYear.addEventListener('input', () => {
  modeTransition = null;
  renderNow();
  queueUrlSync();
});
elements.birthYear.addEventListener('change', () => {
  modeTransition = null;
  renderNow();
  queueUrlSync();
});
elements.share.addEventListener('input', () => {
  modeTransition = null;
  renderNow({ updateDiagnostics: false });
  queueUrlSync();
});
elements.share.addEventListener('change', () => {
  renderNow();
  queueUrlSync();
});
for (const chip of elements.scenarioChips) {
  chip.addEventListener('click', () => {
    elements.share.value = chip.dataset.share;
    modeTransition = null;
    renderNow();
    queueUrlSync();
  });
}
document.addEventListener('visibilitychange', handleVisibilityChange);
document.addEventListener('click', () => closeInfoPopovers());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeInfoPopovers();
});

populateLanguages();
await loadLocale(currentLanguage, initialState.mode);
installGlowTracking();
ensureLiveLoop();
