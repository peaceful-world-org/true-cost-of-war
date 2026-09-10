import { calculateLegacySnapshot } from '../src/runtime.mjs';

const DEFAULT_LANGUAGE = 'en';
const MODE_ORDER = ['year', '1year', '10years', 'lifetime', 'day', 'hour', 'minute', 'since1945'];

const elements = {
  eyebrow: document.querySelector('#eyebrow'),
  title: document.querySelector('#title'),
  lead: document.querySelector('#lead'),
  languageLabel: document.querySelector('#languageLabel'),
  timeframeLabel: document.querySelector('#timeframeLabel'),
  birthYearLabel: document.querySelector('#birthYearLabel'),
  shareLabelText: document.querySelector('#shareLabelText'),
  language: document.querySelector('#language'),
  mode: document.querySelector('#mode'),
  birthYear: document.querySelector('#birthYear'),
  share: document.querySelector('#share'),
  shareLabel: document.querySelector('#shareLabel'),
  headlineMetrics: document.querySelector('#headlineMetrics'),
  opportunityTitle: document.querySelector('#opportunityTitle'),
  opportunityMetrics: document.querySelector('#opportunityMetrics'),
  redirectedPill: document.querySelector('#redirectedPill'),
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
let currentLocale = null;
let currentLanguage = resolveInitialLanguage();

function requireJson(response) {
  if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
  return response.json();
}

function resolveInitialLanguage() {
  const requested = new URLSearchParams(location.search).get('lang');
  if (requested && Object.hasOwn(languages, requested)) return requested;
  const browser = (navigator.language || '').toLowerCase();
  const direct = Object.keys(languages).find((key) => key.toLowerCase() === browser);
  if (direct) return direct;
  const base = browser.split('-')[0];
  const byBase = Object.entries(languages).find(([, meta]) => meta.htmlLang.toLowerCase().split('-')[0] === base);
  return byBase ? byBase[0] : DEFAULT_LANGUAGE;
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

async function loadLocale(language) {
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
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  applyStaticCopy();
  populateModes();
  render();
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
  elements.opportunityTitle.textContent = t.opportunityTitle;
  elements.legacyLink.textContent = t.legacyLink;
  elements.legacyLink.href = `../parity/${currentLanguage}/`;
  elements.legacyNote.textContent = t.legacyNote;
}

function populateModes() {
  const previous = elements.mode.value || 'year';
  elements.mode.replaceChildren();
  for (const mode of MODE_ORDER) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = currentLocale.modes[mode];
    elements.mode.append(option);
  }
  elements.mode.value = MODE_ORDER.includes(previous) ? previous : 'year';
}

function formatters() {
  const meta = languages[currentLanguage];
  return {
    money: new Intl.NumberFormat(meta.intlLocale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    number: new Intl.NumberFormat(meta.intlLocale, { maximumFractionDigits: 0 }),
    ratio: new Intl.NumberFormat(meta.intlLocale, { maximumFractionDigits: 2 }),
  };
}

function metricCard(label, value, kind = 'money') {
  const article = document.createElement('article');
  article.className = 'pw-card';
  article.dataset.kind = kind;
  const name = document.createElement('span');
  name.className = 'pw-card-label';
  name.textContent = label;
  const output = document.createElement('div');
  output.className = 'pw-card-value';
  output.textContent = value;
  article.append(name, output);
  return article;
}

function render() {
  if (!currentLocale) return;
  const snapshot = calculateLegacySnapshot({
    model,
    mode: elements.mode.value || 'year',
    birthYear: elements.birthYear.value,
    sharePercent: elements.share.value,
    now: new Date(),
  });
  const fmt = formatters();
  const t = currentLocale.metrics;

  elements.birthYear.disabled = snapshot.period.mode !== 'lifetime';
  elements.shareLabel.textContent = `${snapshot.sharePercent}%`;
  elements.redirectedPill.textContent = `${snapshot.sharePercent}%`;

  elements.headlineMetrics.replaceChildren(
    metricCard(t.militarySpend, fmt.money.format(snapshot.totals.militarySpend), 'money'),
    metricCard(t.directDeaths, fmt.number.format(snapshot.totals.directDeaths), 'danger'),
    metricCard(t.indirectDeaths, fmt.number.format(snapshot.totals.indirectDeaths), 'danger'),
    metricCard(t.lifeYearsLost, fmt.number.format(snapshot.totals.lifeYearsLost), 'danger'),
    metricCard(t.infrastructureDamage, fmt.money.format(snapshot.totals.infrastructureDamage), 'gold'),
    metricCard(t.economicSetback, fmt.money.format(snapshot.totals.economicSetback), 'gold'),
  );

  elements.opportunityMetrics.replaceChildren(
    metricCard(t.redirectedAmount, fmt.money.format(snapshot.opportunityCosts.redirected), 'peace'),
    metricCard(t.schoolsEquivalent, fmt.number.format(snapshot.opportunityCosts.schools), 'peace'),
    metricCard(t.educationMultiples, fmt.ratio.format(snapshot.opportunityCosts.education), 'peace'),
    metricCard(t.healthMultiples, fmt.ratio.format(snapshot.opportunityCosts.health), 'peace'),
  );

  elements.debug.textContent = [
    `candidate: unified-v0.1`,
    `language: ${currentLanguage} (${languages[currentLanguage].intlLocale}, ${languages[currentLanguage].dir})`,
    `template: unified/index.html`,
    `css: unified/app.css`,
    `js: unified/app.mjs`,
    `locale: unified/locales/${currentLanguage}.json`,
    `data: data/model.json schemaVersion=${modelDocument.schemaVersion}`,
    `runtime: src/runtime.mjs`,
    `engine: src/legacy-engine.mjs`,
    `mode: ${snapshot.period.mode}`,
    `annual fraction: ${snapshot.period.fraction}`,
    `production files changed: 0`,
  ].join('\n');
}

elements.language.addEventListener('change', () => loadLocale(elements.language.value));
for (const element of [elements.mode, elements.birthYear, elements.share]) {
  element.addEventListener('input', render);
  element.addEventListener('change', render);
}

populateLanguages();
await loadLocale(currentLanguage);
