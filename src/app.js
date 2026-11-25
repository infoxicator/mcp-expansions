import { INSTRUMENTS, findInstrumentIndex } from './registry.js';
import { PhraseStore, buildPermalink, syncUrl } from './core/phrases.js';
import { sound } from './core/audio.js';
import { mountFallbackInstrument } from './core/fallback.js';

let webglAvailable;
function supportsWebGL() {
  if (webglAvailable === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      webglAvailable = Boolean(gl);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { webglAvailable = false; }
  }
  return webglAvailable;
}

const $ = (id) => document.getElementById(id);

function pad3(n) {
  return String(n).padStart(3, '0');
}

function getFallbackReason() {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('fallback');
  if (forced === 'no-webgl') return 'no-webgl';
  if (forced === 'reduced-motion') return 'reduced-motion';
  if (new URLSearchParams(location.search).get('fallback') === 'no-webgl' || !supportsWebGL()) return 'no-webgl';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'reduced-motion';
  }
  return null;
}

class FeedApp {
  constructor() {
    this.phraseStore = new PhraseStore();
    this.slides = [];
    this.railDots = [];
    this.instances = new Map(); // index -> { state: 'loading'|'ready', api, canvas, frame }
    this.activeIndex = 0;
    this.initialInstrumentId = null;
    this.theme = 'light';
    this.fallbackReason = null;
    this.isDrawerOpen = false;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.lastFrameTs = null;
    this.confirmTimers = {};

    this.feedEl = $('feed');
    this.railEl = $('feedRail');
    this.totalCountEl = $('totalCount');
    this.themeToggle = $('themeToggle');
    this.themeIcon = $('themeIcon');
    this.soundToggle = $('soundToggle');
    this.soundIcon = $('soundIcon');
    this.soundLabel = $('soundLabel');
    this.indexToggle = $('indexToggle');
    this.indexDrawer = $('indexDrawer');
    this.drawerBackdrop = $('drawerBackdrop');
    this.drawerClose = $('drawerClose');
    this.drawerList = $('drawerList');
    this.drawerShowing = $('drawerShowing');
    this.searchInput = $('searchInput');
    this.filterPills = Array.from(document.querySelectorAll('.filter-pill'));
    this.brandLink = $('brandLink');
  }

