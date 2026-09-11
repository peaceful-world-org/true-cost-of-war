import assert from 'node:assert/strict';
import test from 'node:test';

import { readCandidateState, writeCandidateState } from '../unified/state.mjs';

const languages = ['en', 'ru', 'ar'];

test('preview state reads reference-compatible year query parameter', () => {
  assert.deepEqual(
    readCandidateState('?lang=ru&mode=10years&share=35&year=1988', languages, 'en'),
    { language: 'ru', mode: '10years', share: '35', birthYear: '1988' },
  );
});

test('preview state still reads legacy preview birth parameter during migration', () => {
  const state = readCandidateState('?lang=ru&mode=lifetime&share=25&birth=1987', languages, 'en');
  assert.equal(state.birthYear, '1987');
});

test('preview state falls back and clamps unsafe numeric values to the legacy scenario range', () => {
  const high = readCandidateState('?lang=xx&share=999&year=1800', languages, 'ar');
  assert.equal(high.language, 'ar');
  assert.equal(high.share, '50');
  assert.equal(high.birthYear, '1920');

  const low = readCandidateState('?lang=en&share=0', languages, 'en');
  assert.equal(low.share, '5');
});

test('preview state serializes the reference year parameter and removes birth', () => {
  const path = writeCandidateState(
    'https://peaceful-world-org.github.io/true-cost-of-war/unified/?lang=en&birth=1980#test',
    { language: 'ru', mode: 'hour', share: 25, birthYear: 1990 },
  );
  assert.equal(
    path,
    '/true-cost-of-war/unified/?lang=ru&mode=hour&share=25&year=1990#test',
  );
});
