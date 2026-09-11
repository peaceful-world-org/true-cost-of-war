import { formatMoney } from '../src/format.mjs';
import { legacyCopy } from './legacy-copy.mjs';

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((r) => r.json()),
]);
const model = modelDocument.values;

function language() {
  return document.querySelector('#language')?.value || 'en';
}

function narrative() {
  return legacyCopy(language()).narrative;
}

function meta() {
  return manifest.languages[language()] || manifest.languages.en;
}

function section(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function build() {
  document.querySelector('#parityNarrative')?.remove();
  document.querySelector('#parityScale')?.remove();
  const anchor = document.querySelector('.pw-share-section') || document.querySelector('.pw-method');
  if (!anchor) return;

  const t = narrative();
  const m = meta();
  const wrapper = section('div', 'pw-parity-narrative');
  wrapper.id = 'parityNarrative';

  const scale = section('section', 'pw-scale-section');
  scale.id = 'parityScale';
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
  const missionCopy = section('div', 'pw-mission-title');
  missionCopy.textContent = t.missionCopy;
  const missionHighlight = section('div', 'pw-mission-highlight');
  const impactTitle = document.createElement('strong');
  impactTitle.textContent = t.impactTitle;
  const impact = section('div', 'pw-mission-copy');
  impact.style.marginTop = '12px';
  impact.textContent = t.impact;
  missionHighlight.append(impactTitle, impact);
  const cta = document.createElement('a');
  cta.className = 'pw-mission-cta';
  cta.href = t.ctaHref || 'https://peaceful-world.org/help/';
  cta.target = '_blank';
  cta.rel = 'noopener noreferrer';
  cta.textContent = t.cta;
  missionCard.append(missionHeading, missionCopy, missionHighlight, cta);
  mission.append(missionCard);

  const philosophy = section('section', 'pw-philosophy-section');
  const philosophyCard = section('div', 'pw-philosophy-card');
  const h2 = document.createElement('h2');
  h2.textContent = t.philosophyTitle;
  const rationale = section('div', 'pw-philosophy-copy');
  rationale.textContent = t.philosophyCopy;
  const quote = section('blockquote', 'pw-philosophy-quote');
  quote.append(document.createTextNode(t.quote));
  const source = section('span', 'pw-philosophy-source');
  source.textContent = t.quoteSource;
  quote.append(source);
  const closing = section('div', 'pw-philosophy-copy');
  closing.textContent = t.closing;
  philosophyCard.append(h2, rationale, quote, closing);
  philosophy.append(philosophyCard);

  const fundSlot = document.querySelector('#opportunityFundSlot');
  const allocation = document.querySelector('.pw-allocation');
  if (fundSlot) {
    fundSlot.replaceChildren();
    if (allocation) fundSlot.append(allocation);
    fundSlot.append(missionCard);
  } else {
    wrapper.append(mission);
  }

  /* Production order: methodology/philosophy first, then one dissemination
     section containing the day/month/year scale and the sharing controls. */
  wrapper.append(philosophy);
  anchor.before(wrapper);

  const shareActions = anchor.querySelector?.('.pw-share-actions');
  if (shareActions) anchor.insertBefore(scale, shareActions);
  else anchor.append(scale);
}

const observer = new MutationObserver(build);
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });

build();
