/* Move existing nodes into native disclosures without replacing their handlers. */
(() => {
  const expanded = new Map();
  function fold(node, key, title, subtitle, open = false) {
    if (!node || node.closest('.app-disclosure')) return;
    const details = document.createElement('details');
    details.className = 'app-disclosure';
    details.open = expanded.get(key) ?? open;
    const summary = document.createElement('summary');
    const text = document.createElement('span');
    const heading = document.createElement('strong'); heading.textContent = title;
    const hint = document.createElement('small'); hint.textContent = subtitle;
    text.append(heading, hint); summary.append(text);
    details.append(summary); node.before(details); details.append(node);
    details.addEventListener('toggle', () => expanded.set(key, details.open));
  }
  function tidy() {
    const route = location.hash.split('/')[0];
    if (route === '#settings') {
      fold(app.querySelector('.profile-panel'), 'profile', '身体信息', '查看或修改身高、当前体重');
      const storage = [...app.querySelectorAll('.settings-row')].find(row => row.querySelector('h3')?.textContent === '数据存储');
      fold(storage?.closest('.panel'), 'storage', '数据与备份', '本机存储 · 导入 · 导出 · 清空数据');
      fold(app.querySelector('.weight-panel'), 'weights', '体重变化', '查看趋势、添加体重或管理历史记录');
    }
    if (route === '#summary') {
      const dayPanel = app.querySelector('#summary-day-detail');
      if (dayPanel) dayPanel.hidden = dayPanel.querySelector('.summary-day-title')?.textContent === '选择一个日期';
      fold(app.querySelector('#progress-action')?.closest('section'), 'progress', '动作进步曲线', '选择动作，查看重量与组数变化');
      // Select by content because wrapping changes direct-child indexes.
      const records = app.querySelector('[data-record-list]')?.closest('section');
      fold(records, 'records', '个人纪录', '查看各动作最大重量与单次最多组数');
      fold(app.querySelector('.muscle-week-panel'), 'muscles', '本周肌群组数', '展开查看各肌群训练统计');
      fold(app.querySelector('.weekly-panel'), 'weeks', '月内各周明细', '展开查看当前月份各周训练时长');
    }
  }
  new MutationObserver(tidy).observe(app, {childList:true, subtree:true});
  tidy();
})();
