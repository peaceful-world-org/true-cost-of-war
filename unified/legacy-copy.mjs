import { sanitizeLegacyCopy } from './legacy-copy-clean.mjs';
import {
  applyLocalizationOverrides,
  localizationOverrideLanguages,
} from './localization-overrides.mjs';

const response = await fetch('./legacy-copy.json', { cache: 'no-store' });
if (!response.ok) {
  throw new Error(`Unable to load generated legacy copy: HTTP ${response.status}`);
}

const rawLegacyCopyDocument = await response.json();

if (rawLegacyCopyDocument?.schemaVersion !== 1 || !rawLegacyCopyDocument.languages) {
  throw new Error('Generated legacy copy has an unsupported schema');
}

const languageKeys = new Set([
  ...Object.keys(rawLegacyCopyDocument.languages),
  ...localizationOverrideLanguages(),
]);

export const legacyCopyDocument = {
  ...rawLegacyCopyDocument,
  languages: Object.fromEntries(
    [...languageKeys].map((language) => [
      language,
      sanitizeLegacyCopy(
        applyLocalizationOverrides(
          language,
          'production',
          rawLegacyCopyDocument.languages[language] || {},
        ),
      ),
    ]),
  ),
};

export function legacyCopy(language) {
  return legacyCopyDocument.languages[language] || legacyCopyDocument.languages.en;
}

export function legacyLanguages() {
  return Object.keys(legacyCopyDocument.languages);
}
