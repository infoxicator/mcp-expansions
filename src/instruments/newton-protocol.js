import { photograph, loadPhotograph } from '../core/photograph.js';
import { sound } from '../core/audio.js';

const PENDULUM_L = 1.88;
const HARD_PULL_THRESHOLD = .46;
const MAX_PULL_ANGLE = 1.12;
const openingAngle = -.82;

export async function createInstrument({container, canvas, phraseStore, theme}) {
  const [plate, bearings] = await Promise.all([
    photograph(canvas, 'newton-protocol'), loadPhotograph('balls')
  ]);
  let posed = true;
  let currentTheme = theme;
  // Editorial serif word bar integrated inside the lower band of the square poster
  const wordLayer = document.createElement('div');
  wordLayer.className = 'newton-words';
  wordLayer.setAttribute('aria-live', 'polite');
  wordLayer.innerHTML = `
    <span class="newton-word is-revealed" data-slot="0"></span>
    <span class="newton-word is-revealed" data-slot="1"></span>
    <span class="newton-word is-revealed" data-slot="2"></span>
  `;
  container.appendChild(wordLayer);
  const caption = document.createElement('span');
  caption.className = 'instrument-fineprint';
  caption.textContent = 'click to clack · MCP turns 2';
  container.appendChild(caption);
  const wordEls = [
    wordLayer.querySelector('[data-slot="0"]'),
    wordLayer.querySelector('[data-slot="1"]'),
    wordLayer.querySelector('[data-slot="2"]'),
  ];

  // Physics state
  const theta = [0, 0, 0];
  const omega = [0, 0, 0];
  let revealedCount = 3;
  let revealActive = false;
  let clackCooldown = 0;
  let gravityScale = 1.0;
  let hasPlayedCurrentPhrase = false;

  // Auto pull-back tween state (for Space or gentle click)
  let autoPull = null; // { targetAngle, elapsed, duration, shouldAdvance }

  // Pointer drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartAngle = 0;
  let dragMaxAngle = 0;
  let dragMoved = false;

  function updateWordSizing(words) {
    const gauge = plate.ctx;
    gauge.font = '400 100px "Instrument Serif", Georgia, serif';
    const width = words.reduce((total, word) => total + gauge.measureText(word).width, 32);
    wordLayer.style.setProperty('--newton-size', Math.min(.119, 85 / width));
  }

  function applyPhraseWords(state, { revealAll = true, markUnplayed = false } = {}) {
    updateWordSizing(state.words);
    state.words.forEach((w, i) => {
      wordEls[i].textContent = w;
      wordEls[i].classList.toggle('is-revealed', revealAll);
      wordEls[i].classList.remove('is-just-clacked');
    });
    revealedCount = revealAll ? 3 : 0;
    if (markUnplayed) hasPlayedCurrentPhrase = false;
  }

  function revealNextWord() {
    if (!revealActive || revealedCount >= 3) return;
    const slot = revealedCount;
    revealedCount += 1;
    const el = wordEls[slot];
    if (el) {
      el.classList.add('is-revealed', 'is-just-clacked');
      setTimeout(() => el.classList.remove('is-just-clacked'), 380);
    }
    if (revealedCount >= 3) {
      revealActive = false;
      hasPlayedCurrentPhrase = true;
    }
  }

  function prepareForSwing(shouldAdvancePhrase, pullAngle) {
    if (shouldAdvancePhrase) {
      phraseStore.nextRandom({ source: 'newton-protocol' });
    }
    const state = phraseStore.getState();
    applyPhraseWords(state, { revealAll: false });
    revealActive = true;
    revealedCount = 0;
    clackCooldown = 0;
    // Harder pull -> noticeably snappier, faster clacks
    const norm = Math.max(0, Math.min(1, (Math.abs(pullAngle) - 0.25) / (MAX_PULL_ANGLE - 0.25)));
    gravityScale = 0.92 + norm * 0.42;
  }

  function startAutoPull(targetAngle, shouldAdvance) {
    if (posed) theta[0] = openingAngle;
    posed = false;
    // Reset other balls cleanly
    theta[1] = 0;
    theta[2] = 0;
    omega[0] = 0;
    omega[1] = 0;
    omega[2] = 0;
    autoPull = {
      startAngle: theta[0],
      targetAngle: -Math.abs(targetAngle),
      elapsed: 0,
      duration: 0.30,
      shouldAdvance,
    };
    // Clear words gently while drawing back
    wordEls.forEach((el) => el.classList.remove('is-revealed'));
  }


  function updateVisuals() {
    const {ctx} = plate;
    plate.begin();
    if (currentTheme === 'dark') {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#424447';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.restore();
    }
    const radius = 69;
    for (let i = 0; i < 3; i++) {
      const angle = posed && i === 0 ? openingAngle : theta[i];
      const pivotX = 395 + i * radius * 2;
      const x = pivotX + 372 * Math.sin(angle);
      const y = 111 + 372 * Math.cos(angle);
      const bailX = x - (radius+3)*Math.sin(angle);
      const bailY = y - (radius+3)*Math.cos(angle);
      ctx.save();
      for (const side of [-1,1]) {
        ctx.beginPath();
        ctx.moveTo(pivotX + side*16, 109);
        ctx.lineTo(bailX, bailY);
        ctx.strokeStyle = currentTheme === 'dark' ? '#a7a399' : '#494640';
        ctx.lineWidth = 1.45;
        ctx.stroke();
        ctx.fillStyle = '#8e8b80';
        ctx.fillRect(pivotX+side*16-3,106,6,5);
      }
      ctx.beginPath();
      ctx.arc(bailX,bailY,4,0,Math.PI*2);
      ctx.strokeStyle='#65635c';
      ctx.lineWidth=2.2; ctx.stroke();
      ctx.translate(x,y);
      ctx.rotate(-angle*.12);
      const sx = [14,433,854][i], sy = 14, side = 386;
      const stamp = (dx,dy) => ctx.drawImage(bearings,sx,sy,side,side,
        -radius+dx,-radius+dy,2*radius,2*radius);
      ctx.shadowColor = 'rgba(30,25,18,.34)';
      ctx.shadowBlur = 10 * canvas.width / 1000;
      ctx.shadowOffsetX = 5 * canvas.width / 1000;
      ctx.shadowOffsetY = 9 * canvas.width / 1000;
      const speed = posed && i === 0 ? 2.15 : omega[i];
      if (Math.abs(speed) > .25) {
        for (let sample=6; sample>0; sample--) {
          ctx.globalAlpha = .061;
          stamp(-sample*speed*.95,sample*speed*Math.sin(angle)*.6);
        }
      }
      ctx.globalAlpha=1;
      stamp(0,0);
      ctx.restore();
    }
  }
  function stepPhysics(dt) {
    if (posed) return;
    if (autoPull) {
      autoPull.elapsed += dt;
      const t = Math.min(1, autoPull.elapsed / autoPull.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      theta[0] = autoPull.startAngle + (autoPull.targetAngle - autoPull.startAngle) * eased;
      omega[0] = 0;
      if (t >= 1) {
        const releaseAngle = theta[0];
        const advance = autoPull.shouldAdvance;
        autoPull = null;
        prepareForSwing(advance, releaseAngle);
      }
      return;
    }

    if (isDragging) return;

    // Check if essentially at rest
    const totalEnergy =
      Math.abs(theta[0]) + Math.abs(theta[1]) + Math.abs(theta[2]) +
      Math.abs(omega[0]) + Math.abs(omega[1]) + Math.abs(omega[2]);
    if (totalEnergy < 0.0008 && !revealActive) {
      theta[0] = theta[1] = theta[2] = 0;
      omega[0] = omega[1] = omega[2] = 0;
      return;
    }

    const substeps = 12;
    const h = dt / substeps;
    const gOverL = (23.5 * gravityScale) / PENDULUM_L;
    const airDamping = 0.055;

    for (let s = 0; s < substeps; s++) {
      clackCooldown = Math.max(0, clackCooldown - h);

      // Symplectic Euler integration for true nonlinear pendulum motion
      for (let i = 0; i < 3; i++) {
        const alpha = -gOverL * Math.sin(theta[i]) - airDamping * omega[i];
        omega[i] += alpha * h;
        theta[i] += omega[i] * h;
      }

      // Elastic steel-on-steel momentum transfer along M(0) <-> C(1) <-> P(2)
      // Run two passes so impulse cleanly transmits M -> C -> P within the same instant
      let maxImpactSpeed = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 2; i++) {
          if (theta[i] > theta[i + 1]) {
            const relV = omega[i] - omega[i + 1];
            const mid = 0.5 * (theta[i] + theta[i + 1]);
            theta[i] = mid;
            theta[i + 1] = mid;
            if (relV > 0) {
              // Higher restitution while delivering the 3 words, gentler natural decay after
              const restitution = revealedCount < 3 ? 0.945 : 0.89;
              const j = 0.5 * (1 + restitution) * relV;
              omega[i] -= j;
              omega[i + 1] += j;
              if (relV > maxImpactSpeed) maxImpactSpeed = relV;
            }
          }
        }
      }

      if (maxImpactSpeed > 0.24 && clackCooldown <= 0) {
        clackCooldown = 0.145;
        const normalizedImpact = Math.min(1.0, maxImpactSpeed / 3.4);
        sound.playSteelClack(normalizedImpact);
        revealNextWord();
      }
    }

  }


  function inLeftZone(e) {
    const box=canvas.getBoundingClientRect();
    const x=(e.clientX-box.left)/box.width, y=(e.clientY-box.top)/box.height;
    return x < .56 && y > .16 && y < .70;
  }
  function onPointerDown(e) {
    if (!e.isPrimary || e.button !== 0 || !inLeftZone(e)) return;
    if (posed) theta[0] = openingAngle;
    posed = false;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    autoPull = null;
    isDragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartAngle = Math.min(0, theta[0]);
    dragMaxAngle = Math.abs(dragStartAngle);
    theta[1] = 0;
    theta[2] = 0;
    omega[0] = omega[1] = omega[2] = 0;
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {

    if (!isDragging) {
      canvas.style.cursor = inLeftZone(e) ? 'grab' : 'default';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 6) dragMoved = true;

    // Pulling left (negative dx) increases negative angle on M ball
    const deltaRad = (dx / (rect.width * 0.36)) * 1.1;
    const nextAngle = Math.max(-MAX_PULL_ANGLE, Math.min(-0.04, dragStartAngle + deltaRad));
    theta[0] = nextAngle;
    dragMaxAngle = Math.max(dragMaxAngle, Math.abs(nextAngle));

    if (dragMaxAngle > 0.14) {
      wordEls.forEach((el) => el.classList.remove('is-revealed'));
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grab';
    if (e.type === 'pointercancel') {
      theta.fill(0);
      omega.fill(0);
      revealActive = false;
      applyPhraseWords(phraseStore.getState());
      updateVisuals();

      return;
    }

    const pulled = Math.abs(theta[0]);
    if (!dragMoved || pulled < 0.14) {
      // Gentle tap on M ball -> small swing that replays the current phrase
      startAutoPull(0.36, false);
    } else {
      const isHardPull = pulled >= HARD_PULL_THRESHOLD &&
        (dragStartAngle > -.4 || Math.abs(e.clientX - dragStartX) > canvas.clientWidth * .10);
      prepareForSwing(isHardPull, theta[0]);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // Initial state: sharp, readable at rest
  applyPhraseWords(phraseStore.getState(), { revealAll: true, markUnplayed: true });
  updateVisuals();

  return {
    setPhrase(state, meta = {}) {
      if (meta.source === 'newton-protocol') return;
      applyPhraseWords(state, { revealAll: true, markUnplayed: true });
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
    },

    /** Space bar: first press on a fresh phrase clacks it out; subsequent presses pull harder for a new phrase */
    triggerPrimary(opts = {}) {
      const replayOnly = opts.replay === true || (!hasPlayedCurrentPhrase && opts.forceNew !== true);
      if (replayOnly) {
        startAutoPull(0.42, false);
      } else {
        startAutoPull(0.84, true);
      }
    },

    isMoving() {
      return Boolean(autoPull || isDragging || revealActive || theta.some((v, i) => Math.abs(v) + Math.abs(omega[i]) > .0001));
    },

    render(dt) {
      stepPhysics(Math.min(dt, 0.05));
      updateVisuals();
    },

    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      wordLayer.remove();
      caption.remove();
    },
  };
}
