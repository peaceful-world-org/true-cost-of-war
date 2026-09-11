import './app.mjs';
import { calculateLegacySnapshot } from '../src/runtime.mjs';
import { formatInteger, formatMoney, formatRatio } from '../src/format.mjs';
import { parityCopy } from './parity-b-copy.mjs';

const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const POPULATION_BASELINE = 8.1e9;
const SESSION_EQUIVALENTS = Object.freeze({ food: 62.5, health: 125, poverty: 1000 });
const PROGRAMME_COST_KEYS = Object.freeze({
  education: 'educationCost',
  hunger: 'hungerCost',
  health: 'healthCost',
  water: 'waterCost',
  electricity: 'electricityCost',
  internet: 'internetCost',
  climate: 'climateCost',
  schools: 'schoolCost',
});

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((r) => r.json()),
]);
const model = modelDocument.values;
const perSecond = model.annualMilitarySpend / REFERENCE_SECONDS_PER_YEAR;
const mobileQuery = window.matchMedia('(max-width: 600px)');
let programmesExpanded = false;

const controls = {
  language: document.querySelector('#language'),
  mode: document.querySelector('#mode'),
  birthYear: document.querySelector('#birthYear'),
  share: document.querySelector('#share'),
};

const el = {
  heroSubtitle: document.querySelector('#heroSubtitle'),
  liveFactPrefix: document.querySelector('#liveFactPrefix'),
  liveFactSuffix: document.querySelector('#liveFactSuffix'),
  lead: document.querySelector('#lead'),
  mainCounterCaption: document.querySelector('#mainCounterLabel'),
  sessionTitle: document.querySelector('#sessionTitle'),
  sessionNote: document.querySelector('#sessionNote'),
  sessionAlternatives: document.querySelector('#sessionAlternatives'),
  sessionFoodLabel: document.querySelector('#sessionFoodLabel'),
  sessionHealthLabel: document.querySelector('#sessionHealthLabel'),
  sessionPovertyLabel: document.querySelector('#sessionPovertyLabel'),
  sessionFood: document.querySelector('#sessionFood'),
  sessionHealth: document.querySelector('#sessionHealth'),
  sessionPoverty: document.querySelector('#sessionPoverty'),
  viewerElapsed: document.querySelector('#viewerElapsed'),
  personalBurdenLabel: document.querySelector('#personalBurdenLabel'),
  personalBurden: document.querySelector('#personalBurden'),
  personalBurdenDesc: document.querySelector('#personalBurdenDesc'),
  directLabel: document.querySelector('#directLabel'),
  directValue: document.querySelector('#directValue'),
  indirectLabel: document.querySelector('#indirectLabel'),
  indirectValue: document.querySelector('#indirectValue'),
  economicTitle: document.querySelector('#economicTitle'),
  economicIntro: document.querySelector('#economicIntro'),
  infrastructureLabel: document.querySelector('#infrastructureLabel'),
  infrastructureValue: document.querySelector('#infrastructureValue'),
  lifeYearsLabel: document.querySelector('#lifeYearsLabel'),
  lifeYearsValue: document.querySelector('#lifeYearsValue'),
  economicLossLabel: document.querySelector('#economicLossLabel'),
  economicLossValue: document.querySelector('#economicLossValue'),
  opportunityTitle: document.querySelector('#opportunityTitle'),
  opportunityIntro: document.querySelector('#opportunityIntro'),
  scenarioSpectrum: document.querySelector('#scenarioSpectrum'),
  developmentAllocationLabel: document.querySelector('#developmentAllocationLabel'),
  developmentAllocationValue: document.querySelector('#developmentAllocationValue'),
  developmentAllocationBar: document.querySelector('#developmentAllocationBar'),
  defenceAllocationLabel: document.querySelector('#defenceAllocationLabel'),
  defenceAllocationValue: document.querySelector('#defenceAllocationValue'),
  defenceAllocationBar: document.querySelector('#defenceAllocationBar'),
  programmes: document.querySelector('#programmes'),
  programmeToggle: document.querySelector('#programmeToggle'),
};

