'use strict';

/* Dev tool: render the renderer in headless Chromium (mock-data fallback) and
 * capture screenshots across theme/language/interval states for review.
 *   node tools/capture-preview.js [outDir]
 * Produces: dark.png, light.png, zh.png, interval-menu.png, narrow.png + probes. */

const { chromium } = require('playwright');
const url = require('url');
const path = require('path');
const fs = require('fs');

const INDEX = path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const OUT = process.argv[2] || path.resolve(__dirname, '..', '.preview');
const INDEX_URL = url.pathToFileURL(INDEX).href;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(INDEX_URL, { waitUntil: 'load' });
  await page.waitForSelector('.net-item.selected', { timeout: 8000 });
  await page.waitForTimeout(1300); // settle entrance

  // probes (dark + EN default)
  const fontInfo = await page.evaluate(() => ({ family: getComputedStyle(document.body).fontFamily, lexendLoaded: !!(document.fonts && document.fonts.check('16px "Lexend"')) }));
  const pulse = await page.evaluate(() => new Promise((resolve) => {
    const dot = document.getElementById('statusDot'); if (!dot) return resolve(null);
    const s = []; const start = performance.now();
    (function tick() { const tr = getComputedStyle(dot).transform; const m = tr && tr.match(/matrix\(([^)]+)\)/); let v = 1; if (m) v = parseFloat(m[1].split(',')[0]); s.push(+v.toFixed(3)); if (performance.now() - start < 1000) requestAnimationFrame(tick); else resolve({ min: Math.min(...s), max: Math.max(...s) }); })();
  }));
  console.log('font:', JSON.stringify(fontInfo));
  if (pulse) console.log('pulse range: [' + pulse.min + ' .. ' + pulse.max + ']');

  await page.screenshot({ path: path.join(OUT, 'dark.png') });
  console.log('wrote dark.png');

  // Light theme
  await page.click('#themeBtn'); await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'light.png') });
  console.log('wrote light.png');

  // Chinese language (still light) + back to dark
  await page.click('#langBtn'); await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, 'zh.png') });
  console.log('wrote zh.png');
  await page.click('#langBtn'); await page.waitForTimeout(200); // back to EN
  await page.click('#themeBtn'); await page.waitForTimeout(300); // back to dark

  // Interval dropdown open
  await page.click('#intervalBtn'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'interval-menu.png') });
  console.log('wrote interval-menu.png');
  await page.click('body', { position: { x: 10, y: 10 } }); await page.waitForTimeout(150); // close

  // Narrow / responsive
  await page.setViewportSize({ width: 420, height: 880 }); await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'narrow.png') });
  console.log('wrote narrow.png');

  await browser.close();
  console.log('console errors: ' + (errors.length ? JSON.stringify(errors) : 'none'));
})().catch((e) => { console.error('CAPTURE FAILED:', e.message); process.exit(1); });
