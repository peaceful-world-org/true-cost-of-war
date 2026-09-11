import { legacyCopy } from './legacy-copy.mjs';

const mobile = window.matchMedia('(max-width: 600px)');
let activeTrigger = null;
let activeInline = null;

const floating = document.createElement('div');
floating.className = 'pw-parity-popover';
floating.hidden = true;
floating.setAttribute('role', 'tooltip');
document.body.append(floating);

const METRIC_KEYS = Object.freeze({
  personal: 'personal',
  direct: 'direct',
  indirect: 'indirect',
  infrastructure: 'infrastructure',
  life: 'life',
  economic: 'economicLoss',
});

function language() {
  return document.querySelector('#language')?.value || 'en';
}

function source() {
  return legacyCopy(language());
}

function textFor(key) {
  const data = source();
  if (key === 'hero') return data.hero.tooltip;
  if (key === 'main') return data.hero.mainTooltip;
  if (key === 'scenario') return data.opportunity.scenarioTooltip;
  if (METRIC_KEYS[key]) return data.metrics[METRIC_KEYS[key]]?.tooltip || '';
  return data.opportunity.programmes[key]?.tooltip || '';
}

function descriptionFor(key) {
  const sourceKey = METRIC_KEYS[key];
  return sourceKey ? source().metrics[sourceKey]?.description || '' : '';
}

function titleFor(trigger) {
  const key = trigger.dataset.tooltipKey;
  if (key === 'hero') return document.querySelector('#title')?.textContent?.trim() || trigger.dataset.tooltipTitle || '';
  if (key === 'main') return document.querySelector('#currentPeriod')?.textContent?.trim() || trigger.dataset.tooltipTitle || '';
  if (key === 'scenario') return document.querySelector('#scenarioTitle')?.textContent?.trim() || trigger.dataset.tooltipTitle || '';
  const liveLabel = trigger.closest('.pw-parity-label-row')
    ?.querySelector('.pw-reference-card-label, .pw-programme-name')
    ?.textContent?.trim();
  if (liveLabel) return liveLabel;
  return trigger.dataset.tooltipTitle || trigger
    .closest('.pw-reference-card, .pw-programme, .pw-hero-counter, .pw-hero')
    ?.querySelector('.pw-reference-card-label, .pw-programme-name, .pw-counter-kicker, h1')
    ?.textContent?.trim() || '';
}

function syncAccessibleLabels() {
  for (const button of document.querySelectorAll('.pw-parity-info')) {
    const title = titleFor(button);
    button.setAttribute('aria-label', title ? `${title}: info` : 'Information');
  }
}

function closeTooltip() {
  if (activeTrigger) activeTrigger.setAttribute('aria-expanded', 'false');
  if (activeInline) activeInline.remove();
  activeInline = null;
  activeTrigger = null;
  floating.hidden = true;
}

function fillPopover(popover, trigger, text) {
  popover.replaceChildren();
  const title = titleFor(trigger);
  if (title) {
    const strong = document.createElement('strong');
    strong.className = 'pw-parity-popover-title';
    strong.textContent = title;
    popover.append(strong);
  }
  popover.append(document.createTextNode(text));
}

function renderFloating(trigger, text) {
  fillPopover(floating, trigger, text);
  floating.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const box = floating.getBoundingClientRect();
  const edge = 12;
  const gap = 10;
  let left = triggerRect.left + triggerRect.width / 2 - box.width / 2;
  left = Math.max(edge, Math.min(left, window.innerWidth - box.width - edge));
  let top = triggerRect.top - box.height - gap;
  if (top < edge) top = triggerRect.bottom + gap;
  top = Math.max(edge, Math.min(top, window.innerHeight - box.height - edge));
  floating.style.left = `${Math.round(left)}px`;
  floating.style.top = `${Math.round(top)}px`;
}

function renderInline(trigger, text) {
  const surface = trigger.closest('.pw-reference-card, .pw-programme, .pw-hero-counter, .pw-hero, .pw-scenario-panel') || trigger.parentElement;
  if (!surface) return;
  const popover = document.createElement('div');
  popover.className = 'pw-parity-inline-popover';
  popover.setAttribute('role', 'tooltip');
  fillPopover(popover, trigger, text);
  surface.append(popover);
  activeInline = popover;
}

