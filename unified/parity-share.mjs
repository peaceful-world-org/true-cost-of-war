import './app.mjs';
import { calculateLegacySnapshot } from '../src/runtime.mjs';
import { formatInteger, formatMoney, formatRatio } from '../src/format.mjs';
import { legacyCopy } from './legacy-copy.mjs';
import { shellUiCopy } from './ui-copy.mjs';

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
  return shellUiCopy(language());
}

function source() {
  return legacyCopy(language());
}

function heading() {
  return document.querySelector('#title')?.textContent?.trim() || 'The True Cost of War';
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
  return controls.mode?.selectedOptions?.[0]?.textContent?.trim() || controls.mode?.value || 'year';
}

function setText(node, value) {
  if (node) node.textContent = String(value);
}

function ensureSecondaryIntro() {
  if (!el.shareIntro) return null;
  let secondary = document.querySelector('#shareIntroSecondary');
  if (!secondary) {
    secondary = document.createElement('p');
    secondary.id = 'shareIntroSecondary';
    secondary.className = 'pw-section-intro pw-share-intro-secondary';
    el.shareIntro.after(secondary);
  }
  return secondary;
}

function ensureDownloadNote() {
  if (!el.cardWrap || !el.downloadCard) return null;
  let note = document.querySelector('#shareDownloadNote');
  if (!note) {
    note = document.createElement('div');
    note.id = 'shareDownloadNote';
    note.className = 'pw-share-download-note';
    el.downloadCard.after(note);
  }
  return note;
}

function renderLabels() {
  const t = ui();
  setText(el.shareTitle, t.shareTitle);
  setText(el.shareIntro, t.shareIntro);
  const secondary = ensureSecondaryIntro();
  if (secondary) {
    secondary.hidden = !t.shareIntroSecondary;
    setText(secondary, t.shareIntroSecondary || '');
  }
  setText(el.buildText, t.shareText);
  setText(el.buildCard, t.shareCard);
  setText(el.copyText, t.copy);
  setText(el.downloadCard, t.download);
  const downloadNote = ensureDownloadNote();
  if (downloadNote) {
    downloadNote.hidden = !t.downloadNote;
    setText(downloadNote, t.downloadNote || '');
  }
}

function summaryText() {
  const t = ui();
  const c = source();
  const snap = snapshot();
  const m = meta();
  const programmes = c.opportunity.programmes;
  return [
    heading(),
    `${t.period}: ${periodLabel()}`,
    `${t.military}: ${formatMoney(snap.totals.militarySpend, m)}`,
    `${c.metrics.direct.label}: ${formatInteger(snap.totals.directDeaths, m)}`,
    `${c.metrics.indirect.label}: ${formatInteger(snap.totals.indirectDeaths, m)}`,
    `${t.redirected} ${snap.sharePercent}%: ${formatMoney(snap.opportunityCosts.redirected, m)}`,
    `${programmes.education.label}: ${formatRatio(snap.opportunityCosts.education, m)}×`,
    `${programmes.hunger.label}: ${formatRatio(snap.opportunityCosts.hunger, m)}×`,
    `${programmes.health.label}: ${formatRatio(snap.opportunityCosts.health, m)}×`,
    '',
    'Peaceful World · peaceful-world.org/true-cost-of-war',
  ].join('\n');
}

function tokensForCanvas(text) {
  const value = String(text);
  if (/\s/u.test(value)) return value.split(/\s+/u).map((token) => `${token} `);
  return Array.from(value);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const tokens = tokensForCanvas(text);
  let line = '';
  let lineIndex = 0;
  for (const token of tokens) {
    const trial = line + token;
    if (ctx.measureText(trial.trimEnd()).width > maxWidth && line) {
      ctx.fillText(line.trimEnd(), x, y + lineIndex * lineHeight);
      lineIndex += 1;
      line = token;
      if (lineIndex >= maxLines) break;
    } else {
      line = trial;
    }
  }
  if (lineIndex < maxLines && line) ctx.fillText(line.trimEnd(), x, y + lineIndex * lineHeight);
  return lineIndex + 1;
}

function buildCanvas() {
  const t = ui();
  const c = source();
  const snap = snapshot();
  const m = meta();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const rtl = m.dir === 'rtl';
  const x = rtl ? 1008 : 72;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'start';

  ctx.fillStyle = '#0f1f35';
  ctx.fillRect(0, 0, 1080, 1080);
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, 'rgba(56,189,248,.10)');
  gradient.addColorStop(1, 'rgba(52,211,153,.06)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 28px Arial, sans-serif';
  ctx.fillText('PEACEFUL WORLD', x, 82);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 68px Arial, sans-serif';
  wrapCanvasText(ctx, heading().toUpperCase(), x, 168, 930, 76, 2);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 28px Arial, sans-serif';
  ctx.fillText(`${t.period}: ${periodLabel()}`, x, 312);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 72px Arial, sans-serif';
  ctx.fillText(formatMoney(snap.totals.militarySpend, m), x, 430);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 27px Arial, sans-serif';
  ctx.fillText(t.military.toUpperCase(), x, 470);

  const blocks = [
    [c.metrics.direct.label, formatInteger(snap.totals.directDeaths, m), '#ef4444'],
    [c.metrics.indirect.label, formatInteger(snap.totals.indirectDeaths, m), '#f87171'],
    [`${t.redirected} ${snap.sharePercent}%`, formatMoney(snap.opportunityCosts.redirected, m), '#34d399'],
  ];
  blocks.forEach(([label, value, color], index) => {
    const y = 585 + index * 115;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 23px Arial, sans-serif';
    ctx.fillText(String(label).toUpperCase(), x, y);
    ctx.fillStyle = color;
    ctx.font = '900 42px Arial, sans-serif';
    ctx.fillText(String(value), x, y + 50);
  });

  const programmes = c.opportunity.programmes;
  const opp = `${programmes.education.label}: ${formatRatio(snap.opportunityCosts.education, m)}× · ${programmes.hunger.label}: ${formatRatio(snap.opportunityCosts.hunger, m)}× · ${programmes.health.label}: ${formatRatio(snap.opportunityCosts.health, m)}×`;
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 24px Arial, sans-serif';
  wrapCanvasText(ctx, opp, x, 955, 930, 34, 2);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px Arial, sans-serif';
  ctx.fillText('Peaceful World · peaceful-world.org/true-cost-of-war', x, 1035);
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
    setText(el.copyState, ui().copyFallback);
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
