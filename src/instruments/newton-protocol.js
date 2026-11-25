import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

const BALL_RADIUS = 0.415;
const SPACING = BALL_RADIUS * 2.0; // 0.830
const BALL_XS = [-SPACING, 0, SPACING];
const PIVOT_Y = 2.94;
const ARCH_Z = 0.58;
const BALL_REST_Y = 1.06;
const PENDULUM_L = PIVOT_Y - BALL_REST_Y; // 1.88
const BAIL_OFFSET = BALL_RADIUS + 0.044;

const HARD_PULL_THRESHOLD = 0.46; // radians (~26 deg): below = replay current, above = faster clacks + new phrase
const MAX_PULL_ANGLE = 1.12; // ~64 deg

export async function createInstrument({ container, canvas, phraseStore, theme, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = await createStudioScene(theme, 'newton-protocol');

  // Studio 60mm portrait framing: cradle sits cleanly in upper-middle of square poster
  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 40);
  camera.position.set(0.65, 2.28, 10.85);
  camera.lookAt(0.0, 1.30, 0.0);

  // Load Blender-modeled Draco GLB
  const root = await studio.loadGLB('./assets/models/newton-protocol.glb');
  scene.add(root);

  // Upgrade materials with procedural micro-grain anodized finish & laser-engraved mirror chrome
  const anodizedTex = studio.getAnodizedTexture();
  const letters = ['M', 'C', 'P'];
  const ballNodes = [null, null, null];
  const ballMeshes = [null, null, null];

  root.traverse((obj) => {
    if (obj.name === 'Ball_M') ballNodes[0] = obj;
    if (obj.name === 'Ball_C') ballNodes[1] = obj;
    if (obj.name === 'Ball_P') ballNodes[2] = obj;

    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'MatteAnodizedBlack' || matName === 'FrameMatteBlack' || matName === 'BaseGraphiteInset') {
      const isFrame = matName === 'FrameMatteBlack';
      const isInset = matName === 'BaseGraphiteInset';
      obj.material = new THREE.MeshPhysicalMaterial({
        color: isInset ? 0x1a1a1c : isFrame ? 0x151517 : 0x141416,
        metalness: isFrame ? 0.24 : 0.14,
        roughness: isFrame ? 0.56 : isInset ? 0.72 : 0.68,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0028,
        clearcoat: 0.0,
      });
    } else if (matName === 'GunmetalCollar') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x26282c,
        metalness: 0.85,
        roughness: 0.26,
      });
    } else if (matName === 'ChromeBail') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xdce0e5,
        metalness: 0.98,
        roughness: 0.12,
      });
    } else if (matName.startsWith('ChromeBall_')) {
      const letter = matName.split('_')[1];
      const idx = letters.indexOf(letter);
      if (idx >= 0) ballMeshes[idx] = obj;
      const maps = studio.getEngravedChromeMaps(letter);
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: maps.map,
        metalness: 1.0,
        roughness: 1.0,
        roughnessMap: maps.roughnessMap,
        bumpMap: maps.bumpMap,
        bumpScale: 0.014,
        envMapIntensity: 1.15,
        clearcoat: 0.0,
      });
    }
  });

  // Soft grounded AO contact shadows under plinth
  const baseAo = createContactShadow(4.5, 2.35, theme === 'dark' ? 0.65 : 0.30, 0.002);
  scene.add(baseAo);

  // Subtle dynamic ball shadows on the plinth inset plate (y = 0.275)
  const ballShadows = BALL_XS.map((bx) => {
    const sh = createContactShadow(0.76, 0.76, 0.28, 0.276);
    sh.position.x = bx;
    scene.add(sh);
    return sh;
  });

  // Dynamic taut bifilar suspension threads (2 per ball: front & back top bars -> top bail)
  const threadMat = new THREE.MeshStandardMaterial({
    color: theme === 'dark' ? 0x6c6a64 : 0x2a2926,
    metalness: 0.3,
    roughness: 0.55,
  });
  const threadGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 1, 8, 1);
  const threads = [];
  for (let i = 0; i < 3; i++) {
    const pair = [new THREE.Mesh(threadGeo, threadMat), new THREE.Mesh(threadGeo, threadMat)];
    pair[0].castShadow = false;
    pair[1].castShadow = false;
    scene.add(pair[0], pair[1]);
    threads.push(pair);
  }

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

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const upVec = new THREE.Vector3(0, 1, 0);
  const tmpStart = new THREE.Vector3();
  const tmpEnd = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  // Invisible generous hit-sphere around Ball_M for effortless dragging
  const hitSphereM = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.65, 16, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  scene.add(hitSphereM);

  function updateWordSizing(words) {
    const maxLen = Math.max(...words.map((w) => w.length));
    const totalLen = words.join('').length;
    wordLayer.classList.remove('is-medium', 'is-compact');
    if (maxLen >= 13 || totalLen >= 31) {
      wordLayer.classList.add('is-compact');
    } else if (maxLen >= 10 || totalLen >= 23) {
      wordLayer.classList.add('is-medium');
    }
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
    for (let i = 0; i < 3; i++) {
      const a = theta[i];
      const bx = BALL_XS[i] + PENDULUM_L * Math.sin(a);
      const by = PIVOT_Y - PENDULUM_L * Math.cos(a);
      if (ballNodes[i]) {
        ballNodes[i].position.set(bx, by, 0);
        ballNodes[i].rotation.z = a;
      }

      if (i === 0) {
        hitSphereM.position.set(bx, by, 0);
      }

      // Dynamic shadow beneath swinging ball
      const lift = Math.max(0, by - BALL_REST_Y);
      const sh = ballShadows[i];
      sh.position.x = bx;
      const scale = 1.0 + lift * 0.45;
      sh.scale.set(scale, scale, 1);
      sh.material.opacity = Math.max(0.05, 0.28 - lift * 0.16);

      // Update bifilar V-threads from front/back anchor eyelets to ball's top bail ring
      const bailX = bx - BAIL_OFFSET * Math.sin(a);
      const bailY = by + BAIL_OFFSET * Math.cos(a);
      tmpEnd.set(bailX, bailY, 0);

      for (let s = 0; s < 2; s++) {
        const az = s === 0 ? ARCH_Z : -ARCH_Z;
        tmpStart.set(BALL_XS[i], PIVOT_Y, az);
        tmpDir.subVectors(tmpEnd, tmpStart);
        const len = tmpDir.length();
        const cyl = threads[i][s];
        cyl.position.copy(tmpStart).addScaledVector(tmpDir, 0.5);
        cyl.scale.set(1, len, 1);
        cyl.quaternion.setFromUnitVectors(upVec, tmpDir.normalize());
      }
    }
  }

  function stepPhysics(dt) {
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

  // Pointer interaction on canvas: drag M ball left to pull back, or gentle tap M ball to replay
  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(hitSphereM, false);

    // Allow grabbing Ball M directly OR dragging anywhere on the left half of the cradle
    const inLeftZone = pointerNdc.x < 0.12 && pointerNdc.y > -0.35 && pointerNdc.y < 0.55;
    if (!hits.length && !inLeftZone) return;

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
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(hitSphereM, false);
      canvas.style.cursor = hits.length ? 'grab' : 'default';
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
      const isHardPull = pulled >= HARD_PULL_THRESHOLD;
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

  if (onReady) onReady();

  let currentTheme = theme;

  return {
    setPhrase(state, meta = {}) {
      if (meta.source === 'newton-protocol') return;
      applyPhraseWords(state, { revealAll: true, markUnplayed: true });
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      baseAo.material.opacity = nextTheme === 'dark' ? 0.65 : 0.30;
      threadMat.color.setHex(nextTheme === 'dark' ? 0x6c6a64 : 0x2a2926);
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
      studio.renderToCanvas(scene, camera, canvas, currentTheme);
    },

    resize() {
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    },

    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      wordLayer.remove();
      scene.traverse((obj) => {
        if (obj.geometry && obj.geometry !== threadGeo) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      threadGeo.dispose();
    },
  };
}
