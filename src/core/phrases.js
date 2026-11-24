// Phrase store, non-repeating shuffle deck, and URL permalink sync (?i=, ?p=, ?w=)

export class PhraseStore {
  constructor() {
    this.phrases = [];
    this.deck = [];
    this.deckCursor = -1;
    this.currentIndex = 0; // -1 when custom ?w=M,C,P remix
    this.currentWords = ['More', 'Cake,', 'Please'];
    this.currentNote = 'Official birthday transport specification for November 25.';
    this.currentCategory = 'birthday';
    this.currentId = 'more-cake-please';
    this.isRemix = false;
    this.listeners = new Set();
  }

  async load() {
    const res = await fetch('./phrases.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load phrases.json (${res.status})`);
    const data = await res.json();
    this.phrases = data.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        Array.isArray(item.words) &&
        item.words.length === 3
    );
    this._rebuildDeck(0);
    return this.phrases;
  }

  _rebuildDeck(excludeIndex = -1) {
    const arr = Array.from({ length: this.phrases.length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (excludeIndex >= 0 && arr[0] === excludeIndex && arr.length > 1) {
      const swap = 1 + Math.floor(Math.random() * (arr.length - 1));
      [arr[0], arr[swap]] = [arr[swap], arr[0]];
    }
    this.deck = arr;
    this.deckCursor = -1;
  }

  initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const wParam = params.get('w');
    if (wParam) {
      const parts = wParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 3) {
        this.setRemix(parts, { silentUrl: true });
        return { explicitPhrase: true };
      }
    }

    const pParam = params.get('p');
    if (pParam) {
      const idx = this.phrases.findIndex((p) => p.id === pParam);
      if (idx >= 0) {
        this.setByIndex(idx, { silentUrl: true });
        return { explicitPhrase: true };
      }
    }

    // Default to "More Cake, Please"
    const defaultIdx = Math.max(0, this.phrases.findIndex((p) => p.id === 'more-cake-please'));
    this.setByIndex(defaultIdx, { silentUrl: true });
    return { explicitPhrase: false };
  }

  getState() {
    return {
      index: this.currentIndex,
      total: this.phrases.length,
      id: this.currentId,
      words: [...this.currentWords],
      cleanWords: this.currentWords.map((w) => w.replace(/,$/, '')),
      text: this.currentWords.join(' '),
      note: this.currentNote,
      category: this.currentCategory,
      isRemix: this.isRemix,
    };
  }

  setByIndex(index, { silentUrl = false, source = 'store' } = {}) {
    if (!this.phrases.length) return this.getState();
    const safeIdx = ((index % this.phrases.length) + this.phrases.length) % this.phrases.length;
    const entry = this.phrases[safeIdx];
    this.currentIndex = safeIdx;
    this.currentId = entry.id;
    this.currentWords = [...entry.words];
    this.currentNote = entry.note || '';
    this.currentCategory = entry.category || 'protocol';
    this.isRemix = false;
    this._emit({ source, silentUrl });
    return this.getState();
  }

  setById(id, opts = {}) {
    const idx = this.phrases.findIndex((p) => p.id === id);
    if (idx >= 0) return this.setByIndex(idx, opts);
    return this.getState();
  }

  setRemix(words, { silentUrl = false, source = 'store' } = {}) {
    this.currentIndex = -1;
    this.currentId = null;
    this.currentWords = words.slice(0, 3);
    this.currentNote = 'Custom M·C·P combination.';
    this.currentCategory = 'remix';
    this.isRemix = true;
    this._emit({ source, silentUrl });
    return this.getState();
  }

  nextRandom(opts = {}) {
    if (!this.phrases.length) return this.getState();
    this.deckCursor += 1;
    if (this.deckCursor >= this.deck.length) {
      this._rebuildDeck(this.currentIndex);
      this.deckCursor = 0;
    }
    const nextIdx = this.deck[this.deckCursor];
    if (nextIdx === this.currentIndex && this.phrases.length > 1) {
      return this.nextRandom(opts);
    }
    return this.setByIndex(nextIdx, opts);
  }

  step(delta, opts = {}) {
    if (!this.phrases.length) return this.getState();
    const base = this.currentIndex >= 0 ? this.currentIndex : 0;
    return this.setByIndex(base + delta, opts);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(meta) {
    const state = this.getState();
    for (const fn of this.listeners) {
      fn(state, meta);
    }
  }
}

export function buildPermalink(instrumentId, phraseState) {
  const url = new URL(window.location.href);
  url.searchParams.set('i', instrumentId);
  if (phraseState.isRemix) {
    url.searchParams.delete('p');
    url.searchParams.set('w', phraseState.words.join(','));
  } else if (phraseState.id) {
    url.searchParams.delete('w');
    url.searchParams.set('p', phraseState.id);
  }
  return url;
}

export function syncUrl(instrumentId, phraseState) {
  try {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    const url = buildPermalink(instrumentId, phraseState);
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch (_) {
    // No-op in restricted contexts
  }
}
