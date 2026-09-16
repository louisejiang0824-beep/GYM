/* Derived views only: training records remain the single source of truth. */
function actionProgress(records) {
  const actions = new Map();
  [...records].sort((a,b) => a.date.localeCompare(b.date) || (a.createdAt || 0)-(b.createdAt || 0)).forEach(record => {
    const session = new Map();
    record.exercises.forEach(raw => {
      const exercise = normalizeExercise(raw);
      const sets = exercise.sets.filter(s => !s.isWarmup && Number(s.reps) > 0);
      if (!sets.length) return;
      const name = exercise.name.trim();
      if (!session.has(name)) session.set(name, {date:record.date,id:record.id,groups:0,weight:null});
      const point = session.get(name);
      point.groups += sets.length;
      sets.forEach(s => {
        const n = Number(s.weight);
        if (String(s.weight).trim() && Number.isFinite(n) && n >= 0) point.weight = Math.max(point.weight ?? 0, n);
      });
    });
    session.forEach((point,name) => {
      if (!actions.has(name)) actions.set(name, []);
      actions.get(name).push(point);
    });
  });
  return actions;
}
function progressChart(points, metric) {
  const values = points.filter(p => p[metric] !== null);
  if (!values.length) return '<p class="subtle">暂无可绘制的重量，请先记录数字重量（kg），或切换到组数。</p>';
  const maximum = Math.max(1,...values.map(p => p[metric]));
  const x = i => values.length === 1 ? 310 : 52 + i * 520 / (values.length-1);
  const y = value => 190 - value / maximum * 160;
  const unit = metric === 'weight' ? 'kg' : '组';
  return `<svg class="progress-chart" viewBox="0 0 620 235" role="img" aria-label="每次训练${metric === 'weight' ? '最大重量' : '工作组数'}变化"><g class="chart-grid">${[0,.5,1].map(t => `<line x1="52" x2="572" y1="${y(maximum*t)}" y2="${y(maximum*t)}"/><text x="44" y="${y(maximum*t)+4}" text-anchor="end">${+(maximum*t).toFixed(1)}</text>`).join('')}</g><polyline class="weight-line" points="${values.map((p,i)=>`${x(i)},${y(p[metric])}`).join(' ')}"/>${values.map((p,i)=>`<circle class="weight-dot" cx="${x(i)}" cy="${y(p[metric])}" r="4"><title>${p.date} · ${p[metric]} ${unit}</title></circle>`).join('')}<g class="chart-labels"><text x="52" y="220">${values[0].date.slice(5)}</text><text x="572" y="220" text-anchor="end">${values.length > 1 ? values.at(-1).date.slice(5) : ''}</text></g></svg>`;
}
function weekBounds(offset = 0) {
  const start = new Date(); start.setHours(0,0,0,0);
  start.setDate(start.getDate() - (start.getDay()+6)%7 + offset*7);
  const end = new Date(start); end.setDate(end.getDate()+6);
  return {start:dateKey(start),end:dateKey(end)};
}
function weekTotals(records, offset) {
  const bounds = weekBounds(offset);
  const selected = records.filter(r => r.date >= bounds.start && r.date <= bounds.end);
  return {...bounds, count:selected.length,days:new Set(selected.map(r=>r.date)).size,minutes:selected.reduce((s,r)=>s+Number(r.durationMinutes||0),0),sets:selected.reduce((s,r)=>s+effectiveSets(r),0)};
}
function weeklyMetricMarkup(label, value, unit, percent, delta) { const improved = delta > 0; const safePercent = Math.max(0, Math.min(100, percent)); const change = delta === 0 ? '与上周持平' : delta > 0 ? `比上周 +${delta} ${unit}` : `比上周 ${delta} ${unit}`; return `<div class="progress-stat-card${improved ? ' is-growing' : ''}"><div class="progress-stat-top"><span>${label}</span>${improved ? '<span class="progress-flame" aria-label="较上周增长">🔥</span>' : ''}</div><strong>${value}<small>${unit}</small></strong><div class="metric-progress" role="progressbar" aria-label="${label}相对上周进度" aria-valuenow="${Math.round(safePercent)}" aria-valuemin="0" aria-valuemax="100"><i style="--progress:${safePercent}%"></i></div><small class="metric-change">${change}</small></div>`; }
function attachProgress() {
  if (location.hash !== '#summary' || app.querySelector('#long-term-progress')) return;
  const anchor = app.querySelector('.calendar-panel');
  if (!anchor) return;
  const panel = document.createElement('section'); panel.id = 'long-term-progress';
  panel.innerHTML = `<section class="panel progress-panel"><div class="section-heading"><h2>每周训练总结</h2><div class="toolbar"><button class="btn btn-ghost" data-week-prev aria-label="上一周">上一周</button><button class="btn btn-ghost" data-week-next aria-label="下一周">下一周</button></div></div><div data-week-content aria-live="polite"></div><p class="progress-caption">周一至周日统计 · 每周日 21:00 查看总结</p></section><section class="panel progress-panel"><h2>动作进步与个人纪录</h2><div class="field"><label for="progress-action">选择动作</label><select id="progress-action"></select></div><div class="toolbar progress-metrics"><button class="btn btn-secondary" data-metric="weight">最大重量</button><button class="btn btn-ghost" data-metric="groups">工作组数</button></div><div data-progress-content></div><p class="progress-caption">每个点代表一次训练；同次训练的同名动作合并。不含热身组。最多组数不代表建议增加组数；未填写重量不算作 0 kg。</p></section><section class="panel progress-panel"><h2>全部动作个人纪录</h2><div data-record-list></div></section>`;
  anchor.before(panel);
  const records = loadRecords(); const actions = actionProgress(records);
  const select = panel.querySelector('#progress-action');
  select.innerHTML = actions.size ? [...actions.keys()].sort((a,b)=>a.localeCompare(b,'zh')).map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('') : '<option>暂无训练动作</option>';
  select.disabled = !actions.size;
  let metric = 'weight'; let offset = 0;
  function showWeek() {
    const current = weekTotals(records,offset), previous = weekTotals(records,offset-1);
    const delta = current.minutes-previous.minutes;
    const ratio = (value, baseline) => baseline > 0 ? value / baseline * 100 : value > 0 ? 100 : 0;
    const countDelta = current.count - previous.count;
    const setsDelta = current.sets - previous.sets;
    panel.querySelector('[data-week-content]').innerHTML = `<p class="subtle">${current.start} — ${current.end} · 相对上一周</p><div class="progress-stats"><div class="progress-stats-heading"><span>本周训练进度</span><small>每项与上一周比较</small></div>${weeklyMetricMarkup('训练次数', current.count, '次', ratio(current.count, previous.count), countDelta)}${weeklyMetricMarkup('训练分钟', current.minutes, '分钟', ratio(current.minutes, previous.minutes), delta)}${weeklyMetricMarkup('有效组数', current.sets, '组', ratio(current.sets, previous.sets), setsDelta)}</div><p>${current.count ? `比上一周${delta >= 0 ? '增加' : '减少'} ${Math.abs(delta)} 分钟，训练次数${countDelta >= 0 ? '增加' : '减少'} ${Math.abs(countDelta)} 次。` : '这一周还没有训练记录。'}</p>`;
    panel.querySelector('[data-week-next]').disabled = offset >= 0;
  }
  panel.querySelector('[data-week-prev]').onclick=()=>{offset--;showWeek();};
  panel.querySelector('[data-week-next]').onclick=()=>{if(offset<0)offset++;showWeek();};
  function recordMarkupFor(name, points) {
    const weighted = points.filter(p=>p.weight !== null);
    const heaviest = weighted.reduce((a,p)=>!a || p.weight>a.weight ? p:a,null);
    const most = points.reduce((a,p)=>!a || p.groups>a.groups ? p:a,null);
    return `<div class="progress-record"><strong>${esc(name)}</strong><div class="progress-record-values"><span>最大重量 <b>${heaviest ? `${heaviest.weight} kg` : '未记录'}</b>${heaviest ? `<small>${heaviest.date}</small>` : ''}</span><span>单次最多 <b>${most.groups} 组</b><small>${most.date}</small></span></div></div>`;
  }
  function draw() {
    const points=actions.get(select.value) || [];
    panel.querySelector('[data-progress-content]').innerHTML = points.length ? `${recordMarkupFor(select.value,points)}${progressChart(points,metric)}<details><summary>查看每次训练数据（${points.length} 次）</summary>${points.slice().reverse().map(p=>`<a class="progress-history" href="#detail/${encodeURIComponent(p.id)}"><span>${p.date}</span><span>${p.weight === null ? '未记录重量' : `${p.weight} kg`} · ${p.groups} 组</span></a>`).join('')}</details>` : '<p class="subtle">保存训练后，这里会自动生成进步曲线和纪录。</p>';
    panel.querySelectorAll('[data-metric]').forEach(b=>{b.className=`btn ${b.dataset.metric===metric?'btn-secondary':'btn-ghost'}`; b.setAttribute('aria-pressed',String(b.dataset.metric===metric));});
  }
  select.onchange=draw;
  panel.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{metric=b.dataset.metric;draw();});
  panel.querySelector('[data-record-list]').innerHTML = [...actions].map(([name,points])=>recordMarkupFor(name,points)).join('') || '<p class="subtle">暂无个人纪录。</p>';
  showWeek();draw();
}
new MutationObserver(attachProgress).observe(app,{childList:true,subtree:true});
attachProgress();
