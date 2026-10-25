/* Isolated browser storage: never touches the user's working records. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const url = 'file:///' + path.resolve(__dirname, '../index.html').replaceAll('\\', '/');
  const passes = [];
  const check = name => passes.push(name);
  const settle = () => page.waitForTimeout(180);
  async function route(name) { await page.goto(`${url}#${name}`); await settle(); }
  try {
    await route('dashboard');
    const date = await page.evaluate(() => dateKey(new Date()));
    const record = { id: 'ui-audit', type: 'strength', date, startTime: '18:00', endTime: '19:05', durationMinutes: 65, bodyParts: ['胸', '肩'], note: '长备注，保持自动换行。'.repeat(15), exercises: [{ name: '自定义长动作名称测试'.repeat(6), sets: [{ weight: '25', reps: 12, rir: 2, isWarmup: false }] }], createdAt: 1, updatedAt: 1 };
    const cardio = { id: 'cardio-audit', type: 'cardio', date, durationMinutes: 30, bodyParts: ['有氧'], cardioType: 'running', cardioData: { distance: 5 }, note: '', createdAt: 2, updatedAt: 2 };
    await page.evaluate(({ record, cardio }) => {
      localStorage.setItem('fitness-records-v1', JSON.stringify([record, cardio]));
      localStorage.setItem('fitness-weight-v1', JSON.stringify([{ id: 'weight-audit', date: record.date, weight: 72, createdAt: 1 }]));
      localStorage.setItem('fitness-profile-v1', JSON.stringify({ height: 175 }));
    }, { record, cardio });

    const overflow = [];
    for (const width of [320, 375, 393, 414, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 852 });
      for (const name of ['dashboard', 'new', 'history', 'detail/ui-audit', 'summary', 'settings']) {
        await route(name);
        await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
        await settle();
        const bad = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.right > innerWidth + 1 || rect.left < -1) && getComputedStyle(node).position !== 'absolute';
        }).map(node => `${node.tagName}.${node.className}`).slice(0, 8));
        if (bad.length) overflow.push({ width, name, bad });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `root overflow: ${width}/${name}`);
        if (width === 393 && ['dashboard', 'new', 'history', 'summary', 'settings'].includes(name)) {
          await page.screenshot({ path: path.join(__dirname, `refined-${name}.png`), fullPage: true });
        }
      }
      await route('new');
      await page.locator('[data-workout-type="cardio"]').click();
      for (const type of ['running', 'swimming', 'other']) {
        await page.locator(`[data-cardio-type="${type}"]`).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `cardio overflow: ${width}/${type}`);
      }
      await route('dashboard');
      await page.evaluate(() => localStorage.removeItem('fitness-workout-drafts-v1'));
    }
    assert.deepEqual(overflow, []);
    check('7 widths × 6 routes, open disclosures, cardio layouts: no horizontal overflow');

    await page.setViewportSize({ width: 393, height: 852 });
    await route('dashboard');
    await page.evaluate(() => localStorage.removeItem('fitness-workout-drafts-v1'));
    await route('new');
    const widths = await page.locator('#date, #start-time, #end-time').evaluateAll(nodes => nodes.map(node => ({ id: node.id, height: node.getBoundingClientRect().height })));
    assert(widths.every(item => item.height === 48));
    await page.locator('.remove-set').click();
    assert.match(await page.locator('#toast').innerText(), /至少保留一组/);
    await page.locator('.add-set').click();
    await settle();
    assert.equal(await page.locator('.set-row').count(), 2);
    assert.match(await page.locator('#toast').innerText(), /第 2 组已添加/);
    const cells = await page.locator('.set-row').first().evaluate(node => {
      const rect = selector => node.querySelector(selector).getBoundingClientRect();
      const w = rect('.set-weight'), r = rect('.set-reps'), d = rect('.remove-set');
      return { aligned: w.top === r.top, equal: Math.abs(w.width - r.width) < 1, distinct: d.left >= r.right - 1 };
    });
    assert.deepEqual(cells, { aligned: true, equal: true, distinct: true });
    await page.locator('.remove-set').last().click();
    check('minimum-row feedback, add/remove feedback, equal-width labelled set inputs');

    await page.locator('#record-form [type="submit"]').click();
    await page.locator('#start-time[aria-invalid="true"]').waitFor({ timeout: 3000 });
    assert.equal(await page.locator('#start-time').getAttribute('aria-invalid'), 'true');
    await page.locator('#start-time').fill('18:00');
    await page.locator('#end-time').fill('19:00');
    await page.locator('label[for="part-胸"]').click();
    await page.locator('[data-exercise-select]').selectOption('__custom__');
    await page.locator('[data-exercise="name"]').fill('自定义审核动作');
    await page.locator('[data-set-weight]').fill('30');
    await page.locator('[data-set-reps]').fill('10');
    await page.locator('#note').fill('草稿与保存审核');
    await page.locator('.exercise-collapse-toggle').click();
    assert.equal(await page.locator('.set-table').isVisible(), false);
    await page.locator('.exercise-collapse-toggle').click();
    assert.equal(await page.locator('[data-set-weight]').inputValue(), '30');
    await page.waitForTimeout(300);
    await route('history');
    await route('new');
    assert.equal(await page.locator('[data-exercise="name"]').inputValue(), '自定义审核动作');
    assert.equal(await page.locator('#note').inputValue(), '草稿与保存审核');
    check('invalid submission, accessible field feedback, collapse retains values, draft restoration');

    const oldRecords = await page.evaluate(() => loadRecords());
    await page.locator('#record-form [type="submit"]').click();
    await page.waitForURL(/#detail\//);
    const saved = await page.evaluate(() => loadRecords());
    assert.equal(saved.length, oldRecords.length + 1);
    assert.deepEqual(saved.slice(0, 2), oldRecords);
    const strength = saved.at(-1);
    assert.deepEqual(Object.keys(strength).sort(), ['id', 'type', 'date', 'startTime', 'endTime', 'durationMinutes', 'bodyParts', 'note', 'exercises', 'createdAt', 'updatedAt'].sort());
    assert.deepEqual(strength.exercises[0].sets[0], { weight: '30', reps: 10, rir: '', isWarmup: false });
    check('strength save: original records untouched, unchanged record/set schema');

    await route('new');
    await page.locator('[data-workout-type="cardio"]').click();
    await page.locator('#duration').fill('25');
    await page.locator('[data-cardio-field="distance"]').fill('4');
    await page.locator('#record-form [type="submit"]').click();
    await page.waitForURL(/#detail\//);
    const cardioSaved = await page.evaluate(() => loadRecords().at(-1));
    assert.equal(cardioSaved.type, 'cardio');
    assert.equal(cardioSaved.durationMinutes, 25);
    assert.equal(Number(cardioSaved.cardioData.distance), 4);
    check('cardio type switching, computed metrics and unchanged save flow');

    await route('history');
    await page.locator('#date-filter').fill('2000-01-01');
    assert.equal(await page.locator('#history-list .record-card').count(), 0);
    await page.locator('[data-clear-filter]').click();
    assert.equal(await page.locator('#history-list .record-card').count(), 4);
    assert.equal(await page.locator('.history-day').count(), 1);
    await route('summary');
    await page.locator(`[data-summary-date="${date}"]`).click();
    assert.equal(await page.locator(`[data-summary-date="${date}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#summary-day-detail .summary-session').count(), 4);
    await page.locator('[data-summary-prev]').click();
    await page.locator('[data-summary-today]').click();
    assert.equal(await page.locator(`[data-summary-date="${date}"]`).count(), 1);
    check('history grouping/filter/reset, summary date selection and month navigation');

    await route('settings');
    await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    await page.locator('[data-open-import]').focus();
    await page.locator('[data-open-import]').click();
    assert.equal(await page.locator('.app-shell').evaluate(node => node.inert), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-import-modal]').count(), 0);
    assert.equal(await page.locator('.app-shell').evaluate(node => node.inert), false);
    assert.equal(await page.locator('[data-open-import]').evaluate(node => node === document.activeElement), true);
    await page.locator('[data-open-import]').click();
    const imported = { ...record, id: 'imported-ui', note: '导入审核' };
    await page.locator('[data-import-file]').setInputFiles({ name: 'audit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, records: [imported], weights: [], profile: {} })) });
    await page.locator('[data-confirm-import]:enabled').waitFor();
    await page.locator('[data-confirm-import]').click();
    await page.waitForURL(/#history/);
    assert.equal(await page.locator('#history-list .record-card').count(), 5);
    check('import dialog focus/inert/Escape/restore and JSON import into history');

    await route('new');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('[data-exercise-select]').selectOption('__custom__');
    await page.locator('[data-exercise="name"]').fill('持续填写不重播动画');
    await page.locator('[data-set-reps]').fill('12');
    await settle();
    assert.equal(await page.locator('[data-set-reps]').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#app').evaluate(node => node.getAnimations().length), 0);
    await page.locator('#add-exercise').click();
    assert.equal(await page.locator('[data-exercise-card]').count(), 2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle();
    await route('dashboard');
    const finalNumbers = await page.locator('.stat-card strong').allTextContents();
    assert(finalNumbers[0].includes('1'));
    check('continuous input retains focus, no page replay, live reduced-motion preference');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await route('settings');
    const disclosure = page.locator('.app-disclosure').first();
    await disclosure.evaluate(node => node.open = false);
    await disclosure.locator(':scope > summary').click();
    await page.waitForTimeout(300);
    assert.equal(await disclosure.evaluate(node => node.open), true);
    await disclosure.locator(':scope > summary').click();
    await page.waitForTimeout(300);
    assert.equal(await disclosure.evaluate(node => node.open), false);
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#settings');
    assert.equal(await page.locator('#app').evaluate(node => node === document.activeElement), true);
    check('animated native disclosure open/close and skip-link preserves SPA route');

    const phone = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const touch = await phone.newPage();
    touch.on('pageerror', error => errors.push(error.stack || error.message));
    for (const size of [{ width: 393, height: 852 }, { width: 320, height: 640 }]) {
      await touch.setViewportSize(size);
      for (const name of ['dashboard', 'history', 'summary', 'settings', 'new']) {
        await touch.goto(`${url}#${name}`);
        await touch.waitForTimeout(100);
        assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await touch.locator('.form-footer').scrollIntoViewIfNeeded();
      assert.equal(await touch.locator('.form-footer [type="submit"]').evaluate(node => {
        const rect = node.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }), true);
      const smallTargets = await touch.locator('.form-header .btn, .form-footer .btn, .exercise-card .icon-btn').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 44).map(node => node.className));
      assert.deepEqual(smallTargets, []);
    }
    await phone.close();
    check('empty states, touch-mode 393×852 / 320×640 and reachable 44px form actions');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passes, errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
