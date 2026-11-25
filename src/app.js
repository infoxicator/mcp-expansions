import { INSTRUMENTS, findInstrumentIndex } from 'mcp-registry';
import { PhraseStore, buildPermalink, syncUrl } from './core/phrases.js';
import { bindInstrumentRail } from './core/instrument-rail.js';
import { bindFeedScroll } from 'mcp-feed-scroll';
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
const appModuleUrl = new URL(import.meta.url);

function pad3(n) {
  return String(n).padStart(3, '0');
}

function getFallbackReason() {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('fallback');
  if (forced === 'no-webgl') return 'no-webgl';
  if (forced === 'reduced-motion') return 'reduced-motion';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'reduced-motion';
  }
  return supportsWebGL() ? null : 'no-webgl';
}

class FeedApp {
  constructor() {
    this.phraseStore = new PhraseStore();
    this.slides = [];
    this.instances = new Map(); // index -> { state: 'loading'|'ready', api, canvas, frame }
    this.activeIndex = 0;
    this.initialInstrumentId = null;
    this.theme = 'light';
    this.fallbackReason = null;
    this.isDrawerOpen = false;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.lastFrameTs = null;
    this.lastPlayedSlide = null;
    this.arrivalStarted = null;

    this.feedEl = $('feed');
    this.instrumentRail = $('instrumentRail');
    this.scrollCueMark = $('scrollCueMark');
    this.actionStatus = $('actionStatus');
    this.indexDrawer = $('indexDrawer');
    this.drawerBackdrop = $('drawerBackdrop');
    this.drawerClose = $('drawerClose');
    this.drawerList = $('drawerList');
    this.drawerShowing = $('drawerShowing');
    this.searchInput = $('searchInput');
    this.filterPills = Array.from(document.querySelectorAll('.filter-pill'));
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

    this.autoplay = params.get('poster') !== '1' &&
      params.get('settled') !== '1' && params.get('intro') !== '0';
    this.buildSlides();
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
      if (meta.source === INSTRUMENTS[this.activeIndex].id) this.lastPlayedSlide = this.activeIndex;
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

  buildSlides() {
    const slideFrag = document.createDocumentFragment();

    INSTRUMENTS.forEach((entry, idx) => {
      const slide = document.createElement('section');
      slide.className = 'slide';
      slide.dataset.index = String(idx);
      slide.dataset.id = entry.id;
      slide.setAttribute('aria-label', entry.title);
      slide.setAttribute('aria-description', entry.cue);

      slide.innerHTML = `
        <div class="poster-column">
          <div class="poster-frame" data-poster-index="${idx}"></div>
          <span class="small-print-transcript visually-hidden"></span>
        </div>
      `;

      const frame = slide.querySelector('.poster-frame');
      this.slides.push({ el: slide, frame, entry });
      slideFrag.appendChild(slide);
    });
    this.feedEl.appendChild(slideFrag);
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
    const canOperate = () => idx === this.activeIndex && !this.navigation.isMoving();
    const slot = { state: 'loading', api: null, host, canOperate, slideObj: { ...slideObj, canvas } };
    this.instances.set(idx, slot);

    if (this.fallbackReason) {
      this.mountStill(slot, this.fallbackReason);
      return;
    }

    try {
      this.sizeCanvasForSlide(slot.slideObj);
      const moduleUrl = new URL(entry.modulePath, appModuleUrl);
      moduleUrl.search = appModuleUrl.search;
      const mod = await import(moduleUrl.href);
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
        canOperate,
      });

      if (this.instances.get(idx) !== slot) {
        api.dispose?.();
        return;
      }

      slot.api = api;
      if (this.theme !== mountTheme) api.setTheme(this.theme);
      if (this.phraseStore.getState().text !== mountPhrase) api.setPhrase(this.phraseStore.getState());
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
      this.mountStill(slot, 'load-error', err);
    }
  }

  mountStill(slot, reason, error) {
    const { entry, frame } = slot.slideObj;
    if (error) console.error('Instrument ' + entry.id + ' failed:', error);
    slot.api?.dispose?.();
    if (slot.legend) slot.legend.textContent = '';
    slot.api = mountFallbackInstrument(slot.host, entry, this.phraseStore, reason, slot.canOperate);
    slot.isFallback = true;
    slot.state = 'ready';
    frame.classList.add('is-ready');
  }

  updateActiveWindow() {
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

    this.navigation.goTo(clamped, instant || Math.abs(clamped - this.activeIndex) > 1);
  }

  setActiveIndex(nextIdx) {
    if (nextIdx === this.activeIndex) return;
    if (nextIdx > this.activeIndex) this.scrollCueMark.hidden = true;
    this.activeIndex = nextIdx;
    this.setRailActive(nextIdx);
    this.arrivalStarted = null;
    if (this.autoplay) this.phraseStore.nextRandom({source: 'navigation'});
    else this.syncActiveUrl();
    this.updateActiveWindow();
  }

  triggerActiveInstrument(opts = {}) {
    if (this.navigation.isMoving()) return;
    const slot = this.instances.get(this.activeIndex);
    if (slot && slot.api && typeof slot.api.triggerPrimary === 'function') {
      this.lastPlayedSlide = this.activeIndex;
      slot.dirty = true;
      try {
        slot.api.triggerPrimary(opts);
      } catch (error) {
        this.mountStill(slot, 'load-error', error);
      }
    }
  }

  playSettledSlide(ts) {
    const idx = this.activeIndex;
    const slot = this.instances.get(idx);
    const settled = !this.navigation.isMoving();
    if (!settled || slot?.state !== 'ready' || slot.isFallback) {
      this.arrivalStarted = null;
      return;
    }
    if (this.lastPlayedSlide === idx) return;
    this.arrivalStarted ??= ts;
    if (ts - this.arrivalStarted < 160) return;

    this.lastPlayedSlide = idx;
    try {
      if (!slot.api.isMoving?.()) slot.api.playOnArrival?.();
    } catch (error) {
      this.mountStill(slot, 'load-error', error);
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
      if (this.autoplay) this.playSettledSlide(ts);

      for (const slot of this.instances.values()) {
        if (slot.state !== 'ready' || slot.isFallback) continue;
        const slideTop = slot.slideObj.el.offsetTop;
        const slideBottom = slideTop + this.feedEl.clientHeight;
        const visible = slideBottom > viewTop + 2 && slideTop < viewBottom - 2;
        if (!visible) continue;
        try {
          if (!slot.dirty && !slot.api.isMoving?.()) continue;
          slot.dirty = false;
          this.sizeCanvasForSlide(slot.slideObj);
          slot.api.render(dt);
          if (slot.legend) {
            const words = slot.api.readLegend();
            if (slot.legend.textContent !== words) slot.legend.textContent = words;
          }
        } catch (error) {
          this.mountStill(slot, 'load-error', error);
        }
      }
    }

    requestAnimationFrame((nextTs) => this.tick(nextTs));
  }

  async copyText(text, message) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        try {
          copied = document.execCommand('copy');
        } finally {
          field.remove();
        }
      }
    } catch (_) {}
    this.actionStatus.textContent = copied ? message : 'Could not copy';
    this.actionStatus.classList.add('is-visible');
    clearTimeout(this.actionStatusTimer);
    this.actionStatusTimer = setTimeout(() => this.actionStatus.classList.remove('is-visible'), 1400);
  }

  copyPhrase() {
    return this.copyText(this.phraseStore.getState().text, 'Phrase copied');
  }

  copyLink() {
    const entry = INSTRUMENTS[this.activeIndex];
    const url = buildPermalink(entry.id, this.phraseStore.getState()).toString();
    return this.copyText(url, 'Link copied');
  }

  // Index drawer
  openDrawer() {
    this.drawerTrigger = document.activeElement;
    this.indexDrawer.inert = false;
    this.feedEl.inert = true;
    this.instrumentRail.inert = true;
    this.isDrawerOpen = true;
    this.indexDrawer.classList.add('is-open');
    this.drawerBackdrop.classList.add('is-open');
    this.indexDrawer.setAttribute('aria-hidden', 'false');
    this.renderDrawerList();
    this.searchInput.focus();
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    this.feedEl.inert = false;
    this.instrumentRail.inert = false;
    this.indexDrawer.inert = true;
    const trigger = this.drawerTrigger === document.body ? this.feedEl : this.drawerTrigger;
    trigger?.focus({ preventScroll: true });
    this.indexDrawer.classList.remove('is-open');
    this.drawerBackdrop.classList.remove('is-open');
    this.indexDrawer.setAttribute('aria-hidden', 'true');
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
    this.navigation = bindFeedScroll(this.feedEl, {
      getIndex: () => this.activeIndex,
      getTop: idx => this.slides[idx].el.offsetTop,
      count: this.slides.length,
      wheelTarget: this.instrumentRail,
      onSettled: idx => this.setActiveIndex(idx),
      reducedMotion: () => this.fallbackReason === 'reduced-motion' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches,
    });

    this.setRailActive = bindInstrumentRail(this.instrumentRail, INSTRUMENTS,
      index => this.scrollToInstrument(index));
    this.setRailActive(this.activeIndex);

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
      this.navigation.realign();
      for (const slot of this.instances.values()) {
        if (slot.state === 'ready' && !slot.isFallback) {
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

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (!e.repeat) this.navigation.step(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (!e.repeat) this.navigation.step(-1);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        this.scrollToInstrument(e.key === 'Home' ? 0 : INSTRUMENTS.length - 1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.triggerActiveInstrument({ replay: e.shiftKey });
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!e.repeat) this.triggerActiveInstrument();
      } else if (e.key === '/') {
        e.preventDefault();
        this.openDrawer();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        sound.toggle();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.copyPhrase();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.copyLink();
      }
    });
  }
}

const app = new FeedApp();
app.boot();
