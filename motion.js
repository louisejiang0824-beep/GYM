/* Apple-inspired motion layer: short, purposeful, and fully reducible. */
(() => {
  const appRoot = document.querySelector('#app');
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceQuery.matches;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function animateCounters(root) {
    root.querySelectorAll('.stat-card strong').forEach(node => {
      if (node.dataset.motionCounter) return;
      const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
      const target = Number(textNode?.textContent?.trim());
      node.dataset.motionCounter = Number.isFinite(target) && target > 0 ? 'ready' : 'skip';
      if (reduced || !Number.isFinite(target) || target <= 0 || !textNode) return;
      textNode.textContent = '0';
      const started = performance.now();
      const duration = 520;
      const tick = now => {
        const progress = clamp((now - started) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        textNode.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function animatePage() {
    if (!appRoot) return;
    appRoot.dataset.motionRoute = location.hash || '#dashboard';
    const items = appRoot.querySelectorAll('.hero, .stats, .summary-stats, .section-heading, .record-card, .panel, .app-disclosure, .workout-type-field, .cardio-type-option, .exercise-card, .form-footer');
    items.forEach((item, index) => {
      item.style.setProperty('--motion-index', String(Math.min(index, 10)));
      item.classList.toggle('motion-visible', reduced);
      item.classList.add('motion-item');
      if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => item.classList.add('motion-visible')));
    });
    animateCounters(appRoot);
  }

  reduceQuery.addEventListener?.('change', event => {
    reduced = event.matches;
    animatePage();
  });
  window.addEventListener('hashchange', () => requestAnimationFrame(animatePage));
  if (!appRoot) return;
  new MutationObserver(mutations => {
    const contentChanged = mutations.some(({ target }) => {
      const element = target instanceof Element ? target : target.parentElement;
      return !element?.closest('.stat-card strong');
    });
    if (contentChanged) requestAnimationFrame(animatePage);
  }).observe(appRoot, { childList: true, subtree: true });
  animatePage();
})();
