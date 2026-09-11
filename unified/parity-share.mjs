import './app.mjs';
import { formatInteger, formatMoney } from '../src/format.mjs';
import { dailyShareValues, fillValueTemplate, formatCompactPeople } from './daily-share.mjs';
import { legacyCopy } from './legacy-copy.mjs';
import { disseminationParityCopy, shellUiCopy } from './ui-copy.mjs';

const [manifest, modelDocument] = await Promise.all([
  fetch('./locales/manifest.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('../data/model.json', { cache: 'no-store' }).then((r) => r.json()),
]);
const model = modelDocument.values;

const DAILY_FACT_COPY = Object.freeze({
  en: Object.freeze({
    spend: 'Daily global military expenditure amounts to {value}.',
    alternative: 'Reallocating these funds for one day could instead:',
    cardKicker: 'GLOBAL COSTS OF CONFLICT',
    cardHeadline: 'Every day, the world spends on weapons:',
    school: 'Build {value} new schools',
    linkLabel: 'Interactive model of the opportunity cost of military budgets:',
    footerModel: 'Peaceful World analytical model',
  }),
  de: Object.freeze({
    spend: 'Die weltweiten Militärausgaben pro Tag belaufen sich auf {value}.',
    alternative: 'Eine alternative Verwendung dieser Mittel für einen Tag könnte:',
    cardKicker: 'GLOBALE KOSTEN VON KONFLIKTEN',
    cardHeadline: 'Jeden Tag gibt die Welt für Waffen aus:',
    school: '{value} neue Schulen bauen',
    linkLabel: 'Interaktives Modell zu den Opportunitätskosten von Militärbudgets:',
    footerModel: 'Analytisches Modell von Peaceful World',
  }),
  es: Object.freeze({
    spend: 'El gasto militar mundial diario asciende a {value}.',
    alternative: 'Una reasignación de estos fondos durante un día permitiría:',
    cardKicker: 'COSTE GLOBAL DE LOS CONFLICTOS',
    cardHeadline: 'Cada día, el mundo gasta en armas:',
    school: 'Construir {value} escuelas nuevas',
    linkLabel: 'Modelo interactivo del coste de oportunidad de los presupuestos militares:',
    footerModel: 'Modelo analítico de Peaceful World',
  }),
  fr: Object.freeze({
    spend: 'Les dépenses militaires mondiales quotidiennes s’élèvent à {value}.',
    alternative: 'Une réaffectation de ces fonds pendant une journée permettrait de :',
    cardKicker: 'COÛT MONDIAL DES CONFLITS',
    cardHeadline: 'Chaque jour, le monde dépense pour les armes :',
    school: 'Construire {value} nouvelles écoles',
    linkLabel: 'Modèle interactif du coût d’opportunité des budgets militaires :',
    footerModel: 'Modèle analytique de Peaceful World',
  }),
  pt: Object.freeze({
    spend: 'A despesa militar mundial diária é de {value}.',
    alternative: 'Uma reafetação destes fundos durante um dia permitiria:',
    cardKicker: 'CUSTO GLOBAL DOS CONFLITOS',
    cardHeadline: 'Todos os dias, o mundo gasta em armas:',
    school: 'Construir {value} novas escolas',
    linkLabel: 'Modelo interativo do custo de oportunidade dos orçamentos militares:',
    footerModel: 'Modelo analítico da Peaceful World',
  }),
  ar: Object.freeze({
    spend: 'يبلغ الإنفاق العسكري العالمي اليومي {value}.',
    alternative: 'إعادة تخصيص هذه الأموال ليوم واحد يمكن أن تتيح بدلاً من ذلك:',
    cardKicker: 'التكلفة العالمية للنزاعات',
    cardHeadline: 'ينفق العالم يومياً على الأسلحة:',
    school: 'بناء {value} مدرسة جديدة',
    linkLabel: 'نموذج تفاعلي لتكلفة الفرصة البديلة للميزانيات العسكرية:',
    footerModel: 'النموذج التحليلي لـ Peaceful World',
  }),
  fa: Object.freeze({
    spend: 'هزینه روزانه نظامی جهان {value} است.',
    alternative: 'بازتخصیص این منابع برای یک روز می‌تواند به جای آن امکان دهد:',
    cardKicker: 'هزینه جهانی درگیری‌ها',
    cardHeadline: 'جهان هر روز برای تسلیحات هزینه می‌کند:',
    school: 'ساخت {value} مدرسه جدید',
    linkLabel: 'مدل تعاملی هزینه فرصت بودجه‌های نظامی:',
    footerModel: 'مدل تحلیلی Peaceful World',
  }),
  ru: Object.freeze({
    spend: 'Ежедневные глобальные расходы на оборону составляют {value}.',
    alternative: 'Альтернативное распределение данных средств в течение одного дня позволило бы:',
    cardKicker: 'ГЛОБАЛЬНЫЕ ИЗДЕРЖКИ КОНФЛИКТОВ',
    cardHeadline: 'Ежедневно мир тратит на оружие:',
    school: 'Строительство {value} новых школ',
    linkLabel: 'Интерактивная модель анализа альтернативной стоимости оборонных бюджетов:',
    footerModel: 'Аналитическая модель Peaceful World',
  }),
  hi: Object.freeze({
    spend: 'दुनिया का दैनिक सैन्य व्यय {value} है।',
    alternative: 'इन धनराशियों को एक दिन के लिए पुनः आवंटित करने से इसके बजाय संभव हो सकता है:',
    cardKicker: 'संघर्षों की वैश्विक लागत',
    cardHeadline: 'दुनिया हर दिन हथियारों पर खर्च करती है:',
    school: '{value} नए स्कूलों का निर्माण',
    linkLabel: 'सैन्य बजट की अवसर लागत का इंटरैक्टिव मॉडल:',
    footerModel: 'Peaceful World विश्लेषणात्मक मॉडल',
  }),
  ukr: Object.freeze({
    spend: 'Щоденні глобальні військові витрати становлять {value}.',
    alternative: 'Альтернативний розподіл цих коштів протягом одного дня дав би змогу:',
    cardKicker: 'ГЛОБАЛЬНІ ВИТРАТИ КОНФЛІКТІВ',
    cardHeadline: 'Щодня світ витрачає на зброю:',
    school: 'Будівництво {value} нових шкіл',
    linkLabel: 'Інтерактивна модель альтернативної вартості військових бюджетів:',
    footerModel: 'Аналітична модель Peaceful World',
  }),
  'zh-CN': Object.freeze({
    spend: '全球每日军费开支为 {value}。',
    alternative: '如果将一天的这笔资金重新分配，则可以用于：',
    cardKicker: '全球冲突成本',
    cardHeadline: '世界每天用于武器的支出：',
    school: '建设 {value} 所新学校',
    linkLabel: '军事预算机会成本互动模型：',
    footerModel: 'Peaceful World 分析模型',
  }),
});

const PUBLIC_PAGE_PATHS = Object.freeze({
  en: '', de: '/de', es: '/es', fr: '/fr', pt: '/pt', ar: '/ar', fa: '/fa', ru: '/ru', hi: '/hi', ukr: '/ukr', 'zh-CN': '/zh-cn',
});

const controls = {
  language: document.querySelector('#language'),
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

function dailyCopy() {
  return DAILY_FACT_COPY[language()] || DAILY_FACT_COPY.en;
}

function publicPageUrl() {
  return `https://peaceful-world.org/true-cost-of-war${PUBLIC_PAGE_PATHS[language()] ?? ''}`;
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
  const parity = disseminationParityCopy(language());
  setText(el.shareTitle, t.shareTitle);
  setText(el.shareIntro, t.shareIntro);
  const secondary = ensureSecondaryIntro();
  if (secondary) {
    secondary.hidden = !parity?.secondary;
    setText(secondary, parity?.secondary || '');
  }
  setText(el.buildText, t.shareText);
  setText(el.buildCard, t.shareCard);
  setText(el.copyText, t.copy);
  setText(el.downloadCard, t.download);
  const downloadNote = ensureDownloadNote();
  if (downloadNote) {
    downloadNote.hidden = !parity?.downloadNote;
    setText(downloadNote, parity?.downloadNote || '');
  }
}

// One canonical fact object feeds both dissemination outputs. It deliberately
// has no dependency on calculator mode, birth year or redistribution share.
function canonicalDailyFact() {
  const copy = dailyCopy();
  const c = source();
  const m = meta();
  const values = dailyShareValues(model);
  const dailyMoney = formatMoney(values.dailySpend, m, { short: true });
  const food = fillValueTemplate(c.session.foodTemplate, formatCompactPeople(values.foodPeople, m));
  const health = fillValueTemplate(c.session.healthTemplate, formatCompactPeople(values.healthPeople, m));
  const poverty = fillValueTemplate(c.session.povertyTemplate, formatCompactPeople(values.povertyPeople, m));
  const schools = copy.school.replace('{value}', formatInteger(Math.floor(values.schools), m));

  return Object.freeze({
    dailyMoney,
    spendSentence: copy.spend.replace('{value}', dailyMoney),
    alternative: copy.alternative,
    food,
    health,
    poverty,
    schools,
    cardKicker: copy.cardKicker,
    cardHeadline: copy.cardHeadline,
    linkLabel: copy.linkLabel,
    footerModel: copy.footerModel,
    url: publicPageUrl(),
  });
}

function summaryText() {
  const fact = canonicalDailyFact();
  return [
    fact.spendSentence,
    '',
    fact.alternative,
    `• ${fact.food}`,
    `• ${fact.health}`,
    `• ${fact.poverty}`,
    '',
    fact.linkLabel,
    fact.url,
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
  const fact = canonicalDailyFact();
  const m = meta();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const rtl = m.dir === 'rtl';
  const x = rtl ? 1000 : 80;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // Deliberately return to the quieter original dissemination-card structure:
  // one daily number, one opportunity-cost list, one source line.
  ctx.fillStyle = '#061126';
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 28px Arial, sans-serif';
  ctx.fillText(fact.cardKicker, x, 95);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 48px Arial, sans-serif';
  wrapCanvasText(ctx, fact.cardHeadline, x, 165, 920, 58, 2);

  ctx.fillStyle = '#f87171';
  ctx.font = '900 112px Arial, sans-serif';
  ctx.fillText(fact.dailyMoney, x, 330);

  ctx.strokeStyle = 'rgba(148,163,184,.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rtl ? 80 : 80, 410);
  ctx.lineTo(rtl ? 1000 : 1000, 410);
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = '800 25px Arial, sans-serif';
  wrapCanvasText(ctx, fact.alternative.toUpperCase(), x, 475, 920, 34, 3);

  const bullets = [fact.food, fact.health, fact.poverty, fact.schools];
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px Arial, sans-serif';
  let y = 590;
  for (const line of bullets) {
    const bulletLine = `• ${line}`;
    const used = wrapCanvasText(ctx, bulletLine, x, y, 920, 40, 2);
    y += Math.max(62, used * 40 + 18);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px Arial, sans-serif';
  ctx.fillText(fact.footerModel, x, 1000);
  ctx.textAlign = rtl ? 'left' : 'right';
  ctx.fillText('peaceful-world.org', rtl ? 80 : 1000, 1000);
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
  link.download = `true-cost-of-war-daily-${language()}-${Date.now()}.png`;
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
