// Lazy-loaded catalog of quiet physical MCP instruments

export const INSTRUMENTS = [
  {
    id: 'newton-protocol',
    number: '01',
    title: 'Newton Protocol',
    cue: 'Drag M or press Space',
    modulePath: './instruments/newton-protocol.js',
  },
  {
    id: 'the-contract',
    number: '02',
    title: 'The Contract',
    cue: 'Plug in cable or press Space',
    modulePath: './instruments/the-contract.js',
  },
  {
    id: 'cipher-machine',
    number: '03',
    title: 'Cipher Machine',
    cue: 'Turn crank or press Space',
    modulePath: './instruments/cipher-machine.js',
  },
  {
    id: 'jacket-legend',
    number: '04',
    title: 'Jacket Legend',
    cue: 'Pull cable taut or press Space',
    modulePath: './instruments/jacket-legend.js',
  },
  {
    id: 'discover-identity',
    number: '05',
    title: 'Discover Identity',
    cue: 'Seat VCONN cable or press Space',
    modulePath: './instruments/discover-identity.js',
  },
  {
    id: 'flip-contract',
    number: '06',
    title: 'Flip Contract',
    cue: 'Flip plug 180° or press Space',
    modulePath: './instruments/flip-contract.js',
  },
  {
    id: 'specimen-drawer',
    number: '07',
    title: 'Specimen Drawer',
    cue: 'Pick a cable or press Space',
    modulePath: './instruments/specimen-drawer.js',
  },
  {
    id: 'destination-blind',
    number: '08',
    title: 'Destination Blind',
    cue: 'Click board or press Space',
    modulePath: './instruments/destination-blind.js',
  },
  {
    id: 'letterpress-lockup',
    number: '09',
    title: 'Letterpress Lockup',
    cue: 'Pull proof or press Space',
    modulePath: './instruments/letterpress-lockup.js',
  },
  {
    id: 'dymo-embosser',
    number: '10',
    title: 'Dymo Embosser',
    cue: 'Squeeze trigger or press Space',
    modulePath: './instruments/dymo-embosser.js',
  },
];

export function findInstrumentIndex(id) {
  if (!id) return 0;
  const idx = INSTRUMENTS.findIndex((item) => item.id === id);
  return idx >= 0 ? idx : 0;
}