  async boot() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('poster') === '1') {
      document.body.classList.add('is-poster-only');
    }

    this.initTheme(params.get('theme'));
    this.fallbackReason = getFallbackReason();

    await Promise.all([
      this.phraseStore.load(),
      document.fonts.load('500 16px "JetBrains Mono"'),
      document.fonts.load('400 16px "Instrument Serif"'),
      document.fonts.load('500 16px Inter'),
    ]);
    this.phraseStore.initFromUrl();

    this.initialInstrumentId = params.get('i');
    this.activeIndex = findInstrumentIndex(this.initialInstrumentId);

    this.totalCountEl.textContent = String(this.phraseStore.phrases.length);
    this.buildSlidesAndRail();
    this.bindEvents();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      const reason = getFallbackReason();
      if (reason === this.fallbackReason) return;
      this.fallbackReason = reason;
      for (const slot of this.instances.values()) {
        slot.api?.dispose?.();
        if (slot.legend) slot.legend.textContent = '';
        slot.host.remove();
        slot.slideObj.frame.classList.remove('is-ready');
      }
      this.instances.clear();
      this.updateActiveWindow();
    });

    // Jump immediately to initial instrument without scroll animation
    this.scrollToInstrument(this.activeIndex, { instant: true });
    this.syncActiveUrl();
    this.updateActiveWindow();

    // Subscribe to phrase changes
    this.phraseStore.subscribe((state, meta) => {
      for (const slot of this.instances.values()) {
        slot.dirty = true;
        if (slot.api) slot.api.setPhrase(state, meta);
      }
      if (!meta.silentUrl) {
        this.syncActiveUrl();
      }
      if (this.isDrawerOpen) this.syncDrawerHighlight();
    });

    // Expose tiny test/proof helper on window for deterministic inspection
    window.__MCP_FEED__ = {
      instruments: INSTRUMENTS,
      getActiveIndex: () => this.activeIndex,
      getActiveId: () => INSTRUMENTS[this.activeIndex].id,
      getPhrase: () => this.phraseStore.getState(),
      scrollToIndex: (i, instant = false) => this.scrollToInstrument(i, { instant }),
      triggerCurrent: (opts) => this.triggerActiveInstrument(opts),
      setTheme: (t) => this.applyTheme(t),
      getInstance: (idx) => this.instances.get(idx)?.api || null,
      isReady: (idx = this.activeIndex) => this.instances.get(idx)?.state === 'ready',
    };

    requestAnimationFrame((ts) => this.tick(ts));
  }

  initTheme(queryTheme) {
    let saved = null;
    try {
      saved = localStorage.getItem('mcp-expansions-theme');
    } catch (_) {}
    const initial =
      queryTheme === 'dark' || queryTheme === 'light'
        ? queryTheme
        : saved === 'dark' || saved === 'light'
          ? saved
          : 'light';
    this.applyTheme(initial, { persist: !queryTheme });
  }

  applyTheme(nextTheme, { persist = true } = {}) {
    this.theme = nextTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    if (this.theme === 'dark') {
      this.themeIcon.innerHTML =
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else {
      this.themeIcon.innerHTML =
        '<circle cx="12" cy="12" r="4"></circle>' +
        '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>';
    }
    if (persist) {
      try {
        localStorage.setItem('mcp-expansions-theme', this.theme);
      } catch (_) {}
    }
    for (const slot of this.instances.values()) {
      slot.dirty = true;
      if (slot.api) slot.api.setTheme(this.theme);
    }
  }

  updateSoundUi() {
    const muted = sound.isMuted();
    this.soundToggle.setAttribute('aria-pressed', String(!muted));
    this.soundLabel.textContent = muted ? 'Muted' : 'Sound';
    if (muted) {
      this.soundIcon.innerHTML =
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
        '<line x1="23" y1="9" x2="17" y2="15"></line>' +
        '<line x1="17" y1="9" x2="23" y2="15"></line>';
    } else {
      this.soundIcon.innerHTML =
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
        '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
        '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>';
    }
  }

  buildSlidesAndRail() {
    const slideFrag = document.createDocumentFragment();
    const railFrag = document.createDocumentFragment();

    INSTRUMENTS.forEach((entry, idx) => {
      const slide = document.createElement('section');
      slide.className = 'slide';
      slide.dataset.index = String(idx);
      slide.dataset.id = entry.id;
      slide.setAttribute('aria-label', `${entry.number} ${entry.title}`);

      slide.innerHTML = `
        <div class="poster-column">
          <div class="poster-frame" data-poster-index="${idx}">
            <div class="poster-loading">Loading</div>
          </div>
          <div class="poster-caption">
            <span class="small-print-transcript"></span>
            <div class="caption-left">
              <span class="caption-num">${entry.number}</span>
              <span class="caption-title">${entry.title}</span>
              <span class="caption-cue">${entry.cue}</span>
            </div>
            <div class="caption-actions">
              <button type="button" class="caption-btn" data-action="copy" data-idx="${idx}">Copy</button>
              <button type="button" class="caption-btn" data-action="link" data-idx="${idx}">Link</button>
            </div>
          </div>
        </div>
      `;

      const frame = slide.querySelector('.poster-frame');
      this.slides.push({ el: slide, frame, entry });
      slideFrag.appendChild(slide);

      // Right vertical navigation rail pip
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'rail-dot';
      dot.title = `${entry.number} · ${entry.title}`;
      dot.setAttribute('aria-label', `Jump to ${entry.number} ${entry.title}`);
      dot.setAttribute('aria-current', idx === this.activeIndex ? 'true' : 'false');
      dot.innerHTML = '<span class="rail-pip"></span>';
      dot.addEventListener('click', () => this.scrollToInstrument(idx));
      this.railDots.push(dot);
      railFrag.appendChild(dot);
    });

    this.feedEl.appendChild(slideFrag);
    this.railEl.appendChild(railFrag);
  }

  sizeCanvasForSlide(slideObj) {
    const rect = slideObj.frame.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const target = Math.max(512, Math.min(1080, Math.round(rect.width * dpr)));
    if (slideObj.canvas.width !== target || slideObj.canvas.height !== target) {
      slideObj.canvas.width = target;
      slideObj.canvas.height = target;
    }
  }

  async ensureMounted(idx) {
    if (idx < 0 || idx >= INSTRUMENTS.length) return;
    if (this.instances.has(idx)) return;

    const slideObj = this.slides[idx];
    const entry = slideObj.entry;
    const host = document.createElement('div');
    host.className = 'instrument-surface';
    slideObj.frame.appendChild(host);
    const canvas = document.createElement('canvas');
    canvas.className = 'poster-canvas';
    canvas.setAttribute('aria-label', entry.title);
    host.appendChild(canvas);
    const slot = { state: 'loading', api: null, host, slideObj: { ...slideObj, canvas } };
    this.instances.set(idx, slot);

    if (this.fallbackReason) {
      slot.api = mountFallbackInstrument(host, entry, this.phraseStore, this.fallbackReason);
      slot.state = 'ready';
      slideObj.frame.classList.add('is-ready');
      return;
    }

    try {
      this.sizeCanvasForSlide(slot.slideObj);
      const mod = await import(entry.modulePath);
      // If unloaded while importing, abort cleanly
      if (this.instances.get(idx) !== slot) return;

      const startSettled = Boolean(
        this.initialInstrumentId === entry.id ||
        new URLSearchParams(window.location.search).get('settled') === '1'
      );

      const mountTheme = this.theme;
      const mountPhrase = this.phraseStore.getState().text;
      const api = await mod.createInstrument({
        container: host,
        canvas,
        phraseStore: this.phraseStore,
        theme: this.theme,
        startSettled,
      });

      if (this.instances.get(idx) !== slot) {
        api.dispose?.();
        return;
      }

      if (this.theme !== mountTheme) api.setTheme(this.theme);
      if (this.phraseStore.getState().text !== mountPhrase) api.setPhrase(this.phraseStore.getState());
      slot.api = api;
      if (api.readLegend) {
        slot.legend = slideObj.el.querySelector('.small-print-transcript');
      }
      slot.state = 'ready';
      slideObj.frame.classList.add('is-ready');
      // Render initial frame immediately so neighbor slides look sharp before scrolling into view
      api.render(0);
      if (slot.legend) slot.legend.textContent = api.readLegend();
    } catch (err) {
      if (this.instances.get(idx) !== slot) return;
      console.error(`Instrument ${entry.id} failed to load:`, err);
      slot.api = mountFallbackInstrument(host, entry, this.phraseStore, 'no-webgl');
      slot.state = 'ready';
      slideObj.frame.classList.add('is-ready');
    }
  }

  updateActiveWindow() {
    // Update rail highlights
    this.railDots.forEach((dot, i) => {
      dot.setAttribute('aria-current', i === this.activeIndex ? 'true' : 'false');
    });

    // Lazy-load current instrument + immediate neighbours (activeIndex - 1 .. activeIndex + 1)
    for (let d = 0; d <= 1; d++) {
      if (d === 0) {
        this.ensureMounted(this.activeIndex);
      } else {
        if (this.activeIndex + d < INSTRUMENTS.length) this.ensureMounted(this.activeIndex + d);
        if (this.activeIndex - d >= 0) this.ensureMounted(this.activeIndex - d);
      }
    }

    // Keep only the active spread alive, including in-flight loads.
    for (const [idx, slot] of this.instances.entries()) {
      if (Math.abs(idx - this.activeIndex) > 1) {
        slot.api?.dispose?.();
        if (slot.legend) slot.legend.textContent = '';
        slot.host.remove();
        this.instances.delete(idx);
        slot.slideObj.frame.classList.remove('is-ready');
      }
    }
  }

  syncActiveUrl() {
    const entry = INSTRUMENTS[this.activeIndex];
    if (!entry) return;
    syncUrl(entry.id, this.phraseStore.getState());
  }

  scrollToInstrument(idx, { instant = false } = {}) {
    const clamped = Math.max(0, Math.min(INSTRUMENTS.length - 1, idx));
    const slide = this.slides[clamped]?.el;
    if (!slide) return;

    if (instant) {
      const prevBehavior = this.feedEl.style.scrollBehavior;
      this.feedEl.style.scrollBehavior = 'auto';
      this.feedEl.scrollTop = clamped * this.feedEl.clientHeight;
      this.feedEl.style.scrollBehavior = prevBehavior;
      this.setActiveIndex(clamped);
    } else {
      slide.scrollIntoView({ behavior: this.fallbackReason === 'reduced-motion' ? 'auto' : 'smooth', block: 'start' });
    }
  }

  setActiveIndex(nextIdx) {
    if (nextIdx === this.activeIndex) return;
    this.activeIndex = nextIdx;
    this.syncActiveUrl();
    this.updateActiveWindow();
  }

  triggerActiveInstrument(opts = {}) {
    const slot = this.instances.get(this.activeIndex);
    if (slot && slot.api && typeof slot.api.triggerPrimary === 'function') {
      slot.dirty = true;
      slot.api.triggerPrimary(opts);
    }
  }

  tick(ts) {
    if (this.lastFrameTs === null) this.lastFrameTs = ts;
    const dt = Math.min((ts - this.lastFrameTs) / 1000, 0.05);
    this.lastFrameTs = ts;

    if (!document.hidden && !this.isDrawerOpen && !this.fallbackReason) {
      // Determine which mounted slides are actually visible in viewport right now
      const viewTop = this.feedEl.scrollTop;
      const viewBottom = viewTop + this.feedEl.clientHeight;

      for (const [idx, slot] of this.instances.entries()) {
        if (slot.state !== 'ready' || !slot.api) continue;
        const slideTop = idx * this.feedEl.clientHeight;
        const slideBottom = slideTop + this.feedEl.clientHeight;
        const visible = slideBottom > viewTop + 2 && slideTop < viewBottom - 2;
        if (visible && (slot.dirty || slot.api.isMoving?.())) {
          slot.dirty = false;
          this.sizeCanvasForSlide(slot.slideObj);
          slot.api.render(dt);
          if (slot.legend) {
            const words = slot.api.readLegend();
            if (slot.legend.textContent !== words) slot.legend.textContent = words;
          }
        }
      }
    }

    requestAnimationFrame((nextTs) => this.tick(nextTs));
  }

  // Clipboard helper
  async copyText(text, btn, idleLabel, doneLabel) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    } catch (_) {}

    if (btn) {
      const key = btn.dataset.action + '-' + btn.dataset.idx;
      clearTimeout(this.confirmTimers[key]);
      btn.textContent = doneLabel;
      btn.classList.add('is-confirmed');
      this.confirmTimers[key] = setTimeout(() => {
        btn.textContent = idleLabel;
        btn.classList.remove('is-confirmed');
      }, 1400);
    }
  }

  // Index drawer
  openDrawer() {
    this.drawerTrigger = document.activeElement;
    this.indexDrawer.inert = false;
    for (const region of [this.feedEl, this.railEl, this.indexToggle.closest('header')]) region.inert = true;
    this.isDrawerOpen = true;
    this.indexDrawer.classList.add('is-open');
    this.drawerBackdrop.classList.add('is-open');
    this.indexDrawer.setAttribute('aria-hidden', 'false');
    this.indexToggle.setAttribute('aria-expanded', 'true');
    this.renderDrawerList();
    this.searchInput.focus();
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    for (const region of [this.feedEl, this.railEl, this.indexToggle.closest('header')]) region.inert = false;
    this.indexDrawer.inert = true;
    const trigger = this.drawerTrigger === document.body ? this.feedEl : this.drawerTrigger;
    trigger?.focus({ preventScroll: true });
    this.indexDrawer.classList.remove('is-open');
    this.drawerBackdrop.classList.remove('is-open');
    this.indexDrawer.setAttribute('aria-hidden', 'true');
    this.indexToggle.setAttribute('aria-expanded', 'false');
  }

  renderDrawerList() {
    const q = this.searchQuery.trim().toLowerCase();
    const currentIdx = this.phraseStore.currentIndex;
    const filtered = this.phraseStore.phrases
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        if (this.activeCategory !== 'all' && item.category !== this.activeCategory) return false;
        if (!q) return true;
        return (
          item.words.join(' ').toLowerCase().includes(q) ||
          (item.note || '').toLowerCase().includes(q)
        );
      });

    this.drawerShowing.textContent = `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`;

    if (!filtered.length) {
      this.drawerList.innerHTML = '<div style="padding:36px 20px;text-align:center;font-family:var(--mono);font-size:12px;color:var(--ink-muted)">No matching M·C·P phrases found.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(({ item, idx }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'index-item' + (idx === currentIdx ? ' is-current' : '');
      btn.dataset.index = String(idx);

      const num = document.createElement('span');
      num.className = 'index-num';
      num.textContent = pad3(idx + 1);

      const phrase = document.createElement('span');
      phrase.className = 'index-phrase';
      phrase.textContent = item.words.join(' ');

      const note = document.createElement('span');
      note.className = 'index-note';
      note.textContent = item.note || '';

      btn.append(num, phrase, note);
      btn.addEventListener('click', () => {
        this.phraseStore.setByIndex(idx, { source: 'drawer' });
        this.closeDrawer();
      });
      frag.appendChild(btn);
    });

    this.drawerList.innerHTML = '';
    this.drawerList.appendChild(frag);
  }

  syncDrawerHighlight() {
    const currentIdx = this.phraseStore.currentIndex;
    this.drawerList.querySelectorAll('.index-item').forEach((el) => {
      el.classList.toggle('is-current', Number(el.dataset.index) === currentIdx);
    });
  }

  bindEvents() {
    // Track scroll snap position cleanly without reloading
    let scrollRaf = null;
    this.feedEl.addEventListener('scroll', () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        const h = this.feedEl.clientHeight || 1;
        const idx = Math.max(0, Math.min(INSTRUMENTS.length - 1, Math.round(this.feedEl.scrollTop / h)));
        this.setActiveIndex(idx);
      });
    }, { passive: true });

    // Delegate Copy / Link buttons in slide captions
    this.feedEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.caption-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = Number(btn.dataset.idx);
      const entry = INSTRUMENTS[idx] || INSTRUMENTS[this.activeIndex];
      const st = this.phraseStore.getState();

      if (action === 'copy') {
        this.copyText(st.text, btn, 'Copy', 'Copied');
      } else if (action === 'link') {
        const url = buildPermalink(entry.id, st).toString();
        this.copyText(url, btn, 'Link', 'Copied');
      }
    });

    this.brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.scrollToInstrument(0);
    });

    this.themeToggle.addEventListener('click', () => {
      this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    });

    this.soundToggle.addEventListener('click', () => {
      sound.toggle();
      this.updateSoundUi();
    });
    this.updateSoundUi();

    this.indexToggle.addEventListener('click', () => {
      if (this.isDrawerOpen) this.closeDrawer();
      else this.openDrawer();
    });
    this.drawerClose.addEventListener('click', () => this.closeDrawer());
    this.drawerBackdrop.addEventListener('click', () => this.closeDrawer());

    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderDrawerList();
    });

    this.filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        this.activeCategory = pill.dataset.cat;
        this.filterPills.forEach((p) => p.setAttribute('aria-pressed', String(p === pill)));
        this.renderDrawerList();
      });
    });

    window.addEventListener('resize', () => {
      for (const slot of this.instances.values()) {
        if (slot.state === 'ready') {
          slot.dirty = true;
          this.sizeCanvasForSlide(slot.slideObj);
          slot.api?.resize?.();
        }
      }
    });

    // Keyboard-first navigation & instrument operation
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement ? document.activeElement.tagName : '';

      if (e.key === 'Escape' && this.isDrawerOpen) {
        e.preventDefault();
        this.closeDrawer();
        return;
      }
      if (this.isDrawerOpen || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (tag === 'BUTTON' && e.code === 'Space') return;

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        this.scrollToInstrument(this.activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        this.scrollToInstrument(this.activeIndex - 1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.triggerActiveInstrument({ replay: e.shiftKey });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.phraseStore.step(1, { source: 'keyboard' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.phraseStore.step(-1, { source: 'keyboard' });
      } else if (e.key === '/') {
        e.preventDefault();
        this.openDrawer();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        sound.toggle();
        this.updateSoundUi();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const btn = this.slides[this.activeIndex]?.el.querySelector('[data-action="copy"]');
        this.copyText(this.phraseStore.getState().text, btn, 'Copy', 'Copied');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const btn = this.slides[this.activeIndex]?.el.querySelector('[data-action="link"]');
        const url = buildPermalink(INSTRUMENTS[this.activeIndex].id, this.phraseStore.getState()).toString();
        this.copyText(url, btn, 'Link', 'Copied');
      }
    });
  }
}

const app = new FeedApp();
app.boot();
