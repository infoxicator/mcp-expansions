// Quiet typographic still fallback for prefers-reduced-motion or no-WebGL environments

function svgDiagramFor(instrumentId) {
  switch (instrumentId) {
    case 'newton-protocol':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 150" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M46 130 V24 Q46 16 54 16 H266 Q274 16 274 24 V130" stroke-width="2" opacity="0.5"/>
          <line x1="28" y1="132" x2="292" y2="132" stroke-width="3" opacity="0.7"/>
          <line x1="112" y1="16" x2="112" y2="78" stroke-width="1" opacity="0.45"/>
          <line x1="160" y1="16" x2="160" y2="78" stroke-width="1" opacity="0.45"/>
          <line x1="208" y1="16" x2="208" y2="78" stroke-width="1" opacity="0.45"/>
          <circle cx="112" cy="96" r="21" stroke-width="1.5"/>
          <circle cx="160" cy="96" r="21" stroke-width="1.5"/>
          <circle cx="208" cy="96" r="21" stroke-width="1.5"/>
          <text x="112" y="100" text-anchor="middle" font-size="13" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M</text>
          <text x="160" y="100" text-anchor="middle" font-size="13" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">C</text>
          <text x="208" y="100" text-anchor="middle" font-size="13" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">P</text>
        </svg>`;
    case 'the-contract':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 120" fill="none" stroke="currentColor" aria-hidden="true">
          <line x1="10" y1="60" x2="72" y2="60" stroke-width="3" opacity="0.45"/>
          <rect x="72" y="48" width="26" height="24" rx="5" stroke-width="1.4" opacity="0.6"/>
          <rect x="98" y="24" width="124" height="72" rx="10" stroke-width="1.6"/>
          <rect x="112" y="36" width="96" height="48" rx="4" stroke-width="1" opacity="0.5"/>
          <text x="160" y="55" text-anchor="middle" font-size="9.5" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace" opacity="0.7">20.0V · PD OK</text>
          <text x="160" y="71" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M · C · P</text>
          <rect x="222" y="48" width="26" height="24" rx="5" stroke-width="1.4" opacity="0.6"/>
          <line x1="248" y1="60" x2="310" y2="60" stroke-width="3" opacity="0.45"/>
        </svg>`;
    default:
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 100" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="44" y="22" width="68" height="56" rx="6" stroke-width="1.2" opacity="0.55"/>
          <rect x="126" y="22" width="68" height="56" rx="6" stroke-width="1.2" opacity="0.55"/>
          <rect x="208" y="22" width="68" height="56" rx="6" stroke-width="1.2" opacity="0.55"/>
          <text x="78" y="55" text-anchor="middle" font-size="15" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M</text>
          <text x="160" y="55" text-anchor="middle" font-size="15" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">C</text>
          <text x="242" y="55" text-anchor="middle" font-size="15" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">P</text>
        </svg>`;
  }
}

export function mountFallbackInstrument(container, entry, phraseStore, modeReason = 'reduced-motion') {
  const plate = document.createElement('div');
  plate.className = 'fallback-plate';
  plate.dataset.mode = modeReason;

  const reasonLabel = modeReason === 'no-webgl' ? 'STILL PLATE · NO WEBGL' : 'STILL PLATE · REDUCED MOTION';

  plate.innerHTML = `
    <div class="fallback-head">
      <span class="fallback-id">${entry.number} · ${entry.title.toUpperCase()}</span>
      <span class="fallback-badge">${reasonLabel}</span>
    </div>
    <div class="fallback-body">
      ${svgDiagramFor(entry.id)}
      <div class="fallback-words" role="region" aria-live="polite">
        <div class="fallback-word-row"><span class="fallback-letter">M</span><span class="fallback-word" data-slot="0"></span></div>
        <div class="fallback-word-row"><span class="fallback-letter">C</span><span class="fallback-word" data-slot="1"></span></div>
        <div class="fallback-word-row"><span class="fallback-letter">P</span><span class="fallback-word" data-slot="2"></span></div>
      </div>
    </div>
    <div class="fallback-foot">
      <p class="fallback-note"></p>
      <button type="button" class="fallback-roll-btn">Next phrase</button>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(plate);

  const wordEls = [
    plate.querySelector('[data-slot="0"]'),
    plate.querySelector('[data-slot="1"]'),
    plate.querySelector('[data-slot="2"]'),
  ];
  const noteEl = plate.querySelector('.fallback-note');
  const rollBtn = plate.querySelector('.fallback-roll-btn');

  const update = (state) => {
    state.words.forEach((w, i) => {
      wordEls[i].textContent = w;
    });
    noteEl.textContent = state.note || '';
  };

  rollBtn.addEventListener('click', () => {
    phraseStore.nextRandom({ source: entry.id });
  });

  update(phraseStore.getState());

  return {
    setPhrase: update,
    setTheme: () => {},
    triggerPrimary: () => phraseStore.nextRandom({ source: entry.id }),
    render: () => {},
    resize: () => {},
    dispose: () => {
      container.innerHTML = '';
    },
  };
}
