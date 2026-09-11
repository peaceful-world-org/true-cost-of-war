// Remove presentation-only remnants from copy extracted out of the legacy HTML.
//
// In the production pages, info triggers are inline elements whose visible text
// is the lowercase Latin letter "i". The unified UI renders its own info button,
// so that legacy marker must not survive as ordinary copy beside the new icon.

function isTooltipKey(key) {
  return String(key || '').toLowerCase().includes('tooltip');
}

export function stripLegacyInfoMarkers(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/(^|\s)i(?=\s|[.,;:!?)]|$)/gu, '$1')
    .replace(/\s+([.,;:!?])/gu, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function sanitizeLegacyCopy(value, key = '') {
  if (typeof value === 'string') {
    return isTooltipKey(key) ? value : stripLegacyInfoMarkers(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLegacyCopy(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeLegacyCopy(childValue, childKey),
      ]),
    );
  }

  return value;
}
