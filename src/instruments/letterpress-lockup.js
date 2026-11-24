import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = createStudioScene(theme);

  // Overhead studio flat-lay framing the blued-steel chase lockup on the left + 600gsm cotton proof on the right
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 45);
  camera.position.set(0.0, 13.6, 3.6);
  camera.lookAt(0.0, 0.18, 0.0);

  const root = await studio.loadGLB('./assets/models/letterpress-lockup.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();

  // 1. Mirrored cast-lead slug face textures (512 x 174)
  const slugTextures = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 174;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 12;
    return { canvas: c, ctx, tex };
  });

  // 2. 600gsm warm cotton-rag letterpress proof sheet (1024 x 1326 matching 2.50 x 3.24 aspect)
  const proofCanvas = document.createElement('canvas');
  proofCanvas.width = 1024;
  proofCanvas.height = 1326;
  const pctx = proofCanvas.getContext('2d');
  const proofTex = new THREE.CanvasTexture(proofCanvas);
  proofTex.flipY = false;
  proofTex.colorSpace = THREE.SRGBColorSpace;
  proofTex.anisotropy = 16;

  // Pre-bake warm cotton rag stock texture with subtle fine deckle fiber speckles
  const cottonBase = document.createElement('canvas');
  cottonBase.width = 1024;
  cottonBase.height = 1326;
  const cbctx = cottonBase.getContext('2d');
  cbctx.fillStyle = '#EAE2D2';
  cbctx.fillRect(0, 0, 1024, 1326);
  let seed = 8817;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 6500; i++) {
    const x = rand() * 1024;
    const y = rand() * 1326;
    const r = 0.8 + rand() * 2.0;
    cbctx.fillStyle = rand() > 0.5 ? 'rgba(96, 82, 62, 0.055)' : 'rgba(255, 253, 246, 0.08)';
    cbctx.fillRect(x, y, r, r);
  }
  // Crisp outer cotton card edge bevel shadow
  cbctx.strokeStyle = 'rgba(72, 60, 46, 0.22)';
  cbctx.lineWidth = 4;
  cbctx.strokeRect(2, 2, 1020, 1322);

  // Subtle wood grain canvas for cherry furniture blocks
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#6A3B21';
  wctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = 0.06 + (Math.sin(y * 0.22) * 0.5 + 0.5) * 0.09;
    wctx.fillStyle = y % 4 === 0 ? `rgba(28, 12, 5, ${v})` : `rgba(145, 88, 48, ${v * 0.8})`;
    wctx.fillRect(0, y, 256, 2);
  }
  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;

  const quoins = [null, null];
  const slugs = [null, null, null];
  const slugBaseX = [0, 0, 0];
  let proofRoot = null;
  let proofBasePos = new THREE.Vector3();

  root.traverse((obj) => {
    if (obj.name === 'BrassQuoin0') quoins[0] = obj;
    if (obj.name === 'BrassQuoin1') quoins[1] = obj;
    for (let i = 0; i < 3; i++) {
      if (obj.name === `LeadSlug${i}`) {
        slugs[i] = obj;
        slugBaseX[i] = obj.position.x;
      }
    }
    if (obj.name === 'ProofSheetRoot') {
      proofRoot = obj;
      proofBasePos.copy(obj.position);
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'BluedSteelChase') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x1e2228,
        metalness: 0.68,
        roughness: 0.44,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.003,
      });
    } else if (matName === 'IronPressBed') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x101215,
        metalness: 0.30,
        roughness: 0.78,
      });
    } else if (matName === 'CherryFurniture') {
      obj.material = new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.56,
        metalness: 0.0,
      });
    } else if (matName === 'QuoinBrass') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xc8a24c,
        metalness: 0.92,
        roughness: 0.25,
        envMapIntensity: 1.2,
      });
    } else if (matName === 'CastLeadType') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x7a7e86,
        metalness: 0.86,
        roughness: 0.34,
      });
    } else if (matName.startsWith('LeadSlugFace')) {
      const idx = Number(matName.replace('LeadSlugFace', '')) || 0;
      obj.material = new THREE.MeshStandardMaterial({
        map: slugTextures[idx].tex,
        metalness: 0.62,
        roughness: 0.36,
      });
      obj.castShadow = false;
    } else if (matName === 'CottonProofSheet') {
      if (obj.name === 'CottonProofFace') {
        obj.material = new THREE.MeshStandardMaterial({
          map: proofTex,
          roughness: 0.92,
          metalness: 0.0,
        });
        obj.castShadow = false;
      } else {
        obj.material = new THREE.MeshStandardMaterial({
          color: 0xe6decb,
          roughness: 0.92,
          metalness: 0.0,
        });
      }
    }
  });

  const chaseAo = createContactShadow(3.15, 3.85, theme === 'dark' ? 0.70 : 0.34, 0.002);
  chaseAo.position.set(-1.42, 0.002, 0);
  scene.add(chaseAo);

  const proofAo = createContactShadow(2.95, 3.65, theme === 'dark' ? 0.45 : 0.20, 0.002);
  proofAo.position.set(1.42, 0.002, 0);
  scene.add(proofAo);

  let currentState = phraseStore.getState();

  function drawAllArtwork() {
    const words = currentState.words;
    const cleanUpper = currentState.cleanWords.map((w) => w.replace(/,$/, '').toUpperCase());

    // 1. Render mirrored inked metal type slugs inside the chase
    cleanUpper.forEach((word, idx) => {
      const { ctx, canvas: c, tex } = slugTextures[idx];
      ctx.fillStyle = '#565A62';
      ctx.fillRect(0, 0, c.width, c.height);

      // Machined horizontal lead slug shoulders
      ctx.fillStyle = '#3B3E45';
      ctx.fillRect(0, 0, c.width, 18);
      ctx.fillRect(0, c.height - 18, c.width, 18);

      // Mirrored raised inked letterpress relief
      let fontSize = 86;
      while (fontSize > 34) {
        ctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
        if (ctx.measureText(word).width <= c.width - 56) break;
        fontSize -= 3;
      }
      ctx.save();
      ctx.translate(c.width * 0.5, c.height * 0.54);
      ctx.scale(-1, 1); // Real letterpress metal type is mirrored!
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
      // Pewter cast relief shadow + wet black printer's ink top face
      ctx.fillStyle = '#A8AEB8';
      ctx.fillText(word, 2, 3);
      ctx.fillStyle = '#141518';
      ctx.fillText(word, 0, 0);
      ctx.restore();
      tex.needsUpdate = true;
    });

    // 2. Render crisp debossed 600gsm cotton letterpress proof sheet
    const w = proofCanvas.width;
    const h = proofCanvas.height;
    pctx.drawImage(cottonBase, 0, 0);

    // Subtle letterpress registration corner crop marks
    pctx.strokeStyle = 'rgba(28, 25, 22, 0.24)';
    pctx.lineWidth = 2;
    const m = 66;
    const tick = 22;
    [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ].forEach(([x, y, sx, sy]) => {
      pctx.beginPath();
      pctx.moveTo(x, y + sy * tick);
      pctx.lineTo(x, y);
      pctx.lineTo(x + sx * tick, y);
      pctx.stroke();
    });

    // Quiet colophon header in vermilion & charcoal
    const idxStr = currentState.isRemix
      ? 'REMIX'
      : `NO. ${String(currentState.index + 1).padStart(3, '0')}/${String(currentState.total).padStart(3, '0')}`;
    pctx.fillStyle = '#A8382B';
    pctx.font = '600 24px "JetBrains Mono", ui-monospace, monospace';
    pctx.textAlign = 'left';
    pctx.textBaseline = 'middle';
    pctx.fillText('PRESS PROOF', 106, 134);
    pctx.fillStyle = 'rgba(28, 25, 22, 0.56)';
    pctx.textAlign = 'right';
    pctx.fillText(idxStr, w - 106, 134);

    pctx.fillStyle = 'rgba(28, 25, 22, 0.22)';
    pctx.fillRect(106, 174, w - 212, 2);

    // Stacked Instrument Serif letterpress impression
    const maxW = w - 260;
    let fontSize = 180;
    while (fontSize > 76) {
      pctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
      const widest = Math.max(...words.map((txt) => pctx.measureText(txt).width));
      if (widest <= maxW) break;
      fontSize -= 6;
    }

    const rowYs = [426, 668, 910];
    const tags = ['M', 'C', 'P'];
    words.forEach((word, idx) => {
      const ry = rowYs[idx];
      // Clean vermilion initial index mark seated in left editorial gutter
      pctx.fillStyle = 'rgba(168, 56, 43, 0.78)';
      pctx.font = '600 24px "JetBrains Mono", ui-monospace, monospace';
      pctx.textAlign = 'left';
      pctx.fillText(tags[idx], 106, ry - 6);

      // Subtle debossed white highlight below stroke + rich letterpress carbon ink impression
      pctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
      pctx.textAlign = 'left';
      pctx.fillStyle = 'rgba(255, 252, 245, 0.72)';
      pctx.fillText(word, 162, ry + 3);
      pctx.fillStyle = '#181615';
      pctx.fillText(word, 160, ry);
    });

    // Bottom quiet foundry colophon
    pctx.fillStyle = 'rgba(28, 25, 22, 0.22)';
    pctx.fillRect(106, h - 180, w - 212, 2);
    pctx.fillStyle = 'rgba(28, 25, 22, 0.56)';
    pctx.font = '500 20px "JetBrains Mono", ui-monospace, monospace';
    pctx.textAlign = 'left';
    pctx.fillText('18PT LEAD LOCKUP  ·  600GSM COTTON', 106, h - 134);
    pctx.textAlign = 'right';
    pctx.fillStyle = '#A8382B';
    pctx.fillText('M·C·P', w - 106, h - 134);

    proofTex.needsUpdate = true;
  }

  // Interactive lockup cycle animation
  let animPhase = 'idle'; // 'idle' | 'locking'
  let animTime = 0;
  let swappedPhrase = false;

  function triggerLockup() {
    if (animPhase === 'locking') return;
    animPhase = 'locking';
    animTime = 0;
    swappedPhrase = false;
    sound.playMechanicalDetent(0.92, 0.22);
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    triggerLockup();
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('pointerdown', onPointerDown);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (animPhase === 'locking') {
      animTime += dt;
      const total = 0.86;
      const t = Math.min(1.0, animTime / total);

      // Brass quoins twist open & clamp shut
      const quoinRot = Math.sin(t * Math.PI) * 0.42;
      quoins.forEach((q, idx) => {
        if (q) q.rotation.y = (idx === 0 ? 1 : -1) * quoinRot;
      });

      // Lead slugs loosen briefly then lock back tight
      const slugShift = Math.sin(t * Math.PI) * 0.14;
      slugs.forEach((s, idx) => {
        if (s) s.position.x = slugBaseX[idx] - slugShift * (0.7 + idx * 0.2);
      });

      // Proof sheet lifts/slides smoothly out & in with the fresh impression
      const sheetOut = Math.sin(t * Math.PI);
      if (proofRoot) {
        proofRoot.position.set(
          proofBasePos.x + sheetOut * 0.48,
          proofBasePos.y + sheetOut * 0.08,
          proofBasePos.z + sheetOut * 0.18
        );
        proofRoot.rotation.y = -sheetOut * 0.06;
      }

      if (t >= 0.48 && !swappedPhrase) {
        swappedPhrase = true;
        phraseStore.nextRandom({ source: 'letterpress-lockup' });
        currentState = phraseStore.getState();
        drawAllArtwork();
        sound.playSteelClack(0.45);
      }

      if (t >= 1.0) {
        animPhase = 'idle';
        quoins.forEach((q) => { if (q) q.rotation.y = 0; });
        slugs.forEach((s, idx) => { if (s) s.position.x = slugBaseX[idx]; });
        if (proofRoot) {
          proofRoot.position.copy(proofBasePos);
          proofRoot.rotation.y = 0;
        }
      }
    }
  }

  drawAllArtwork();
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'letterpress-lockup') return;
      drawAllArtwork();
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      chaseAo.material.opacity = nextTheme === 'dark' ? 0.70 : 0.34;
      proofAo.material.opacity = nextTheme === 'dark' ? 0.45 : 0.20;
    },

    triggerPrimary() {
      triggerLockup();
    },

    setSettled() {
      animPhase = 'idle';
      if (proofRoot) {
        proofRoot.position.copy(proofBasePos);
        proofRoot.rotation.y = 0;
      }
      drawAllArtwork();
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
      proofTex.dispose();
      woodTex.dispose();
      slugTextures.forEach((s) => s.tex.dispose());
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
