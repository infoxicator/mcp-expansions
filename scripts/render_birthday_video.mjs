import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT_MP4 = path.join(ROOT, 'proof', 'final', 'mcp-birthday-showcase.mp4');
fs.mkdirSync(path.dirname(OUT_MP4), { recursive: true });

const FPS = 60;
const TOTAL_SECONDS = 21.4;
const TOTAL_FRAMES = Math.round(TOTAL_SECONDS * FPS);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

const STAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1080, height=1080, initial-scale=1.0" />
  <title>MCP Birthday Showcase Stage</title>
  <link rel="stylesheet" href="./src/styles.css" />
  <script type="importmap">
    {
      "imports": {
        "mcp-feed-scroll": "./src/core/feed-scroll.js?v=3",
        "mcp-mechanism": "./src/core/mechanism.js?v=3",
        "three": "./vendor/three/three.module.js",
        "three/addons/": "./vendor/three/jsm/"
      }
    }
  </script>
  <style>
    html, body {
      width: 1080px;
      height: 1080px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #ffffff;
    }

    #stage {
      position: relative;
      width: 1080px;
      height: 1080px;
      overflow: hidden;
      background: #ffffff;
    }

    /* Act 1 full-bleed stage (1080x1080) */
    #act1 {
      position: absolute;
      inset: 0;
      width: 1080px;
      height: 1080px;
      background: #ffffff;
      z-index: 2;
    }

    .act1-slot {
      position: absolute;
      inset: 0;
      width: 1080px;
      height: 1080px;
      --poster-size: 1080px;
      display: none;
      overflow: hidden;
    }

    .act1-slot.is-visible {
      display: block;
    }

    .act1-slot .poster-canvas {
      width: 1080px;
      height: 1080px;
      display: block;
    }

    /* Slightly crisper word fade for deterministic 60fps stepping */
    .newton-word {
      transition: opacity 95ms cubic-bezier(0.22, 1, 0.36, 1), transform 120ms cubic-bezier(0.22, 1, 0.36, 1) !important;
    }

    /* Act 2 zoom-out mosaic world */
    #act2 {
      position: absolute;
      inset: 0;
      width: 1080px;
      height: 1080px;
      background: #ffffff;
      display: none;
      z-index: 3;
      overflow: hidden;
    }

    #mosaicWorld {
      position: absolute;
      left: 540px;
      top: 540px;
      width: 0;
      height: 0;
      transform-origin: 0 0;
      will-change: transform;
    }

    .mosaic-tile {
      position: absolute;
      width: 1080px;
      height: 1080px;
      --poster-size: 1080px;
      background: #F2EDE4;
      border: 1.4px solid rgba(21, 21, 20, 0.11);
      border-radius: 30px;
      overflow: hidden;
      box-shadow: 0 2px 14px rgba(21, 21, 20, 0.04);
      transform-origin: center center;
    }

    .mosaic-tile.is-hero {
      box-shadow: none;
    }

    .mosaic-tile .poster-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* Actual updated site chrome overlay during the site-view beat */
    #siteChrome {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
    }

    #siteChrome .mcp-mark {
      position: absolute;
      inset-block-start: 20px;
      inset-inline-end: 21.6px;
      width: 24px;
      height: 24px;
    }

    #siteChrome .instrument-rail {
      position: absolute;
      top: 50%;
      inset-inline-end: 21.6px;
      transform: translateY(-50%);
    }

    #siteChrome .scroll-cue {
      position: absolute;
      inset: auto 0 24px;
    }

    #siteChrome .scroll-cue-arrow {
      animation: none;
    }

    /* Realistic macOS pointing/grab cursor matching ui-feed.dev video */
    #cursorLayer {
      position: absolute;
      left: 0;
      top: 0;
      z-index: 10;
      pointer-events: none;
      opacity: 0;
      will-change: transform, opacity;
      filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.28));
    }

    /* Act 3 "Happy Birthday, MCP" gallery finale */
    #act3 {
      position: absolute;
      inset: 0;
      width: 1080px;
      height: 1080px;
      background: #ffffff;
      z-index: 12;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
    }

    .bday-lockup {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 34px;
      transform: translateY(-10px);
    }

    .bday-mark {
      width: 82px;
      height: 82px;
      background: #151514;
      mask: url('./assets/brand/mcp-mark.svg') center / contain no-repeat;
      -webkit-mask: url('./assets/brand/mcp-mark.svg') center / contain no-repeat;
      opacity: 0;
      transform: translateY(16px) scale(0.92);
    }

    .bday-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-weight: 400;
      font-size: 106px;
      line-height: 1.02;
      letter-spacing: -0.022em;
      color: #151514;
      display: flex;
      align-items: baseline;
      gap: 0.20em;
    }

    .bday-word {
      display: inline-block;
      opacity: 0;
      transform: translateY(20px);
    }

    .bday-word.is-mcp {
      -webkit-text-stroke: 0.008em currentColor;
    }

    .bday-rule {
      width: 72px;
      height: 1px;
      background: rgba(21, 21, 20, 0.18);
      opacity: 0;
      transform: scaleX(0);
    }

    .bday-sub {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #58554E;
      opacity: 0;
      transform: translateY(10px);
    }
  </style>
