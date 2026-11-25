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
  const runtimeRequests = new Map();
  page.on('request', request => {
    const { pathname, search } = new URL(request.url());
    if (!/^\/src\/(app|registry|core\/(mechanism|feed-scroll)|instruments\/[^/]+)\.js$/.test(pathname)) return;
    if (!runtimeRequests.has(pathname)) runtimeRequests.set(pathname, new Set());
    runtimeRequests.get(pathname).add(search);
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = (idx) => page.waitForFunction(i =>
    window.__MCP_FEED__?.getActiveIndex() === i && window.__MCP_FEED__.isReady(i) &&
    Math.abs(document.querySelector('#feed').scrollTop - innerHeight * i) < 2, idx);
  const phrase = () => page.evaluate(() => window.__MCP_FEED__.getPhrase().id);
  const navigate = async (id, key) => { await page.keyboard.press(key); await ready(id); };
  await page.goto(origin + '/?p=more-cake-please');
  await ready(0);
  const order = await page.locator('.slide').evaluateAll(slides => slides.map(slide => slide.dataset.id));
  const indexOf = id => order.indexOf(id);
  assert.deepEqual(order.slice(-3), ['flip-contract','jacket-legend','specimen-drawer']);
  assert.equal(await page.locator('header, #indexDrawer.is-open').count(), 0);
  const rail = page.getByRole('navigation', {name: 'Instrument navigation'});
  assert.equal(await rail.locator('.instrument-tick').count(), 12);
  const railLabels = await rail.locator('.instrument-tick').evaluateAll(ticks =>
    ticks.map(tick => tick.getAttribute('aria-label')));
  assert.deepEqual(railLabels.slice(-3), ['Flip Contract','Jacket Legend','Specimen Drawer']);
  assert.equal(await rail.getByRole('button', {name:'Newton Protocol', exact:true}).getAttribute('aria-current'), 'true');
  const cue = page.locator('.scroll-cue');
  const cueMark = page.locator('#scrollCueMark');
  await cue.waitFor({ state: 'visible' });
  await cueMark.waitFor({ state: 'visible' });
  const cueArrow = cue.locator('.scroll-cue-arrow');
  const transform = await cueArrow.evaluate(arrow => getComputedStyle(arrow).transform);
  await page.waitForFunction(previous => {
    const arrow = document.querySelector('.scroll-cue-arrow');
    return getComputedStyle(arrow).transform !== previous;
  }, transform, { timeout: 2500 });
  assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor), 'rgb(255, 255, 255)');
  assert.ok(await page.locator('.poster-frame').first().evaluate(frame => parseFloat(getComputedStyle(frame).borderRadius) > 0));
  async function verifyAutoplay(idx) {
    const canvas = page.locator('[data-poster-index="' + idx + '"] canvas');
    const initial = await canvas.evaluate(element => element.toDataURL());
    await page.waitForFunction(({idx, initial}) => {
      const element = document.querySelector('[data-poster-index="' + idx + '"] canvas');
      return window.__MCP_FEED__.getInstance(idx)?.isMoving() && element.toDataURL() !== initial;
    }, {idx, initial}, { polling: 100, timeout: 4000 });
  }

  const shown = new Set([await phrase()]);
  async function checkNewPhrase() {
    const id = await phrase();
    assert.ok(id && !shown.has(id), 'Repeated phrase: ' + id);
    shown.add(id);
    assert.equal(new URL(page.url()).searchParams.get('p'), id);
  }
  const posterCanvas = idx => page.locator('[data-poster-index="' + idx + '"] canvas');

  await verifyAutoplay(0);
  await posterCanvas(0).click();
  await checkNewPhrase();
  for (let idx = 1; idx < 12; idx++) {
    if (idx === 1) {
      await page.mouse.move(390, 390);
      await page.mouse.wheel(0, 500);
      await ready(idx);
      await cueMark.waitFor({ state: 'hidden' });
      await cue.waitFor({ state: 'visible' });
    } else {
      await navigate(idx, 'j');
    }
    await checkNewPhrase();
    await verifyAutoplay(idx);
    await posterCanvas(idx).click();
    await checkNewPhrase();
    await page.waitForFunction(i => !window.__MCP_FEED__.getInstance(i).isMoving(), idx);
  }
  // Fast repeat clicks may interrupt an animation, but each must draw a fresh phrase.
  while (shown.size < catalog.length) {
    await posterCanvas(11).click();
    await checkNewPhrase();
  }
  const lastInCycle = await phrase();
  await posterCanvas(11).click();
  assert.notEqual(await phrase(), lastInCycle);
  shown.clear();
  await checkNewPhrase();

  await navigate(10, 'k');
  await checkNewPhrase();
  assert.equal(await cueMark.isVisible(), false);
  await verifyAutoplay(10);
  const version = await page.locator('script[type="module"]').evaluate(script => new URL(script.src).search);
  assert.ok(version, 'The feed entry point must have a cache version');
  assert.equal(runtimeRequests.size, 16, 'The feed, its runtimes, the registry and all twelve instruments must load');
  for (const [pathname, versions] of runtimeRequests) {
    assert.deepEqual([...versions], [version], pathname);
  }
  console.log('All twelve autoplay and respond to clicks, return visits draw fresh phrases, and all 85 appear before the first repeat.');

  await page.goto(origin + '/?p=more-cake-please&poster=1');
  await ready(0);
  assert.equal(await page.locator('.fallback-plate').count(), 0);
  const muted = () => page.evaluate(async () => (await import('/src/core/audio.js')).sound.isMuted());
  assert.equal(await muted(), true);
  await page.keyboard.press('s');
  assert.equal(await muted(), false);

  // Observe the displayed DOM words, including their hidden-to-visible transitions.
  await page.evaluate(() => {
    window.reveals = [];
    const layer = document.querySelector('.newton-words');
    new MutationObserver(() => {
      const count = layer.querySelectorAll('.is-revealed').length;
      if (window.reveals.at(-1) !== count) window.reveals.push(count);
    }).observe(layer, { attributes: true, subtree: true });
  });
  await page.keyboard.press('Shift+Space');
  await page.waitForFunction(() => window.reveals.join(',') === '0,1,2,3');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.newton-word')].every(word => getComputedStyle(word).opacity === '1'));
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.__MCP_FEED__.setTheme(value), theme);
    const styles = await page.locator('.newton-word').evaluateAll(words =>
      words.map(word => {
        const style = getComputedStyle(word);
        return [style.color, style.webkitTextStrokeColor, style.webkitTextStrokeWidth];
      }));
    assert.deepEqual(styles, [styles[0], styles[0], styles[0]], 'Cradle lettering in ' + theme);
  }
  assert.equal(await phrase(), 'more-cake-please');
  // Settle the plate by reopening the exact link before pointer testing the M ball.
  await page.reload();
  await ready(0);
  await page.mouse.click(265, 424);
  await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 0);
  await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 3);
  assert.notEqual(await phrase(), 'more-cake-please');
  await page.goto(origin + '/?p=more-cake-please&poster=1');
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
  assert.notEqual(await phrase(), before);
  const firstContract = await phrase();
  await page.mouse.move(690, 460); await page.mouse.down();
  await page.mouse.move(767, 460, {steps:8}); await page.mouse.up();
  await page.waitForFunction(() => window.readings.at(-1)[0] === 'Disconnected');
  await page.mouse.move(705, 470); await page.mouse.down();
  await page.mouse.move(480, 425, {steps:12}); await page.mouse.up();
  await page.waitForFunction(() => window.readings.length >= 13);
  assert.notEqual(await phrase(), firstContract);
  console.log('Contract: click, unplug, magnetic drag; observed all five negotiation states in',
    Math.round(readings[5][1]-readings[0][1]), 'ms.');

  for (let idx=2; idx<12; idx++) {
    await navigate(idx, 'ArrowDown');
    const current = await phrase();
    await page.keyboard.press('Space');
    await page.waitForFunction(old => window.__MCP_FEED__.getPhrase().id !== old, current);
    await page.waitForFunction(() => !window.__MCP_FEED__.getInstance(window.__MCP_FEED__.getActiveIndex()).isMoving());
    if (order[idx] === 'specimen-drawer') {
      const specimen = page.locator('[data-id="specimen-drawer"] canvas');
      assert.match(await specimen.getAttribute('aria-label'), /^Charge-only cable · /);
    }
    assert.ok(catalog.some(p => p.id === new URL(page.url()).searchParams.get('p')));
    if (order[idx] === 'jacket-legend') {
      const straight = await phrase();
      await page.mouse.move(620,420); await page.mouse.down();
      await page.mouse.move(150,420,{steps:12}); await page.mouse.up();
      await page.waitForFunction(i => !window.__MCP_FEED__.getInstance(i).isMoving(), idx);
      assert.equal(await phrase(), straight);
      await page.mouse.down(); await page.mouse.move(620,420,{steps:12}); await page.mouse.up();
      await page.waitForFunction(id => window.__MCP_FEED__.getPhrase().id !== id, straight);
    }
    if (order[idx] === 'flip-contract') {
      const flipped = await phrase();
      await page.keyboard.press('Space');
      assert.notEqual(await phrase(), current);
      assert.notEqual(await phrase(), flipped);
    }
    assert.ok(await page.locator('.instrument-surface').count() <= 3);
    assert.equal(await page.locator('.fallback-plate').count(),0);
  }
  assert.equal(await page.evaluate(() => performance.timeOrigin), loaded);
  console.log('All twelve live; every mechanism settled, flip rollover and three-surface limit passed.');

  await navigate(10, 'k');
  await page.keyboard.press('t');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.mouse.move(390, 400);
  for (const delta of [-690,-480,-240,-160,-110,-80,-54,-40,-30,-25,-20,-15]) {
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(80);
  }
  await ready(9);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });
  const scrollTop = () => page.locator('#feed').evaluate(el => el.scrollTop);
  await touch('touchStart', 395, 624);
  await touch('touchMove', 395, 604);
  await page.waitForTimeout(250);
  assert.ok(Math.abs(await scrollTop() - (9 * 780 + 20)) < 2);
  await touch('touchEnd');
  await ready(9);
  await page.locator('#feed.is-panning').waitFor({ state: 'detached' });

  await touch('touchStart', 395, 624);
  for (let y=600;y>=280;y-=40) {
    await touch('touchMove', 395, y);
    await page.waitForTimeout(18);
  }
  assert.ok(Math.abs(await scrollTop() - (9 * 780 + 344)) < 2);
  assert.equal(await page.evaluate(() => window.__MCP_FEED__.getActiveIndex()), 9);
  await touch('touchEnd');
  await page.waitForFunction(() => {
    const { scrollTop } = document.querySelector('#feed');
    return scrollTop > 9 * 780 + 360 && scrollTop < 10 * 780 - 4;
  });
  await ready(10);
  await page.locator('#feed.is-panning').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => performance.timeOrigin), loaded);
  console.log('Keyboard, wheel burst, held touch drag, short-drag return and glide all stayed in the feed.');

  // Keep sending small downward momentum events after the slide lands, then
  // reverse with a light upward gesture that should move exactly one poster.
  await page.mouse.wheel(0, 320);
  for (const delta of [90,45,30,20,12,7,4]) {
    await page.waitForTimeout(45);
    await page.mouse.wheel(0, delta);
  }
  await ready(11);
  for (const delta of [-11,-12,-13]) await page.mouse.wheel(0, delta);
  await ready(10);

  await page.mouse.wheel(0, 75);
  await page.waitForFunction(() => document.querySelector('#feed').scrollTop > 10 * 780 + 10);
  await page.mouse.wheel(0, -32);
  await ready(10);
  await page.locator('#feed.is-panning').waitFor({ state: 'detached' });

  await touch('touchStart', 395, 410);
  for (const y of [430,450,470,494]) {
    await page.waitForTimeout(90);
    await touch('touchMove', 395, y);
  }
  await page.waitForTimeout(120);
  await touch('touchEnd');
  await ready(9);
  await navigate(10, 'j');
  console.log('Light reverse scrolls, mid-glide reversals and slow upward navigation by touch passed.');

  const stored = new URL(page.url()).searchParams;
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForSelector('[data-id="jacket-legend"] .fallback-word');
  assert.equal(new URL(page.url()).searchParams.get('p'), stored.get('p'));
  await page.emulateMedia({reducedMotion:'no-preference'}); await ready(10);
  await page.waitForSelector('[data-id="jacket-legend"] .poster-frame.is-ready canvas');
  const remix = '/?i=flip-contract&w=Many,Custom,Permalinks';
  await page.goto(origin + remix); await ready(indexOf('flip-contract'));
  assert.deepEqual(await page.evaluate(() => window.__MCP_FEED__.getPhrase().words), ['Many','Custom','Permalinks']);
  await page.reload(); await ready(indexOf('flip-contract'));
  assert.equal(new URL(page.url()).searchParams.get('w'), 'Many,Custom,Permalinks');
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await ready(indexOf('specimen-drawer'));
  assert.ok(await phrase());
  assert.equal(new URL(page.url()).searchParams.has('w'), false);
  await page.goto(origin + '/?i=jacket-legend&p=more-cake-please&intro=0');
  await ready(indexOf('jacket-legend'));
  assert.equal(await page.locator('.poster-caption, .instrument-fineprint, .fallback-badge').count(), 0);
  await page.keyboard.press('c');
  await page.waitForFunction(() => document.querySelector('#actionStatus').textContent === 'Phrase copied');
  const start = await phrase();
  await touch('touchStart', 620, 420);
  await touch('touchMove', 380, 420);
  await touch('touchMove', 150, 420);
  await touch('touchEnd');
  await ready(indexOf('jacket-legend'));
  assert.equal(await phrase(), start);
  await touch('touchStart', 150, 420);
  await touch('touchMove', 380, 420);
  await touch('touchMove', 620, 420);
  await touch('touchEnd');
  await page.waitForFunction(id => window.__MCP_FEED__.getPhrase().id !== id, start);
  await ready(indexOf('jacket-legend'));

  await page.goto(origin + '/?p=more-cake-please');
  await ready(0);
  const preview = rail.locator('.instrument-preview');
  const typewriterTick = rail.getByRole('button', {name:'Mechanical Typewriter', exact:true});
  await typewriterTick.hover();
  await preview.waitFor();
  await page.waitForFunction(() => document.querySelector('.instrument-preview img').naturalWidth === 192);
  assert.equal(await preview.getAttribute('aria-label'), 'Go to Mechanical Typewriter');
  assert.equal(await phrase(), 'more-cake-please');
  await preview.click();
  await ready(indexOf('mechanical-typewriter'));
  assert.notEqual(await phrase(), 'more-cake-please');
  assert.equal(await typewriterTick.getAttribute('aria-current'), 'true');
  await typewriterTick.focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await preview.getAttribute('aria-label'), 'Go to Combination Lock');
  await page.keyboard.press('Enter');
  await ready(indexOf('combination-lock'));
  assert.equal(await rail.getByRole('button', {name:'Combination Lock', exact:true}).getAttribute('aria-current'), 'true');
  assert.deepEqual(errors, []);
  console.log('Exact combined links, preference changes and dark theme verified.');
} finally {
  await browser.close();
  local?.server.close();
}
