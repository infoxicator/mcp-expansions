import { startServer } from './preview-server.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const local = process.argv[2] ? null : await startServer();
const origin = process.argv[2] ?? local.baseUrl;
const catalog = JSON.parse(readFileSync('phrases.json', 'utf8'));
for (const row of catalog) {
  assert.equal(row.words.length, 3, row.id);
  assert.equal(row.words.map(word => word[0]).join(''), 'MCP', row.id);
}
assert.equal(new Set(catalog.map(row => row.id)).size, catalog.length);
console.log(`${catalog.length} unique catalog entries have strict M·C·P initials.`);
const browser = await chromium.launch({
  channel: 'chrome', args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 780, height: 780 }, hasTouch: true });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = (idx) => page.waitForFunction(i =>
    window.__MCP_FEED__?.getActiveIndex() === i && window.__MCP_FEED__.isReady(i) &&
    Math.abs(document.querySelector('#feed').scrollTop - innerHeight * i) < 2, idx);
  const phrase = () => page.evaluate(() => window.__MCP_FEED__.getPhrase().id);
  const navigate = async (id, key) => { await page.keyboard.press(key); await ready(id); };
  await page.goto(origin + '/?p=more-cake-please&poster=1');
  await ready(0);
  assert.equal(await page.locator('.fallback-plate').count(), 0);
  assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('s');
  assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'), 'true');

  // Observe the displayed DOM words, including their hidden-to-visible transitions.
  await page.evaluate(() => {
    window.reveals = [];
    const layer = document.querySelector('.newton-words');
    new MutationObserver(() => {
      const count = layer.querySelectorAll('.is-revealed').length;
      if (window.reveals.at(-1) !== count) window.reveals.push(count);
    }).observe(layer, { attributes: true, subtree: true });
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.reveals.join(',') === '0,1,2,3');
  assert.equal(await phrase(), 'more-cake-please');
  // Settle the plate by reopening the exact link before pointer testing the M ball.
  await page.reload();
  await ready(0);
  await page.mouse.click(265, 424);
  await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 0);
  await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 3);
  assert.equal(await phrase(), 'more-cake-please');
  await page.reload();
  await ready(0);
  await page.mouse.move(265, 424);
  await page.mouse.down();
  await page.mouse.move(76, 415, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__MCP_FEED__.getPhrase().id !== 'more-cake-please');
  await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 3);
  assert.ok(catalog.some(p => p.id === new URL(page.url()).searchParams.get('p')));
  console.log('Cradle: Space, gentle tap, hard drag; one word per impact.');

  const loaded = await page.evaluate(() => performance.timeOrigin);
  await navigate(1, 'j');
  const meter = page.locator('[data-id="the-contract"] canvas');
  assert.match(await meter.getAttribute('aria-label'), /Disconnected/);
  await page.evaluate(() => {
    const meter = document.querySelector('[data-id="the-contract"] canvas');
    window.readings = [];
    new MutationObserver(() => {
      window.readings.push([meter.getAttribute('aria-label').split(' · ')[1], performance.now()]);
    }).observe(meter, { attributes: true, attributeFilter: ['aria-label'] });
  });
  const before = await phrase();
  await page.mouse.click(690, 460);
  await page.waitForFunction(() => window.readings.length >= 6);
  const readings = await page.evaluate(() => window.readings);
  assert.deepEqual(readings.slice(0,5).map(([v]) => v), ['5.00V','9.00V','15.00V','20.00V','CONTRACT OK']);
  assert.ok(readings[5][1]-readings[0][1] < 1500);
  assert.equal(await phrase(), before);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.readings.at(-1)[0] === 'Disconnected');
  await page.mouse.move(705, 470); await page.mouse.down();
  await page.mouse.move(480, 425, {steps:12}); await page.mouse.up();
  await page.waitForFunction(() => window.readings.length >= 13);
  assert.notEqual(await phrase(), before);
  console.log('Contract: click, unplug, magnetic drag; observed all five negotiation states in',
    Math.round(readings[5][1]-readings[0][1]), 'ms.');

  for (let idx=2; idx<12; idx++) {
    await navigate(idx, 'ArrowDown');
    const current = await phrase();
    await page.keyboard.press('Space');
    if (idx === 6) {
      await page.waitForFunction(() => !window.__MCP_FEED__.getInstance(6).isMoving());
      assert.equal(await phrase(), current);
      assert.equal(await page.locator('[data-id="specimen-drawer"] canvas').getAttribute('aria-label'), 'Charge-only cable');
      await page.keyboard.press('Space');
    }
    await page.waitForFunction(old => window.__MCP_FEED__.getPhrase().id !== old, current);
    await page.waitForFunction(() => !window.__MCP_FEED__.getInstance(window.__MCP_FEED__.getActiveIndex()).isMoving());
    assert.ok(catalog.some(p => p.id === new URL(page.url()).searchParams.get('p')));
    if (idx === 3) {
      const straight = await phrase();
      await page.mouse.move(620,420); await page.mouse.down();
      await page.mouse.move(150,420,{steps:12}); await page.mouse.up();
      await page.waitForFunction(() => !window.__MCP_FEED__.getInstance(3).isMoving());
      assert.equal(await phrase(), straight);
      await page.mouse.down(); await page.mouse.move(620,420,{steps:12}); await page.mouse.up();
      await page.waitForFunction(id => window.__MCP_FEED__.getPhrase().id !== id, straight);
    }
    if (idx === 5) {
      await page.keyboard.press('Space');
      await page.waitForFunction(id => window.__MCP_FEED__.getPhrase().id === id, current);
    }
    assert.ok(await page.locator('.instrument-surface').count() <= 3);
    assert.equal(await page.locator('.fallback-plate').count(),0);
  }
  assert.equal(await page.evaluate(() => performance.timeOrigin), loaded);
  console.log('All twelve live; every mechanism settled, orientation memory and three-surface limit passed.');

  await navigate(10, 'k');
  await page.keyboard.press('t');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.mouse.move(390, 400); await page.mouse.wheel(0, -690); await ready(9);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:395,y:624}]});
  for (let y=600;y>=160;y-=40) {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:395,y}]});
    await page.waitForTimeout(18);
  }
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await ready(10);
  assert.equal(await page.evaluate(() => performance.timeOrigin), loaded);
  console.log('Keyboard, wheel and native touch swipe snapped without navigation.');

  const stored = new URL(page.url()).searchParams;
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForSelector('[data-id="combination-lock"] .fallback-word');
  assert.equal(new URL(page.url()).searchParams.get('p'), stored.get('p'));
  await page.emulateMedia({reducedMotion:'no-preference'}); await ready(10);
  await page.waitForSelector('[data-id="combination-lock"] .poster-frame.is-ready canvas');
  const remix = '/?i=flip-contract&w=Many,Custom,Permalinks';
  await page.goto(origin + remix); await ready(5);
  assert.deepEqual(await page.evaluate(() => window.__MCP_FEED__.getPhrase().words), ['Many','Custom','Permalinks']);
  await page.reload(); await ready(5);
  assert.equal(new URL(page.url()).searchParams.get('w'), 'Many,Custom,Permalinks');
  assert.deepEqual(errors, []);
  console.log('Exact combined links, preference changes and dark theme verified.');
} finally {
  await browser.close();
  local?.server.close();
}
