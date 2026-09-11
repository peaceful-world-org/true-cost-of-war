import { formatMoney } from '../src/format.mjs';

const REFERENCE_SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

const COPY = Object.freeze({
  ru: {
    scaleHeading: 'Масштаб отвлечения ресурсов',
    scaleTitle: 'Объем безвозвратно потерянных финансовых средств:',
    day: 'В сутки:',
    month: 'В месяц:',
    year: 'В год:',
    missionHeading: 'Потенциал микроперераспределения',
    missionCopy: 'Даже незначительная реаллокация средств способна обеспечить реализацию масштабных программ. Объем глобальных военных расходов за 1 секунду эквивалентен бюджету, достаточному для запуска международной инфраструктуры мирного образования.',
    missionMetricPrefix: '1 секунда глобальных военных расходов ≈',
    impact: 'Модель демонстрирует высокую рентабельность социальных инвестиций: небольшие доли глобальных расходов могут превращаться в инфраструктуру для масштабного мирного просвещения.',
    cta: 'Поддержать программу',
    philosophyTitle: 'Методологическое обоснование проекта',
    philosophyCopy: 'Цель данной макромодели — перевод экономических последствий вооруженных конфликтов в измеримые показатели. Оборонные бюджеты рассматриваются как ресурсы, отвлеченные от программ глобального развития: строительства инфраструктуры, медицинских исследований и повышения качества жизни.',
    quote: '«Поскольку войны начинаются в умах людей, именно в умах людей должны строиться защитные силы мира.»',
    quoteSource: '— Устав ЮНЕСКО',
    closing: 'Институциональная деятельность Peaceful World сфокусирована на развитии глобальной архитектуры мирного образования. Превентивное формирование культуры ненасилия требует значительно меньших инвестиций по сравнению с затратами на преодоление последствий вооруженных конфликтов.',
  },
  en: {
    scaleHeading: 'Scale of diverted resources',
    scaleTitle: 'Financial resources irreversibly diverted:',
    day: 'Per day:',
    month: 'Per month:',
    year: 'Per year:',
    missionHeading: 'The potential of micro-redistribution',
    missionCopy: 'Even a very small reallocation can support substantial programmes. One second of global military expenditure is comparable to a budget capable of launching international infrastructure for peace education.',
    missionMetricPrefix: '1 second of global military expenditure ≈',
    impact: 'The model illustrates the leverage of social investment: very small fractions of global expenditure can finance infrastructure for peace education at scale.',
    cta: 'Support the programme',
    philosophyTitle: 'Methodological rationale',
    philosophyCopy: 'The purpose of this macro model is to translate the economic consequences of armed conflict into measurable indicators. Military budgets are treated as resources diverted from global development, including infrastructure, medical research and quality of life.',
    quote: '“Since wars begin in the minds of men, it is in the minds of men that the defences of peace must be constructed.”',
    quoteSource: '— Constitution of UNESCO',
    closing: 'Peaceful World focuses on building a global architecture for peace education. Preventive investment in a culture of nonviolence requires far fewer resources than responding to the consequences of armed conflict.',
  },
});

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((r) => r.json()),
]);
const model = modelDocument.values;

function language() {
  return document.querySelector('#language')?.value === 'ru' ? 'ru' : 'en';
}

function copy() {
  return COPY[language()];
}

function meta() {
  const key = document.querySelector('#language')?.value || 'en';
  return manifest.languages[key] || manifest.languages.en;
}

function section(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function build() {
  document.querySelector('#parityNarrative')?.remove();
  const anchor = document.querySelector('.pw-share-section') || document.querySelector('.pw-method');
  if (!anchor) return;

  const t = copy();
  const m = meta();
  const wrapper = section('div', 'pw-parity-narrative');
  wrapper.id = 'parityNarrative';

  const scale = section('section', 'pw-scale-section');
  const scaleCard = section('div', 'pw-scale-card');
  const scaleHeading = section('div', 'pw-scale-heading');
  scaleHeading.textContent = t.scaleHeading;
  const scaleTitle = section('div', 'pw-scale-title');
  scaleTitle.textContent = t.scaleTitle;
  const scaleGrid = section('div', 'pw-scale-grid');
  const scaleValues = [
    [t.day, model.annualMilitarySpend / 365.25],
    [t.month, model.annualMilitarySpend / 12],
    [t.year, model.annualMilitarySpend],
  ];
  for (const [label, value] of scaleValues) {
    const item = section('div', 'pw-scale-item');
    const itemLabel = section('div', 'pw-scale-label');
    itemLabel.textContent = label;
    const itemValue = section('div', 'pw-scale-value');
    itemValue.textContent = formatMoney(value, m, { short: true });
    item.append(itemLabel, itemValue);
    scaleGrid.append(item);
  }
  scaleCard.append(scaleHeading, scaleTitle, scaleGrid);
  scale.append(scaleCard);

  const mission = section('section', 'pw-mission-section');
  const missionCard = section('div', 'pw-mission-card');
  const missionHeading = section('div', 'pw-mission-heading');
  missionHeading.textContent = t.missionHeading;
  const missionTitle = section('div', 'pw-mission-title');
  missionTitle.textContent = t.missionCopy;
  const missionHighlight = section('div', 'pw-mission-highlight');
  const metricLabel = document.createElement('strong');
  metricLabel.textContent = `${t.missionMetricPrefix} `;
  const metric = section('span', 'pw-mission-metric');
  metric.textContent = formatMoney(model.annualMilitarySpend / REFERENCE_SECONDS_PER_YEAR, m);
  const impact = section('div', 'pw-mission-copy');
  impact.style.marginTop = '12px';
  impact.textContent = t.impact;
  missionHighlight.append(metricLabel, metric, impact);
  const cta = document.createElement('a');
  cta.className = 'pw-mission-cta';
  cta.href = language() === 'ru' ? 'https://peaceful-world.org/help/ru' : 'https://peaceful-world.org/help/';
  cta.target = '_blank';
  cta.rel = 'noopener noreferrer';
  cta.textContent = t.cta;
  missionCard.append(missionHeading, missionTitle, missionHighlight, cta);
  mission.append(missionCard);

  const philosophy = section('section', 'pw-philosophy-section');
  const philosophyCard = section('div', 'pw-philosophy-card');
  const h2 = document.createElement('h2');
  h2.textContent = t.philosophyTitle;
  const rationale = section('div', 'pw-philosophy-copy');
  rationale.textContent = t.philosophyCopy;
  const quote = section('blockquote', 'pw-philosophy-quote');
  quote.textContent = t.quote;
  const source = section('span', 'pw-philosophy-source');
  source.textContent = t.quoteSource;
  quote.append(source);
  const closing = section('div', 'pw-philosophy-copy');
  closing.textContent = t.closing;
  philosophyCard.append(h2, rationale, quote, closing);
  philosophy.append(philosophyCard);

  wrapper.append(scale, mission, philosophy);
  anchor.before(wrapper);
}

const observer = new MutationObserver(build);
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

build();
