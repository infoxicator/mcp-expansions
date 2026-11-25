import { writeFrames } from './recording.mjs';
import { swipeNext } from './swipe.mjs';
import assert from 'node:assert/strict';
import { startServer } from './preview-server.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'proof', 'phase1');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitReady(page, idx = 0) {
  await page.waitForFunction(
    (i) => window.__MCP_FEED__ && window.__MCP_FEED__.isReady(i),
    idx,
    { timeout: 15000 }
  );
  // Let fonts & 2 RAF frames settle
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function main() {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const errors = [];

  try {
    // 1. Capture exact 1080x1080 stills
    const stillCtx = await browser.newContext({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await stillCtx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    // Still 1: Newton Protocol at rest (light) - More Cake, Please
    await page.goto(`${baseUrl}/?i=newton-protocol&p=more-cake-please&poster=1&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '01-newton-protocol-rest.png') });

    // The return swing after the third impact keeps the complete phrase in view.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 0);
    await page.waitForFunction(() => document.querySelectorAll('.newton-word.is-revealed').length === 3);
    await page.waitForTimeout(1040);
    await page.screenshot({ path: path.join(OUT_DIR, '01-newton-protocol-swing.png') });

    // Still 1 dark
    await page.goto(`${baseUrl}/?i=newton-protocol&p=more-cake-please&poster=1&theme=dark`, { waitUntil: 'networkidle' });
    await waitReady(page, 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '01-newton-protocol-dark.png') });

    // Still 2: The Contract at rest (light) - More Cake, Please
    await page.goto(`${baseUrl}/?i=the-contract&p=more-cake-please&poster=1&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 1);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '02-the-contract-rest.png') });

    // Still 2 dark
    await page.goto(`${baseUrl}/?i=the-contract&p=more-cake-please&poster=1&theme=dark`, { waitUntil: 'networkidle' });
    await waitReady(page, 1);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '02-the-contract-dark.png') });

    // Still 3: Another phrase (Manual Copy Paste on The Contract + Mischievous Capybara Parliament on Newton)
    await page.goto(`${baseUrl}/?i=the-contract&p=manual-copy-paste&poster=1&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 1);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '02-the-contract-other-phrase.png') });

    await page.goto(`${baseUrl}/?i=newton-protocol&p=mischievous-capybara-parliament&poster=1&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '01-newton-protocol-other-phrase.png') });

    // Still 4: Reduced-motion fallback (using real emulateMedia)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${baseUrl}/?i=newton-protocol&p=more-cake-please&poster=1&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 0);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT_DIR, '01-newton-protocol-fallback.png') });
    await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type.includes('webgl') ? null : native.call(this, type, ...args);
      };
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Test deep links (?w= custom remix + no-webgl fallback)
    await page.goto(`${baseUrl}/?i=the-contract&w=Mostly,Caffeinated,Pigeons`, { waitUntil: 'networkidle' });
    await waitReady(page, 1);
    const fallbackText = await page.locator('[data-poster-index="1"] .fallback-words').innerText();
    assert.deepEqual(await page.locator('[data-poster-index="1"] .fallback-word').allTextContents(), ['Mostly','Caffeinated','Pigeons']);
    assert.equal(new URL(page.url()).searchParams.get('w'), 'Mostly,Caffeinated,Pigeons');
    console.log('Verified ?w= + no-webgl fallback:', fallbackText.replace(/\s+/g, ' '));

    await stillCtx.close();

    // 2. Capture 16-18s Phase 1 video recording using CDP Page.startScreencast + system ffmpeg
    fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
    const tmpFramesDir = fs.mkdtempSync(path.join(ROOT, 'tmp', 'phase1-frames-'));

    const recCtx = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 1,
    });
    // Tap the actual Web Audio output so the steel impacts and relay clicks
    // in the recording are the same signals a listener hears in the app.
    await recCtx.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      const taps = new WeakMap();
      AudioNode.prototype.connect = function(destination, ...args) {
        if (destination === this.context.destination) {
          let tap = taps.get(this.context);
          if (!tap) {
            tap = this.context.createMediaStreamDestination();
            taps.set(this.context, tap);
            const silence = this.context.createConstantSource();
            silence.offset.value = 0;
            silence.connect(tap);
            silence.start();
            window.proofAudio = new MediaRecorder(tap.stream, {mimeType:'audio/webm;codecs=opus'});
          }
          connect.call(this, tap);
        }
        return connect.call(this, destination, ...args);
      };
    });
    const recPage = await recCtx.newPage();
    recPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`rec console.error: ${msg.text()}`);
    });
    recPage.on('pageerror', (err) => errors.push(`rec pageerror: ${err.message}`));

    await recPage.goto(`${baseUrl}/?p=more-cake-please&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(recPage, 0);
    await waitReady(recPage, 1);

    const cdp = await recCtx.newCDPSession(recPage);
    const frameLog = [];
    let frameIdx = 0;
    await recPage.keyboard.press('s');
    await recPage.waitForTimeout(250);
    await recPage.evaluate(() => {
      window.proofChunks = [];
      window.proofAudio.ondataavailable = event => window.proofChunks.push(event.data);
      window.proofAudio.start();
    });
    const t0 = performance.now();

    cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
      const idx = frameIdx++;
      const ts = (performance.now() - t0) / 1000;
      const fname = path.join(tmpFramesDir, `frame_${String(idx).padStart(5, '0')}.jpg`);
      fs.writeFileSync(fname, Buffer.from(data, 'base64'));
      frameLog.push({ fname, ts });
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId });
      } catch (_) {}
    });

    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 94,
      maxWidth: 1080,
      maxHeight: 1080,
      everyNthFrame: 1,
    });

    // Hold briefly at rest on Newton Protocol (1.2s)
    await recPage.waitForTimeout(1200);

    // Pull & release M ball via Space -> clacks out "More", "Cake,", "Please" with P swinging out!
    await recPage.keyboard.press('Space');
    await recPage.waitForTimeout(4400);

    // Smoothly snap-scroll down to Instrument 2 (The Contract) using a native touch swipe
    await swipeNext(recPage, cdp, 1);
    await recPage.waitForTimeout(1300);

    await recPage.mouse.click(795, 565);
    await recPage.waitForFunction(() => document.querySelector('[data-id="the-contract"] canvas')
      .getAttribute('aria-label') === 'The Contract · More Cake Please');
    await recPage.waitForTimeout(1900);
    await recPage.mouse.click(795, 565);
    await recPage.waitForTimeout(1200);
    await recPage.mouse.click(820, 570);
    await recPage.waitForFunction(() => {
      const meter = document.querySelector('[data-id="the-contract"] canvas');
      const phrase = window.__MCP_FEED__.getPhrase();
      return phrase.id !== 'more-cake-please' && meter.getAttribute('aria-label') ===
        'The Contract · ' + phrase.cleanWords.join(' ');
    });
    await recPage.waitForTimeout(Math.max(900, 17500 - (performance.now() - t0)));
    assert.notEqual(new URL(recPage.url()).searchParams.get('p'), 'more-cake-please');

    const totalEndSec = (performance.now() - t0) / 1000;
    await cdp.send('Page.stopScreencast');
    await recPage.waitForTimeout(150);

    const finalUrl = recPage.url();
    console.log('Recording ended at URL:', finalUrl, 'frames:', frameLog.length);
    const audioBytes = await recPage.evaluate(async () => {
      const recording = new Promise(resolve => window.proofAudio.onstop = resolve);
      window.proofAudio.stop();
      await recording;
      const data = new Blob(window.proofChunks);
      return Array.from(new Uint8Array(await data.arrayBuffer()));
    });
    const audioPath = path.join(tmpFramesDir, 'sound.webm');
    fs.writeFileSync(audioPath, Buffer.from(audioBytes));
    await recCtx.close();

    // Build ffmpeg concat list with real frame durations for true real-time playback speed
    const concatPath = writeFrames(tmpFramesDir, frameLog, totalEndSec);

    const outMp4 = path.join(OUT_DIR, 'phase1-demo.mp4');
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-i', audioPath,
      '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '128k',
      '-vf', 'fps=30,scale=1080:1080:flags=lanczos',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '18',
      '-movflags', '+faststart',
      outMp4,
    ], { stdio: 'inherit' });



    const durOut = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outMp4,
    ]).toString().trim();
    assert.ok(Number(durOut) >= 15 && Number(durOut) <= 20, 'Phase 1 duration '+durOut);
    console.log(`Saved ${outMp4} (duration: ${durOut}s)`);

    if (errors.length) {
      console.error('Errors encountered:', errors);
      process.exitCode = 1;
    } else {
      console.log('Phase 1 capture complete with 0 errors.');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
