import './app.mjs';
import { calculateLegacySnapshot } from '../src/runtime.mjs';
import { formatInteger, formatMoney, formatRatio } from '../src/format.mjs';

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((r) => r.json()),
]);
const model = modelDocument.values;

const controls = {
  language: document.querySelector('#language'),
  mode: document.querySelector('#mode'),
  birthYear: document.querySelector('#birthYear'),
  share: document.querySelector('#share'),
};

const el = {
  shareTitle: document.querySelector('#shareTitle'),
  shareIntro: document.querySelector('#shareIntro'),
  buildText: document.querySelector('#buildText'),
  buildCard: document.querySelector('#buildCard'),
  copyText: document.querySelector('#copyText'),
  downloadCard: document.querySelector('#downloadCard'),
  textOutput: document.querySelector('#shareTextOutput'),
  textWrap: document.querySelector('#shareTextWrap'),
  cardWrap: document.querySelector('#shareCardWrap'),
  cardPreview: document.querySelector('#shareCardPreview'),
  copyState: document.querySelector('#copyState'),
};

function language() {
  return controls.language?.value || new URLSearchParams(location.search).get('lang') || 'en';
}

function meta() {
  return manifest.languages[language()] || manifest.languages.en;
}

function ui() {
  if (language() === 'ru') {
    return {
      title: 'ПОДЕЛИТЬСЯ РЕЗУЛЬТАТОМ',
      intro: 'Сформируйте текстовую сводку или квадратную карточку 1080×1080 из текущего состояния калькулятора.',
      text: 'Создать текст',
      card: 'Создать карточку',
      copy: 'Скопировать данные',
      copied: 'Скопировано ✓',
      download: 'Скачать PNG',
      heading: 'Истинная цена войны',
      period: 'Период',
      military: 'Военные расходы',
      direct: 'Прямые потери',
      indirect: 'Косвенные потери',
      redirected: 'Перенаправлено',
      education: 'Базовое образование',
      hunger: 'Ликвидация голода',
      health: 'Здравоохранение',
      source: 'Peaceful World · peaceful-world.org/true-cost-of-war',
    };
  }
  return {
    title: 'SHARE THE RESULT',
    intro: 'Generate a text summary or a 1080×1080 square card from the calculator’s current state.',
    text: 'Generate text',
    card: 'Generate card',
    copy: 'Copy data',
    copied: 'Copied ✓',
    download: 'Download PNG',
    heading: 'The True Cost of War',
    period: 'Period',
    military: 'Military expenditure',
    direct: 'Direct deaths',
    indirect: 'Indirect deaths',
    redirected: 'Redirected',
    education: 'Basic education',
    hunger: 'Ending hunger',
    health: 'Health coverage',
    source: 'Peaceful World · peaceful-world.org/true-cost-of-war',
  };
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

function periodLabel() {
  const selected = controls.mode?.selectedOptions?.[0]?.textContent?.trim();
  return selected || controls.mode?.value || 'year';
}

function setText(node, value) {
  if (node) node.textContent = String(value);
}

function renderLabels() {
  const t = ui();
  setText(el.shareTitle, t.title);
  setText(el.shareIntro, t.intro);
  setText(el.buildText, t.text);
  setText(el.buildCard, t.card);
  setText(el.copyText, t.copy);
  setText(el.downloadCard, t.download);
}

function summaryText() {
  const t = ui();
  const snap = snapshot();
  const m = meta();
  const share = snap.sharePercent;
  return [
    t.heading,
    `${t.period}: ${periodLabel()}`,
    `${t.military}: ${formatMoney(snap.totals.militarySpend, m)}`,
    `${t.direct}: ${formatInteger(snap.totals.directDeaths, m)}`,
    `${t.indirect}: ${formatInteger(snap.totals.indirectDeaths, m)}`,
    `${t.redirected} ${share}%: ${formatMoney(snap.opportunityCosts.redirected, m)}`,
    `${t.education}: ${formatRatio(snap.opportunityCosts.education, m)}×`,
    `${t.hunger}: ${formatRatio(snap.opportunityCosts.hunger, m)}×`,
    `${t.health}: ${formatRatio(snap.opportunityCosts.health, m)}×`,
    '',
    t.source,
  ].join('\n');
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(/\s+/);
  let line = '';
  let lineIndex = 0;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      line = word;
      if (lineIndex >= maxLines) break;
    } else {
      line = trial;
    }
  }
  if (lineIndex < maxLines && line) ctx.fillText(line, x, y + lineIndex * lineHeight);
  return lineIndex + 1;
}

