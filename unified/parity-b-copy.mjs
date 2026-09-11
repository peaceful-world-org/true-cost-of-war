import { legacyCopy } from './legacy-copy.mjs';
import { shellUiCopy } from './ui-copy.mjs';

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

function programmeValueTemplate(initialValue) {
  const text = String(initialValue || '').trim();
  if (!text) return '{value}';
  const replaced = text.replace(/[0٠۰](?:[.,][0٠۰]+)?/, '{value}');
  return replaced.includes('{value}') ? replaced : '{value}';
}

export function parityCopy(language) {
  const source = legacyCopy(language);
  const ui = shellUiCopy(language);

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
    scenarioTitle: source.opportunity.scenarioTitle,
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
  };
}
