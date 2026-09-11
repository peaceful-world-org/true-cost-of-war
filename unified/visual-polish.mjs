// UX-only motion layer for the unified preview.
//
// The shared runtime remains the source of truth. This module only softens
// visible text replacements in the live counters so rapidly updating numbers
// read as a continuous stream instead of a sequence of hard jumps.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const TARGETS = Object.freeze([
  ['#mainCounterValue', 92, 0.055],
  ['#viewerSpend', 122, 0.075],
  ['#sessionFood', 92, 0.06],
  ['#sessionHealth', 92, 0.06],
  ['#sessionPoverty', 92, 0.06],
]);

function animateUpdate(node, duration, distanceEm) {
  if (reducedMotion.matches || typeof node.animate !== 'function') return;

  const previous = node.__pwFlowAnimation;
  if (previous) previous.cancel();

  const animation = node.animate(
    [
      {
        transform: `translateY(${distanceEm}em)`,
        opacity: 0.86,
        filter: 'blur(0.18px)',
      },
      {
        transform: 'translateY(0)',
        opacity: 1,
        filter: 'blur(0)',
      },
    ],
    {
      duration,
      easing: 'cubic-bezier(.22,.72,.2,1)',
      fill: 'none',
    },
  );

  node.__pwFlowAnimation = animation;
  animation.finished.finally(() => {
    if (node.__pwFlowAnimation === animation) node.__pwFlowAnimation = null;
  }).catch(() => {});
}

function installFlow(node, duration, distanceEm) {
  if (!node || node.dataset.flowReady === 'true') return;

  node.dataset.flowReady = 'true';
  node.classList.add('pw-flow-value');
  let lastText = node.textContent;
  let tick = 0;

  const observer = new MutationObserver(() => {
    const nextText = node.textContent;
    if (nextText === lastText) return;
    lastText = nextText;
    tick += 1;
    node.dataset.flowTick = String(tick);
    animateUpdate(node, duration, distanceEm);
  });

  observer.observe(node, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function install() {
  for (const [selector, duration, distanceEm] of TARGETS) {
    installFlow(document.querySelector(selector), duration, distanceEm);
  }
  document.documentElement.dataset.motionPolish = 'ready';
}

install();
