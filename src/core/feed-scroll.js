// Keep the settled index separate from the surface moving under the pointer.
export function bindFeedScroll(feed, { getIndex, getTop, count, onSettled, reducedMotion, wheelTarget }) {
  const duration = 260;
  const wheelQuietTime = 170;
  const wheelThreshold = 24;
  const pendingSteps = [];
  let touch;
  let flight = null;
  let nativeSettle = 0;
  let lastWheel = -Infinity;
  let wheelDistance = 0;
  let wheelDirection = 0;
  let wheelClaimedAt = -Infinity;
  let wheelMagnitude = 0;

  const bound = index => Math.max(0, Math.min(count - 1, index));

  function cancelFlight() {
    if (flight) cancelAnimationFrame(flight.frame);
    flight = null;
    clearTimeout(nativeSettle);
  }

  function land(index) {
    feed.scrollTop = getTop(index);
    flight = null;
    feed.classList.remove('is-panning');
    onSettled(index);
    if (!touch && pendingSteps.length) step(pendingSteps.shift());
  }

  function moveTo(index, instant = false) {
    const target = bound(index);
    cancelFlight();
    feed.classList.add('is-panning');
    const from = feed.scrollTop;
    const to = getTop(target);
    if (instant || reducedMotion() || Math.abs(from - to) < 1) {
      land(target);
      return;
    }

    const started = performance.now();
    const move = { target, frame: 0 };
    flight = move;
    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      if (progress === 1) {
        land(target);
      } else {
        feed.scrollTop = from + (to - from) * (1 - (1 - progress) ** 3);
        move.frame = requestAnimationFrame(frame);
      }
    }
    move.frame = requestAnimationFrame(frame);
  }

  function goTo(index, instant = false) {
    pendingSteps.length = 0;
    moveTo(index, instant);
  }

  function step(direction) {
    if (touch?.panning) return;
    if (flight) {
      if (pendingSteps.length < count) pendingSteps.push(direction);
      return;
    }
    const current = getIndex();
    const next = bound(current + direction);
    if (current !== next) moveTo(next);
    else if (pendingSteps.length) step(pendingSteps.shift());
  }

  function onWheel(event) {
    if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > wheelQuietTime) {
      wheelDistance = 0;
      wheelDirection = 0;
    }
    lastWheel = now;
    if (touch?.panning) return;

    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? feed.clientHeight : 1;
    const delta = event.deltaY * multiplier;
    const direction = Math.sign(delta);
    const previousMagnitude = wheelMagnitude;
    wheelMagnitude = Math.abs(delta);

    // A new push can follow the last small momentum event without a quiet gap.
    if (direction === wheelDirection) {
      wheelDistance = 0;
      const renewed = !flight && now - wheelClaimedAt >= duration &&
        previousMagnitude <= 8 && wheelMagnitude >= wheelThreshold;
      if (!renewed) return;
    }

    if (Math.sign(wheelDistance) !== direction) wheelDistance = 0;
    wheelDistance += delta;
    if (Math.abs(wheelDistance) < wheelThreshold) return;
    wheelDirection = direction;
    wheelClaimedAt = now;
    wheelDistance = 0;

    const current = getIndex();
    if (flight && direction * (flight.target - current) < 0) {
      // Reverse the current glide before it can land and consume a phrase.
      goTo(current);
    } else {
      step(direction);
    }
  }

  feed.addEventListener('wheel', onWheel, { passive: false });
  wheelTarget?.addEventListener('wheel', onWheel, { passive: false });

  feed.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    touch = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      started: performance.now(),
      target: event.target,
      panning: false,
      horizontal: false,
      samples: [],
      distance: 0,
    };
  }, true);

  feed.addEventListener('pointermove', event => {
    if (event.pointerId !== touch?.id || touch.horizontal) return;
    const dx = event.clientX - touch.x;
    const dy = event.clientY - touch.y;
    if (!touch.panning) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        touch.horizontal = true;
        return;
      }
      cancelFlight();
      pendingSteps.length = 0;
      feed.classList.add('is-panning');
      // Give the instrument a chance to release its pointer before the feed takes it.
      touch.target.dispatchEvent(new PointerEvent('pointercancel', {
        pointerId: event.pointerId, pointerType: 'touch', isPrimary: true,
      }));
      feed.setPointerCapture(event.pointerId);
      touch.panning = true;
      touch.top = feed.scrollTop;
      touch.index = getIndex();
    }
    const now = performance.now();
    touch.distance = dy;
    touch.samples.push({ time: now, y: event.clientY });
    while (touch.samples[0].time < now - 100) touch.samples.shift();
    const min = getTop(bound(touch.index - 1));
    const max = getTop(bound(touch.index + 1));
    feed.scrollTop = Math.max(min, Math.min(max, touch.top - dy));
  }, true);

  function endTouch(event) {
    if (!event.isTrusted || event.pointerId !== touch?.id) return;
    const { distance, index, panning, samples, started } = touch;
    touch = undefined;
    if (!panning) return;
    const now = performance.now();
    const first = samples.find(sample => sample.time >= now - 100);
    const last = samples.at(-1);
    const recentSpeed = first && last.time - first.time > 4
      ? (last.y - first.y) / (last.time - first.time)
      : 0;
    const direction = Math.sign(distance);
    const elapsed = Math.max(1, now - started);
    const travel = Math.abs(distance);
    const advance = event.type !== 'pointercancel' && travel >= 24 && (
      travel >= Math.min(72, feed.clientHeight * .1) ||
      recentSpeed * direction >= .25 || travel / elapsed >= .25
    );
    moveTo(advance ? index - direction : index);
  }

  feed.addEventListener('pointerup', endTouch, true);
  feed.addEventListener('pointercancel', endTouch, true);

  // Handle native scrolls from accessibility tools and browser automation too.
  feed.addEventListener('scroll', () => {
    if (flight || touch?.panning || Math.abs(feed.scrollTop - getTop(getIndex())) < 1) return;
    clearTimeout(nativeSettle);
    nativeSettle = setTimeout(() => {
      moveTo(Math.round(feed.scrollTop / feed.clientHeight));
    }, 120);
  }, { passive: true });

  return {
    goTo,
    step,
    isMoving: () => !!flight || Boolean(touch?.panning) || Math.abs(feed.scrollTop - getTop(getIndex())) > 1,
    realign() {
      const target = flight?.target ?? getIndex();
      if (touch?.panning) touch = undefined;
      goTo(target, true);
    },
  };
}
