import { photograph } from './photograph.js';

// Common transport for mechanisms with one finite stroke. Each instrument owns
// its bearings, paper path, lettering, sound cues and selection behaviour.
export function mechanism(id, design) {
  return async function createInstrument({canvas, phraseStore, startSettled, canOperate = () => true}) {
    const plate = await photograph(canvas, id);
    let phrase = phraseStore.getState();
    const machine = design({ ...plate, canvas, startSettled, phraseStore });
    let t = 1;
    let pressed = null;
    function operate(point, replay = false) {
      if (replay && (t < 1 || pressed)) return;
      const previousPhrase = phraseStore.getState();
      phrase = replay ? previousPhrase : phraseStore.nextRandom({source: id});
      machine.start?.({point, previousPhrase, phrase, replay});
      t = 0;
    }
    const controller = new AbortController();
    function point(e) {
      const box = canvas.getBoundingClientRect();
      return {x: (e.clientX-box.left)/box.width*1000, y: (e.clientY-box.top)/box.height*1000};
    }
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0 || !canOperate()) return;
      pressed = point(e);
      canvas.setPointerCapture(e.pointerId);
    }, {signal:controller.signal});
    canvas.addEventListener('pointercancel', () => { pressed = null; }, {signal:controller.signal});
    canvas.addEventListener('pointerup', e => {
      if (!pressed) return;
      const end = point(e);
      const dx = end.x - pressed.x, dy = end.y - pressed.y;
      pressed = null;
      if (!canOperate()) return;
      if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) return;
      operate({...end, dx, dy});
    }, {signal:controller.signal});
    return {
      triggerPrimary: opts => operate(null, opts?.replay),
      playOnArrival: () => operate(null, true),
      setPhrase(state, meta = {}) {
        phrase = state;
        if (meta.source !== id) {
          t = 1;
        }
      },
      setTheme() {},
      readLegend: machine.smallPrint ? () => t===1 ? (machine.label?.(phrase) ?? phrase.text) : '' : undefined,
      setSettled() { t = 1; },
      isMoving: () => t < 1,
      render(dt) {
        const previous = t;
        t = Math.min(1, t + dt / (machine.duration || 1));
        machine.step?.(t, previous, phrase);
        plate.begin();
        machine.draw(t, phrase);
        const label = machine.label?.(phrase) ?? phrase.text;
        if (canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label',label);
      },
      dispose() { controller.abort(); }
    };
  };
}
