/* Quiet visual confirmation for taps and key workout actions. */
(() => {
  function flash(element) {
    if (!element) return;
    element.classList.remove('tap-feedback');
    void element.offsetWidth;
    element.classList.add('tap-feedback');
    setTimeout(() => element.classList.remove('tap-feedback'), 420);
  }
  function highlightNew(element) {
    if (!element) return;
    element.classList.remove('item-added');
    void element.offsetWidth;
    element.classList.add('item-added');
    setTimeout(() => element.classList.remove('item-added'), 750);
  }
  document.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target.closest('button, a, select, summary') : null;
    if (!element) return;
    flash(element);
    if (element.matches('#add-exercise')) {
      const cards = document.querySelectorAll('[data-exercise-card]');
      const card = cards[cards.length - 1];
      highlightNew(card);
      card?.scrollIntoView({behavior: 'smooth', block: 'center'});
      showToast('动作已添加，请选择动作名称');
    } else if (element.matches('.add-set')) {
      const card = element.closest('[data-exercise-card]');
      const rows = card?.querySelectorAll('.set-row');
      const row = rows?.[rows.length - 1];
      highlightNew(row);
      row?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      showToast('第 ' + (rows?.length || 1) + ' 组已添加');
    } else if (element.matches('.remove-exercise')) {
      showToast('动作已删除');
    } else if (element.matches('.remove-set')) {
      showToast('这一组已删除');
    }
  });
  window.addEventListener('hashchange', () => {
    app.classList.remove('route-enter');
    if (/^#(?:new|edit(?:\/|$))/.test(location.hash)) return;
    void app.offsetWidth;
    app.classList.add('route-enter');
    setTimeout(() => app.classList.remove('route-enter'), 360);
  });
})();
