/* Keep unfinished workout forms on this device so a tab swipe does not erase them. */
(() => {
  const DRAFT_KEY = 'fitness-workout-drafts-v1';
  let saveTimer;
  let observedForm;

  function routeKey() { return location.hash || '#new'; }
  function readDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
  function writeDrafts(drafts) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); } catch {} }
  function clearDraft(key = routeKey()) { const drafts = readDrafts(); delete drafts[key]; if (Object.keys(drafts).length) writeDrafts(drafts); else localStorage.removeItem(DRAFT_KEY); }
  function collectDraft() {
    const form = document.querySelector('#record-form');
    if (!form) return null;
    return {
      savedAt: Date.now(),
      date: document.querySelector('#date')?.value || '',
      startTime: document.querySelector('#start-time')?.value || '',
      endTime: document.querySelector('#end-time')?.value || '',
      note: document.querySelector('#note')?.value || '',
      bodyParts: [...document.querySelectorAll('input[name="part"]:checked')].map(input => input.value),
      exercises: typeof collectExercises === 'function' ? collectExercises() : []
    };
  }
  function saveDraft() {
    const draft = collectDraft();
    if (!draft) return;
    if (document.querySelector('#record-form')?.dataset.draftSubmitted === 'true' || document.querySelector('#record-form')?.dataset.draftSubmitting === 'true') return;
    const drafts = readDrafts();
    drafts[routeKey()] = draft;
    writeDrafts(drafts);
    const status = document.querySelector('[data-draft-status]');
    if (status) status.innerHTML = '<span><span class="draft-dot"></span>已自动保存草稿</span>' + (status.querySelector('[data-clear-draft]') ? '<button type="button" data-clear-draft>清除草稿</button>' : '');
    status?.querySelector('[data-clear-draft]')?.addEventListener('click', () => { clearDraft(); render(); });
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 120); }
  function draftSummary(draft) {
    const partsCount = draft.bodyParts?.length || 0;
    const exerciseCount = draft.exercises?.filter(item => item.name || item.sets?.some(set => set.reps || set.weight)).length || 0;
    return (partsCount ? partsCount + ' 个部位' : '尚未选择部位') + ' · ' + (exerciseCount ? exerciseCount + ' 个动作' : '尚未填写动作');
  }
  function restoreDraft(draft) {
    if (!draft) return false;
    const date = document.querySelector('#date');
    const start = document.querySelector('#start-time');
    const end = document.querySelector('#end-time');
    const note = document.querySelector('#note');
    if (date) date.value = draft.date || date.value;
    if (start) start.value = draft.startTime || '';
    if (end) end.value = draft.endTime || '';
    if (note) note.value = draft.note || '';
    document.querySelectorAll('input[name="part"]').forEach(input => { input.checked = (draft.bodyParts || []).includes(input.value); });
    if (Array.isArray(draft.exercises) && draft.exercises.length && typeof exerciseRow === 'function') {
      const list = document.querySelector('#exercise-list');
      if (list) {
        list.innerHTML = draft.exercises.map(exerciseRow).join('');
        if (typeof bindWorkoutControls === 'function') bindWorkoutControls();
      }
    }
    if (typeof syncWorkoutTime === 'function') syncWorkoutTime();
    return true;
  }
  function addStatus(form, restored, draft) {
    const panel = form.closest('.workout-form-panel');
    const existing = panel?.querySelectorAll('[data-draft-status]');
    if (existing?.length) {
      existing.forEach((node, index) => { if (index) node.remove(); });
      return;
    }
    const header = panel?.querySelector('.form-header');
    if (!header) return;
    const status = document.createElement('div');
    status.dataset.draftStatus = '';
    status.className = 'draft-status' + (restored ? ' is-restored' : '');
    status.innerHTML = restored
      ? '<span><span class="draft-dot"></span>已恢复未完成草稿 · ' + draftSummary(draft) + '</span><button type="button" data-clear-draft>清除草稿</button>'
      : '<span><span class="draft-dot"></span>填写内容会自动保存</span>';
    header.after(status);
    status.querySelector('[data-clear-draft]')?.addEventListener('click', () => { clearDraft(); render(); });
  }
  function wireForm() {
    const form = document.querySelector('#record-form');
    if (!form || form === observedForm) return;
    observedForm = form;
    const draft = readDrafts()[routeKey()];
    const restored = draft ? restoreDraft(draft) : false;
    addStatus(form, restored, draft);
    ['input', 'change'].forEach(type => form.addEventListener(type, scheduleSave));
    new MutationObserver(scheduleSave).observe(form, {childList: true, subtree: true});
  }
  function guardSubmit(event) {
    const form = event.target;
    if (!form?.matches('#record-form')) return;
    const before = JSON.stringify(loadRecords());
    const draftBeforeSubmit = collectDraft();
    form.dataset.draftSubmitting = 'true';
    clearTimeout(saveTimer);
    clearDraft();
    setTimeout(() => {
      if (JSON.stringify(loadRecords()) !== before) {
        form.dataset.draftSubmitted = 'true';
        delete form.dataset.draftSubmitting;
      } else {
        delete form.dataset.draftSubmitting;
        const drafts = readDrafts();
        if (draftBeforeSubmit) { drafts[routeKey()] = draftBeforeSubmit; writeDrafts(drafts); }
      }
    }, 0);
  }
  function checkForm() {
    if (location.hash.startsWith('#new') || location.hash.startsWith('#edit/')) wireForm();
    else observedForm = null;
  }
  new MutationObserver(checkForm).observe(app, {childList: true, subtree: true});
  window.addEventListener('hashchange', () => { observedForm = null; setTimeout(checkForm, 0); });
  window.addEventListener('pagehide', saveDraft);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveDraft(); });
  document.addEventListener('submit', guardSubmit, true);
  checkForm();
})();
