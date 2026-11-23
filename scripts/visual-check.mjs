import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A separate user-data directory and ephemeral server never touch the live app.
const data = await mkdtemp(join(tmpdir(), 'sidecast-visual-'));
await mkdir('test-results', { recursive: true });
const app = await electron.launch({
  args: ['.'],
  env: { ...process.env, SIDECAST_DATA_DIR: data, SIDECAST_SOURCE_PORT: '0' },
  timeout: 20000
});
try {
  await app.firstWindow();
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    page = app.windows().find(window => window.url().includes('/index.html'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'The isolated control window must load');
  await page.getByRole('heading', { name: 'Your stream. Your style.' }).waitFor();
  const state = await page.evaluate(() => window.sidecast.getState());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.hide()));
  await app.evaluate(async ({ BrowserWindow }, url) => {
    const window = new BrowserWindow({ width: 1520, height: 780, useContentSize: true, show: false, title: 'Sidecast Visual Check', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await window.loadURL(url);
  }, state.urls.combined);
  // Audio and desktop-overlay windows can still be starting. Select this exact URL.
  const source = app.windows().find(window => window.url() === state.urls.combined);
  assert.ok(source, 'The isolated browser-source window must load');
  await source.waitForLoadState('domcontentloaded');
  await source.setViewportSize({ width: 1520, height: 780 });
  await source.evaluate(async profile => {
    const { createOverlay, THEMES } = await import('./shared.js');
    document.body.replaceChildren();
    document.body.className = '';
    document.body.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(320px,1fr));gap:20px;padding:24px;background:#20242c!important;height:100vh;';
    const now = Date.now();
    const messages = [
      { name: 'balkn', text: 'That last lap was unbelievable 🔥', platform: 'twitch' },
      { name: 'NightDriver', text: '@sidecast what a finish! 🏁', platform: 'youtube' },
      { name: 'PitCrew', text: 'Welcome in, everyone 👋', platform: 'kick', role: 'MOD' },
      { name: 'Mia', text: '🏎️ 🔥 💜', platform: 'twitch' }
    ].map((message, index) => ({ ...message, id: String(index), time: now, badges: [], fragments: [] }));
    window.visualViews = [];
    for (const [theme, info] of Object.entries(THEMES)) {
      const section = document.createElement('section');
      section.style.cssText = 'display:flex;flex-direction:column;gap:16px;min-width:0;';
      const heading = document.createElement('h2');
      heading.textContent = `${info.name} / ${info.game}`;
      heading.style.cssText = 'font:600 14px Segoe UI;color:#cbd2db;letter-spacing:.2px;';
      const container = document.createElement('div');
      container.className = 'overlay-content';
      container.id = `visual-${theme}`;
      container.style.cssText = 'height:650px;justify-content:flex-start;';
      section.append(heading, container);
      document.body.append(section);
      const view = createOverlay(container);
      const snapshot = {
        profile: { ...profile, theme, accent: info.accent, radius: 22, fadeSeconds: 0, timestamps: true, maxMessages: 8, highlights: { enabled: true, mentions: ['sidecast'], users: ['balkn'], moderators: true } },
        messages,
        serverTime: now,
        alert: { id: 'visual-raid', alertType: 'raid', name: 'balkn', detail: 'Raiding with 42 viewers 🎉', platform: 'twitch', startedAt: now, endsAt: now + 600000 }
      };
      view.update(snapshot);
      window.visualViews.push({ view, snapshot, container });
    }
  }, state.snapshot.profile);
  assert.equal(await source.locator('.chat-message[data-highlight=mention]').count(), 4);
  assert.equal(await source.locator('.chat-message[data-highlight=person]').count(), 4);
  assert.equal(await source.locator('.chat-message[data-highlight=moderator]').count(), 4);
  assert.equal(await source.locator('.message-body.emoji-only').count(), 4);
  assert.equal(await source.evaluate(() => CSS.supports('corner-shape', 'superellipse(1.6)')), true);
  assert.equal(await source.locator('#visual-minimal .alert-card').evaluate(element => getComputedStyle(element).boxShadow), 'none');
  assert.equal(await source.locator('.unicode-emoji').first().evaluate(element => getComputedStyle(element).fontFamily.includes('Segoe UI Emoji')), true);
  assert.equal(await source.evaluate(() => innerWidth), 1520);
  for (const column of await source.locator('body > section').all()) {
    assert.ok(await column.evaluate(element => element.getBoundingClientRect().width >= 320), 'Each comparison column must remain readable');
  }
  await source.screenshot({ path: 'test-results/themes-highlights.png', animations: 'disabled', scale: 'css' });
  const comparison = await readFile('test-results/themes-highlights.png');
  assert.equal(comparison.readUInt32BE(16), 1520, 'The comparison PNG must be 1520px wide');
  assert.equal(comparison.readUInt32BE(20), 780, 'The comparison PNG must be 780px high');
  for (const theme of ['grid', 'endurance', 'vice', 'minimal']) {
    await source.locator(`#visual-${theme}`).screenshot({ path: `test-results/theme-${theme}.png`, animations: 'disabled', scale: 'css' });
  }
  await source.setViewportSize({ width: 1520, height: 780 });
  await source.evaluate(() => {
    document.body.style.gridTemplateColumns = 'repeat(4, 280px)';
    for (const { view, snapshot, container } of window.visualViews) {
      view.update({ ...snapshot, profile: { ...snapshot.profile, radius: 0 } });
      container.style.width = '280px';
    }
  });
  for (const card of await source.locator('.chat-box, .alert-card').all()) {
    assert.equal(await card.evaluate(element => getComputedStyle(element).borderTopLeftRadius), '0px');
  }
  // Decorative sunset artwork intentionally extends past its clipped card edge.
  for (const content of await source.locator('.chat-stack, .alert-info').all()) {
    assert.equal(await content.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
  }
  await source.screenshot({ path: 'test-results/themes-narrow-square.png', animations: 'disabled', scale: 'css' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/dashboard-highlights.png', fullPage: true, animations: 'disabled', scale: 'css' });
  console.log('PASS: four distinct themes, continuous corners, zero radius, 280px widths, highlight variants, emoji font, and quiet Minimal. Screenshots in test-results/.');
} finally {
  await app.close();
}
