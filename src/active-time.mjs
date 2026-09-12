// Active-viewing clock used by the unified preview session counter.
// Time is accumulated only while the document is visible. The clock accepts
// an injected monotonic `now` function so the behavior is deterministic in QA.

export function createActiveTimeTracker({ now = () => performance.now(), initiallyActive = true } = {}) {
  let accumulatedMs = 0;
  let activeSince = initiallyActive ? now() : null;

  function elapsedMs(at = now()) {
    if (activeSince === null) return accumulatedMs;
    return accumulatedMs + Math.max(0, at - activeSince);
  }

  function pause(at = now()) {
    if (activeSince === null) return accumulatedMs;
    accumulatedMs += Math.max(0, at - activeSince);
    activeSince = null;
    return accumulatedMs;
  }

  function resume(at = now()) {
    if (activeSince === null) activeSince = at;
    return elapsedMs(at);
  }

  function setActive(active, at = now()) {
    return active ? resume(at) : pause(at);
  }

  return {
    elapsedMs,
    elapsedSeconds(at = now()) {
      return elapsedMs(at) / 1000;
    },
    pause,
    resume,
    setActive,
    isActive() {
      return activeSince !== null;
    },
  };
}
