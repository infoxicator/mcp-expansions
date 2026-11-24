import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const instrumentId = process.argv[2];
const phraseSlug = process.argv[3] || 'more-cake-please';
const theme = process.argv[4] || 'light';

if (!instrumentId) {
  console.error('Usage: node scripts/verify_instrument.mjs <instrument-id> [phrase-slug] [theme]');
  process.exit(1);
}

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
      const filePath = path.join(ROOT, cleanUrl === '/' ? 'index.html' : cleanUrl);
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
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
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
  const outDir = path.join(ROOT, 'proof', 'final', 'stills');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${baseUrl}/?i=${instrumentId}&p=${phraseSlug}&poster=1&theme=${theme}&settled=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__MCP_FEED__ && window.__MCP_FEED__.isReady(), { timeout: 15000 });
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await page.waitForTimeout(250);

    const outPath = path.join(outDir, `${instrumentId}.png`);
    await page.screenshot({ path: outPath });

    // Also test operating via Space to confirm no runtime errors and phrase transitions
    const beforePhrase = await page.evaluate(() => window.__MCP_FEED__.getPhrase().id);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1600);
    const afterPhrase = await page.evaluate(() => window.__MCP_FEED__.getPhrase().id);

    console.log(`Verified ${instrumentId}: saved ${outPath} | before=${beforePhrase} afterSpace=${afterPhrase} errors=${errors.length}`);
    if (errors.length) {
      console.error('Errors:', errors);
      process.exitCode = 1;
    }
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