function languageKey() {
  return controls.language?.value || new URLSearchParams(location.search).get('lang') || 'en';
}

function meta() {
  return manifest.languages[languageKey()] || manifest.languages.en;
}

function copy() {
  return parityCopy(languageKey());
}

function setText(node, value) {
  if (node && node.textContent !== String(value)) node.textContent = String(value);
}

function elapsedSeconds() {
  const parts = (el.viewerElapsed?.textContent || '00:00').trim().split(':').map(Number);
  if (parts.some((value) => !Number.isFinite(value))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function snapshot() {
  return calculateLegacySnapshot({
    model,
    mode: controls.mode?.value || 'year',
    birthYear: controls.birthYear?.value || 1990,
    sharePercent: controls.share?.value || 10,
    now: new Date(),
  });
}

function renderStatic() {
  const t = copy();
  setText(el.heroSubtitle, t.subtitle);
  setText(el.liveFactPrefix, t.livePrefix);
  setText(el.liveFactSuffix, t.liveSuffix);
  setText(el.lead, t.lead);
  setText(el.mainCounterCaption, t.mainCaption);
  setText(el.sessionTitle, t.sessionTitle);
  setText(el.sessionNote, t.sessionNote);
  setText(el.sessionAlternatives, t.sessionAlternatives);
  setText(el.sessionFoodLabel, t.food);
  setText(el.sessionHealthLabel, t.health);
  setText(el.sessionPovertyLabel, t.poverty);
  setText(el.personalBurdenLabel, t.personalBurden);
  setText(el.personalBurdenDesc, t.personalBurdenDesc);
  setText(el.directLabel, t.directDeaths);
  setText(el.indirectLabel, t.indirectDeaths);
  setText(el.economicTitle, t.economicTitle);
  setText(el.economicIntro, t.economicIntro);
  setText(el.infrastructureLabel, t.infrastructure);
  setText(el.lifeYearsLabel, t.lifeYears);
  setText(el.economicLossLabel, t.economicLoss);
  setText(el.opportunityTitle, t.opportunityTitle);
  setText(el.opportunityIntro, t.opportunityIntro);
  setText(el.scenarioSpectrum, t.scenarioSpectrum);
  setText(el.developmentAllocationLabel, t.developmentAllocation);
  setText(el.defenceAllocationLabel, t.defenceAllocation);
  buildProgrammes();
  updateProgrammeVisibility();
}

function buildProgrammes() {
  if (!el.programmes) return;
  const t = copy();
  el.programmes.replaceChildren();
  t.programmes.forEach(([key, label], index) => {
    const row = document.createElement('article');
    row.className = 'pw-programme pw-glow';
    row.dataset.programme = key;
    if (index >= 3) row.dataset.mobileExtra = 'true';

    const content = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'pw-programme-name';
    name.textContent = label;
    const note = document.createElement('div');
    note.className = 'pw-programme-note';
    const costKey = PROGRAMME_COST_KEYS[key];
    const annualCost = model[costKey];
    note.textContent = languageKey() === 'ru'
      ? `Оценочная потребность: ${formatMoney(annualCost, meta())} / год`
      : `Reference annual need: ${formatMoney(annualCost, meta())}`;
    content.append(name, note);

    const value = document.createElement('div');
    value.className = 'pw-programme-value';
    value.dataset.programmeValue = key;
    value.textContent = '—';
    row.append(content, value);
    el.programmes.append(row);
  });
}

function updateProgrammeVisibility() {
  if (!el.programmes || !el.programmeToggle) return;
  const extras = [...el.programmes.querySelectorAll('[data-mobile-extra="true"]')];
  if (!mobileQuery.matches) {
    extras.forEach((row) => { row.hidden = false; });
    el.programmeToggle.hidden = true;
    el.programmeToggle.setAttribute('aria-expanded', 'true');
    return;
  }
  extras.forEach((row) => { row.hidden = !programmesExpanded; });
  el.programmeToggle.hidden = false;
  el.programmeToggle.setAttribute('aria-expanded', String(programmesExpanded));
  setText(el.programmeToggle, programmesExpanded ? copy().showLess : copy().showMore);
}

function renderDynamic() {
  const snap = snapshot();
  const m = meta();
  const t = copy();

  const active = elapsedSeconds();
  const sessionSpend = perSecond * active;
  setText(el.sessionFood, `${formatInteger(Math.floor(sessionSpend / SESSION_EQUIVALENTS.food), m)} ${t.people}`);
  setText(el.sessionHealth, `${formatInteger(Math.floor(sessionSpend / SESSION_EQUIVALENTS.health), m)} ${t.people}`);
  setText(el.sessionPoverty, `${formatInteger(Math.floor(sessionSpend / SESSION_EQUIVALENTS.poverty), m)} ${t.people}`);

  setText(el.personalBurden, formatMoney(snap.totals.militarySpend / POPULATION_BASELINE, m));
  setText(el.directValue, formatInteger(snap.totals.directDeaths, m));
  setText(el.indirectValue, formatInteger(snap.totals.indirectDeaths, m));
  setText(el.infrastructureValue, formatMoney(snap.totals.infrastructureDamage, m, { short: true }));
  setText(el.lifeYearsValue, formatInteger(snap.totals.lifeYearsLost, m));
  setText(el.economicLossValue, formatMoney(snap.totals.economicSetback, m, { short: true }));

  const share = snap.sharePercent;
  const development = snap.opportunityCosts.redirected;
  const defence = Math.max(0, snap.totals.militarySpend - development);
  setText(el.developmentAllocationValue, `${share}% · ${formatMoney(development, m, { short: true })}`);
  setText(el.defenceAllocationValue, `${100 - share}% · ${formatMoney(defence, m, { short: true })}`);
  if (el.developmentAllocationBar) el.developmentAllocationBar.style.width = `${share}%`;
  if (el.defenceAllocationBar) el.defenceAllocationBar.style.width = `${100 - share}%`;

  const values = snap.opportunityCosts;
  const programmeValues = {
    education: values.education,
    hunger: values.hunger,
    health: values.health,
    water: values.water,
    electricity: values.electricity,
    internet: values.internet,
    climate: values.climate,
    schools: values.schools,
  };

  for (const [key, numeric] of Object.entries(programmeValues)) {
    const output = el.programmes?.querySelector(`[data-programme-value="${key}"]`);
    const row = el.programmes?.querySelector(`[data-programme="${key}"]`);
    if (key === 'schools') {
      setText(output, `${formatInteger(numeric, m)} ${t.institutions}`);
      if (row) row.style.setProperty('--progress', `${Math.min(100, numeric > 0 ? 100 : 0)}%`);
    } else {
      setText(output, languageKey() === 'ru' ? `${formatRatio(numeric, m)} ${t.times}` : `${formatRatio(numeric, m)}${t.times}`);
      if (row) row.style.setProperty('--progress', `${Math.min(100, Math.max(0, numeric * 100))}%`);
    }
  }
}

let lastLanguage = languageKey();
let lastRender = 0;
function frame(now) {
  const nextLanguage = languageKey();
  if (nextLanguage !== lastLanguage) {
    lastLanguage = nextLanguage;
    renderStatic();
  }
  if (now - lastRender >= 100) {
    renderDynamic();
    lastRender = now;
  }
  requestAnimationFrame(frame);
}

const languageObserver = new MutationObserver(() => {
  renderStatic();
  renderDynamic();
});
languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });

for (const control of [controls.mode, controls.birthYear, controls.share]) {
  control?.addEventListener('input', renderDynamic);
  control?.addEventListener('change', renderDynamic);
}

el.programmeToggle?.addEventListener('click', () => {
  programmesExpanded = !programmesExpanded;
  updateProgrammeVisibility();
});
mobileQuery.addEventListener?.('change', updateProgrammeVisibility);

renderStatic();
renderDynamic();
requestAnimationFrame(frame);
