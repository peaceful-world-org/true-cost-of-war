const response = await fetch('./legacy-copy.json', { cache: 'no-store' });
if (!response.ok) {
  throw new Error(`Unable to load generated legacy copy: HTTP ${response.status}`);
}

export const legacyCopyDocument = await response.json();

if (legacyCopyDocument?.schemaVersion !== 1 || !legacyCopyDocument.languages) {
  throw new Error('Generated legacy copy has an unsupported schema');
}

export function legacyCopy(language) {
  return legacyCopyDocument.languages[language] || legacyCopyDocument.languages.en;
}

export function legacyLanguages() {
  return Object.keys(legacyCopyDocument.languages);
}
