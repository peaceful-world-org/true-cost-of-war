import { calculateLegacySnapshot } from '../src/runtime.mjs';
import { readCandidateState, writeCandidateState } from './state.mjs';

const DEFAULT_LANGUAGE = 'en';
const MODE_ORDER = ['year', '1year', '10years', 'lifetime', 'day', 'hour', 'minute', 'since1945'];
const SECONDS_PER_365_DAY_YEAR = 365 * 24 * 60 * 60;
const SESSION_STARTED_AT = Date.now();

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
const perSecond = model.annualMilitarySpend / SECONDS_PER_365_DAY_YEAR;
let currentLocale = null;
let currentLanguage = DEFAULT_LANGUAGE;
let liveTimer = null;
let lastSnapshot = null;

function requireJson(response) {
  if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
  return response.json();
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
  const locale = await fetch(`./locales/${language}.json`, { cache: 'no-store' }).then(requireJson);
  validateLocale(locale, language);
  currentLanguage = language;
  currentLocale = locale;
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dir = meta.dir;
  document.title = locale.pageTitle;
  elements.language.value = language;
  applyStaticCopy();
  populateModes(requestedMode);
  renderAll();
}

function validateLocale(locale, language) {
  const required = ['pageTitle', 'eyebrow', 'title', 'lead', 'language', 'timeframe', 'birthYear', 'redirectedShare', 'opportunityTitle', 'legacyLink', 'legacyNote', 'metrics', 'modes'];
  for (const key of required) {
    if (!Object.hasOwn(locale, key)) throw new Error(`${language}.json missing ${key}`);
  }
  for (const mode of MODE_ORDER) {
    if (!locale.modes[mode]) throw new Error(`${language}.json missing modes.${mode}`);
  }
}

function applyStaticCopy() {
  const t = currentLocale;
  elements.eyebrow.textContent = t.eyebrow;
  elements.title.textContent = t.title;
  elements.lead.textContent = t.lead;
  elements.languageLabel.textContent = t.language;
  elements.timeframeLabel.textContent = t.timeframe;
  elements.birthYearLabel.textContent = t.birthYear;
  elements.shareLabelText.textContent = t.redirectedShare;
  elements.scenarioTitle.textContent = t.redirectedShare;
  elements.opportunityTitle.textContent = t.opportunityTitle;
  elements.liveMetricLabel.textContent = t.metrics.militarySpend;
  elements.mainCounterLabel.textContent = t.metrics.militarySpend;
  elements.sessionMetricLabel.textContent = t.metrics.militarySpend;
  elements.methodMilitaryLabel.textContent = t.metrics.militarySpend;
  elements.methodDeathsLabel.textContent = t.metrics.directDeaths;
  elements.legacyLink.textContent = t.legacyLink;
  elements.legacyLink.href = `../parity/${currentLanguage}/`;
  elements.legacyNote.textContent = t.legacyNote;
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

function formatters() {
  const meta = languages[currentLanguage];
  return {
    money: new Intl.NumberFormat(meta.intlLocale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    compactMoney: new Intl.NumberFormat(meta.intlLocale, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 3 }),
    number: new Intl.NumberFormat(meta.intlLocale, { maximumFractionDigits: 0 }),
    ratio: new Intl.NumberFormat(meta.intlLocale, { maximumFractionDigits: 2 }),
  };
}

const formulaInfo = {
  direct: 'annualDirectDeaths × selected period',
  indirect: 'directDeaths × indirectMultiplier',
  life: '(directDeaths + indirectDeaths) × avgYearsLostPerDeath',
  infra: 'annualInfraDamage × selected period',
  econ: 'militarySpend + infrastructureDamage + deaths × economicValuePerDeath',
  redirected: 'militarySpend × selected share',
  schools: 'redirectedAmount ÷ schoolCost',
  education: 'redirectedAmount ÷ educationCost',
  health: 'redirectedAmount ÷ healthCost',
};

function closeInfoPopovers(except = null) {
  for (const popover of document.querySelectorAll('.pw-card-popover:not([hidden])')) {
    if (popover !== except) popover.hidden = true;
  }
  for (const button of document.querySelectorAll('.pw-info-button[aria-expanded="true"]')) {
    if (!except || button.nextElementSibling !== except) button.setAttribute('aria-expanded', 'false');
  }
}

function metricCard(label, value, kind = 'money', info = null) {
  const article = document.createElement('article');
  article.className = 'pw-card pw-glow';
  article.dataset.kind = kind;

  const head = document.createElement('div');
  head.className = 'pw-card-head';
  const name = document.createElement('span');
  name.className = 'pw-card-label';
  name.textContent = label;
  head.append(name);

  if (info) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-info-button';
    button.textContent = 'i';
    button.setAttribute('aria-label', `${label}: formula`);
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
  output.textContent = value;
  article.append(head, output);
  return article;
}

function currentState(snapshot) {
  return {
    language: currentLanguage,
    mode: snapshot.period.mode,
    birthYear: elements.birthYear.value,
    share: snapshot.sharePercent,
  };
}

function syncUrl(snapshot) {
  const next = writeCandidateState(location.href, currentState(snapshot));
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next !== current) history.replaceState(null, '', next);
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
  elements.shareLabel.textContent = `${snapshot.sharePercent}%`;
  elements.shareProgress.style.width = `${Math.max(0, Math.min(100, shareProgressPercent(snapshot.sharePercent)))}%`;
  for (const chip of elements.scenarioChips) {
    const active = Number(chip.dataset.share) === snapshot.sharePercent;
    chip.classList.toggle('pw-active', active);
    chip.setAttribute('aria-pressed', String(active));
  }
}

