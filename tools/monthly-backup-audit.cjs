/* File exports and storage are tested in an isolated browser context. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], passes = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const url = 'file:///' + path.resolve(__dirname, '../index.html').replaceAll('\\', '/');
  const key = 'fitness-backup-preferences-v1';
  const fixture = {
    records: [
      { id: 'backup-strength', type: 'strength', date: '2026-10-24', startTime: '18:00', endTime: '19:00', durationMinutes: 60, bodyParts: ['胸'], note: '保留训练备注', exercises: [{ name: '杠铃卧推', sets: [{ weight: '40', reps: 10, rir: 2, isWarmup: false }] }], createdAt: 1, updatedAt: 1 },
      { id: 'backup-cardio', type: 'cardio', date: '2026-10-25', durationMinutes: 30, bodyParts: ['有氧'], cardioType: 'running', cardioData: { distance: 5 }, note: '跑步', createdAt: 2, updatedAt: 2 }
    ],
    profile: { height: 175 },
    weights: [{ id: 'backup-weight', date: '2026-10-25', weight: 72, createdAt: 3, updatedAt: 3 }]
  };
  const settle = () => page.waitForTimeout(130);
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  const reset = async (overrides = {}) => {
    await page.evaluate(({ key, overrides }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, enabled: true, lastConfirmedAt: null, snoozedUntil: null, pending: null, ...overrides }));
      window.monthlyBackup.refresh();
    }, { key, overrides });
    await settle();
  };
  const route = async name => { await page.goto(`${url}#${name}`); await settle(); };
  const download = async selector => {
    const event = page.waitForEvent('download');
    await page.locator(selector).click();
    const file = await event;
    const data = JSON.parse(await fs.readFile(await file.path(), 'utf8'));
    await settle();
    return { file, data };
  };
  await context.addInitScript(() => {
    window.__shareMode = 'download';
    window.__shareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => window.__shareMode !== 'download' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.__shareCalls.push({ name: data.files[0].name, text: await data.files[0].text() });
      if (window.__shareMode === 'cancel') throw new DOMException('Canceled', 'AbortError');
      if (window.__shareMode === 'error') throw new DOMException('Not available', 'NotAllowedError');
    } });
  });
  try {
    await route('settings');
    await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    assert.equal(await page.locator('[data-monthly-backup]').count(), 1);
    assert.equal(await page.locator('[data-backup-save]').isDisabled(), true);
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    passes.push('Empty storage: no backup reminder or misleading downloadable data');

    await page.evaluate(fixture => {
      localStorage.setItem('fitness-records-v1', JSON.stringify(fixture.records));
      localStorage.setItem('fitness-profile-v1', JSON.stringify(fixture.profile));
      localStorage.setItem('fitness-weight-v1', JSON.stringify(fixture.weights));
    }, fixture);
    await route('dashboard');
    await page.locator('[data-backup-banner]').waitFor();
    let unsolicitedDownloads = 0;
    const countDownloads = () => unsolicitedDownloads++;
    page.on('download', countDownloads);
    await settle();
    assert.equal(unsolicitedDownloads, 0);
    page.off('download', countDownloads);
    const { file, data } = await download('[data-backup-banner] [data-backup-save]');
    assert.match(file.suggestedFilename(), /^动起来-完整备份-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
    assert.deepEqual(Object.keys(data).sort(), ['version', 'exportedAt', 'records', 'profile', 'weights'].sort());
    assert.equal(data.version, 1);
    assert.deepEqual(data.records, fixture.records);
    assert.deepEqual(data.profile, fixture.profile);
    assert.deepEqual(data.weights, fixture.weights);
    assert.equal((await state()).lastConfirmedAt, null);
    assert.equal((await state()).pending.requestedAt, data.exportedAt);
    const imported = await page.evaluate(data => parseImportText('backup.json', JSON.stringify(data)), data);
    assert.equal(imported.records.length, 2);
    assert.equal(imported.records[0].exercises[0].sets[0].rir, 2);
    assert.equal(imported.records[1].type, 'cardio');
    assert.deepEqual(imported.profile, fixture.profile);
    assert.deepEqual(imported.weights, fixture.weights);
    passes.push('Explicit JSON download: full original schema, strength/cardio/RIR/profile/weight import round trip');

    await page.reload();
    await page.locator('[data-backup-banner] [data-backup-confirm]').waitFor();
    assert.equal((await state()).lastConfirmedAt, null);
    await page.locator('[data-backup-banner] [data-backup-confirm]').click();
    await settle();
    assert.equal((await state()).lastConfirmedAt, data.exportedAt);
    assert.equal((await state()).pending, null);
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    passes.push('Reload preserves pending confirmation; only explicit confirmation advances backup date');

    await page.clock.setFixedTime(new Date('2026-02-28T10:59:59+08:00'));
    await reset({ lastConfirmedAt: '2026-01-31T11:00:00+08:00' });
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    await page.clock.setFixedTime(new Date('2026-02-28T11:00:00+08:00'));
    await page.evaluate(() => window.monthlyBackup.refresh());
    await settle();
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), true);
    await page.clock.setFixedTime(new Date('2028-02-29T10:59:59+08:00'));
    await reset({ lastConfirmedAt: '2028-01-31T11:00:00+08:00' });
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    await page.clock.setFixedTime(new Date('2028-02-29T11:00:00+08:00'));
    await page.evaluate(() => window.monthlyBackup.refresh());
    await settle();
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), true);
    await page.locator('[data-backup-later]').click();
    await settle();
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    await page.clock.setFixedTime(new Date('2028-03-01T11:00:00+08:00'));
    await page.evaluate(() => window.monthlyBackup.refresh());
    await settle();
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), true);
    passes.push('Calendar-month boundary, non-leap/leap February, exact due time and one-day snooze');

    await route('settings');
    await reset();
    await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    await page.locator('[data-backup-toggle]').uncheck();
    await settle();
    assert.equal((await state()).enabled, false);
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    await page.reload();
    await settle();
    await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    assert.equal(await page.locator('[data-backup-toggle]').isChecked(), false);
    assert.equal(await page.locator('[data-monthly-backup]').count(), 1);
    await download('[data-monthly-backup] [data-backup-save]');
    assert.equal((await state()).lastConfirmedAt, null);
    await page.locator('[data-monthly-backup] [data-backup-confirm]').click();
    await settle();
    const confirmed = (await state()).lastConfirmedAt;
    const csvEvent = page.waitForEvent('download');
    await page.locator('[data-export="csv"]').click();
    await csvEvent;
    assert.equal((await state()).lastConfirmedAt, confirmed);
    passes.push('Settings switch persists, manual backup works when disabled, CSV does not count as full backup');

    await route('dashboard');
    await reset();
    await page.evaluate(() => window.__shareMode = 'cancel');
    await page.locator('[data-backup-banner] [data-backup-save]').click();
    await settle();
    assert.equal((await state()).pending, null);
    assert.equal((await state()).lastConfirmedAt, null);
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), true);
    await page.evaluate(() => window.__shareMode = 'success');
    await page.locator('[data-backup-banner] [data-backup-save]').click();
    await settle();
    assert.equal((await state()).lastConfirmedAt, null);
    assert((await state()).pending);
    const shared = await page.evaluate(() => window.__shareCalls.at(-1));
    assert.deepEqual(JSON.parse(shared.text).records, fixture.records);
    await reset();
    await page.evaluate(() => window.__shareMode = 'error');
    await page.locator('[data-backup-banner] [data-backup-save]').click();
    await settle();
    assert.equal((await state()).pending, null);
    assert.match(await page.locator('[data-backup-banner] [data-backup-save]').innerText(), /下载 JSON/);
    await download('[data-backup-banner] [data-backup-save]');
    assert((await state()).pending);
    passes.push('Native-share cancel/success/failure: no false saved state; explicit download fallback');

    await page.reload();
    await settle();
    await reset();
    await page.evaluate(key => {
      const setItem = Storage.prototype.setItem;
      window.__originalSetItem = setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
        return setItem.call(this, name, value);
      };
    }, key);
    await download('[data-backup-banner] [data-backup-save]');
    await page.locator('[data-backup-banner] [data-backup-confirm]').click();
    await settle();
    assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
    await route('settings');
    await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    assert.match(await page.locator('[data-backup-status]').innerText(), /未能持久保存/);
    await page.evaluate(() => Storage.prototype.setItem = window.__originalSetItem);
    await page.reload();
    await settle();
    assert.equal((await state()).lastConfirmedAt, null);
    passes.push('Storage quota failure still exports file, without pretending preference persistence');

    await reset();
    for (const width of [320, 393, 430, 1280]) {
      await page.setViewportSize({ width, height: 852 });
      for (const name of ['dashboard', 'settings', 'new', 'detail/backup-strength']) {
        await route(name);
        await page.locator('.app-disclosure').evaluateAll(nodes => nodes.forEach(node => node.open = true));
        await settle();
        const bad = await page.locator('[data-backup-banner], [data-monthly-backup]').evaluateAll(nodes => nodes.flatMap(node => [node, ...node.querySelectorAll('*')]).filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
        }).map(node => node.className));
        assert.deepEqual(bad, [], `backup overflow ${width}/${name}`);
        if (name === 'new' || name.startsWith('detail/')) assert.equal(await page.locator('[data-backup-banner]').isVisible(), false);
      }
    }
    assert.deepEqual(await page.evaluate(() => ({ records: loadRecords(), profile: loadProfile(), weights: loadWeights() })), fixture);
    assert.deepEqual(errors, []);
    passes.push('320/393/430/1280px, recording uninterrupted, original training data unchanged, no JS errors');
    process.stdout.write(JSON.stringify({ passes, errors }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
