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

function source() {
  return legacyCopy(language());
}

function meta() {
  return manifest.languages[language()] || manifest.languages.en;
}

function section(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function fundSummary({ mobile = false } = {}) {
  const t = source().opportunity;
  const card = section('div', mobile ? 'pw-mobile-summary' : 'pw-fund-summary');
  if (mobile) card.id = 'mobileFundSummary';

  const heading = section('div', 'pw-fund-header');
  heading.textContent = t.fundHeading;
  const amount = section('div', 'pw-fund-amount');
  amount.id = mobile ? 'mobileImpactTotalAmount' : 'impactTotalAmount';
  amount.textContent = '—';
  const subtitle = section('div', mobile ? 'pw-mobile-summary-desc' : 'pw-fund-subtitle');
  subtitle.textContent = mobile ? t.mobileFundSubtitle : t.fundSubtitle;

  card.append(heading, amount, subtitle);
  return card;
}

function normalizeAllocationMarkup() {
  const allocation = document.querySelector('.pw-allocation');
  if (!allocation || allocation.dataset.parityNormalized === 'true') return allocation;

  const developmentCard = allocation.querySelector('[data-allocation="development"]');
  const defenceCard = allocation.querySelector('[data-allocation="defence"]');
  const developmentHead = developmentCard?.querySelector('.pw-allocation-head');
  const defenceHead = defenceCard?.querySelector('.pw-allocation-head');
  const developmentBar = developmentCard?.querySelector('#developmentAllocationBar');
  const defenceBar = defenceCard?.querySelector('#defenceAllocationBar');

  if (!developmentHead || !defenceHead || !developmentBar || !defenceBar) return allocation;

  const labels = section('div', 'pw-fund-bar-labels');
  developmentHead.className = 'pw-fund-bar-label pw-fund-bar-label-peace';
  defenceHead.className = 'pw-fund-bar-label pw-fund-bar-label-war';
  labels.append(developmentHead, defenceHead);

  const bar = section('div', 'pw-fund-bar-wrap');
  developmentBar.className = 'pw-fund-bar-peace';
  defenceBar.className = 'pw-fund-bar-war';
  bar.append(developmentBar, defenceBar);

  allocation.replaceChildren(labels, bar);
  allocation.dataset.parityNormalized = 'true';
  return allocation;
}

function makeInfoButton(key, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pw-parity-info pw-parity-info-sm';
  button.textContent = 'i';
  button.dataset.tooltipKey = key;
  button.dataset.tooltipTitle = title || '';
  button.setAttribute('aria-label', title ? `${title}: info` : 'Information');
  button.setAttribute('aria-expanded', 'false');
  return button;
}

function appendEmphasizedText(node, text, emphasis) {
  const sourceText = String(text || '');
  const marker = String(emphasis || '');
  const index = marker ? sourceText.indexOf(marker) : -1;
  if (index < 0) {
    node.append(document.createTextNode(sourceText));
    return;
  }
  if (index > 0) node.append(document.createTextNode(sourceText.slice(0, index)));
  const strong = document.createElement('strong');
  strong.textContent = marker;
  node.append(strong);
  if (index + marker.length < sourceText.length) {
    node.append(document.createTextNode(sourceText.slice(index + marker.length)));
  }
}

function appendMissionCopy(node, t) {
  node.replaceChildren();
  appendEmphasizedText(node, t.missionBeforeInfo, t.missionFirstEmphasis);
  node.append(document.createTextNode('\u00a0'));
  node.append(makeInfoButton('missionFunding', t.missionHeading));
  if (t.missionAfterInfo) {
    node.append(document.createTextNode(' '));
    appendEmphasizedText(node, t.missionAfterInfo, t.missionSecondEmphasis);
  }

  const lineBreak = document.createElement('br');
  const note = document.createElement('span');
  note.className = 'pw-mission-note';
  const template = String(t.missionNoteTemplate || '{value}');
  const marker = template.indexOf('{value}');
  if (marker >= 0) {
    note.append(document.createTextNode(template.slice(0, marker)));
    const percent = document.createElement('span');
    percent.id = 'missionPercentText';
    percent.className = 'pw-mission-percent';
    percent.textContent = '0.00%';
    note.append(percent, document.createTextNode(template.slice(marker + 7)));
  } else {
    note.textContent = template;
  }
  node.append(lineBreak, note);
}

function buildImpactTitle(t) {
  const title = section('div', 'pw-mission-impact-title');
  const wrap = section('div', 'pw-mission-impact-text-wrap');
  const heading = section('div', 'pw-mission-impact-heading');
  heading.textContent = t.impactHeading;
  const highlight = section('div', 'pw-mission-impact-highlight');
  highlight.append(document.createTextNode(t.impactHighlight), document.createTextNode('\u00a0'));
  highlight.append(makeInfoButton('impactEfficiency', t.impactHighlight));
  wrap.append(heading, highlight);
  title.append(wrap);
  return title;
}

function build() {
  document.querySelector('#parityNarrative')?.remove();
  document.querySelector('#parityScale')?.remove();
  document.querySelector('#mobileFundSummary')?.remove();
  const anchor = document.querySelector('.pw-share-section') || document.querySelector('.pw-method');
  if (!anchor) return;

  const t = source().narrative;
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
  const missionCopy = section('div', 'pw-mission-copy pw-mission-primary-copy');
  appendMissionCopy(missionCopy, t);
  const missionHighlight = section('div', 'pw-mission-highlight');
  const impactTitle = buildImpactTitle(t);
  const impact = section('div', 'pw-mission-copy pw-mission-impact-copy');
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
  const quoteSource = section('span', 'pw-philosophy-source');
  quoteSource.textContent = t.quoteSource;
  quote.append(quoteSource);
  const closing = section('div', 'pw-philosophy-copy');
  closing.textContent = t.closing;
  philosophyCard.append(h2, rationale, quote, closing);
  philosophy.append(philosophyCard);

  const fundSlot = document.querySelector('#opportunityFundSlot');
  const allocation = normalizeAllocationMarkup();
  if (fundSlot) {
    fundSlot.replaceChildren();
    fundSlot.append(fundSummary());
    if (allocation) fundSlot.append(allocation);
    fundSlot.append(missionCard);
  } else {
    wrapper.append(mission);
  }

  const opportunitySplit = document.querySelector('.pw-opportunity-split');
  if (opportunitySplit) opportunitySplit.before(fundSummary({ mobile: true }));

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