function buildCanvas() {
  const t = ui();
  const snap = snapshot();
  const m = meta();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f1f35';
  ctx.fillRect(0, 0, 1080, 1080);

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, 'rgba(56,189,248,.10)');
  gradient.addColorStop(1, 'rgba(52,211,153,.06)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 28px Arial, sans-serif';
  ctx.fillText('PEACEFUL WORLD', 72, 82);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 68px Arial, sans-serif';
  wrapCanvasText(ctx, t.heading.toUpperCase(), 72, 168, 930, 76, 2);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 28px Arial, sans-serif';
  ctx.fillText(`${t.period}: ${periodLabel()}`, 72, 312);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 72px Arial, sans-serif';
  ctx.fillText(formatMoney(snap.totals.militarySpend, m), 72, 430);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 27px Arial, sans-serif';
  ctx.fillText(t.military.toUpperCase(), 72, 470);

  const blocks = [
    [t.direct, formatInteger(snap.totals.directDeaths, m), '#ef4444'],
    [t.indirect, formatInteger(snap.totals.indirectDeaths, m), '#f87171'],
    [`${t.redirected} ${snap.sharePercent}%`, formatMoney(snap.opportunityCosts.redirected, m), '#34d399'],
  ];
  blocks.forEach(([label, value, color], index) => {
    const y = 585 + index * 115;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 23px Arial, sans-serif';
    ctx.fillText(String(label).toUpperCase(), 72, y);
    ctx.fillStyle = color;
    ctx.font = '900 42px Arial, sans-serif';
    ctx.fillText(String(value), 72, y + 50);
  });

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 24px Arial, sans-serif';
  const opp = `${t.education}: ${formatRatio(snap.opportunityCosts.education, m)}×   ·   ${t.hunger}: ${formatRatio(snap.opportunityCosts.hunger, m)}×   ·   ${t.health}: ${formatRatio(snap.opportunityCosts.health, m)}×`;
  wrapCanvasText(ctx, opp, 72, 955, 930, 34, 2);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px Arial, sans-serif';
  ctx.fillText(t.source, 72, 1035);
  return canvas;
}

function showText() {
  if (!el.textOutput || !el.textWrap) return;
  el.textOutput.textContent = summaryText();
  el.textWrap.hidden = false;
}

function showCard() {
  if (!el.cardPreview || !el.cardWrap) return;
  const canvas = buildCanvas();
  el.cardPreview.src = canvas.toDataURL('image/png');
  el.cardWrap.hidden = false;
}

async function copySummary() {
  showText();
  const text = el.textOutput?.textContent || summaryText();
  try {
    await navigator.clipboard.writeText(text);
    setText(el.copyState, ui().copied);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(el.textOutput);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    setText(el.copyState, language() === 'ru' ? 'Текст выделен — используйте копирование браузера.' : 'Text selected — use the browser copy command.');
  }
  window.setTimeout(() => setText(el.copyState, ''), 2200);
}

function downloadCard() {
  showCard();
  if (!el.cardPreview?.src) return;
  const link = document.createElement('a');
  link.href = el.cardPreview.src;
  link.download = `true-cost-of-war-${language()}-${Date.now()}.png`;
  document.body.append(link);
  link.click();
  link.remove();
}

el.buildText?.addEventListener('click', showText);
el.buildCard?.addEventListener('click', showCard);
el.copyText?.addEventListener('click', copySummary);
el.downloadCard?.addEventListener('click', downloadCard);

const observer = new MutationObserver(renderLabels);
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
renderLabels();
