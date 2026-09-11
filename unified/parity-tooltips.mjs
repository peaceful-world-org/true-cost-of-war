const COPY = Object.freeze({
  ru: {
    hero: 'Макромодель агрегирует данные SIPRI по оборонным бюджетам и UCDP по количеству жертв конфликтов, оценивая прямые демографические и экономические потери, а также альтернативную стоимость отвлеченных ресурсов.',
    main: 'Оценка базируется на отчетах Стокгольмского института исследования проблем мира (SIPRI). Глобальные военные расходы составляют более $2.44 трлн в год. Расчет производится пропорционально выбранному временному периоду.',
    personal: 'Совокупные глобальные оборонные расходы, распределенные на общую численность населения Земли (≈8.1 млрд человек). Параметр отражает косвенную финансовую нагрузку на каждого жителя.',
    direct: 'Смертность, непосредственно связанная с ведением боевых действий (комбатанты и гражданское население). Среднегодовой показатель, по данным UCDP, составляет порядка 150 000 человек.',
    indirect: 'Избыточная смертность, вызванная деградацией медицинской инфраструктуры и перебоями в обеспечении. Согласно историческим демографическим данным, соотношение косвенных потерь к прямым оценивается как 4 к 1.',
    infrastructure: 'Оценочная стоимость восстановления разрушенных объектов инфраструктуры. В рамках данной макромодели применяется консервативный коэффициент в 30% от совокупных военных расходов.',
    life: 'Потерянные годы потенциальной жизни (YPLL). Совокупное количество лет, не прожитых в результате демографических потерь. В расчетах используется средний возраст погибших 34 года при ожидаемой продолжительности жизни в 73 года.',
    economic: 'Агрегированный показатель, включающий прямые военные расходы, инфраструктурный ущерб и статистическую стоимость утраченного человеческого капитала (VSL).',
    education: 'Согласно оценкам ЮНЕСКО, ежегодные инвестиции в размере $39 млрд позволят обеспечить доступ к качественному базовому образованию в странах с низким уровнем дохода.',
    hunger: 'По данным Продовольственной и сельскохозяйственной организации ООН (ФАО), инвестиции в размере $50 млрд ежегодно необходимы для обеспечения глобальной продовольственной безопасности.',
    health: 'По оценкам Всемирной организации здравоохранения (ВОЗ), обеспечение базового универсального охвата услугами здравоохранения требует дополнительных инвестиций в размере $250 млрд ежегодно.',
    water: 'По данным Всемирного банка, обеспечение глобального доступа к безопасной питьевой воде и базовой санитарии требует инвестиций в размере $150 млрд ежегодно.',
    electricity: 'Оценки Международного энергетического агентства (МЭА) показывают, что инвестиции в $35 млрд в год необходимы для обеспечения стопроцентного глобального доступа к электроэнергии.',
    internet: 'По данным Международного союза электросвязи (ITU), для обеспечения доступа к широкополосному интернету оставшейся части населения требуется $43 млрд ежегодно.',
    climate: 'Инвестиции в размере $1.5–2 трлн ежегодно требуются для глобального энергетического перехода и достижения макроцелей по углеродной нейтральности.',
    schools: 'Оценка капитальных затрат на строительство и полное аппаратное оснащение современного образовательного учреждения вместимостью около 1000 учащихся в развивающихся странах.',
  },
  en: {
    hero: 'The macro model combines SIPRI military-expenditure data with UCDP conflict-fatality data to estimate direct demographic and economic losses and the opportunity cost of diverted resources.',
    main: 'The estimate uses the calculator’s SIPRI-based annual military-expenditure baseline and scales it proportionally to the selected time period.',
    personal: 'Total global military expenditure divided across an approximate world population of 8.1 billion people, illustrating the indirect financial burden per person.',
    direct: 'Deaths directly associated with armed conflict, including combatants and civilians. The legacy baseline uses an annual value of about 150,000.',
    indirect: 'Excess mortality associated with degraded health systems and disrupted essential services. The legacy model applies a 4:1 indirect-to-direct mortality ratio.',
    infrastructure: 'Estimated reconstruction cost for damaged infrastructure. The legacy macro model uses an annual infrastructure-damage baseline equivalent to roughly 30% of military expenditure.',
    life: 'Years of Potential Life Lost (YPLL): the aggregate number of years not lived because of demographic losses. The legacy model uses 39 average years lost per death.',
    economic: 'Aggregate indicator combining direct military expenditure, infrastructure damage and a statistical value assigned to lost human capital.',
    education: 'Legacy benchmark: $39B per year for the global basic-education financing gap.',
    hunger: 'Legacy benchmark: $50B per year for global food-security needs.',
    health: 'Legacy benchmark: $250B per year for additional basic universal health coverage.',
    water: 'Legacy benchmark: $150B per year for safe water and basic sanitation infrastructure.',
    electricity: 'Legacy benchmark: $35B per year for universal electricity access.',
    internet: 'Legacy benchmark: $43B per year for expanding broadband access to the remaining unconnected population.',
    climate: 'Legacy benchmark: $1.5T per year for large-scale energy transition and climate goals.',
    schools: 'Legacy benchmark: approximately $5M to build and equip a modern educational facility for about 1,000 students.',
  },
});

