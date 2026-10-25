/* Monthly file-backup assistant. No background-file-write promises and no
   extra training-data copies inside the storage that deletion would erase. */
(() => {
  const KEY = 'fitness-backup-preferences-v1';
  const DAY = 24 * 60 * 60 * 1000;
  const root = document.querySelector('#app');
  let scheduled = false;
  let busy = false;
  let shareUnavailable = false;
  let volatileState = null;
  let storageWarning = false;

  function validDate(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
  }

  function readState() {
    let raw = volatileState || {};
    if (!volatileState) {
      try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
    }
    return {
      version: 1,
      enabled: raw.enabled !== false,
      lastConfirmedAt: validDate(raw.lastConfirmedAt) ? raw.lastConfirmedAt : null,
      snoozedUntil: validDate(raw.snoozedUntil) ? raw.snoozedUntil : null,
      pending: validDate(raw.pending?.requestedAt) && typeof raw.pending?.filename === 'string'
        ? { requestedAt: raw.pending.requestedAt, filename: raw.pending.filename } : null
    };
  }

  function writeState(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      volatileState = null;
      storageWarning = false;
    } catch {
      volatileState = state;
      storageWarning = true;
      showToast('提醒设置暂未写入本机；仍可保存备份文件');
    }
    schedule();
  }

  // Calendar month, clamped at month end: Jan 31 → Feb 28/29.
  function nextMonth(value) {
    const date = new Date(value);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    return date;
  }

  function dateLabel(value) {
    const date = new Date(value);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function bundle() {
    return { version: 1, exportedAt: new Date().toISOString(), records: loadRecords(), profile: loadProfile(), weights: loadWeights() };
  }

  function hasData(data) {
    return Boolean(data.records.length || data.weights.length || data.profile.height);
  }

  function due(state, data) {
    return state.enabled && hasData(data) && (!state.lastConfirmedAt || Date.now() >= nextMonth(state.lastConfirmedAt).getTime());
  }

  function filename(now) {
    const pad = value => String(value).padStart(2, '0');
    return `动起来-完整备份-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  }

  async function exportCurrent(forceDownload = false) {
    if (busy) return;
    const data = bundle();
    if (!hasData(data)) return showToast('暂无可备份的数据');
    const name = filename(new Date(data.exportedAt));
    const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
    busy = true;
    schedule();
    try {
      const canShare = !forceDownload && !shareUnavailable && navigator.share && navigator.canShare?.({ files: [file] });
      if (canShare) {
        // Must be invoked in the originating user click, before any await.
        await navigator.share({ files: [file], title: '动起来 · 完整数据备份' });
        showToast('请确认已将 JSON 保存到“文件”中');
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        showToast('备份下载已发起，请确认保存到“文件”');
      }
      const state = readState();
      state.pending = { requestedAt: data.exportedAt, filename: name };
      state.snoozedUntil = null;
      // Sharing/downloading isn't proof that an independent file was saved.
      writeState(state);
    } catch (error) {
      if (error.name === 'AbortError') showToast('已取消备份，提醒仍会保留');
      else {
        shareUnavailable = true;
        showToast('系统分享未完成，请点击“下载 JSON”重试');
      }
    } finally {
      busy = false;
      schedule();
    }
  }

  function confirmSaved() {
    const state = readState();
    if (!state.pending) return;
    // Schedule from the file's creation date, not a later confirmation date.
    state.lastConfirmedAt = state.pending.requestedAt;
    state.pending = null;
    state.snoozedUntil = null;
    writeState(state);
    showToast('已记下备份日期，下个月到期后会再次提醒');
  }

  function statusText(state) {
    if (state.pending) return `已发起导出：${dateLabel(state.pending.requestedAt)}。保存文件后，请点击“已保存到文件”。`;
    if (!state.lastConfirmedAt) return '尚未确认保存过文件备份。建议现在保存第一份。';
    return `上次确认文件备份：${dateLabel(state.lastConfirmedAt)}${state.enabled ? ` · 下次提醒：${dateLabel(nextMonth(state.lastConfirmedAt).toISOString())}` : ' · 每月提醒已关闭'}`;
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function installSettings() {
    const exportButton = root.querySelector('[data-export="json"]');
    if (!exportButton || root.querySelector('[data-monthly-backup]')) return;
    const exportRow = exportButton.closest('.settings-row');
    const panel = document.createElement('div');
    panel.className = 'settings-row monthly-backup';
    panel.dataset.monthlyBackup = '';
    panel.innerHTML = `<div class="backup-heading"><div><h3>每月备份提醒</h3><p>每月到期后，打开 App 时提醒保存完整 JSON。</p></div><label class="backup-switch"><input type="checkbox" role="switch" aria-label="每月备份提醒" data-backup-toggle><span aria-hidden="true"></span></label></div><p class="backup-status" data-backup-status role="status" aria-live="polite"></p><p class="backup-help">iPhone 点“保存备份”后，可在系统分享菜单中选择“存储到文件”。网页关闭时无法定时写入文件；删除网页版或清除网站数据可能丢失记录。</p><div class="backup-actions"><button type="button" class="btn btn-secondary" data-backup-save>保存备份</button><button type="button" class="btn btn-primary" data-backup-confirm hidden>已保存到文件</button></div>`;
    exportRow.before(panel);
  }

  function update() {
    scheduled = false;
    installSettings();
    const state = readState();
    const data = bundle();
    const dataExists = hasData(data);
    const recording = /^#(?:new|edit|detail)(?:\/|$)/.test(location.hash);
    let banner = document.querySelector('[data-backup-banner]');
    const snoozed = state.snoozedUntil && Date.now() < Date.parse(state.snoozedUntil);
    const show = !recording && dataExists && !snoozed && (state.pending || due(state, data));
    if (show && !banner) {
      banner = document.createElement('section');
      banner.className = 'backup-banner';
      banner.dataset.backupBanner = '';
      banner.setAttribute('aria-label', '文件备份提醒');
      banner.innerHTML = `<div><strong data-backup-title></strong><p data-backup-message></p></div><div class="backup-actions"><button type="button" class="btn btn-primary" data-backup-save>保存备份</button><button type="button" class="btn btn-secondary" data-backup-confirm hidden>已保存到文件</button><button type="button" class="btn btn-ghost" data-backup-later>明天提醒</button></div>`;
      root.before(banner);
    }
    if (banner) {
      banner.hidden = !show;
      setText(banner.querySelector('[data-backup-title]'), state.pending ? '再确认一下：文件保存好了吗？' : state.lastConfirmedAt ? '本月的训练，也留一份备份' : '给训练记录留一份文件备份');
      setText(banner.querySelector('[data-backup-message]'), state.pending ? '下载或分享不代表文件已保存。请先在“文件”App 中确认，再点下方按钮。' : '记录目前只在此网页版内。保存完整 JSON 后，更换设备或重新添加 App 时才能导入恢复。');
    }
    document.querySelectorAll('[data-backup-confirm]').forEach(button => button.hidden = !state.pending);
    document.querySelectorAll('[data-backup-save]').forEach(button => {
      button.disabled = busy || !dataExists;
      setText(button, busy ? '正在准备…' : shareUnavailable ? '下载 JSON' : state.pending ? '重新保存' : '保存备份');
    });
    const toggle = root.querySelector('[data-backup-toggle]');
    if (toggle) toggle.checked = state.enabled;
    setText(root.querySelector('[data-backup-status]'), statusText(state) + (storageWarning ? ' 提醒设置未能持久保存。' : ''));
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(update, 0);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-backup-save], [data-backup-confirm], [data-backup-later]');
    if (!button || button.disabled) return;
    if (button.matches('[data-backup-save]')) exportCurrent();
    else if (button.matches('[data-backup-confirm]')) confirmSaved();
    else {
      const state = readState();
      state.snoozedUntil = new Date(Date.now() + DAY).toISOString();
      writeState(state);
    }
  });
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-backup-toggle]')) return;
    const state = readState();
    state.enabled = event.target.checked;
    state.snoozedUntil = null;
    writeState(state);
    showToast(state.enabled ? '已开启每月备份提醒' : '已关闭每月备份提醒，仍可手动备份');
  });
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  window.addEventListener('pageshow', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('storage', event => {
    if (!event.key || [KEY, STORAGE_KEY, PROFILE_KEY, WEIGHT_KEY].includes(event.key)) schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule();
  });
  document.addEventListener('submit', schedule, true);
  setInterval(() => { if (document.visibilityState === 'visible') schedule(); }, 60 * 60 * 1000);
  window.monthlyBackup = Object.freeze({ exportCurrent, refresh: schedule });
  schedule();
})();
