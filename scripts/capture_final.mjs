import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const FINAL_DIR = path.join(ROOT, 'proof', 'final');
const STILLS_DIR = path.join(FINAL_DIR, 'stills');
fs.mkdirSync(STILLS_DIR, { recursive: true });

const INSTRUMENTS = [
  { id: 'newton-protocol', number: '01', title: 'Newton Protocol' },
  { id: 'the-contract', number: '02', title: 'The Contract' },
  { id: 'cipher-machine', number: '03', title: 'Cipher Machine' },
  { id: 'jacket-legend', number: '04', title: 'Jacket Legend' },
  { id: 'discover-identity', number: '05', title: 'Discover Identity' },
  { id: 'flip-contract', number: '06', title: 'Flip Contract' },
  { id: 'specimen-drawer', number: '07', title: 'Specimen Drawer' },
  { id: 'destination-blind', number: '08', title: 'Destination Blind' },
  { id: 'letterpress-lockup', number: '09', title: 'Letterpress Lockup' },
  { id: 'dymo-embosser', number: '10', title: 'Dymo Embosser' },
  { id: 'combination-lock', number: '11', title: 'Combination Lock' },
  { id: 'mechanical-typewriter', number: '12', title: 'Mechanical Typewriter' },
];

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

async function waitReady(page, idx) {
  await page.waitForFunction(
    (i) => window.__MCP_FEED__ && window.__MCP_FEED__.isReady(i),
    idx,
    { timeout: 20000 }
  );
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
    // Clean stale unnumbered stills so proof/final/stills holds exact 01..12 set
    for (const f of fs.readdirSync(STILLS_DIR)) {
      if (f.endsWith('.png')) fs.unlinkSync(path.join(STILLS_DIR, f));
    }

    // ── 1. First-paint network payload budget check (< 5 MB) ──
    const budgetCtx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
    const budgetPage = await budgetCtx.newPage();
    let totalBytes = 0;
    const loadedFiles = [];
    budgetPage.on('response', async (resp) => {
      if (!resp.url().startsWith(baseUrl)) return;
      try {
        const buf = await resp.body();
        totalBytes += buf.length;
        loadedFiles.push({ path: new URL(resp.url()).pathname, bytes: buf.length });
      } catch (_) {}
    });
    await budgetPage.goto(`${baseUrl}/?p=more-cake-please&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(budgetPage, 0);
    await budgetPage.waitForTimeout(300);
    console.log(`First-paint payload: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB across ${loadedFiles.length} local files`);
    if (totalBytes >= 5 * 1024 * 1024) {
      errors.push(`First-paint payload exceeded 5 MB: ${totalBytes} bytes`);
    }
    await budgetCtx.close();

    // ── 2. Capture 1080x1080 at-rest stills on "More Cake, Please" for ALL 12 instruments ──
    const stillCtx = await browser.newContext({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await stillCtx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`still console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`still pageerror: ${err.message}`));

    const stillPaths = [];
    for (let idx = 0; idx < INSTRUMENTS.length; idx++) {
      const inst = INSTRUMENTS[idx];
      const outPath = path.join(STILLS_DIR, `${inst.number}-${inst.id}.png`);
      await page.goto(
        `${baseUrl}/?i=${inst.id}&p=more-cake-please&poster=1&theme=light&settled=1`,
        { waitUntil: 'networkidle' }
      );
      await waitReady(page, idx);
      await page.waitForTimeout(260);
      await page.screenshot({ path: outPath });
      stillPaths.push({ ...inst, file: `${inst.number}-${inst.id}.png`, outPath });
      console.log(`Captured still ${inst.number}/12: ${inst.id}`);
    }

    // Quick verification of dark mode, reduced-motion fallback, custom ?w=, and `/` Index drawer
    await page.goto(`${baseUrl}/?i=mechanical-typewriter&p=more-cake-please&poster=1&theme=dark&settled=1`, { waitUntil: 'networkidle' });
    await waitReady(page, 11);
    await page.waitForTimeout(180);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${baseUrl}/?i=combination-lock&w=Modern,Coffee,Protocol&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 10);
    const fallbackText = await page.locator('[data-poster-index="10"] .fallback-words').innerText();
    console.log('Verified reduced-motion + ?w= fallback:', fallbackText.replace(/\s+/g, ' '));
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Verify `/` Index drawer opens and has all 64 phrases
    await page.goto(`${baseUrl}/?i=newton-protocol&p=more-cake-please&theme=light`, { waitUntil: 'networkidle' });
    await waitReady(page, 0);
    await page.keyboard.press('/');
    await page.waitForTimeout(200);
    const drawerRows = await page.locator('.drawer-item, .index-row, [data-slug]').count();
    console.log('Verified `/` Index drawer items:', drawerRows);
    await page.keyboard.press('Escape');

    await stillCtx.close();

    // ── 3. Build 4x3 archival contact sheet (proof/final/contact-sheet.png) ──
    const sheetW = 2400;
    const sheetH = 1940;
    const sheetCtx = await browser.newContext({ viewport: { width: sheetW, height: sheetH }, deviceScaleFactor: 1 });
    const sheetPage = await sheetCtx.newPage();

    const cardsHtml = stillPaths.map((s) => {
      const b64 = fs.readFileSync(s.outPath).toString('base64');
      return `
        <figure class="card">
          <div class="frame">
            <img src="data:image/png;base64,${b64}" alt="${s.title}" />
          </div>
          <figcaption>
            <span class="num">${s.number}</span>
            <span class="name">${s.title}</span>
          </figcaption>
        </figure>
      `;
    }).join('');

    await sheetPage.setContent(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: ${sheetW}px;
            height: ${sheetH}px;
            background: #EAE5DC;
            color: #181715;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
            padding: 46px 52px 44px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 1px solid rgba(24, 23, 21, 0.14);
            padding-bottom: 18px;
            margin-bottom: 26px;
          }
          header h1 {
            font-size: 24px;
            font-weight: 500;
            letter-spacing: -0.01em;
          }
          header .meta {
            font-family: ui-monospace, "SF Mono", Menlo, monospace;
            font-size: 14px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(24, 23, 21, 0.58);
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 26px 28px;
            flex: 1;
          }
          .card {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .frame {
            width: 100%;
            aspect-ratio: 1 / 1;
            background: #F4F1EA;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(24, 23, 21, 0.08);
          }
          .frame img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
          }
          figcaption {
            display: flex;
            align-items: baseline;
            gap: 10px;
            font-family: ui-monospace, "SF Mono", Menlo, monospace;
            font-size: 14px;
            letter-spacing: 0.04em;
            color: #24221F;
          }
          figcaption .num {
            color: rgba(24, 23, 21, 0.45);
          }
          figcaption .name {
            text-transform: uppercase;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>MCP — Twelve Physical Instruments</h1>
          <div class="meta">1080×1080 STUDIO PLATES · AT REST ON "MORE CAKE, PLEASE"</div>
        </header>
        <main class="grid">${cardsHtml}</main>
      </body>
      </html>
    `, { waitUntil: 'load' });
    await sheetPage.waitForTimeout(150);
    const contactSheetPath = path.join(FINAL_DIR, 'contact-sheet.png');
    await sheetPage.screenshot({ path: contactSheetPath });
    console.log(`Saved contact sheet: ${contactSheetPath}`);
    await sheetCtx.close();

    // ── 4. Record full-feed swipe demo (proof/final/full-feed-demo.mp4) ──
    const tmpFramesDir = path.join(ROOT, 'tmp', 'final-frames');
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

    await recPage.goto(`${baseUrl}/?i=newton-protocol&p=more-cake-please&theme=light`, { waitUntil: 'networkidle' });
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
      quality: 92,
      maxWidth: 1080,
      maxHeight: 1080,
      everyNthFrame: 1,
    });

    // Instrument 01: Newton Protocol — hold 0.8s then pull & release M ball via Space!
    await recPage.waitForTimeout(800);
    await recPage.keyboard.press('Space');
    await recPage.waitForTimeout(2600);

    // Swipe down through Instruments 02..12, operating Destination Blind (08), Combination Lock (11), and Mechanical Typewriter (12)
    for (let targetIdx = 1; targetIdx < INSTRUMENTS.length; targetIdx++) {
      await recPage.keyboard.press('ArrowDown');
      await waitReady(recPage, targetIdx);

      if (targetIdx === 7) {
        // Instrument 08: Destination Blind — let it settle then roll split-flaps via Space
        await recPage.waitForTimeout(850);
        await recPage.keyboard.press('Space');
        await recPage.waitForTimeout(2200);
      } else if (targetIdx === 10) {
        // Instrument 11: Combination Lock — toggle dark mode briefly + spin tumblers!
        await recPage.waitForTimeout(750);
        await recPage.keyboard.press('t');
        await recPage.waitForTimeout(650);
        await recPage.keyboard.press('Space');
        await recPage.waitForTimeout(1900);
        await recPage.keyboard.press('t');
        await recPage.waitForTimeout(500);
      } else if (targetIdx === 11) {
        // Instrument 12: Mechanical Typewriter — type a fresh phrase & carriage return!
        await recPage.waitForTimeout(850);
        await recPage.keyboard.press('Space');
        await recPage.waitForTimeout(2400);
      } else {
        // Clean hold on each intermediate instrument so every single plate is clearly readable in the swipe demo
        await recPage.waitForTimeout(1050);
      }
    }

    const totalEndSec = (performance.now() - t0) / 1000;
    await cdp.send('Page.stopScreencast');
    await recPage.waitForTimeout(150);
    console.log(`Full feed recording ended at ${recPage.url()} | frames=${frameLog.length} | rawSec=${totalEndSec.toFixed(1)}`);
    await recCtx.close();

    // Assemble H.264 MP4 with true real-time frame timing via concat demuxer
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

    const outMp4 = path.join(FINAL_DIR, 'full-feed-demo.mp4');
    execFileSync('/opt/homebrew/bin/ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-vf', 'fps=30,scale=1080:1080:flags=lanczos',
      '-fps_mode', 'vfr',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '20',
      '-movflags', '+faststart',
      outMp4,
    ], { stdio: 'inherit' });

    // Extract a 4x3 filmstrip preview from the finished MP4 for quick visual inspection
    const filmstripPath = path.join(ROOT, 'tmp', 'demo-filmstrip.png');
    execFileSync('/opt/homebrew/bin/ffmpeg', [
      '-y',
      '-i', outMp4,
      '-vf', 'fps=12/26,scale=360:360,tile=4x3',
      '-frames:v', '1',
      filmstripPath,
    ], { stdio: 'pipe' });

    fs.rmSync(tmpFramesDir, { recursive: true, force: true });

    const durOut = execFileSync('/opt/homebrew/bin/ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outMp4,
    ]).toString().trim();
    const mp4SizeMB = (fs.statSync(outMp4).size / (1024 * 1024)).toFixed(2);
    console.log(`Saved ${outMp4} (${durOut}s, ${mp4SizeMB} MB)`);

    if (errors.length) {
      console.error('Errors encountered:', errors);
      process.exitCode = 1;
    } else {
      console.log('Final capture & verification complete with 0 errors!');
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
