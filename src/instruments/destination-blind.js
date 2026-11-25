import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

const ROW_YS = [2.60, 1.70, 0.80];
const FLAP_X = 0.15;
const FLAP_Z = 0.415;
const FLAP_W = 3.66;
const HALF_H = 0.365;
const GAP = 0.016;

// Authentic intermediate railway-board words to cycle through during split-flap clatter
const FLAP_POOL = [
  ['MANUAL', 'MEANING', 'MINIMUM', 'MODEST', 'MAGICAL', 'MIDNIGHT', 'MONUMENTAL', 'MUTUAL'],
  ['COFFEE', 'CIRCUIT', 'CONTEXT', 'CABLES', 'CHASSIS', 'CATALOG', 'COUPLED', 'CLOUD'],
  ['PROTOCOL', 'PASTRY', 'PAYLOAD', 'PIPELINE', 'PARCEL', 'PATTERN', 'PIGEONS', 'PORTAL'],
];

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = createStudioScene(theme, '#87969d');

  // Clean eye-level architectural product view with gentle elevated angle & studio margins
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 45);
  camera.position.set(0.67, 2.74, 12.55);
  camera.lookAt(0.0, 1.82, 0.0);

  const root = await studio.loadGLB('./assets/models/destination-blind.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();

  // 1. Etched folded-steel front bezel overlay (header + M / C / P brass channel marks)
  const bezelCanvas = document.createElement('canvas');
  bezelCanvas.width = 1024;
  bezelCanvas.height = 738;
  const bctx = bezelCanvas.getContext('2d');
  bctx.clearRect(0, 0, 1024, 738);

  // Top quiet Solari header
  bctx.fillStyle = 'rgba(228, 224, 214, 0.72)';
  bctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
  bctx.textBaseline = 'middle';
  bctx.textAlign = 'left';
  bctx.fillText('MCP  ·  DESTINATION BLIND', 142, 46);
  bctx.textAlign = 'right';
  bctx.fillStyle = 'rgba(228, 224, 214, 0.44)';
  bctx.font = '500 18px "JetBrains Mono", ui-monospace, monospace';
  bctx.fillText('SPLIT-FLAP  03-ROW', 962, 46);

  // Left-rail M / C / P engraved markers centered vertically with each row
  // Case height in Blender: 3.36, plane height: 3.26 centered at z=1.82 -> top=3.45, bot=0.19
  const letters = ['M', 'C', 'P'];
  ROW_YS.forEach((ry, idx) => {
    const ty = (3.45 - ry) / 3.26;
    const py = ty * 738;
    // Small brass-toned square index badge
    bctx.strokeStyle = 'rgba(216, 186, 118, 0.65)';
    bctx.lineWidth = 2.5;
    bctx.strokeRect(36, py - 24, 48, 48);
    bctx.fillStyle = 'rgba(240, 232, 214, 0.90)';
    bctx.font = '600 30px "JetBrains Mono", ui-monospace, monospace';
    bctx.textAlign = 'center';
    bctx.fillText(letters[idx], 60, py + 2);
  });

  const bezelTex = new THREE.CanvasTexture(bezelCanvas);
  bezelTex.flipY = false;
  bezelTex.colorSpace = THREE.SRGBColorSpace;
  bezelTex.anisotropy = 8;

  root.traverse((obj) => {
    if (obj.name.startsWith('FlapAxle_')) {
      obj.position.z = FLAP_Z - 0.024;
    } else if (obj.name.startsWith('FlapBushing')) {
      obj.position.z = FLAP_Z + 0.002;
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'SolariFoldedSteel') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16171a,
        metalness: 0.22,
        roughness: 0.68,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0032,
        clearcoat: 0.0,
      });
    } else if (matName === 'SolariCavity') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x060708,
        metalness: 0.04,
        roughness: 0.94,
      });
    } else if (matName === 'SolariChrome') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd8dce2,
        metalness: 0.96,
        roughness: 0.20,
        envMapIntensity: 1.25,
      });
    } else if (matName === 'SolariBrass') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xc8a458,
        metalness: 0.90,
        roughness: 0.28,
      });
    } else if (matName === 'SolariBezelDecal') {
      obj.material = new THREE.MeshBasicMaterial({
        map: bezelTex,
        transparent: true,
        depthWrite: false,
      });
      obj.castShadow = false;
    }
  });

  // Grounded AO shadow beneath folded-steel Solari departure housing
  const caseAo = createContactShadow(5.4, 2.2, theme === 'dark' ? 0.72 : 0.32, 0.002);
  scene.add(caseAo);

  // Offscreen high-DPI full-flap composer (1024 x 256) sliced cleanly into top & bottom PVC blade textures
  const fullCardCanvas = document.createElement('canvas');
  fullCardCanvas.width = 1024;
  fullCardCanvas.height = 256;
  const fullCtx = fullCardCanvas.getContext('2d');

  function renderFullCard(word) {
    const w = fullCardCanvas.width;
    const h = fullCardCanvas.height;
    const text = word.replace(/,$/, '').toUpperCase();

    // Rich satin-matte black Solari PVC blade
    fullCtx.fillStyle = '#141518';
    fullCtx.fillRect(0, 0, w, h);

    // Subtle matte PVC sheen gradient across top & bottom halves
    const gTop = fullCtx.createLinearGradient(0, 0, 0, h * 0.5);
    gTop.addColorStop(0, 'rgba(255,255,255,0.045)');
    gTop.addColorStop(1, 'rgba(0,0,0,0.08)');
    fullCtx.fillStyle = gTop;
    fullCtx.fillRect(0, 0, w, h * 0.5);

    const gBot = fullCtx.createLinearGradient(0, h * 0.5, 0, h);
    gBot.addColorStop(0, 'rgba(0,0,0,0.12)');
    gBot.addColorStop(1, 'rgba(255,255,255,0.02)');
    fullCtx.fillStyle = gBot;
    fullCtx.fillRect(0, h * 0.5, w, h * 0.5);

    // Crisp warm-ivory Solari silk-screened condensed grotesque lettering
    const maxW = w - 120;
    let fontSize = 152;
    while (fontSize > 64) {
      fullCtx.font = `600 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      if (fullCtx.measureText(text).width <= maxW) break;
      fontSize -= 4;
    }

    fullCtx.fillStyle = '#F3EFE4';
    fullCtx.font = `600 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`;
    fullCtx.textAlign = 'left';
    fullCtx.textBaseline = 'middle';
    fullCtx.fillText(text, 56, h * 0.5 + 4);

    // Subtle mechanical side hinge cutouts at center seam
    fullCtx.fillStyle = '#060708';
    fullCtx.fillRect(0, h * 0.5 - 16, 20, 32);
    fullCtx.fillRect(w - 20, h * 0.5 - 16, 20, 32);
  }

  function createHalfTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 12;
    return { canvas: c, ctx, tex };
  }

  function paintHalf(target, word, isTop) {
    renderFullCard(word);
    target.ctx.clearRect(0, 0, 1024, 128);
    target.ctx.drawImage(fullCardCanvas, 0, isTop ? 0 : 128, 1024, 128, 0, 0, 1024, 128);
    // Subtle dark hairline along the split edge
    target.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    target.ctx.fillRect(0, isTop ? 124 : 0, 1024, 4);
    target.tex.needsUpdate = true;
  }

  // Build 3 physical 3D split-flap row mechanisms
  const flapGeo = new THREE.PlaneGeometry(FLAP_W, HALF_H);
  const rows = ROW_YS.map((ry, idx) => {
    const group = new THREE.Group();
    group.position.set(FLAP_X, ry, FLAP_Z);
    scene.add(group);

    const topTex = createHalfTexture();
    const botTex = createHalfTexture();
    const flipFrontTex = createHalfTexture();
    const flipBackTex = createHalfTexture();

    const makeFlapMat = (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.58,
        metalness: 0.04,
      });

    // Static upper half (shows next word during flip, settled word at rest)
    const topMesh = new THREE.Mesh(flapGeo, makeFlapMat(topTex.tex));
    topMesh.position.set(0, HALF_H * 0.5 + GAP * 0.5, -0.012);
    group.add(topMesh);

    // Static lower half (shows current word until flipper completes)
    const botMesh = new THREE.Mesh(flapGeo, makeFlapMat(botTex.tex));
    botMesh.position.set(0, -(HALF_H * 0.5 + GAP * 0.5), -0.012);
    group.add(botMesh);

    // Rotating physical hinge pivot centered on the chrome axle
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0.0);
    group.add(pivot);

    // Front face of tumbling blade (upper half of outgoing word)
    const flipFront = new THREE.Mesh(flapGeo, makeFlapMat(flipFrontTex.tex));
    flipFront.position.set(0, HALF_H * 0.5 + GAP * 0.5, 0.004);
    pivot.add(flipFront);

    // Back face of tumbling blade (lower half of incoming word — upright after pivot rotates +PI!)
    const flipBack = new THREE.Mesh(flapGeo, makeFlapMat(flipBackTex.tex));
    flipBack.position.set(0, HALF_H * 0.5 + GAP * 0.5, -0.004);
    flipBack.rotation.x = Math.PI;
    pivot.add(flipBack);

    pivot.visible = false;

    return {
      idx,
      group,
      pivot,
      topTex,
      botTex,
      flipFrontTex,
      flipBackTex,
      currentWord: phraseStore.getState().cleanWords[idx],
      queue: [],
      flipping: false,
      flipProgress: 0,
      flipDuration: 0.085,
    };
  });

  function setRowSettled(row, word) {
    row.currentWord = word;
    row.queue = [];
    row.flipping = false;
    row.flipProgress = 0;
    row.pivot.visible = false;
    row.pivot.rotation.x = 0;
    paintHalf(row.topTex, word, true);
    paintHalf(row.botTex, word, false);
  }

  function startRowNextFlip(row) {
    if (!row.queue.length) {
      row.flipping = false;
      row.pivot.visible = false;
      return;
    }
    const nextWord = row.queue[0];
    row.flipping = true;
    row.flipProgress = 0;
    paintHalf(row.topTex, nextWord, true);
    paintHalf(row.botTex, row.currentWord, false);
    paintHalf(row.flipFrontTex, row.currentWord, true);
    paintHalf(row.flipBackTex, nextWord, false);
    row.pivot.rotation.x = 0;
    row.pivot.visible = true;
  }

  function clatterToWords(targetWords) {
    const stepsPerRow = [4, 7, 10];
    rows.forEach((row, idx) => {
      const pool = FLAP_POOL[idx];
      const steps = stepsPerRow[idx];
      const q = [];
      for (let s = 0; s < steps - 1; s++) {
        q.push(pool[(s + Math.floor(Math.random() * pool.length)) % pool.length]);
      }
      q.push(targetWords[idx]);
      row.queue = q;
      row.flipDuration = 0.072 + idx * 0.006;
      if (!row.flipping) {
        startRowNextFlip(row);
      }
    });
  }

  function rollNewDestination() {
    phraseStore.nextRandom({ source: 'destination-blind' });
    const nextWords = phraseStore.getState().cleanWords;
    clatterToWords(nextWords);
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    rollNewDestination();
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('pointerdown', onPointerDown);

  // Initialize settled words
  const initWords = phraseStore.getState().cleanWords;
  rows.forEach((row, idx) => setRowSettled(row, initWords[idx]));

  let currentTheme = theme;

  function stepAnimation(dt) {
    for (const row of rows) {
      if (!row.flipping) continue;
      row.flipProgress += dt / row.flipDuration;
      if (row.flipProgress >= 1.0) {
        const landed = row.queue.shift();
        row.currentWord = landed;
        paintHalf(row.botTex, landed, false);
        sound.playFlapClack(0.16);
        if (row.queue.length > 0) {
          startRowNextFlip(row);
        } else {
          row.flipping = false;
          row.pivot.visible = false;
          row.pivot.rotation.x = 0;
        }
      } else {
        // Gravity-accelerated split-flap fall curve
        const p = row.flipProgress;
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        row.pivot.rotation.x = eased * Math.PI;
      }
    }
  }

  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      if (meta.source === 'destination-blind') return;
      if (startSettled) {
        rows.forEach((row, idx) => setRowSettled(row, state.cleanWords[idx]));
      } else {
        clatterToWords(state.cleanWords);
      }
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      caseAo.material.opacity = nextTheme === 'dark' ? 0.72 : 0.32;
    },

    triggerPrimary() {
      rollNewDestination();
    },

    setSettled(settled) {
      if (settled) {
        const w = phraseStore.getState().cleanWords;
        rows.forEach((row, idx) => setRowSettled(row, w[idx]));
      }
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
      bezelTex.dispose();
      flapGeo.dispose();
      rows.forEach((row) => {
        row.topTex.tex.dispose();
        row.botTex.tex.dispose();
        row.flipFrontTex.tex.dispose();
        row.flipBackTex.tex.dispose();
      });
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}
