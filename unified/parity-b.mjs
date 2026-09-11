import './app.mjs';
import './parity-tooltips.mjs';
import './parity-narrative.mjs';
import { calculateLegacySnapshot } from '../src/runtime.mjs';
import { formatInteger, formatMoney, formatRatio } from '../src/format.mjs';
import { parityCopy } from './parity-b-copy.mjs';

const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const POPULATION_BASELINE = 8.1e9;
const SESSION_EQUIVALENTS = Object.freeze({ food: 62.5, health: 125, poverty: 1000 });

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((r) => r.json()),
]);
const model = modelDocument.values;
const perSecond = model.annualMilitarySpend / REFERENCE_SECONDS_PER_YEAR;
const mobileQuery = window.matchMedia('(max-width: 900px)');
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
  scenarioTitle: document.querySelector('#scenarioTitle'),
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

function splitTemplate(template) {
  const source = String(template || '{value}');
  const marker = source.indexOf('{value}');
  if (marker < 0) return ['', source];
  return [source.slice(0, marker).trim(), source.slice(marker + 7).trim()];
}

function prepareSessionLine(valueNode, template) {
  const line = valueNode?.closest('li');
  if (!line || !valueNode) return;
  const [before, after] = splitTemplate(template);
  const children = [document.createTextNode('• ')];
  if (before) children.push(document.createTextNode(`${before} `));
  children.push(valueNode);
  if (after) children.push(document.createTextNode(` ${after}`));
  line.replaceChildren(...children);
}

function applyValueTemplate(template, value) {
  const source = String(template || '{value}');
  return source.includes('{value}') ? source.replace('{value}', String(value)) : String(value);
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

function formatMissionPercent(redirected) {
  if (!Number.isFinite(redirected) || redirected <= 0) return '0.00%';
  const value = (perSecond / redirected) * 100;
  return `${value < 0.0001 ? value.toFixed(7) : value.toFixed(5)}%`;
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
  prepareSessionLine(el.sessionFood, t.sessionTemplates.food);
  prepareSessionLine(el.sessionHealth, t.sessionTemplates.health);
  prepareSessionLine(el.sessionPoverty, t.sessionTemplates.poverty);
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
  setText(el.scenarioTitle, t.scenarioTitle);
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
  t.programmes.forEach(([key, label, noteText, tooltipText, valueTemplate], index) => {
    const row = document.createElement('article');
    row.className = 'pw-programme pw-glow';
    row.dataset.programme = key;
    row.dataset.valueTemplate = valueTemplate || '{value}';
    row.dataset.tooltipText = tooltipText || '';
    if (index >= 3) row.dataset.mobileExtra = 'true';

    const content = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'pw-programme-name';
    name.textContent = label;
    const note = document.createElement('div');
    note.className = 'pw-programme-note';
    note.textContent = noteText;
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

  const active = elapsedSeconds();
  const sessionSpend = perSecond * active;
  setText(el.sessionFood, formatInteger(Math.floor(sessionSpend / SESSION_EQUIVALENTS.food), m));
  setText(el.sessionHealth, formatInteger(Math.floor(sessionSpend / SESSION_EQUIVALENTS.health), m));
  setText(el.sessionPoverty, formatInteger(Math.floor(sessionSpend / SESSION_EQUIVALENTS.poverty), m));

  setText(el.personalBurden, formatMoney(snap.totals.militarySpend / POPULATION_BASELINE, m));
  setText(el.directValue, formatInteger(snap.totals.directDeaths, m));
  setText(el.indirectValue, formatInteger(snap.totals.indirectDeaths, m));
  setText(el.infrastructureValue, formatMoney(snap.totals.infrastructureDamage, m, { short: true }));
  setText(el.lifeYearsValue, formatInteger(snap.totals.lifeYearsLost, m));
  setText(el.economicLossValue, formatMoney(snap.totals.economicSetback, m, { short: true }));

  const share = snap.sharePercent;
  const development = snap.opportunityCosts.redirected;
  const developmentShort = formatMoney(development, m, { short: true });
  setText(el.developmentAllocationValue, `${share}%`);
  setText(el.defenceAllocationValue, `${100 - share}%`);
  setText(document.querySelector('#impactTotalAmount'), developmentShort);
  setText(document.querySelector('#mobileImpactTotalAmount'), developmentShort);
  setText(document.querySelector('#missionPercentText'), formatMissionPercent(development));
  const allocation = document.querySelector('.pw-allocation');
  if (allocation) allocation.style.setProperty('--development-share', `${share}%`);
  if (el.developmentAllocationBar) el.developmentAllocationBar.style.width = `${share}%`;
  if (el.defenceAllocationBar) el.defenceAllocationBar.style.width = `${100 - share}%`;

  const programmeValues = {
    education: snap.opportunityCosts.education,
    hunger: snap.opportunityCosts.hunger,
    health: snap.opportunityCosts.health,
    water: snap.opportunityCosts.water,
    electricity: snap.opportunityCosts.electricity,
    internet: snap.opportunityCosts.internet,
    climate: snap.opportunityCosts.climate,
    schools: snap.opportunityCosts.schools,
  };

  for (const [key, numeric] of Object.entries(programmeValues)) {
    const output = el.programmes?.querySelector(`[data-programme-value="${key}"]`);
    const row = el.programmes?.querySelector(`[data-programme="${key}"]`);
    const formatted = key === 'schools' ? formatInteger(numeric, m) : formatRatio(numeric, m);
    setText(output, applyValueTemplate(row?.dataset.valueTemplate, formatted));
    if (row) {
      const progress = key === 'schools'
        ? (numeric > 0 ? 100 : 0)
        : Math.min(100, Math.max(0, numeric * 100));
      row.style.setProperty('--progress', `${progress}%`);
      row.classList.toggle('pw-overflow', key !== 'schools' && numeric >= 1 && numeric < 5);
      row.classList.toggle('pw-overflow-massive', key !== 'schools' && numeric >= 5);
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
