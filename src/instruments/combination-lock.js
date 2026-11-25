import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

const NEIGHBOR_WORDS = [
  ['MANUAL', 'MODEST', 'MAGICAL', 'MIDNIGHT', 'MUTUAL', 'MINIMUM', 'MELTED', 'MYSTIC'],
  ['COFFEE', 'CIRCUIT', 'CATALOG', 'CHASSIS', 'CABLES', 'CRISP', 'CLOUD', 'COMPASS'],
  ['PASTRY', 'PAYLOAD', 'PATTERN', 'PIGEONS', 'PORTAL', 'PARCEL', 'PROTOCOL', 'POCKET'],
];

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = createStudioScene(theme, '#ba9b68');

  // Elevated overhead studio macro framing the full padlock (U-shackle + 3 word tumblers + end cap)
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 50);
  camera.position.set(-0.64, 16.0, 4.96);
  camera.lookAt(-0.22, 0.86, 0.0);
  camera.rotateZ(THREE.MathUtils.degToRad(-13));

  const root = await studio.loadGLB('./assets/models/combination-lock.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();

  // Three circumferential tumbler textures (512 width x 2048 circumference)
  const drumTextures = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 2048;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return { canvas: c, ctx, tex };
  });

  const rings = [null, null, null];
  let shackleRoot = null;
  let shackleBaseX = 0;

  root.traverse((obj) => {
    for (let i = 0; i < 3; i++) {
      if (obj.name === `TumblerRing${i}`) rings[i] = obj;
    }
    if (obj.name === 'ShackleRoot') {
      shackleRoot = obj;
      shackleBaseX = obj.position.x;
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'LockBrushedSteel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd0d4da,
        metalness: 0.94,
        roughness: 0.25,
        envMapIntensity: 1.2,
      });
    } else if (matName === 'LockChromeShackle') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xe6e9ee,
        metalness: 0.98,
        roughness: 0.13,
        envMapIntensity: 1.35,
      });
    } else if (matName === 'LockBrassTrim') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xc9a34e,
        metalness: 0.92,
        roughness: 0.24,
        envMapIntensity: 1.2,
      });
    } else if (matName === 'LockAnodizedCap') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16171a,
        metalness: 0.22,
        roughness: 0.68,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0032,
        clearcoat: 0.0,
      });
    } else if (matName.startsWith('TumblerDrum')) {
      const idx = Number(matName.replace('TumblerDrum', '')) || 0;
      obj.material = new THREE.MeshPhysicalMaterial({
        map: drumTextures[idx].tex,
        metalness: 0.22,
        roughness: 0.56,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0022,
        clearcoat: 0.0,
      });
    }
  });

  const lockAo = createContactShadow(6.8, 2.35, theme === 'dark' ? 0.72 : 0.34, 0.002);
  lockAo.position.set(0.0, 0.002, 0.0);
  scene.add(lockAo);

  let currentState = phraseStore.getState();

  function drawTumblers() {
    const words = currentState.cleanWords.map((w) => w.replace(/,$/, '').toUpperCase());
    const letters = ['M', 'C', 'P'];

    // Uniform optical sizing across all 3 rings so words look calibrated
    const testCtx = drumTextures[0].ctx;
    let mainFontSize = 90;
    while (mainFontSize > 40) {
      testCtx.font = `600 ${mainFontSize}px "JetBrains Mono", ui-monospace, monospace`;
      const widest = Math.max(...words.map((txt) => testCtx.measureText(txt).width));
      if (widest <= 415) break;
      mainFontSize -= 3;
    }

    words.forEach((word, idx) => {
      const { ctx, canvas: c, tex } = drumTextures[idx];
      const w = c.width;
      const h = c.height;

      // Matte anodized obsidian tumbler cylinder substrate
      ctx.fillStyle = '#17191D';
      ctx.fillRect(0, 0, w, h);

      // 10 circumferential slots around cylinder; slot 5 lands dead-center on y = 1024 (v = 0.5, exact top crown!)
      const slots = 10;
      const slotH = h / slots;
      const pool = NEIGHBOR_WORDS[idx];

      for (let s = 0; s < slots; s++) {
        const cy = (s + 0.5) * slotH;
        const isActive = s === 5;
        const label = isActive ? word : pool[s % pool.length];

        // Subtle machined circumferential detent groove separating slots
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, s * slotH, w, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(0, s * slotH + 4, w, 2);

        // Subtle machined slot accent band behind the active word
        if (isActive) {
          ctx.fillStyle = 'rgba(205, 168, 86, 0.14)';
          ctx.fillRect(28, cy - slotH * 0.36, w - 56, slotH * 0.72);
          ctx.strokeStyle = 'rgba(205, 168, 86, 0.45)';
          ctx.lineWidth = 3;
          ctx.strokeRect(28, cy - slotH * 0.36, w - 56, slotH * 0.72);

          // Small brass key tag (M / C / P) top-center of active slot
          ctx.fillStyle = '#E0B962';
          ctx.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letters[idx], w * 0.5, cy - 52);
        }

        // Engraved silk-screened word on cylinder face
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isActive) {
          ctx.fillStyle = '#F5F0E4';
          ctx.font = `600 ${mainFontSize}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.fillText(label, w * 0.5, cy + 16);
        } else {
          // Slightly dimmer etched neighbor words curving around the drum
          let nf = 64;
          while (nf > 34) {
            ctx.font = `500 ${nf}px "JetBrains Mono", ui-monospace, monospace`;
            if (ctx.measureText(label).width <= 380) break;
            nf -= 3;
          }
          ctx.fillStyle = 'rgba(230, 224, 210, 0.44)';
          ctx.fillText(label, w * 0.5, cy);
        }
      }

      tex.needsUpdate = true;
    });
  }

  // Interaction state: unlocked shackle popped cleanly open at rest on a valid combination
  // Slot 5 sits at v = 0.55 -> rotating by -0.1*PI aligns it dead-center between the brass sight bars
  const BASE_ROT_X = -Math.PI * 0.1;
  const UNLOCKED_SHACKLE_X = -0.34;
  let isUnlocked = true;
  let shackleOffset = startSettled ? UNLOCKED_SHACKLE_X : UNLOCKED_SHACKLE_X;
  let shackleVel = 0;
  let animPhase = 'idle'; // 'idle' | 'dialing'
  let animTime = 0;
  const ringAngles = [BASE_ROT_X, BASE_ROT_X, BASE_ROT_X];
  const ringStarts = [BASE_ROT_X, BASE_ROT_X, BASE_ROT_X];
  const ringTargets = [BASE_ROT_X, BASE_ROT_X, BASE_ROT_X];
  let lastDetent = -1;
  let swappedPhrase = false;

  function triggerDial() {
    if (animPhase === 'dialing') return;
    animPhase = 'dialing';
    animTime = 0;
    lastDetent = -1;
    swappedPhrase = false;
    isUnlocked = false;
    sound.playUsbPlug();

    // Rotate each ring by 1 full turn (2*pi) + staggered direction so they visibly tumble & align cleanly back to BASE_ROT_X
    for (let i = 0; i < 3; i++) {
      ringStarts[i] = ringAngles[i];
      ringTargets[i] = ringAngles[i] + (i % 2 === 0 ? 1 : -1) * Math.PI * 2.0;
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    triggerDial();
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('pointerdown', onPointerDown);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (animPhase === 'dialing') {
      animTime += dt;
      const total = 1.05;
      const t = Math.min(1.0, animTime / total);

      const tickBucket = Math.floor(t * 9);
      if (tickBucket !== lastDetent && tickBucket < 9) {
        lastDetent = tickBucket;
        sound.playMechanicalDetent(0.92 + tickBucket * 0.04, 0.17);
      }

      if (t >= 0.45 && !swappedPhrase) {
        swappedPhrase = true;
        phraseStore.nextRandom({ source: 'combination-lock' });
        currentState = phraseStore.getState();
        drawTumblers();
      }

      // Staggered ease-out settling for M → C → P rings
      for (let i = 0; i < 3; i++) {
        const endT = 0.68 + i * 0.14;
        const rt = Math.min(1.0, t / endT);
        const ease = 1.0 - Math.pow(1.0 - rt, 3);
        ringAngles[i] = ringStarts[i] + (ringTargets[i] - ringStarts[i]) * ease;
      }

      if (t >= 1.0) {
        animPhase = 'idle';
        for (let i = 0; i < 3; i++) {
          ringAngles[i] = BASE_ROT_X;
        }
        isUnlocked = true;
        sound.playSteelClack(0.55);
      }
    }

    // Spring shackle open when unlocked, shut (0.0) when dialing
    const targetShackle = isUnlocked ? UNLOCKED_SHACKLE_X : 0.0;
    const force = (targetShackle - shackleOffset) * 280 - shackleVel * 20;
    shackleVel += force * dt;
    shackleOffset += shackleVel * dt;
    if (Math.abs(targetShackle - shackleOffset) < 0.001 && Math.abs(shackleVel) < 0.004) {
      shackleOffset = targetShackle;
      shackleVel = 0;
    }

    if (shackleRoot) {
      shackleRoot.position.x = shackleBaseX + shackleOffset;
    }
    for (let i = 0; i < 3; i++) {
      if (rings[i]) rings[i].rotation.x = ringAngles[i];
    }
  }

  if (shackleRoot) shackleRoot.position.x = shackleBaseX + shackleOffset;
  for (let i = 0; i < 3; i++) {
    if (rings[i]) rings[i].rotation.x = BASE_ROT_X;
  }
  drawTumblers();
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'combination-lock') return;
      drawTumblers();
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      lockAo.material.opacity = nextTheme === 'dark' ? 0.72 : 0.34;
    },

    triggerPrimary() {
      triggerDial();
    },

    setSettled(settled) {
      animPhase = 'idle';
      isUnlocked = Boolean(settled);
      shackleOffset = isUnlocked ? UNLOCKED_SHACKLE_X : 0.0;
      shackleVel = 0;
      for (let i = 0; i < 3; i++) {
        ringAngles[i] = BASE_ROT_X;
        if (rings[i]) rings[i].rotation.x = BASE_ROT_X;
      }
      if (shackleRoot) shackleRoot.position.x = shackleBaseX + shackleOffset;
      drawTumblers();
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
      drumTextures.forEach((d) => d.tex.dispose());
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
