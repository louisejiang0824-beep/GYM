/* Feedback follows the actual result, including minimum-row guards. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function highlightNew(element) {
    if (!element) return;
    element.classList.add('item-added');
    setTimeout(() => element.classList.remove('item-added'), 800);
    const rect = element.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight - 96) {
      element.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'nearest' });
    }
  }
  document.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target.closest('button') : null;
    if (!element || element.disabled) return;
    const card = element.closest('[data-exercise-card]');
    const beforeCards = document.querySelectorAll('[data-exercise-card]').length;
    const beforeRows = card?.querySelectorAll('.set-row').length || 0;
    // Capture before the existing handlers; report only successful mutations.
    setTimeout(() => {
      const cards = document.querySelectorAll('[data-exercise-card]');
      const rows = card?.querySelectorAll('.set-row');
      if (element.matches('#add-exercise') && cards.length > beforeCards) {
        highlightNew(cards[cards.length - 1]);
        showToast('动作已添加，选择名称后开始记录');
      } else if (element.matches('.add-set') && rows?.length > beforeRows) {
        highlightNew(rows[rows.length - 1]);
        showToast(`第 ${rows.length} 组已添加`);
      } else if (element.matches('.remove-exercise') && cards.length < beforeCards) {
        showToast('动作已删除');
      } else if (element.matches('.remove-set') && rows?.length < beforeRows) {
        showToast('这一组已删除');
      }
    }, 0);
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form.matches('#record-form')) return;
    setTimeout(() => {
      const errors = [...form.querySelectorAll('.error')].filter(node => node.textContent.trim());
      form.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute('aria-invalid'));
      if (!errors.length) return;
      errors.forEach((node, index) => {
        node.id ||= `form-feedback-${index}`;
        node.setAttribute('role', 'alert');
        node.closest('.field, .exercise-block')?.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(input => {
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', node.id);
        });
      });
      const scope = errors[0].closest('.field, .exercise-block') || errors[0];
      scope.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
      scope.querySelector('input:not([type="hidden"]), select')?.focus({ preventScroll: true });
      showToast('还有内容未填写，请检查标记的位置');
    }, 0);
  }, true);
  document.addEventListener('input', event => {
    if (event.target.getAttribute('aria-invalid') === 'true') event.target.removeAttribute('aria-invalid');
  });
})();
