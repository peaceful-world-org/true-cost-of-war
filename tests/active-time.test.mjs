import assert from 'node:assert/strict';
import test from 'node:test';

import { createActiveTimeTracker } from '../src/active-time.mjs';

test('active clock counts visible time and ignores hidden time', () => {
  let clock = 0;
  const tracker = createActiveTimeTracker({ now: () => clock, initiallyActive: true });

  clock = 5_000;
  assert.equal(tracker.elapsedMs(), 5_000);

  tracker.pause();
  clock = 65_000;
  assert.equal(tracker.elapsedMs(), 5_000);

  tracker.resume();
  clock = 70_000;
  assert.equal(tracker.elapsedMs(), 10_000);
});

test('pause and resume are idempotent', () => {
  let clock = 100;
  const tracker = createActiveTimeTracker({ now: () => clock, initiallyActive: false });

  tracker.pause();
  clock = 200;
  tracker.resume();
  tracker.resume();
  clock = 700;
  tracker.pause();
  tracker.pause();

  assert.equal(tracker.elapsedMs(), 500);
  assert.equal(tracker.isActive(), false);
});