</head>
<body>
  <div id="stage">
    <div id="act1"></div>

    <div id="act2">
      <div id="mosaicWorld"></div>
      <div id="siteChrome">
        <span class="mcp-mark" aria-hidden="true"></span>
        <nav class="instrument-rail" id="chromeRail" aria-hidden="true">
          <div class="instrument-rail-track" id="chromeRailTrack"></div>
        </nav>
        <div class="scroll-cue" aria-hidden="true">
          <span class="scroll-cue-mark">
            <span class="scroll-cue-arrow" id="chromeArrow"></span>
          </span>
          <span class="scroll-cue-keyboard">scroll · press j / k</span>
        </div>
      </div>
    </div>

    <div id="cursorLayer"></div>

    <div id="act3">
      <div class="bday-lockup">
        <div class="bday-mark" id="bdayMark"></div>
        <h1 class="bday-title">
          <span class="bday-word" id="bdayW0">Happy</span>
          <span class="bday-word" id="bdayW1">Birthday,</span>
          <span class="bday-word is-mcp" id="bdayW2">MCP</span>
        </h1>
        <div class="bday-rule" id="bdayRule"></div>
        <p class="bday-sub" id="bdaySub">NOV 25, 2024 — NOV 25, 2026 · TWO YEARS</p>
      </div>
    </div>
  </div>

  <script type="module">
    // Deterministic virtual clock so the-contract.js (performance.now) stays locked to 60.000fps!
    let virtualNowMs = 1000;
    const realPerfNow = performance.now.bind(performance);
    Object.defineProperty(performance, 'now', {
      configurable: true,
      value: () => virtualNowMs,
    });

    import { INSTRUMENTS } from './src/registry.js';

    const phrasesRes = await fetch('./phrases.json');
    const ALL_PHRASES = await phrasesRes.json();

    await Promise.all([
      document.fonts.load('400 106px "Instrument Serif"'),
      document.fonts.load('400 16px "JetBrains Mono"'),
      document.fonts.load('600 16px "JetBrains Mono"'),
      document.fonts.load('700 16px "JetBrains Mono"'),
      document.fonts.load('500 16px Inter'),
    ]);
    await document.fonts.ready;

    function makePhraseObj(entry) {
      const cleanWords = entry.words.map((w) => w.replace(/,$/, ''));
      return {
        id: entry.id,
        slug: entry.id,
        words: entry.words,
        cleanWords,
        text: entry.words.join(' '),
        note: entry.note || '',
        category: entry.category || '',
      };
    }

    function findPhrase(id) {
      const found = ALL_PHRASES.find((p) => p.id === id) || ALL_PHRASES[0];
      return makePhraseObj(found);
    }

    class LocalPhraseStore {
      constructor(queueIds) {
        this.phrases = ALL_PHRASES;
        this.queue = queueIds.map((id) => (typeof id === 'number' ? makePhraseObj(ALL_PHRASES[id % ALL_PHRASES.length]) : findPhrase(id)));
        this.ptr = 0;
        this.state = this.queue[0];
      }
      getState() {
        return this.state;
      }
      nextRandom() {
        this.ptr = (this.ptr + 1) % this.queue.length;
        this.state = this.queue[this.ptr];
        return this.state;
      }
    }

    // Crisp macOS-style hand cursor SVGs (pointing hand, open grab hand, closed grabbing hand)
    const CURSOR_POINTER = \`<svg width="46" height="46" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.2 5.5C14.2 4.1 15.3 3 16.7 3C18.1 3 19.2 4.1 19.2 5.5V14.5H20.3C21.6 14.5 22.6 15.4 22.8 16.6H23.7C25 16.6 26.1 17.6 26.2 18.9H27C28.3 18.9 29.4 20 29.4 21.3V25.2C29.4 29.5 26 33 21.7 33H17.6C14.6 33 12 31.3 10.6 28.7L6.8 21.6C6.1 20.3 6.6 18.6 7.9 17.9C9.1 17.3 10.6 17.7 11.4 18.8L14.2 22.4V5.5Z" fill="#FFFFFF" stroke="#151514" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="19.2" y1="14.5" x2="19.2" y2="20.5" stroke="#151514" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="22.8" y1="16.6" x2="22.8" y2="21.4" stroke="#151514" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="26.2" y1="18.9" x2="26.2" y2="22.4" stroke="#151514" stroke-width="1.6" stroke-linecap="round"/>
    </svg>\`;

    const CURSOR_GRAB = \`<svg width="46" height="46" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.8 17.5V9.5C11.8 8.3 12.8 7.3 14 7.3C15.2 7.3 16.2 8.3 16.2 9.5V14.8V7.2C16.2 6 17.2 5 18.4 5C19.6 5 20.6 6 20.6 7.2V14.8V8.4C20.6 7.2 21.6 6.2 22.8 6.2C24 6.2 25 7.2 25 8.4V15.5V11.8C25 10.6 26 9.6 27.2 9.6C28.4 9.6 29.4 10.6 29.4 11.8V23.2C29.4 28.4 25.4 32.5 20.2 32.5H17.3C13.8 32.5 10.7 30.4 9.3 27.2L6.6 20.8C6 19.5 6.7 18 8 17.5C9.2 17 10.6 17.5 11.2 18.6L11.8 19.6V17.5Z" fill="#FFFFFF" stroke="#151514" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="16.2" y1="14.5" x2="16.2" y2="18.2" stroke="#151514" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="20.6" y1="14.5" x2="20.6" y2="18.2" stroke="#151514" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="25" y1="15.2" x2="25" y2="18.8" stroke="#151514" stroke-width="1.5" stroke-linecap="round"/>
    </svg>\`;

    const CURSOR_GRABBING = \`<svg width="46" height="46" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.6 18.2V14.5C11.6 13.2 12.7 12.1 14 12.1C15.1 12.1 16 12.9 16.3 13.9C16.6 12.7 17.6 11.8 18.9 11.8C20.2 11.8 21.2 12.7 21.5 13.9C21.9 12.9 22.9 12.2 24 12.2C25.3 12.2 26.3 13.2 26.5 14.5C27.9 14.6 29 15.8 29 17.2V23.4C29 28.4 25 32.4 20 32.4H17.4C14 32.4 10.9 30.3 9.5 27.1L7.3 22.1C6.7 20.8 7.3 19.2 8.7 18.7C9.8 18.3 11 18.8 11.6 19.7V18.2Z" fill="#FFFFFF" stroke="#151514" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="16.3" y1="14.2" x2="16.3" y2="19.6" stroke="#151514" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="21.5" y1="14.2" x2="21.5" y2="19.6" stroke="#151514" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="26.3" y1="15.2" x2="26.3" y2="20.2" stroke="#151514" stroke-width="1.6" stroke-linecap="round"/>
    </svg>\`;

    const cursorLayer = document.getElementById('cursorLayer');
    let currentCursorKind = '';
    function setCursor(x, y, { kind = 'pointer', opacity = 1, scale = 1 } = {}) {
      if (kind !== currentCursorKind) {
        currentCursorKind = kind;
        cursorLayer.innerHTML = kind === 'grab' ? CURSOR_GRAB : kind === 'grabbing' ? CURSOR_GRABBING : CURSOR_POINTER;
      }
      // Offset SVG hotspot cleanly to fingertip / palm center
      const ox = kind === 'pointer' ? 21 : 23;
      const oy = kind === 'pointer' ? 7 : 20;
      cursorLayer.style.opacity = String(opacity);
      cursorLayer.style.transform = \`translate(\${(x - ox).toFixed(2)}px, \${(y - oy).toFixed(2)}px) scale(\${scale.toFixed(3)})\`;
    }

    // Load all 12 instrument ES modules once
    const modules = {};
    for (const entry of INSTRUMENTS) {
      const relPath = entry.modulePath.startsWith('./') ? entry.modulePath.slice(2) : entry.modulePath;
      const mod = await import('./src/' + relPath + '?v=3');
      modules[entry.id] = mod;
    }

    // ── ACT 1: 7 Full-Bleed Close-Up Clips (0.00s -> 13.85s) ──
    const CLIPS = [
      {
        id: 'newton-protocol',
        start: 0.00,
        end: 2.45,
        startSettled: false,
        phrases: ['more-cake-please', 'more-cake-please'],
        triggerAt: 0.16,
        replay: true,
        timeScale: 1.42,
        cursor(lt) {
          // Glide directly onto posed M steel sphere (228, 468), pull slightly & release cleanly
          if (lt < 0.15) {
            const k = easeOutCubic(lt / 0.15);
            return { x: lerp(310, 228, k), y: lerp(540, 468, k), kind: 'grab', opacity: clamp01(lt / 0.06), scale: 1 };
          }
          if (lt < 0.36) {
            const k = easeInOutCubic((lt - 0.15) / 0.21);
            return { x: lerp(228, 194, k), y: lerp(468, 444, k), kind: 'grabbing', opacity: 1, scale: 0.94 };
          }
          const k = easeOutCubic(clamp01((lt - 0.36) / 0.42));
          return { x: lerp(194, 248, k), y: lerp(444, 515, k), kind: 'grab', opacity: 1 - clamp01((lt - 1.55) / 0.35), scale: 1 };
        },
      },
      {
        id: 'the-contract',
        start: 2.45,
        end: 4.35,
        startSettled: false,
        phrases: ['manual-copy-paste', 'manual-copy-paste'],
        triggerAt: 0.22,
        replay: true,
        timeScale: 1.05,
        cursor(lt) {
          // Grab right unplugged USB-C black rubber boot at (1002, 540) and slide it cleanly into the meter!
          if (lt < 0.15) {
            const k = easeOutCubic(lt / 0.15);
            return { x: lerp(1048, 1002, k), y: lerp(602, 540, k), kind: 'grab', opacity: 1, scale: 1 };
          }
          if (lt < 0.35) {
            const k = easeInOutCubic((lt - 0.15) / 0.20);
            return { x: lerp(1002, 926, k), y: 540, kind: 'grabbing', opacity: 1, scale: 0.95 };
          }
          const k = easeOutCubic(clamp01((lt - 0.35) / 0.34));
          return { x: lerp(926, 968, k), y: lerp(540, 592, k), kind: 'grab', opacity: 1 - clamp01((lt - 1.35) / 0.35), scale: 1 };
        },
      },
      {
        id: 'cipher-machine',
        start: 4.35,
        end: 6.00,
        startSettled: true,
        phrases: ['manual-copy-paste', 'mostly-context-problems'],
        triggerAt: 0.14,
        replay: false,
        timeScale: 1.0,
        cursor(lt) {
          // Click brass C rotor dial at (540, 268)
          if (lt < 0.12) {
            const k = easeOutCubic(lt / 0.12);
            return { x: lerp(620, 540, k), y: lerp(335, 268, k), kind: 'pointer', opacity: 1, scale: 1 };
          }
          const press = lt >= 0.12 && lt < 0.23 ? 0.88 : 1;
          const k = easeOutCubic(clamp01((lt - 0.26) / 0.35));
          return { x: lerp(540, 595, k), y: lerp(268, 315, k), kind: 'pointer', opacity: 1 - clamp01((lt - 1.15) / 0.30), scale: press };
        },
      },
      {
        id: 'destination-blind',
        start: 6.00,
        end: 7.90,
        startSettled: true,
        phrases: ['mostly-context-problems', 'many-candles-pending'],
        triggerAt: 0.14,
        replay: false,
        timeScale: 1.24,
        cursor(lt) {
          if (lt < 0.12) {
            const k = easeOutCubic(lt / 0.12);
            return { x: lerp(680, 580, k), y: lerp(620, 548, k), kind: 'pointer', opacity: 1, scale: 1 };
          }
          const press = lt >= 0.12 && lt < 0.23 ? 0.88 : 1;
          const k = easeOutCubic(clamp01((lt - 0.26) / 0.35));
          return { x: lerp(580, 645, k), y: lerp(548, 605, k), kind: 'pointer', opacity: 1 - clamp01((lt - 1.35) / 0.30), scale: press };
        },
      },
      {
        id: 'dymo-embosser',
        start: 7.90,
        end: 10.05,
        startSettled: true,
        phrases: ['many-candles-pending', 'mandatory-coffee-protocol'],
        triggerAt: 0.14,
        replay: false,
        timeScale: 1.32,
        cursor(lt) {
          // Squeeze squarely on the cast-teal embosser handle at (778, 222)
          if (lt < 0.12) {
            const k = easeOutCubic(lt / 0.12);
            return { x: lerp(848, 778, k), y: lerp(286, 222, k), kind: 'pointer', opacity: 1, scale: 1 };
          }
          const press = lt >= 0.12 && lt < 0.24 ? 0.88 : 1;
          const k = easeOutCubic(clamp01((lt - 0.28) / 0.38));
          return { x: lerp(778, 825, k), y: lerp(222, 272, k), kind: 'pointer', opacity: 1 - clamp01((lt - 1.55) / 0.32), scale: press };
        },
      },
      {
        id: 'combination-lock',
        start: 10.05,
        end: 11.75,
        startSettled: true,
        phrases: ['mandatory-coffee-protocol', 'make-claude-proud'],
        triggerAt: 0.14,
        replay: false,
        timeScale: 1.0,
        cursor(lt) {
          // Tap the central brass word tumbler at (552, 678)
          if (lt < 0.12) {
            const k = easeOutCubic(lt / 0.12);
            return { x: lerp(640, 552, k), y: lerp(745, 678, k), kind: 'pointer', opacity: 1, scale: 1 };
          }
          const press = lt >= 0.12 && lt < 0.23 ? 0.88 : 1;
          const k = easeOutCubic(clamp01((lt - 0.26) / 0.35));
          return { x: lerp(552, 625, k), y: lerp(678, 735, k), kind: 'pointer', opacity: 1 - clamp01((lt - 1.25) / 0.30), scale: press };
        },
      },
      {
        id: 'mechanical-typewriter',
        start: 11.75,
        end: 13.85,
        startSettled: true,
        phrases: ['make-claude-proud', 'more-cake-please'],
        triggerAt: 0.12,
        replay: false,
        timeScale: 1.0,
        cursor(lt) {
          // Tap the typewriter keybed at (545, 865), then gracefully glide away before zoom-out
          if (lt < 0.11) {
            const k = easeOutCubic(lt / 0.11);
            return { x: lerp(620, 545, k), y: lerp(930, 865, k), kind: 'pointer', opacity: 1, scale: 1 };
          }
          const press = lt >= 0.11 && lt < 0.22 ? 0.88 : 1;
          const k = easeOutCubic(clamp01((lt - 0.25) / 0.45));
          return { x: lerp(545, 620, k), y: lerp(865, 920, k), kind: 'pointer', opacity: 1 - clamp01((lt - 1.55) / 0.40), scale: press };
        },
      },
    ];

    // Mount Act 1 clip instances
    const act1El = document.getElementById('act1');
    const act1Instances = [];
    for (const clip of CLIPS) {
      const slotEl = document.createElement('div');
      slotEl.className = 'act1-slot';
      const canvas = document.createElement('canvas');
      canvas.className = 'poster-canvas';
      canvas.width = 1080;
      canvas.height = 1080;
      slotEl.appendChild(canvas);
      act1El.appendChild(slotEl);

      const store = new LocalPhraseStore(clip.phrases);
      const api = await modules[clip.id].createInstrument({
        container: slotEl,
        canvas,
        phraseStore: store,
        theme: 'light',
        startSettled: clip.startSettled,
        canOperate: () => true,
      });
      api.render(0);
      act1Instances.push({ clip, slotEl, api, store, triggered: false });
    }

    // ── ACT 2: Build the 5x5 Living Mosaic Wall (All 12 instruments alive simultaneously!) ──
    // Center tile (row=2, col=2) is mechanical-typewriter settled on "More Cake, Please" for a 100% seamless handoff from Act 1!
    // Inner 3x3 + surrounding 4x4 show ALL 12 instruments with balanced visual contrast and zero touching duplicates.
    const MOSAIC_LAYOUT = [
      // Row 0
      ['dymo-embosser', 'newton-protocol', 'specimen-drawer', 'combination-lock', 'jacket-legend'],
      // Row 1
      ['discover-identity', 'destination-blind', 'the-contract', 'cipher-machine', 'letterpress-lockup'],
      // Row 2 (center row — col 2 is HERO mechanical-typewriter!)
      ['combination-lock', 'letterpress-lockup', 'mechanical-typewriter', 'newton-protocol', 'flip-contract'],
      // Row 3
      ['jacket-legend', 'flip-contract', 'specimen-drawer', 'dymo-embosser', 'discover-identity'],
      // Row 4
      ['cipher-machine', 'the-contract', 'destination-blind', 'mechanical-typewriter', 'combination-lock'],
    ];

    const MOSAIC_PHRASE_SEEDS = [
      ['mandatory-celebration-protocol', 'more-cake-please'],
      ['more-cake-please', 'many-candles-pending'],
      ['mostly-confetti-particles', 'mandatory-coffee-protocol'],
      ['make-claude-proud', 'manual-copy-paste'],
      ['more-context-probably', 'mostly-context-problems'],
      ['majestic-croissant-physics', 'mildly-caffeinated-pigeons'],
      ['manual-copy-paste', 'many-candles-pending'],
      ['mostly-context-problems', 'mandatory-celebration-protocol'],
      ['many-candles-pending', 'more-cake-please'],
      ['mischievous-capybara-parliament', 'make-claude-proud'],
      ['missing-config-path', 'more-context-probably'],
      ['muffled-console-print', 'mostly-confetti-particles'],
    ];

    const CELL_SIZE = 1080;
    const CELL_GAP = 220; // At scale = 780/1080 (0.7222), neighbors sit cleanly outside viewport edge!
    const CELL_PITCH = CELL_SIZE + CELL_GAP;

    const mosaicWorld = document.getElementById('mosaicWorld');
    const mosaicTiles = [];
    let tileCounter = 0;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const id = MOSAIC_LAYOUT[r][c];
        const isHero = r === 2 && c === 2;
        const tileEl = document.createElement('div');
        tileEl.className = 'mosaic-tile' + (isHero ? ' is-hero' : '');

        const left = (c - 2) * CELL_PITCH - CELL_SIZE / 2;
        const top = (r - 2) * CELL_PITCH - CELL_SIZE / 2;
        tileEl.style.left = left + 'px';
        tileEl.style.top = top + 'px';

        const canvas = document.createElement('canvas');
        canvas.className = 'poster-canvas';
        // Full 1080x1080 on hero tile for razor-sharp zoom-out; 540x540 on neighbors (viewed at <= 320px)
        const res = isHero ? 1080 : 540;
        canvas.width = res;
        canvas.height = res;
        tileEl.appendChild(canvas);
        mosaicWorld.appendChild(tileEl);

        const seed = isHero
          ? ['more-cake-please', 'more-cake-please']
          : MOSAIC_PHRASE_SEEDS[tileCounter % MOSAIC_PHRASE_SEEDS.length];
        const store = new LocalPhraseStore(seed);

        const api = await modules[id].createInstrument({
          container: tileEl,
          canvas,
          phraseStore: store,
          theme: 'light',
          startSettled: true,
          canOperate: () => true,
        });
        api.render(0);

        // Stagger live triggers across the mosaic wall during zoom-out (14.55s -> 17.3s)
        const dist = Math.hypot(r - 2, c - 2);
        const triggerTime = isHero ? null : 14.55 + dist * 0.42 + ((tileCounter * 0.17) % 0.55);

        mosaicTiles.push({
          id,
          r,
          c,
          isHero,
          tileEl,
          api,
          store,
          triggerTime,
          triggered: false,
          secondTriggerTime: isHero ? null : triggerTime + 2.05,
          secondTriggered: false,
        });
        tileCounter++;
      }
    }

    // Build authentic 12-tick instrument rail in #siteChrome matching src/core/instrument-rail.js (active = 11 -> Mechanical Typewriter!)
    const railTrack = document.getElementById('chromeRailTrack');
    for (let i = 0; i < INSTRUMENTS.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'instrument-tick';
      const activeIdx = 11;
      const dist = Math.abs(i - activeIdx);
      btn.style.setProperty('--tick-width', [32, 21, 15][dist] ?? 11);
      btn.style.setProperty('--tick-opacity', [1, 0.63, 0.44][dist] ?? Math.max(0.16, 0.38 - dist * 0.029));
      railTrack.appendChild(btn);
    }

    const act2El = document.getElementById('act2');
    const siteChrome = document.getElementById('siteChrome');
    const chromeArrow = document.getElementById('chromeArrow');
    const act3El = document.getElementById('act3');
    const bdayMark = document.getElementById('bdayMark');
    const bdayWords = [document.getElementById('bdayW0'), document.getElementById('bdayW1'), document.getElementById('bdayW2')];
    const bdayRule = document.getElementById('bdayRule');
    const bdaySub = document.getElementById('bdaySub');

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - clamp01(t), 3); }
    function easeInOutCubic(t) {
      const x = clamp01(t);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    function easeOutExpo(t) {
      const x = clamp01(t);
      return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
    }

    const ACT2_START = 13.85;
    const SITE_BEAT_END = 15.15;
    const ZOOM_END = 17.85;
    const ACT3_START = 18.35;

    const heroTile = mosaicTiles.find((t) => t.isHero);

    // Deterministic single-frame stepper called from Node for each frame
    window.__RENDER_FRAME__ = function renderFrame(frameIndex, fps) {
      const dt = 1 / fps;
      const t = frameIndex / fps;
      virtualNowMs = 1000 + t * 1000;

      if (t < ACT2_START) {
        // ── ACT 1: Punchy Full-Bleed Close-Ups ──
        act1El.style.display = 'block';
        act2El.style.display = 'none';
        act3El.style.opacity = '0';

        let activeEntry = null;
        for (const item of act1Instances) {
          const visible = t >= item.clip.start && t < item.clip.end;
          item.slotEl.classList.toggle('is-visible', visible);
          if (visible) activeEntry = item;
        }

        if (activeEntry) {
          const lt = t - activeEntry.clip.start;
          const stepDt = dt * (activeEntry.clip.timeScale ?? 1);
          if (!activeEntry.triggered && lt >= activeEntry.clip.triggerAt) {
            activeEntry.triggered = true;
            activeEntry.api.triggerPrimary({ replay: activeEntry.clip.replay });
          }
          activeEntry.api.render(stepDt);

          const cur = activeEntry.clip.cursor(lt);
          setCursor(cur.x, cur.y, cur);
        }
      } else {
        // ── ACT 2 & ACT 3: Zoom-Out (Site View -> 5x5 Living Mosaic) -> "Happy Birthday, MCP" ──
        act1El.style.display = 'none';
        act2El.style.display = 'block';
        setCursor(-100, -100, { opacity: 0 });

        // Continuous log-space camera scale for natural optical zoom-out!
        // Phase 2A (13.85 -> 15.15): 1.000 -> 0.7222 (exact 780/1080 site poster size!)
        // Phase 2B (15.15 -> 17.85): 0.7222 -> 0.198 (full 5x5 mosaic wall filling 1080x1080!)
        // Phase 2C (17.85 -> 19.10): gentle drift 0.198 -> 0.184 as Act 3 dissolves in
        let scale;
        let offsetY = 0;
        let chromeOpacity = 0;

        if (t < SITE_BEAT_END) {
          const p = easeInOutCubic((t - ACT2_START) / (SITE_BEAT_END - ACT2_START));
          // Log interpolation between 1.0 and 0.7222
          scale = Math.exp(lerp(Math.log(1.0), Math.log(780 / 1080), p));
          // Shift gently to match updated site's exact vertical poise (-35px above center for bottom scroll cue)
          offsetY = lerp(0, -35, p);
          chromeOpacity = easeOutCubic(clamp01((p - 0.35) / 0.50));
        } else if (t < ZOOM_END) {
          const p = easeInOutCubic((t - SITE_BEAT_END) / (ZOOM_END - SITE_BEAT_END));
          // Brief dwell feel built into the start of easeInOutCubic!
          scale = Math.exp(lerp(Math.log(780 / 1080), Math.log(0.198), p));
          offsetY = lerp(-35, 0, clamp01(p / 0.42));
          chromeOpacity = 1 - easeOutCubic(clamp01(p / 0.24));
        } else {
          const drift = clamp01((t - ZOOM_END) / 1.4);
          scale = lerp(0.198, 0.184, drift);
          offsetY = 0;
          chromeOpacity = 0;
        }

        // Hero poster corner radius transitions smoothly from 0px (full bleed) -> 30px (22px at 0.7222 scale!)
        const radiusP = clamp01((t - ACT2_START) / 0.55);
        heroTile.tileEl.style.borderRadius = (30 * easeOutCubic(radiusP)).toFixed(2) + 'px';
        heroTile.tileEl.style.borderColor = \`rgba(21, 21, 20, \${(0.11 * easeOutCubic(radiusP)).toFixed(3)})\`;

        // Keep surrounding mosaic tiles invisible during the exact site beat so zero edges peek at the bottom!
        const neighborOpacity = easeOutCubic(clamp01((t - (SITE_BEAT_END + 0.08)) / 0.36));

        mosaicWorld.style.transform = \`translate(0px, \${offsetY.toFixed(2)}px) scale(\${scale.toFixed(5)})\`;

        // Update site chrome (MCP mark + 12-tick rail + rising scroll arrow)
        siteChrome.style.opacity = chromeOpacity.toFixed(4);
        if (chromeOpacity > 0.01) {
          const arrowCycle = ((t - ACT2_START) * 0.75) % 1;
          const ay = lerp(10, -5, easeOutCubic(arrowCycle));
          chromeArrow.style.transform = \`translateY(\${ay.toFixed(2)}px)\`;
        }

        // Step ALL 25 tiles in the living mosaic wall!
        for (const tile of mosaicTiles) {
          if (!tile.isHero) {
            tile.tileEl.style.opacity = neighborOpacity.toFixed(4);
            if (!tile.triggered && t >= tile.triggerTime) {
              tile.triggered = true;
              tile.api.triggerPrimary({ replay: false });
            } else if (!tile.secondTriggered && t >= tile.secondTriggerTime) {
              tile.secondTriggered = true;
              tile.api.triggerPrimary({ replay: false });
            }
          }
          if (tile.api.isMoving?.() || frameIndex === Math.round(ACT2_START * fps)) {
            tile.api.render(dt);
          }
        }

        // ── ACT 3: "Happy Birthday, MCP" Gallery Finale ──
        if (t >= ACT3_START) {
          const bt = t - ACT3_START;
          const bgAlpha = easeInOutCubic(clamp01(bt / 0.62));
          act3El.style.opacity = bgAlpha.toFixed(4);

          // MCP mark rises cleanly
          const mP = easeOutExpo(clamp01((bt - 0.28) / 0.65));
          bdayMark.style.opacity = clamp01((bt - 0.28) / 0.42).toFixed(4);
          bdayMark.style.transform = \`translateY(\${lerp(18, 0, mP).toFixed(2)}px) scale(\${lerp(0.90, 1, mP).toFixed(4)})\`;

          // Staggered word reveal: "Happy" · "Birthday," · "MCP"
          bdayWords.forEach((el, idx) => {
            const startDelay = 0.50 + idx * 0.16;
            const wP = easeOutExpo(clamp01((bt - startDelay) / 0.62));
            el.style.opacity = clamp01((bt - startDelay) / 0.36).toFixed(4);
            el.style.transform = \`translateY(\${lerp(22, 0, wP).toFixed(2)}px)\`;
          });

          // Hairline rule draws outward
          const rP = easeOutExpo(clamp01((bt - 0.96) / 0.55));
          bdayRule.style.opacity = clamp01((bt - 0.96) / 0.35).toFixed(4);
          bdayRule.style.transform = \`scaleX(\${rP.toFixed(4)})\`;

          // Date mono subtitle rises gently
          const sP = easeOutExpo(clamp01((bt - 1.12) / 0.58));
          bdaySub.style.opacity = clamp01((bt - 1.12) / 0.38).toFixed(4);
          bdaySub.style.transform = \`translateY(\${lerp(12, 0, sP).toFixed(2)}px)\`;
        } else {
          act3El.style.opacity = '0';
        }
      }
    };

    window.__STAGE_READY__ = true;
  </script>
</body>
</html>`;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      if (cleanUrl === '/__birthday_stage__.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(STAGE_HTML);
        return;
      }
      if (cleanUrl === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
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
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function main() {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--disable-gpu-vsync'],
  });

  const errors = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = `console.error: ${msg.text()}`;
        errors.push(text);
        console.error(text);
      }
    });
    page.on('pageerror', (err) => {
      const text = `pageerror: ${err.message}`;
      errors.push(text);
      console.error(text);
    });

    await page.goto(`${baseUrl}/__birthday_stage__.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__STAGE_READY__ === true, { timeout: 30000 });

    // Spawn ffmpeg receiving crisp 60fps JPEG frames over stdin pipe
    const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-framerate', String(FPS),
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-level:v', '4.2',
      '-pix_fmt', 'yuv420p',
      '-crf', '16',
      '-preset', 'medium',
      '-movflags', '+faststart',
      OUT_MP4,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    let ffmpegStderr = '';
    ffmpeg.stderr.on('data', (chunk) => { ffmpegStderr += chunk.toString(); });

    const cdp = await context.newCDPSession(page);
    const t0 = performance.now();

    for (let f = 0; f < TOTAL_FRAMES; f++) {
      await page.evaluate(([idx, fps]) => window.__RENDER_FRAME__(idx, fps), [f, FPS]);
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 96,
      });
      const buf = Buffer.from(data, 'base64');
      if (!ffmpeg.stdin.write(buf)) {
        await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
      }
      if (f % 120 === 0 || f === TOTAL_FRAMES - 1) {
        const pct = ((f + 1) / TOTAL_FRAMES * 100).toFixed(0);
        const sec = ((performance.now() - t0) / 1000).toFixed(1);
        console.log(`Rendered frame ${f + 1}/${TOTAL_FRAMES} (${pct}%) in ${sec}s`);
      }
    }

    ffmpeg.stdin.end();
    const exitCode = await new Promise((resolve) => ffmpeg.on('close', resolve));
    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}:\n${ffmpegStderr}`);
    }

    const durOut = execFileSync('/opt/homebrew/bin/ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      OUT_MP4,
    ]).toString().trim();
    const sizeMB = (fs.statSync(OUT_MP4).size / (1024 * 1024)).toFixed(2);
    console.log(`Saved ${OUT_MP4} (${durOut}s @ ${FPS}fps, ${sizeMB} MB)`);

    if (errors.length) {
      console.error('Page errors:', errors);
      process.exitCode = 1;
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
