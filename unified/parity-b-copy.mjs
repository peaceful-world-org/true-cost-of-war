import { legacyCopy } from './legacy-copy.mjs';

const PROGRAMME_ORDER = Object.freeze([
  'education',
  'hunger',
  'health',
  'water',
  'electricity',
  'internet',
  'climate',
  'schools',
]);

// These three labels describe controls introduced by the unified shell rather
// than claims from the published calculator. All substantive copy is loaded
// from legacy-copy.json, which is generated from the existing localized pages.
const UI_ONLY = Object.freeze({
  en: {
    developmentAllocation: 'Redirected to development',
    defenceAllocation: 'Remaining military expenditure',
    showLess: 'Show fewer programmes',
  },
  de: {
    developmentAllocation: 'Für Entwicklung umgeleitet',
    defenceAllocation: 'Verbleibende Militärausgaben',
    showLess: 'Weniger Programme anzeigen',
  },
  es: {
    developmentAllocation: 'Redirigido al desarrollo',
    defenceAllocation: 'Gasto militar restante',
    showLess: 'Mostrar menos programas',
  },
  fr: {
    developmentAllocation: 'Réaffecté au développement',
    defenceAllocation: 'Dépenses militaires restantes',
    showLess: 'Afficher moins de programmes',
  },
  pt: {
    developmentAllocation: 'Redirecionado para o desenvolvimento',
    defenceAllocation: 'Despesa militar restante',
    showLess: 'Mostrar menos programas',
  },
  ar: {
    developmentAllocation: 'معاد توجيهه إلى التنمية',
    defenceAllocation: 'الإنفاق العسكري المتبقي',
    showLess: 'عرض برامج أقل',
  },
  fa: {
    developmentAllocation: 'بازتخصیص‌یافته به توسعه',
    defenceAllocation: 'هزینه نظامی باقی‌مانده',
    showLess: 'نمایش برنامه‌های کمتر',
  },
  ru: {
    developmentAllocation: 'Перенаправлено на развитие',
    defenceAllocation: 'Остается в военных расходах',
    showLess: 'Скрыть дополнительные направления ↑',
  },
  hi: {
    developmentAllocation: 'विकास के लिए पुनर्निर्देशित',
    defenceAllocation: 'शेष सैन्य व्यय',
    showLess: 'कम कार्यक्रम दिखाएँ',
  },
  ukr: {
    developmentAllocation: 'Перенаправлено на розвиток',
    defenceAllocation: 'Решта військових витрат',
    showLess: 'Показати менше програм',
  },
  'zh-CN': {
    developmentAllocation: '重新分配至发展',
    defenceAllocation: '剩余军事支出',
    showLess: '收起部分项目',
  },
});

function programmeValueTemplate(initialValue) {
  const text = String(initialValue || '').trim();
  if (!text) return '{value}';
  const replaced = text.replace(/[0٠۰](?:[.,][0٠۰]+)?/, '{value}');
  return replaced.includes('{value}') ? replaced : '{value}';
}

export function parityCopy(language) {
  const source = legacyCopy(language);
  const ui = UI_ONLY[language] || UI_ONLY.en;

  return {
    subtitle: source.hero.subtitle,
    livePrefix: source.hero.livePrefix,
    liveSuffix: source.hero.liveSuffix,
    liveTemplate: source.hero.liveTemplate,
    lead: source.hero.lead,
    mainCaption: source.hero.mainCaption,
    sessionTitle: source.session.title,
    sessionNote: source.session.note,
    sessionAlternatives: source.session.alternatives,
    sessionTemplates: {
      food: source.session.foodTemplate,
      health: source.session.healthTemplate,
      poverty: source.session.povertyTemplate,
    },
    personalBurden: source.metrics.personal.label,
    personalBurdenDesc: source.metrics.personal.description,
    economicTitle: source.economic.title,
    economicIntro: source.economic.intro,
    directDeaths: source.metrics.direct.label,
    indirectDeaths: source.metrics.indirect.label,
    infrastructure: source.metrics.infrastructure.label,
    lifeYears: source.metrics.life.label,
    economicLoss: source.metrics.economicLoss.label,
    opportunityTitle: source.opportunity.title,
    opportunityIntro: source.opportunity.intro,
    scenarioSpectrum: source.opportunity.scenarioSpectrum,
    developmentAllocation: ui.developmentAllocation,
    defenceAllocation: ui.defenceAllocation,
    showMore: source.opportunity.showMore,
    showLess: ui.showLess,
    programmes: PROGRAMME_ORDER.map((key) => {
      const programme = source.opportunity.programmes[key];
      return [
        key,
        programme.label,
        programme.note,
        programme.tooltip,
        programmeValueTemplate(programme.initialValue),
      ];
    }),
    // Kept during the migration for compatibility with any older preview code.
    times: '',
    institutions: '',
  };
}
