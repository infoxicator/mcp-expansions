import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = await createStudioScene(theme, 'cipher-machine');

  // Elevated 3/4 studio macro angle framing the charcoal cipher box, knurled M·C·P rotors, brass crank, and foreground paper tape
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 45);
  camera.position.set(1.45, 8.35, 7.30);
  camera.lookAt(0.24, 0.28, 0.26);
  camera.rotateZ(THREE.MathUtils.degToRad(2));

  const root = await studio.loadGLB('./assets/models/cipher-machine.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();

  // 1. Etched top faceplate texture (3.06 x 1.86)
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 1024;
  faceCanvas.height = 622;
  const fctx = faceCanvas.getContext('2d');
  fctx.clearRect(0, 0, 1024, 622);

  // Subtle machined hairline border
  fctx.strokeStyle = 'rgba(218, 210, 194, 0.22)';
  fctx.lineWidth = 2;
  fctx.strokeRect(20, 20, 984, 582);

  // Quiet industrial legend along bottom edge of top deck
  fctx.fillStyle = 'rgba(228, 220, 202, 0.78)';
  fctx.font = '500 23px "JetBrains Mono", ui-monospace, monospace';
  fctx.textAlign = 'center';
  fctx.textBaseline = 'middle';
  fctx.fillText('M O D E L   C I P H E R   P R O T O C O L', 512, 560);

  // M / C / P index plates above each rotor slot
  const rotorU = [512 - 301, 512, 512 + 301];
  const letters = ['M', 'C', 'P'];
  letters.forEach((ch, idx) => {
    const cx = rotorU[idx] + 18;
    // Small brass-tinted index triangle pointing down to rotor
    fctx.fillStyle = 'rgba(224, 196, 134, 0.88)';
    fctx.beginPath();
    fctx.moveTo(cx, 82);
    fctx.lineTo(cx - 10, 64);
    fctx.lineTo(cx + 10, 64);
    fctx.closePath();
    fctx.fill();

    fctx.fillStyle = 'rgba(240, 234, 220, 0.92)';
    fctx.font = '600 34px "JetBrains Mono", ui-monospace, monospace';
    fctx.fillText(ch, cx, 42);
  });

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;

  // 2. High-DPI archival warm cream/manila paper tape texture (2.56 x 2.15)
  const tapeCanvas = document.createElement('canvas');
  tapeCanvas.width = 1024;
  tapeCanvas.height = 860;
  const tctx = tapeCanvas.getContext('2d');
  const tapeTex = new THREE.CanvasTexture(tapeCanvas);
  tapeTex.flipY = false;
  tapeTex.colorSpace = THREE.SRGBColorSpace;
  tapeTex.anisotropy = 16;

  // Pre-bake warm archival ticker-tape stock with subtle paper fibers & clean outer edge trim
  const paperBaseCanvas = document.createElement('canvas');
  paperBaseCanvas.width = 1024;
  paperBaseCanvas.height = 860;
  const pctx = paperBaseCanvas.getContext('2d');
  pctx.fillStyle = '#E6DCC8';
  pctx.fillRect(0, 0, 1024, 860);
  // Subtle cream paper mottling + left/right feed-sprocket registration holes
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 4500; i++) {
    const x = rand() * 1024;
    const y = rand() * 860;
    const r = 0.8 + rand() * 1.9;
    pctx.fillStyle = rand() > 0.5 ? 'rgba(110, 96, 74, 0.055)' : 'rgba(255, 252, 244, 0.07)';
    pctx.fillRect(x, y, r, r);
  }
  // Crisp paper-edge definition & ledger borders
  pctx.strokeStyle = 'rgba(72, 62, 48, 0.22)';
  pctx.lineWidth = 4;
  pctx.strokeRect(2, 2, 1020, 856);
  pctx.strokeStyle = 'rgba(42, 38, 34, 0.16)';
  pctx.lineWidth = 2;
  pctx.beginPath();
  pctx.moveTo(50, 0);
  pctx.lineTo(50, 860);
  pctx.moveTo(974, 0);
  pctx.lineTo(974, 860);
  pctx.stroke();

  pctx.fillStyle = 'rgba(42, 36, 28, 0.20)';
  for (let y = 44; y < 840; y += 64) {
    pctx.beginPath();
    pctx.arc(26, y, 7.5, 0, Math.PI * 2);
    pctx.arc(998, y, 7.5, 0, Math.PI * 2);
    pctx.fill();
  }

  let rotors = [];
  let crankAssembly = null;
  let tapeRoot = null;
  let tapeBaseZ = 0;

  root.traverse((obj) => {
    if (obj.name === 'RotorM') rotors[0] = obj;
    if (obj.name === 'RotorC') rotors[1] = obj;
    if (obj.name === 'RotorP') rotors[2] = obj;
    if (obj.name === 'CrankAssembly') crankAssembly = obj;
    if (obj.name === 'PaperTapeRoot') {
      tapeRoot = obj;
      tapeBaseZ = obj.position.z;
    }

    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'CipherChassis') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16181b,
        metalness: 0.14,
        roughness: 0.76,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0042,
        clearcoat: 0.0,
      });
    } else if (matName === 'CipherDeck') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x101215,
        metalness: 0.14,
        roughness: 0.72,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0028,
        clearcoat: 0.0,
      });
    } else if (matName === 'CipherSeam') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x07080a,
        metalness: 0.04,
        roughness: 0.90,
      });
    } else if (matName === 'CipherSteel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd0d4da,
        metalness: 0.94,
        roughness: 0.24,
        envMapIntensity: 1.25,
      });
    } else if (matName === 'CipherBrass') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xc5a25c,
        metalness: 0.90,
        roughness: 0.28,
        envMapIntensity: 1.15,
      });
    } else if (matName === 'CipherKnob') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x261a14,
        metalness: 0.02,
        roughness: 0.34,
        clearcoat: 0.25,
        clearcoatRoughness: 0.24,
      });
    } else if (matName === 'CipherFaceplate') {
      obj.material = new THREE.MeshBasicMaterial({
        map: faceTex,
        transparent: true,
        depthWrite: false,
      });
      obj.castShadow = false;
    } else if (matName === 'CipherPaper') {
      obj.material = new THREE.MeshStandardMaterial({
        map: tapeTex,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
    }
  });

  // Grounded AO shadows beneath chassis & emerging paper tape
  const chassisAo = createContactShadow(4.5, 3.2, theme === 'dark' ? 0.72 : 0.34, 0.002);
  chassisAo.position.set(0.0, 0.002, -0.65);
  scene.add(chassisAo);

  const tapeAo = createContactShadow(2.9, 2.0, theme === 'dark' ? 0.42 : 0.16, 0.002);
  tapeAo.position.set(0.0, 0.002, 1.55);
  scene.add(tapeAo);

  // State machine
  let currentState = phraseStore.getState();
  let revealCount = 3; // 0..3 words stamped on tape
  let animTime = startSettled ? 2.0 : 2.0;
  let isAnimating = false;
  let crankAngle = 0;
  let crankTarget = 0;
  let rotorAngles = [0.25, 0.65, 1.1];
  let rotorTargets = [0.25, 0.65, 1.1];
  let lastDetentTick = -1;
  let tapeAdvance = 1.0; // 0..1 feed slide
  let tapeDirty = true;

  function drawTape() {
    const ctx = tctx;
    ctx.drawImage(paperBaseCanvas, 0, 0);

    const words = currentState.cleanWords.map((w) => w.replace(/,$/, '').toUpperCase());
    const idxLabel = currentState.isRemix
      ? 'REMIX'
      : `MSG ${String(currentState.index + 1).padStart(3, '0')}/${String(currentState.total).padStart(3, '0')}`;

    // Subtle top perforated header inside the flat landing region (y >= 260 is past the curl)
    ctx.fillStyle = 'rgba(38, 34, 30, 0.45)';
    ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MCP · CIPHER TAPE', 86, 265);
    ctx.textAlign = 'right';
    ctx.fillText(idxLabel, 938, 265);

    // Hairline ink rule
    ctx.fillStyle = 'rgba(34, 30, 26, 0.22)';
    ctx.fillRect(86, 296, 852, 2);

    // Uniform optical sizing for the 3 stacked ink-stamped words
    const maxW = 730;
    let fontSize = 112;
    while (fontSize > 52) {
      ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      const widest = Math.max(...words.map((w) => ctx.measureText(w).width));
      if (widest <= maxW) break;
      fontSize -= 4;
    }

    const tags = ['M', 'C', 'P'];
    words.forEach((word, i) => {
      if (i >= revealCount) return;
      const cy = 408 + i * 148;

      // Subtle ruled ledger line between words
      if (i > 0) {
        ctx.fillStyle = 'rgba(34, 30, 26, 0.08)';
        ctx.fillRect(86, cy - 74, 852, 1.5);
      }

      // Crisp dark charcoal-black ribbon ink impression
      ctx.fillStyle = '#181615';
      ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(word, 88, cy);

      // Right-hand boxed rotor key indicator (M / C / P)
      ctx.strokeStyle = 'rgba(28, 25, 22, 0.34)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(862, cy - 32, 74, 64);
      ctx.fillStyle = 'rgba(28, 25, 22, 0.72)';
      ctx.font = '600 36px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tags[i], 899, cy + 2);
    });

    // Subtle bottom tear-line tick marks
    ctx.fillStyle = 'rgba(34, 30, 26, 0.22)';
    for (let x = 88; x < 940; x += 26) {
      ctx.fillRect(x, 818, 12, 2);
    }

    tapeTex.needsUpdate = true;
    tapeDirty = false;
  }

  function crankForNewPhrase({ advancePhrase = true } = {}) {
    if (advancePhrase) {
      phraseStore.nextRandom({ source: 'cipher-machine' });
    }
    currentState = phraseStore.getState();
    isAnimating = true;
    animTime = 0;
    lastDetentTick = -1;
    revealCount = 0;
    tapeAdvance = 0.0;
    crankTarget += Math.PI * 2;
    rotorTargets[0] += Math.PI * 1.15;
    rotorTargets[1] += Math.PI * 1.55;
    rotorTargets[2] += Math.PI * 1.95;
    tapeDirty = true;
  }

  // Interactive click or drag on canvas
  let pointerDown = false;
  let dragStartY = 0;
  let dragged = false;

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerDown = true;
    dragStartY = e.clientY;
    dragged = false;
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    if (!pointerDown) {
      canvas.style.cursor = 'pointer';
      return;
    }
    if (Math.abs(e.clientY - dragStartY) > 22 && !dragged) {
      dragged = true;
      crankForNewPhrase({ advancePhrase: true });
    }
  }

  function onPointerUp() {
    if (!pointerDown) return;
    pointerDown = false;
    canvas.style.cursor = 'pointer';
    if (!dragged) {
      crankForNewPhrase({ advancePhrase: true });
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (isAnimating) {
      animTime += dt;
      const totalDur = 1.15;
      const t = Math.min(1.0, animTime / totalDur);

      // Detent audio clicks during crank/rotor spin
      const tickBucket = Math.floor(t * 7);
      if (tickBucket !== lastDetentTick && tickBucket < 7) {
        lastDetentTick = tickBucket;
        sound.playMechanicalDetent(0.88 + tickBucket * 0.05, 0.18);
      }

      // Staggered word stamping onto emerging tape
      const nextReveal = t < 0.25 ? 0 : t < 0.50 ? 1 : t < 0.76 ? 2 : 3;
      if (nextReveal !== revealCount) {
        revealCount = nextReveal;
        if (revealCount > 0) sound.playRelayTick(0.95 + revealCount * 0.14, 0.15);
        tapeDirty = true;
      }

      // Tape feeds smoothly forward
      const easeOut = 1.0 - Math.pow(1.0 - t, 3);
      tapeAdvance = easeOut;

      if (t >= 1.0) {
        isAnimating = false;
        revealCount = 3;
        tapeAdvance = 1.0;
        tapeDirty = true;
      }
    }

    // Smoothly approach crank & rotor targets
    const follow = 1.0 - Math.exp(-8.5 * dt);
    crankAngle += (crankTarget - crankAngle) * follow;
    if (crankAssembly) {
      crankAssembly.rotation.x = crankAngle;
    }

    for (let i = 0; i < 3; i++) {
      const rFollow = 1.0 - Math.exp(-(9.5 - i * 1.4) * dt);
      rotorAngles[i] += (rotorTargets[i] - rotorAngles[i]) * rFollow;
      if (rotors[i]) {
        rotors[i].rotation.x = rotorAngles[i];
      }
    }

    if (tapeRoot) {
      tapeRoot.position.z = tapeBaseZ - (1.0 - tapeAdvance) * 0.42;
    }
    tapeAo.position.z = 1.55 - (1.0 - tapeAdvance) * 0.42;

    if (tapeDirty) drawTape();
  }

  drawTape();
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'cipher-machine') return;
      revealCount = 3;
      tapeAdvance = 1.0;
      tapeDirty = true;
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      chassisAo.material.opacity = nextTheme === 'dark' ? 0.72 : 0.34;
      tapeAo.material.opacity = nextTheme === 'dark' ? 0.42 : 0.16;
    },

    triggerPrimary() {
      crankForNewPhrase({ advancePhrase: true });
    },

    setSettled(settled) {
      isAnimating = false;
      revealCount = 3;
      tapeAdvance = settled ? 1.0 : 1.0;
      tapeDirty = true;
    },

    render(dt) {
      stepAnimation(Math.min(dt, 0.05));
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
      faceTex.dispose();
      tapeTex.dispose();
      scene.userData.plates.light.dispose();
      scene.userData.plates.dark.dispose();
      scene.traverse((obj) => {
        obj.shadow?.dispose();
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}
