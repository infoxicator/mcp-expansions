export function bindInstrumentRail(rail, entries, select) {
  const track = rail.querySelector('.instrument-rail-track');
  const preview = rail.querySelector('.instrument-preview');
  const image = preview.querySelector('img');
  let active = 0;
  let previewIndex = null;
  let drag = null;

  const ticks = entries.map((entry, index) => {
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'instrument-tick';
    tick.dataset.index = index;
    tick.setAttribute('aria-label', entry.title);
    tick.tabIndex = -1;
    return tick;
  });
  track.replaceChildren(...ticks);

  function focusable(index) {
    for (const [i, tick] of ticks.entries()) tick.tabIndex = i === index ? 0 : -1;
  }

  function setActive(index) {
    active = index;
    for (const [i, tick] of ticks.entries()) {
      if (i === index) tick.setAttribute('aria-current', 'true');
      else tick.removeAttribute('aria-current');
      const distance = Math.abs(i - index);
      tick.style.setProperty('--tick-width', [32, 21, 15][distance] ?? 11);
      tick.style.setProperty('--tick-opacity', [1, .63, .44][distance] ?? Math.max(.16, .38 - distance * .029));
    }
    if (!track.contains(document.activeElement)) focusable(index);
  }

  function show(index) {
    if (index === previewIndex) return;
    if (previewIndex !== null) ticks[previewIndex].classList.remove('is-previewed');
    previewIndex = index;
    const entry = entries[index];
    ticks[index].classList.add('is-previewed');
    preview.style.setProperty('--preview-index', index);
    preview.setAttribute('aria-label', 'Go to ' + entry.title);
    image.src = new URL('../../assets/previews/' + entry.id + '.webp', import.meta.url);
    preview.hidden = false;
  }

  function hide() {
    if (previewIndex !== null) ticks[previewIndex].classList.remove('is-previewed');
    previewIndex = null;
    preview.hidden = true;
  }

  const tickFrom = target => target.closest('.instrument-tick');
  function indexAt(y) {
    const box = track.getBoundingClientRect();
    return Math.max(0, Math.min(ticks.length - 1, Math.floor((y - box.top) * ticks.length / box.height)));
  }

  track.addEventListener('pointermove', event => {
    if (drag === event.pointerId) show(indexAt(event.clientY));
    else if (event.pointerType === 'mouse') {
      const tick = tickFrom(event.target);
      if (tick) show(Number(tick.dataset.index));
    }
  });

  track.addEventListener('pointerdown', event => {
    const tick = tickFrom(event.target);
    if (!tick || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    drag = event.pointerId;
    track.setPointerCapture(event.pointerId);
    show(Number(tick.dataset.index));
  });

  track.addEventListener('pointerup', event => {
    if (drag !== event.pointerId) return;
    drag = null;
    const index = indexAt(event.clientY);
    select(index);
    if (event.pointerType !== 'mouse') hide();
    else show(index);
  });

  track.addEventListener('lostpointercapture', event => {
    if (drag !== event.pointerId) return;
    drag = null;
    hide();
  });

  track.addEventListener('click', event => {
    const tick = tickFrom(event.target);
    if (tick && event.detail === 0) select(Number(tick.dataset.index));
  });
  preview.addEventListener('click', () => {
    if (previewIndex !== null) select(previewIndex);
  });

  rail.addEventListener('pointerleave', () => {
    if (drag === null && !track.querySelector(':focus-visible')) hide();
  });

  track.addEventListener('focusin', event => {
    const tick = tickFrom(event.target);
    if (!tick) return;
    const index = Number(tick.dataset.index);
    focusable(index);
    show(index);
  });
  rail.addEventListener('focusout', event => {
    if (rail.contains(event.relatedTarget)) return;
    focusable(active);
    if (drag === null) hide();
  });

  track.addEventListener('keydown', event => {
    const tick = tickFrom(event.target);
    if (!tick) return;
    const index = Number(tick.dataset.index);
    let next;
    switch (event.key) {
      case 'ArrowUp': next = index - 1; break;
      case 'ArrowDown': next = index + 1; break;
      case 'Home': next = 0; break;
      case 'End': next = ticks.length - 1; break;
      case 'Escape': hide(); return;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
    ticks[Math.max(0, Math.min(ticks.length - 1, next))].focus({preventScroll: true});
  });

  return setActive;
}