function toggleTooltip(trigger) {
  const text = textFor(trigger.dataset.tooltipKey);
  if (!text) return;
  if (activeTrigger === trigger) {
    closeTooltip();
    return;
  }
  closeTooltip();
  activeTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  if (mobile.matches) renderInline(trigger, text);
  else renderFloating(trigger, text);
}

function makeButton(key, title = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pw-parity-info';
  button.textContent = 'i';
  button.dataset.tooltipKey = key;
  if (title) button.dataset.tooltipTitle = title;
  button.setAttribute('aria-label', title ? `${title}: info` : 'Information');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleTooltip(button);
  });
  return button;
}

function attachToLabel(label, key) {
  if (!label || label.parentElement?.querySelector(`.pw-parity-info[data-tooltip-key="${key}"]`)) return;
  const row = document.createElement('div');
  row.className = 'pw-parity-label-row';
  label.parentNode.insertBefore(row, label);
  row.append(label, makeButton(key, label.textContent.trim()));
}

function attachDescriptions() {
  const targets = [
    ['#directValue', 'direct'],
    ['#indirectValue', 'indirect'],
    ['#infrastructureValue', 'infrastructure'],
    ['#lifeYearsValue', 'life'],
    ['#economicLossValue', 'economic'],
  ];
  for (const [selector, key] of targets) {
    const value = document.querySelector(selector);
    const card = value?.closest('.pw-reference-card');
    if (!card) continue;
    let desc = card.querySelector('.pw-reference-card-desc');
    if (!desc) {
      desc = document.createElement('div');
      desc.className = 'pw-reference-card-desc';
      card.append(desc);
    }
    desc.textContent = descriptionFor(key);
  }
}

function attachMainCounterInfo() {
  const value = document.querySelector('#mainCounterValue');
  if (!value || document.querySelector('.pw-parity-info[data-tooltip-key="main"]')) return;

  let row = value.parentElement?.querySelector('.pw-counter-value-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'pw-counter-value-row';
    value.parentNode.insertBefore(row, value);
    row.append(value);
  }
  row.append(makeButton('main', document.querySelector('#currentPeriod')?.textContent?.trim() || 'Period total'));
}

function attachScenarioInfo() {
  const title = document.querySelector('#scenarioTitle');
  if (!title || document.querySelector('.pw-parity-info[data-tooltip-key="scenario"]')) return;
  const row = document.createElement('div');
  row.className = 'pw-scenario-title-row';
  title.parentNode.insertBefore(row, title);
  row.append(title, makeButton('scenario', title.textContent.trim()));
}

function install() {
  const lead = document.querySelector('#lead');
  if (lead && !document.querySelector('.pw-parity-info[data-tooltip-key="hero"]')) {
    const row = document.createElement('div');
    row.className = 'pw-hero-info-row';
    lead.parentNode.insertBefore(row, lead);
    row.append(lead, makeButton('hero', document.querySelector('#title')?.textContent?.trim() || 'Model'));
  }

  attachMainCounterInfo();
  attachScenarioInfo();

  const cards = [
    ['#personalBurdenLabel', 'personal'],
    ['#directLabel', 'direct'],
    ['#indirectLabel', 'indirect'],
    ['#infrastructureLabel', 'infrastructure'],
    ['#lifeYearsLabel', 'life'],
    ['#economicLossLabel', 'economic'],
  ];
  for (const [selector, key] of cards) attachToLabel(document.querySelector(selector), key);

  for (const programme of document.querySelectorAll('.pw-programme[data-programme]')) {
    attachToLabel(programme.querySelector('.pw-programme-name'), programme.dataset.programme);
  }
  attachDescriptions();
  syncAccessibleLabels();
}

const programmeObserver = new MutationObserver(install);
programmeObserver.observe(document.querySelector('#programmes') || document.body, { childList: true, subtree: true });
const languageObserver = new MutationObserver(() => {
  closeTooltip();
  install();
});
languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });

document.addEventListener('click', (event) => {
  if (!event.target.closest('.pw-parity-info, .pw-parity-popover, .pw-parity-inline-popover')) closeTooltip();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeTooltip();
});
window.addEventListener('resize', () => {
  if (!activeTrigger) return;
  const trigger = activeTrigger;
  const text = textFor(trigger.dataset.tooltipKey);
  closeTooltip();
  activeTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  if (mobile.matches) renderInline(trigger, text);
  else renderFloating(trigger, text);
});

install();
