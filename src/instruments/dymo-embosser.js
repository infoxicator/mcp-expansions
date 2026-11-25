import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = createStudioScene(theme, '#8baca0');

  // Macro overhead studio flat-lay framing the vintage cast-metal Dymo wheel on the left & 3 glossy embossed strips on the right
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 45);
  camera.position.set(0.22, 13.85, 4.34);
  camera.lookAt(0.02, 0.22, 0.08);
  camera.rotateZ(THREE.MathUtils.degToRad(-6));

  const root = await studio.loadGLB('./assets/models/dymo-embosser.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();

  // 1. Circular embossed alphabet dial face texture (512 x 512)
  const wheelCanvas = document.createElement('canvas');
  wheelCanvas.width = 512;
  wheelCanvas.height = 512;
  const wctx = wheelCanvas.getContext('2d');
  wctx.clearRect(0, 0, 512, 512);

  // Subtle concentric machined groove rings
  wctx.strokeStyle = 'rgba(225, 222, 214, 0.18)';
  wctx.lineWidth = 2;
  wctx.beginPath();
  wctx.arc(256, 256, 232, 0, Math.PI * 2);
  wctx.stroke();
  wctx.beginPath();
  wctx.arc(256, 256, 168, 0, Math.PI * 2);
  wctx.stroke();

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  chars.forEach((ch, idx) => {
    const ang = (idx / chars.length) * Math.PI * 2;
    const isMCP = ch === 'M' || ch === 'C' || ch === 'P';
    wctx.save();
    wctx.translate(256, 256);
    wctx.rotate(ang);
    wctx.fillStyle = isMCP ? '#E5BC68' : 'rgba(232, 228, 220, 0.78)';
    wctx.font = isMCP
      ? '700 22px "JetBrains Mono", ui-monospace, monospace'
      : '500 18px "JetBrains Mono", ui-monospace, monospace';
    wctx.textAlign = 'center';
    wctx.textBaseline = 'middle';
    wctx.fillText(ch, 200, 0);
    wctx.restore();
  });

  // Inner subtle brand legend ring
  wctx.fillStyle = 'rgba(225, 222, 214, 0.44)';
  wctx.font = '600 16px "JetBrains Mono", ui-monospace, monospace';
  wctx.textAlign = 'center';
  wctx.fillText('TAPEWRITER', 256, 134);
  wctx.fillText('M · C · P', 256, 384);

  const wheelTex = new THREE.CanvasTexture(wheelCanvas);
  wheelTex.flipY = false;
  wheelTex.colorSpace = THREE.SRGBColorSpace;
  wheelTex.anisotropy = 8;

  // 2. Three glossy embossed PVC Dymo label strip textures (albedo + real bumpMap!)
  const stripsData = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 184;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;

    const bc = document.createElement('canvas');
    bc.width = 1024;
    bc.height = 184;
    const bctx = bc.getContext('2d');
    const btex = new THREE.CanvasTexture(bc);
    btex.flipY = false;
    btex.anisotropy = 8;

    return { canvas: c, ctx, tex, bumpCanvas: bc, bumpCtx: bctx, bumpTex: btex };
  });

  let embossWheel = null;
  let triggerLever = null;
  const stripRoots = [null, null, null];
  const stripBaseX = [0, 0, 0];

  root.traverse((obj) => {
    if (obj.name === 'EmbossWheel') embossWheel = obj;
    if (obj.name === 'TriggerLever') triggerLever = obj;
    for (let i = 0; i < 3; i++) {
      if (obj.name === `DymoStrip${i}`) {
        stripRoots[i] = obj;
        stripBaseX[i] = obj.position.x;
      }
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'DymoMatteBlack') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16171a,
        metalness: 0.16,
        roughness: 0.70,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0036,
        clearcoat: 0.0,
      });
    } else if (matName === 'DymoChrome') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd8dce2,
        metalness: 0.96,
        roughness: 0.19,
        envMapIntensity: 1.25,
      });
    } else if (matName === 'DymoWheelCharcoal') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x1d1f24,
        metalness: 0.18,
        roughness: 0.50,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0024,
      });
    } else if (matName === 'DymoBrassPointer') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xcba64e,
        metalness: 0.92,
        roughness: 0.24,
      });
    } else if (matName === 'DymoWheelDecal') {
      obj.material = new THREE.MeshBasicMaterial({
        map: wheelTex,
        transparent: true,
        depthWrite: false,
      });
      obj.castShadow = false;
    } else if (matName === 'DymoVinylBase') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x101216,
        metalness: 0.0,
        roughness: 0.22,
        clearcoat: 0.88,
        clearcoatRoughness: 0.14,
      });
    } else if (matName.startsWith('DymoStripFace')) {
      const idx = Number(matName.replace('DymoStripFace', '')) || 0;
      obj.material = new THREE.MeshPhysicalMaterial({
        map: stripsData[idx].tex,
        bumpMap: stripsData[idx].bumpTex,
        bumpScale: 0.022,
        metalness: 0.0,
        roughness: 0.32,
        clearcoat: 0.42,
        clearcoatRoughness: 0.24,
      });
      obj.castShadow = false;
    }
  });

  const bodyAo = createContactShadow(2.7, 3.2, theme === 'dark' ? 0.70 : 0.34, 0.002);
  bodyAo.position.set(-1.55, 0.002, 0.1);
  scene.add(bodyAo);

  const stripsAo = createContactShadow(3.6, 2.5, theme === 'dark' ? 0.52 : 0.22, 0.002);
  stripsAo.position.set(1.06, 0.002, 0.0);
  scene.add(stripsAo);

  let currentState = phraseStore.getState();

  function drawEmbossedStrips() {
    const words = currentState.cleanWords.map((w) => w.replace(/,$/, '').toUpperCase());
    const letters = ['M', 'C', 'P'];

    // Calibrated optical font size across all 3 Dymo strips
    const testCtx = stripsData[0].ctx;
    let fontSize = 96;
    while (fontSize > 44) {
      testCtx.font = `700 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      const widest = Math.max(...words.map((txt) => testCtx.measureText(txt).width));
      if (widest <= 740) break;
      fontSize -= 3;
    }

    words.forEach((word, idx) => {
      const { ctx, canvas: c, tex, bumpCtx: bctx, bumpCanvas: bc, bumpTex } = stripsData[idx];
      const w = c.width;
      const h = c.height;

      // Glossy jet-black PVC Dymo vinyl substrate with subtle longitudinal extrusion sheen
      ctx.fillStyle = '#0F1115';
      ctx.fillRect(0, 0, w, h);
      const sheen = ctx.createLinearGradient(0, 0, 0, h);
      sheen.addColorStop(0.0, 'rgba(255,255,255,0.08)');
      sheen.addColorStop(0.18, 'rgba(255,255,255,0.0)');
      sheen.addColorStop(0.84, 'rgba(0,0,0,0.0)');
      sheen.addColorStop(1.0, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      // Subtle glossy horizontal embossing rail edges
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(14, 12, w - 28, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(14, h - 14, w - 28, 2);

      // Neutral mid-grey bump background
      bctx.fillStyle = '#404040';
      bctx.fillRect(0, 0, bc.width, bc.height);

      // Draw embossed character helper (white cold-stressed vinyl + crisp 3D shadow/highlight + bump map!)
      const drawRaised = (text, x, y, font, align = 'left') => {
        ctx.save();
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillText(text, x + 3, y + 4);
        ctx.strokeStyle = 'rgba(215, 218, 224, 0.34)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = '#F2F3F5';
        ctx.fillText(text, x, y);
        ctx.restore();

        bctx.save();
        bctx.font = font;
        bctx.textAlign = align;
        bctx.textBaseline = 'middle';
        bctx.fillStyle = '#FFFFFF';
        bctx.fillText(text, x, y);
        bctx.restore();
      };

      // Left embossed channel notch (M / C / P) with clean vinyl margin past the cut gate
      drawRaised(letters[idx], 102, h * 0.52, '700 54px "JetBrains Mono", ui-monospace, monospace', 'center');
      ctx.fillStyle = 'rgba(242, 243, 245, 0.35)';
      ctx.fillRect(150, 44, 4, h - 88);
      bctx.fillStyle = '#C8C8C8';
      bctx.fillRect(150, 44, 4, h - 88);

      // Bold embossed word across the glossy strip
      drawRaised(word, 184, h * 0.52, `700 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`, 'left');

      // Right-end subtle Dymo tear-tab alignment dot
      ctx.fillStyle = 'rgba(242, 243, 245, 0.28)';
      ctx.beginPath();
      ctx.arc(w - 38, h * 0.5, 6, 0, Math.PI * 2);
      ctx.fill();

      tex.needsUpdate = true;
      bumpTex.needsUpdate = true;
    });
  }

  // Interaction state
  let animPhase = 'idle'; // 'idle' | 'embossing'
  let animTime = 0;
  let wheelAngle = 0.2;
  let wheelTarget = 0.2;
  let lastClickBucket = -1;
  let swappedPhrase = false;

  function triggerEmboss() {
    if (animPhase === 'embossing') return;
    animPhase = 'embossing';
    animTime = 0;
    lastClickBucket = -1;
    swappedPhrase = false;
    wheelTarget += Math.PI * 1.45;
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    triggerEmboss();
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('pointerdown', onPointerDown);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (animPhase === 'embossing') {
      animTime += dt;
      const total = 0.92;
      const t = Math.min(1.0, animTime / total);

      // Mechanical ratchet clicks as scalloped character wheel turns & punches
      const bucket = Math.floor(t * 6);
      if (bucket !== lastClickBucket && bucket < 6) {
        lastClickBucket = bucket;
        sound.playMechanicalDetent(1.02 + bucket * 0.06, 0.20);
      }

      // Chrome trigger lever squeezes 3 rhythmic times (for M, C, P)
      if (triggerLever) {
        const squeeze = Math.max(0, Math.sin(t * Math.PI * 3.0));
        triggerLever.rotation.y = squeeze * 0.24;
      }

      // Freshly embossed strips slide briskly out from the chrome exit nozzle
      if (t >= 0.35 && !swappedPhrase) {
        swappedPhrase = true;
        phraseStore.nextRandom({ source: 'dymo-embosser' });
        currentState = phraseStore.getState();
        drawEmbossedStrips();
      }

      const feedSlide = t < 0.35 ? -(t / 0.35) * 0.42 : -0.42 * (1.0 - (t - 0.35) / 0.65);
      stripRoots.forEach((sr, idx) => {
        if (sr) sr.position.x = stripBaseX[idx] + feedSlide * (0.85 + idx * 0.12);
      });

      if (t >= 1.0) {
        animPhase = 'idle';
        if (triggerLever) triggerLever.rotation.y = 0;
        stripRoots.forEach((sr, idx) => {
          if (sr) sr.position.x = stripBaseX[idx];
        });
      }
    }

    const follow = 1 - Math.exp(-8.5 * dt);
    wheelAngle += (wheelTarget - wheelAngle) * follow;
    if (embossWheel) embossWheel.rotation.y = wheelAngle;
  }

  drawEmbossedStrips();
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'dymo-embosser') return;
      drawEmbossedStrips();
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      bodyAo.material.opacity = nextTheme === 'dark' ? 0.70 : 0.34;
      stripsAo.material.opacity = nextTheme === 'dark' ? 0.52 : 0.22;
    },

    triggerPrimary() {
      triggerEmboss();
    },

    setSettled() {
      animPhase = 'idle';
      if (triggerLever) triggerLever.rotation.y = 0;
      stripRoots.forEach((sr, idx) => {
        if (sr) sr.position.x = stripBaseX[idx];
      });
      drawEmbossedStrips();
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
      wheelTex.dispose();
      stripsData.forEach((s) => {
        s.tex.dispose();
        s.bumpTex.dispose();
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
