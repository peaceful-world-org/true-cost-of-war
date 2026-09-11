const params = new URLSearchParams(location.search);
const embedMode = params.get('embed') === '1';

if (embedMode) {
  document.documentElement.classList.add('pw-embed-mode');

  const root = document.querySelector('.pw-shell');
  let frame = null;

  function measuredHeight() {
    if (!root) return Math.ceil(document.documentElement.scrollHeight);
    const rect = root.getBoundingClientRect();
    return Math.ceil(Math.max(rect.height, root.scrollHeight));
  }

  function sendWidgetHeight() {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ type: 'pw2-resize', height: measuredHeight() }, '*');
  }

  function queueResize() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      sendWidgetHeight();
    });
  }

  window.addEventListener('load', queueResize);
  window.addEventListener('resize', queueResize);
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'pw2-request-resize') sendWidgetHeight();
  });

  if ('ResizeObserver' in window && root) {
    const observer = new ResizeObserver(queueResize);
    observer.observe(root);
  }

  const mutationObserver = new MutationObserver(queueResize);
  mutationObserver.observe(root || document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  queueResize();
}