function renderCards(snapshot) {
  const fmt = formatters();
  const t = currentLocale.metrics;

  elements.headlineMetrics.replaceChildren(
    metricCard(t.directDeaths, fmt.number.format(snapshot.totals.directDeaths), 'danger', formulaInfo.direct),
    metricCard(t.indirectDeaths, fmt.number.format(snapshot.totals.indirectDeaths), 'danger', formulaInfo.indirect),
    metricCard(t.lifeYearsLost, fmt.number.format(snapshot.totals.lifeYearsLost), 'danger', formulaInfo.life),
    metricCard(t.infrastructureDamage, fmt.compactMoney.format(snapshot.totals.infrastructureDamage), 'gold', formulaInfo.infra),
    metricCard(t.economicSetback, fmt.compactMoney.format(snapshot.totals.economicSetback), 'gold', formulaInfo.econ),
  );

  elements.opportunityMetrics.replaceChildren(
    metricCard(t.redirectedAmount, fmt.compactMoney.format(snapshot.opportunityCosts.redirected), 'peace', formulaInfo.redirected),
    metricCard(t.schoolsEquivalent, fmt.number.format(snapshot.opportunityCosts.schools), 'peace', formulaInfo.schools),
    metricCard(t.educationMultiples, fmt.ratio.format(snapshot.opportunityCosts.education), 'peace', formulaInfo.education),
    metricCard(t.healthMultiples, fmt.ratio.format(snapshot.opportunityCosts.health), 'peace', formulaInfo.health),
  );
  installGlowTracking();
}

function updateDynamicValues(now = new Date()) {
  if (!currentLocale) return;
  const snapshot = calculateSnapshot(now);
  lastSnapshot = snapshot;
  const fmt = formatters();

  elements.currentPeriod.textContent = currentLocale.modes[snapshot.period.mode];
  elements.mainCounterValue.textContent = fmt.compactMoney.format(snapshot.totals.militarySpend);
  elements.liveRate.textContent = `${fmt.money.format(perSecond)}/s`;

  const elapsedSeconds = Math.max(0, (Date.now() - SESSION_STARTED_AT) / 1000);
  const sessionSpend = perSecond * elapsedSeconds;
  const sessionRedirected = sessionSpend * (snapshot.sharePercent / 100);
  const elapsedWholeSeconds = Math.floor(elapsedSeconds);
  const minutes = Math.floor(elapsedWholeSeconds / 60);
  const seconds = elapsedWholeSeconds % 60;
  elements.viewerElapsed.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  elements.viewerSpend.textContent = fmt.money.format(sessionSpend);
  elements.viewerRedirected.textContent = `${snapshot.sharePercent}% → ${fmt.money.format(sessionRedirected)}`;

  if (snapshot.period.mode === 'lifetime') {
    elements.birthControl.hidden = false;
    elements.birthYear.disabled = false;
  } else {
    elements.birthControl.hidden = true;
    elements.birthYear.disabled = true;
  }
  updateScenarioControls(snapshot);
  return snapshot;
}

function renderAll() {
  if (!currentLocale) return;
  const snapshot = updateDynamicValues(new Date());
  renderCards(snapshot);
  const fmt = formatters();

  elements.methodMilitaryValue.textContent = `${fmt.compactMoney.format(model.annualMilitarySpend)} / year`;
  elements.methodDeathsValue.textContent = `${fmt.number.format(model.annualDirectDeaths)} / year`;

  elements.debug.textContent = [
    `candidate: unified-v0.3`,
    `language: ${currentLanguage} (${languages[currentLanguage].intlLocale}, ${languages[currentLanguage].dir})`,
    `template: unified/index.html`,
    `css: unified/app.css`,
    `js: unified/app.mjs`,
    `state: unified/state.mjs`,
    `locale: unified/locales/${currentLanguage}.json`,
    `data: data/model.json schemaVersion=${modelDocument.schemaVersion}`,
    `runtime: src/runtime.mjs`,
    `engine: src/legacy-engine.mjs`,
    `interaction parity: hero counter + session counter + scenario slider/chips + metric info popovers`,
    `mode: ${snapshot.period.mode}`,
    `annual fraction: ${snapshot.period.fraction}`,
    `preview URL state: lang + mode + share + birth`,
    `v2 research candidate connected: no`,
    `production files changed: 0`,
  ].join('\n');

  syncUrl(snapshot);
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

function scheduleLiveUpdates() {
  if (liveTimer !== null) clearInterval(liveTimer);
  liveTimer = null;
  if (document.hidden) return;
  liveTimer = window.setInterval(() => updateDynamicValues(new Date()), 250);
}

elements.language.addEventListener('change', () => loadLocale(elements.language.value, elements.mode.value));
elements.mode.addEventListener('change', renderAll);
elements.birthYear.addEventListener('input', renderAll);
elements.birthYear.addEventListener('change', renderAll);
elements.share.addEventListener('input', renderAll);
elements.share.addEventListener('change', renderAll);
for (const chip of elements.scenarioChips) {
  chip.addEventListener('click', () => {
    elements.share.value = chip.dataset.share;
    renderAll();
  });
}
document.addEventListener('visibilitychange', scheduleLiveUpdates);
document.addEventListener('click', () => closeInfoPopovers());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeInfoPopovers();
});

populateLanguages();
await loadLocale(currentLanguage, initialState.mode);
installGlowTracking();
scheduleLiveUpdates();
