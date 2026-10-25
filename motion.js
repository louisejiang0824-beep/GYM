/* State transitions only. Never replay a page entrance during form entry. */
(() => {
  const root = document.querySelector('#app');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  const counterStates = new WeakMap();
  const pendingCounters = new Set();
  const closeAnimations = new WeakMap();
  const activeAnimations = new Set();
  let firstNode;
  let frame;
  let keyboardNavigation = false;

  function animate(node, keyframes, duration = 240) {
    if (reduced.matches || !node?.animate) return null;
    const animation = node.animate(keyframes, { duration, easing: ease });
    activeAnimations.add(animation);
    animation.finished.catch(() => {}).finally(() => activeAnimations.delete(animation));
    return animation;
  }

  function counters() {
    root.querySelectorAll('.stat-card strong, .progress-stat-card > strong').forEach(node => {
      if (counterStates.has(node)) return;
      const text = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
      const target = Number(text?.textContent.trim());
      const state = { text, target, frame: 0 };
      counterStates.set(node, state);
      if (reduced.matches || !text || !Number.isFinite(target) || target <= 0) return;
      pendingCounters.add(state);
      const started = performance.now();
      function tick(time) {
        if (!node.isConnected || reduced.matches) {
          text.textContent = String(target);
          pendingCounters.delete(state);
          return;
        }
        const progress = Math.min(1, (time - started) / 440);
        text.textContent = String(Math.round(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) state.frame = requestAnimationFrame(tick);
        else pendingCounters.delete(state);
      }
      state.frame = requestAnimationFrame(tick);
    });
  }

  function workoutState() {
    root.querySelectorAll('[data-exercise-card]').forEach((card, index) => {
      card.dataset.exerciseNumber = String(index + 1).padStart(2, '0');
      const label = card.querySelector('.exercise-name-fields > label');
      if (label) label.dataset.number = `${index + 1} · `;
      card.querySelectorAll('.set-row').forEach(row => {
        const complete = Number(row.querySelector('[data-set-reps]')?.value) > 0;
        row.classList.toggle('is-filled', complete);
        row.classList.toggle('is-warmup', Boolean(row.querySelector('[data-set-warmup]')?.checked));
      });
    });
  }

  function decorate() {
    frame = 0;
    if (firstNode !== root.firstElementChild) {
      firstNode = root.firstElementChild;
      const route = location.hash || '#dashboard';
      root.dataset.route = route.split('/')[0].slice(1);
      if (!/^#(?:new|edit)(?:\/|$)/.test(route)) {
        animate(root, [{ opacity: .4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }]);
      }
      if (keyboardNavigation) {
        const heading = root.querySelector('h1, #form-title');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true });
        keyboardNavigation = false;
      }
    }
    counters();
    workoutState();
  }

  new MutationObserver(() => {
    if (!frame) frame = requestAnimationFrame(decorate);
  }).observe(root, { childList: true, subtree: true });
  root.addEventListener('input', workoutState);
  root.addEventListener('change', workoutState);

  // Retain native details semantics and handlers; animate content and siblings.
  document.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    if (!summary || event.target.closest('button, a, input')) return;
    const details = summary.parentElement;
    const contents = [...details.children].filter(child => child !== summary);
    const previous = closeAnimations.get(details);
    if (previous) {
      previous.cancel();
      closeAnimations.delete(details);
      event.preventDefault();
      return;
    }
    if (reduced.matches) return;
    const siblings = [...details.parentElement.children].filter(node => node !== details);
    const before = siblings.map(node => [node, node.getBoundingClientRect().top]);
    const settle = () => requestAnimationFrame(() => {
      before.forEach(([node, top]) => {
        const delta = top - node.getBoundingClientRect().top;
        if (Math.abs(delta) > 1) animate(node, [{ transform: `translateY(${delta}px)` }, { transform: 'none' }]);
      });
    });
    if (details.open && contents.length) {
      event.preventDefault();
      const animations = contents.map(node => animate(node, [{ opacity: 1 }, { opacity: 0 }], 130)).filter(Boolean);
      const token = { cancel: () => animations.forEach(animation => animation.cancel()) };
      closeAnimations.set(details, token);
      Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (closeAnimations.get(details) !== token) return;
        details.open = false;
        closeAnimations.delete(details);
        settle();
      }).catch(() => {});
    } else {
      requestAnimationFrame(() => {
        contents.forEach(node => animate(node, [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }]));
        settle();
      });
    }
  });

  root.addEventListener('click', event => {
    const toggle = event.target.closest('.exercise-collapse-toggle');
    if (toggle && !reduced.matches) {
      const card = toggle.closest('[data-exercise-card]');
      const siblings = [...card.parentElement.children];
      const before = siblings.map(node => [node, node.getBoundingClientRect().top]);
      requestAnimationFrame(() => {
        before.forEach(([node, top]) => {
          const delta = top - node.getBoundingClientRect().top;
          if (Math.abs(delta) > 1) animate(node, [{ transform: `translateY(${delta}px)` }, { transform: 'none' }]);
        });
        if (!card.classList.contains('is-collapsed')) animate(card.querySelector('.set-table'), [{ opacity: 0 }, { opacity: 1 }]);
      });
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.closest('a[href^="#"]')) keyboardNavigation = true;
  });
  document.querySelector('.skip-link')?.addEventListener('click', event => {
    event.preventDefault();
    root.focus();
  });
  document.addEventListener('click', event => {
    const day = event.target.closest('[data-summary-date]');
    if (!day) return;
    root.querySelectorAll('[data-summary-date]').forEach(node => {
      const selected = node === day;
      node.classList.toggle('is-selected', selected);
      node.setAttribute('aria-pressed', String(selected));
    });
    animate(root.querySelector('#summary-day-detail'), [{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }]);
  });

  // Keep the real import dialog keyboard-contained and restore its opener.
  let modal;
  let opener;
  let wasInert = false;
  const shell = document.querySelector('.app-shell');
  new MutationObserver(() => {
    const next = document.querySelector('[data-import-modal]');
    if (next === modal) return;
    if (next) {
      opener = document.activeElement;
      wasInert = shell.inert;
      shell.inert = true;
      document.body.classList.add('has-import');
      next.querySelector('[data-close-import]')?.focus({ preventScroll: true });
    } else {
      shell.inert = wasInert;
      document.body.classList.remove('has-import');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
    modal = next;
  }).observe(document.body, { childList: true });
  document.addEventListener('keydown', event => {
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); closeImportWindow(); }
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')].filter(node => node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    activeAnimations.forEach(animation => animation.finish());
    pendingCounters.forEach(state => {
      cancelAnimationFrame(state.frame);
      state.text.textContent = String(state.target);
    });
    pendingCounters.clear();
  });
  decorate();
})();
