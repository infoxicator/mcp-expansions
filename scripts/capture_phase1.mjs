import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'proof', 'phase1');
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      let filePath = path.join(ROOT, cleanUrl === '/' ? 'index.html' : cleanUrl);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

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
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Test deep links (?w= custom remix + no-webgl fallback)
    await page.goto(`${baseUrl}/?i=the-contract&w=Mostly,Caffeinated,Pigeons&fallback=no-webgl`, { waitUntil: 'networkidle' });
    await waitReady(page, 1);
    const fallbackText = await page.locator('[data-poster-index="1"] .fallback-words').innerText();
    console.log('Verified ?w= + no-webgl fallback:', fallbackText.replace(/\s+/g, ' '));

    await stillCtx.close();

    // 2. Capture 16-18s Phase 1 video recording using CDP Page.startScreencast + system ffmpeg
    const tmpFramesDir = path.join(ROOT, 'tmp', 'phase1-frames');
    fs.rmSync(tmpFramesDir, { recursive: true, force: true });
    fs.mkdirSync(tmpFramesDir, { recursive: true });

    const recCtx = await browser.newContext({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 1,
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

    // Smoothly snap-scroll down to Instrument 2 (The Contract) via keyboard ArrowDown
    await recPage.keyboard.press('ArrowDown');
    await recPage.waitForTimeout(1500);

    // Plug in the right cable -> 5V -> 9V -> 15V -> 20V -> CONTRACT OK -> locks MORE / CAKE / PLEASE
    await recPage.keyboard.press('Space');
    await recPage.waitForTimeout(3400);

    // Unplug the right cable
    await recPage.keyboard.press('Space');
    await recPage.waitForTimeout(1200);

    // Replug -> negotiates and locks a NEW phrase!
    await recPage.keyboard.press('Space');
    await recPage.waitForTimeout(4000);

    const totalEndSec = (performance.now() - t0) / 1000;
    await cdp.send('Page.stopScreencast');
    await recPage.waitForTimeout(150);

    const finalUrl = recPage.url();
    console.log('Recording ended at URL:', finalUrl, 'frames:', frameLog.length);
    await recCtx.close();

    // Build ffmpeg concat list with real frame durations for true real-time playback speed
    const concatPath = path.join(tmpFramesDir, 'frames.txt');
    let concatTxt = '';
    for (let i = 0; i < frameLog.length; i++) {
      const nextTs = i + 1 < frameLog.length ? frameLog[i + 1].ts : totalEndSec;
      const dur = Math.max(0.016, nextTs - frameLog[i].ts);
      concatTxt += `file '${frameLog[i].fname}'\nduration ${dur.toFixed(4)}\n`;
    }
    if (frameLog.length > 0) {
      concatTxt += `file '${frameLog[frameLog.length - 1].fname}'\n`;
    }
    fs.writeFileSync(concatPath, concatTxt);

    const outMp4 = path.join(OUT_DIR, 'phase1-demo.mp4');
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-vf', 'fps=30,scale=1080:1080:flags=lanczos',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '18',
      '-movflags', '+faststart',
      outMp4,
    ], { stdio: 'inherit' });

    fs.rmSync(tmpFramesDir, { recursive: true, force: true });

    const durOut = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outMp4,
    ]).toString().trim();
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
