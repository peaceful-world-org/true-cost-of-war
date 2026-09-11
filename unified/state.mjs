const DEFAULTS = Object.freeze({ mode: 'year', birthYear: '1990', share: '10' });

function clampInteger(raw, min, max, fallback) {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return String(fallback);
  return String(Math.min(max, Math.max(min, value)));
}

export function readCandidateState(search, supportedLanguages, defaultLanguage = 'en') {
  const params = new URLSearchParams(search || '');
  const requestedLanguage = params.get('lang');
  const language = supportedLanguages.includes(requestedLanguage) ? requestedLanguage : defaultLanguage;
  const mode = params.get('mode') || DEFAULTS.mode;
  const share = clampInteger(params.get('share'), 5, 50, DEFAULTS.share);
  // Reference links historically use `year`; v0.2/v0.3 preview links used
  // `birth`. Read both during migration and write only the reference name.
  const requestedYear = params.get('year') ?? params.get('birth');
  const birthYear = clampInteger(requestedYear, 1920, new Date().getFullYear(), DEFAULTS.birthYear);
  return { language, mode, share, birthYear };
}

export function writeCandidateState(urlLike, state) {
  const url = new URL(urlLike, 'https://preview.invalid/');
  url.searchParams.set('lang', state.language);
  url.searchParams.set('mode', state.mode);
  url.searchParams.set('share', String(state.share));
  url.searchParams.set('year', String(state.birthYear));
  url.searchParams.delete('birth');
  return `${url.pathname}${url.search}${url.hash}`;
}