const DESCRIPTIONS = Object.freeze({
  ru: {
    direct: 'Количество людей, погибших в результате прямых вооруженных столкновений.',
    indirect: 'Избыточная смертность вследствие гуманитарных кризисов и разрушения систем жизнеобеспечения.',
    infrastructure: 'Оценка финансового ущерба, нанесенного объектам гражданской инфраструктуры.',
    life: 'Совокупная оценка лет потенциальной жизни, утраченных в результате демографических потерь.',
    economic: 'Объем агрегированных экономических издержек и замедления глобального развития.',
  },
  en: {
    direct: 'People killed as a direct result of armed conflict.',
    indirect: 'Excess mortality associated with humanitarian crises and the breakdown of life-supporting systems.',
    infrastructure: 'Estimated financial damage to civilian infrastructure.',
    life: 'Aggregate estimate of potential years of life lost through demographic losses.',
    economic: 'Aggregate economic costs and the associated setback to global development.',
  },
});

const mobile = window.matchMedia('(max-width: 600px)');
let activeTrigger = null;
let activeInline = null;

const floating = document.createElement('div');
floating.className = 'pw-parity-popover';
floating.hidden = true;
floating.setAttribute('role', 'tooltip');
document.body.append(floating);

function language() {
  const value = document.querySelector('#language')?.value || document.documentElement.lang || 'en';
  return value === 'ru' ? 'ru' : 'en';
}

function textFor(key) {
  return COPY[language()][key] || COPY.en[key] || '';
}

function titleFor(trigger) {
  return trigger.dataset.tooltipTitle || trigger.closest('.pw-reference-card, .pw-programme, .pw-hero-counter, .pw-hero')?.querySelector('.pw-reference-card-label, .pw-programme-name, .pw-counter-kicker, h1')?.textContent?.trim() || '';
}

function closeTooltip() {
  if (activeTrigger) activeTrigger.setAttribute('aria-expanded', 'false');
  if (activeInline) activeInline.remove();
  activeInline = null;
  activeTrigger = null;
  floating.hidden = true;
}

function renderFloating(trigger, text) {
  floating.replaceChildren();
  const title = titleFor(trigger);
  if (title) {
    const strong = document.createElement('strong');
    strong.className = 'pw-parity-popover-title';
    strong.textContent = title;
    floating.append(strong);
  }
  floating.append(document.createTextNode(text));
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
  const surface = trigger.closest('.pw-reference-card, .pw-programme, .pw-hero-counter, .pw-hero') || trigger.parentElement;
  const popover = document.createElement('div');
  popover.className = 'pw-parity-inline-popover';
  popover.setAttribute('role', 'tooltip');
  const title = titleFor(trigger);
  if (title) {
    const strong = document.createElement('strong');
    strong.className = 'pw-parity-popover-title';
    strong.textContent = title;
    popover.append(strong);
  }
  popover.append(document.createTextNode(text));
  surface.append(popover);
  activeInline = popover;
}

function toggleTooltip(trigger) {
  const key = trigger.dataset.tooltipKey;
  const text = textFor(key);
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
  const descriptions = DESCRIPTIONS[language()];
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
    desc.textContent = descriptions[key] || DESCRIPTIONS.en[key];
  }
}

function install() {
  const lead = document.querySelector('#lead');
  if (lead && !document.querySelector('.pw-parity-info[data-tooltip-key="hero"]')) {
    const row = document.createElement('div');
    row.className = 'pw-hero-info-row';
    lead.parentNode.insertBefore(row, lead);
    row.append(lead, makeButton('hero', document.querySelector('#title')?.textContent?.trim() || 'Model'));
  }

  const kicker = document.querySelector('.pw-counter-kicker');
  if (kicker && !kicker.querySelector('.pw-parity-info[data-tooltip-key="main"]')) {
    kicker.append(makeButton('main', document.querySelector('#currentPeriod')?.textContent?.trim() || 'Period total'));
  }

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
    const key = programme.dataset.programme;
    attachToLabel(programme.querySelector('.pw-programme-name'), key);
  }
  attachDescriptions();
}

const observer = new MutationObserver(() => install());
observer.observe(document.querySelector('#programmes') || document.body, { childList: true, subtree: true });

document.addEventListener('click', (event) => {
  if (!event.target.closest('.pw-parity-info, .pw-parity-popover, .pw-parity-inline-popover')) closeTooltip();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeTooltip();
});
window.addEventListener('resize', () => {
  if (activeTrigger) {
    const trigger = activeTrigger;
    const key = trigger.dataset.tooltipKey;
    closeTooltip();
    activeTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    if (mobile.matches) renderInline(trigger, textFor(key));
    else renderFloating(trigger, textFor(key));
  }
});

const languageObserver = new MutationObserver(() => {
  closeTooltip();
  attachDescriptions();
});
languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

install();
