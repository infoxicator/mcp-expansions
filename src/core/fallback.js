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
    case 'cipher-machine':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 140" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="64" y="18" width="184" height="68" rx="8" stroke-width="1.6"/>
          <rect x="92" y="28" width="26" height="40" rx="3" stroke-width="1.2" opacity="0.7"/>
          <rect x="143" y="28" width="26" height="40" rx="3" stroke-width="1.2" opacity="0.7"/>
          <rect x="194" y="28" width="26" height="40" rx="3" stroke-width="1.2" opacity="0.7"/>
          <text x="105" y="52" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M</text>
          <text x="156" y="52" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">C</text>
          <text x="207" y="52" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">P</text>
          <path d="M248 52 H274 V26 H286" stroke-width="2" opacity="0.65"/>
          <rect x="96" y="86" width="120" height="40" stroke-width="1.2" opacity="0.6"/>
          <line x1="110" y1="101" x2="202" y2="101" stroke-width="1" opacity="0.45"/>
          <line x1="110" y1="113" x2="188" y2="113" stroke-width="1" opacity="0.45"/>
        </svg>`;
    case 'jacket-legend':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 110" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="22" y="45" width="38" height="20" rx="4" stroke-width="1.4" opacity="0.7"/>
          <rect x="260" y="45" width="38" height="20" rx="4" stroke-width="1.4" opacity="0.7"/>
          <rect x="60" y="49" width="200" height="12" rx="6" stroke-width="1.6"/>
          <text x="160" y="58" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">AWM 2725 · M · C · P</text>
        </svg>`;
    case 'discover-identity':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 110" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="14" y="28" width="44" height="54" rx="6" stroke-width="1.4" opacity="0.65"/>
          <circle cx="44" cy="40" r="3" fill="currentColor" stroke="none"/>
          <line x1="58" y1="55" x2="78" y2="55" stroke-width="2.5" opacity="0.5"/>
          <rect x="78" y="34" width="60" height="42" rx="5" stroke-width="1.5"/>
          <text x="108" y="59" text-anchor="middle" font-size="10" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">SOP</text>
          <line x1="138" y1="55" x2="156" y2="55" stroke-width="2.5" opacity="0.5"/>
          <rect x="156" y="34" width="60" height="42" rx="5" stroke-width="1.5"/>
          <text x="186" y="59" text-anchor="middle" font-size="10" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">SOP'</text>
          <line x1="216" y1="55" x2="234" y2="55" stroke-width="2.5" opacity="0.5"/>
          <rect x="234" y="34" width="60" height="42" rx="5" stroke-width="1.5"/>
          <text x="264" y="59" text-anchor="middle" font-size="10" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">SOP''</text>
        </svg>`;
    case 'flip-contract':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 120" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="44" y="22" width="136" height="76" rx="8" stroke-width="1.6"/>
          <rect x="56" y="34" width="102" height="52" rx="3" stroke-width="1" opacity="0.5"/>
          <text x="107" y="56" text-anchor="middle" font-size="9" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">CC1 / CC2</text>
          <text x="107" y="72" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M · C · P</text>
          <rect x="186" y="48" width="52" height="24" rx="6" stroke-width="1.5"/>
          <line x1="238" y1="60" x2="292" y2="60" stroke-width="3" opacity="0.5"/>
        </svg>`;
    case 'specimen-drawer':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 130" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="34" y="16" width="252" height="98" rx="6" stroke-width="1.6"/>
          <line x1="84" y1="16" x2="84" y2="80" stroke-width="1" opacity="0.45"/>
          <line x1="135" y1="16" x2="135" y2="80" stroke-width="1" opacity="0.45"/>
          <line x1="185" y1="16" x2="185" y2="80" stroke-width="1" opacity="0.45"/>
          <line x1="236" y1="16" x2="236" y2="80" stroke-width="1" opacity="0.45"/>
          <ellipse cx="59" cy="48" rx="14" ry="22" stroke-width="1.2" opacity="0.5"/>
          <ellipse cx="110" cy="48" rx="14" ry="22" stroke-width="1.2" opacity="0.5"/>
          <ellipse cx="160" cy="48" rx="14" ry="22" stroke-width="1.8"/>
          <ellipse cx="210" cy="48" rx="14" ry="22" stroke-width="1.2" opacity="0.5"/>
          <ellipse cx="261" cy="48" rx="14" ry="22" stroke-width="1.2" opacity="0.5"/>
          <line x1="34" y1="80" x2="286" y2="80" stroke-width="1.2" opacity="0.6"/>
          <text x="160" y="101" text-anchor="middle" font-size="9.5" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">SPEC 03 · LIVE · M · C · P</text>
        </svg>`;
    case 'destination-blind':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 136" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="42" y="14" width="236" height="108" rx="6" stroke-width="1.6"/>
          <rect x="76" y="28" width="186" height="24" rx="2" stroke-width="1.2" opacity="0.7"/>
          <line x1="76" y1="40" x2="262" y2="40" stroke-width="1" opacity="0.5"/>
          <rect x="76" y="58" width="186" height="24" rx="2" stroke-width="1.2" opacity="0.7"/>
          <line x1="76" y1="70" x2="262" y2="70" stroke-width="1" opacity="0.5"/>
          <rect x="76" y="88" width="186" height="24" rx="2" stroke-width="1.2" opacity="0.7"/>
          <line x1="76" y1="100" x2="262" y2="100" stroke-width="1" opacity="0.5"/>
          <text x="58" y="44" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M</text>
          <text x="58" y="74" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">C</text>
          <text x="58" y="104" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">P</text>
        </svg>`;
    case 'letterpress-lockup':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 136" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="44" y="16" width="102" height="104" rx="4" stroke-width="2"/>
          <rect x="64" y="42" width="52" height="14" stroke-width="1.2" opacity="0.7"/>
          <rect x="64" y="61" width="52" height="14" stroke-width="1.2" opacity="0.7"/>
          <rect x="64" y="80" width="52" height="14" stroke-width="1.2" opacity="0.7"/>
          <rect x="174" y="16" width="102" height="104" rx="2" stroke-width="1.4" opacity="0.75"/>
          <text x="225" y="54" text-anchor="middle" font-size="11" fill="currentColor" stroke="none" font-family="Instrument Serif, Georgia, serif">M · C · P</text>
          <line x1="192" y1="74" x2="258" y2="74" stroke-width="1" opacity="0.4"/>
          <line x1="192" y1="88" x2="246" y2="88" stroke-width="1" opacity="0.4"/>
        </svg>`;
    case 'dymo-embosser':
      return `
        <svg class="fallback-diagram" viewBox="0 0 320 120" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="88" cy="60" r="34" stroke-width="1.6"/>
          <circle cx="88" cy="60" r="10" stroke-width="1.2" opacity="0.6"/>
          <rect x="136" y="26" width="144" height="18" rx="3" stroke-width="1.4"/>
          <rect x="136" y="51" width="144" height="18" rx="3" stroke-width="1.4"/>
          <rect x="136" y="76" width="144" height="18" rx="3" stroke-width="1.4"/>
          <text x="150" y="38" font-size="9" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">M |</text>
          <text x="150" y="63" font-size="9" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">C |</text>
          <text x="150" y="88" font-size="9" fill="currentColor" stroke="none" font-family="JetBrains Mono, monospace">P |</text>
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
