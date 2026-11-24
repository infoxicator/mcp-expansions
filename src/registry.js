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
];

export function findInstrumentIndex(id) {
  if (!id) return 0;
  const idx = INSTRUMENTS.findIndex((item) => item.id === id);
  return idx >= 0 ? idx : 0;
}
