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
    cue: 'Turn rotors or press Space',
    modulePath: './instruments/cipher-machine.js',
  },
  {
    id: 'discover-identity',
    number: '04',
    title: 'Discover Identity',
    cue: 'Seat VCONN cable or press Space',
    modulePath: './instruments/discover-identity.js',
  },
  {
    id: 'destination-blind',
    number: '05',
    title: 'Destination Blind',
    cue: 'Click board or press Space',
    modulePath: './instruments/destination-blind.js',
  },
  {
    id: 'letterpress-lockup',
    number: '06',
    title: 'Letterpress Lockup',
    cue: 'Pull proof or press Space',
    modulePath: './instruments/letterpress-lockup.js',
  },
  {
    id: 'dymo-embosser',
    number: '07',
    title: 'Dymo Embosser',
    cue: 'Squeeze trigger or press Space',
    modulePath: './instruments/dymo-embosser.js',
  },
  {
    id: 'combination-lock',
    number: '08',
    title: 'Combination Lock',
    cue: 'Spin tumblers or press Space',
    modulePath: './instruments/combination-lock.js',
  },
  {
    id: 'mechanical-typewriter',
    number: '09',
    title: 'Mechanical Typewriter',
    cue: 'Strike keys or press Space',
    modulePath: './instruments/mechanical-typewriter.js',
  },
  {
    id: 'flip-contract',
    number: '10',
    title: 'Flip Contract',
    cue: 'Flip plug 180° or press Space',
    modulePath: './instruments/flip-contract.js',
  },
  {
    id: 'jacket-legend',
    number: '11',
    title: 'Jacket Legend',
    cue: 'Pull cable taut or press Space',
    modulePath: './instruments/jacket-legend.js',
  },
  {
    id: 'specimen-drawer',
    number: '12',
    title: 'Specimen Drawer',
    cue: 'Pick a cable or press Space',
    modulePath: './instruments/specimen-drawer.js',
  },
];

export function findInstrumentIndex(id) {
  if (!id) return 0;
  const idx = INSTRUMENTS.findIndex((item) => item.id === id);
  return idx >= 0 ? idx : 0;
}
