import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = await createStudioScene(theme, 'mechanical-typewriter');

  // Elevated 3/4 overhead studio macro framing the full typewriter deck, carriage knobs & cotton bond sheet
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 55);
  camera.position.set(1.10, 13.25, 8.95);
  camera.lookAt(0.0, 0.72, 0.05);
  camera.rotateZ(THREE.MathUtils.degToRad(3));

  const root = await studio.loadGLB('./assets/models/mechanical-typewriter.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();

  // Archival cream cotton paper texture (1024x1024, flipY=false -> v=0 top of paper, v=1 platen wrap)
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 1024;
  paperCanvas.height = 1024;
  const paperCtx = paperCanvas.getContext('2d');
  const paperTex = new THREE.CanvasTexture(paperCanvas);
  paperTex.flipY = false;
  paperTex.colorSpace = THREE.SRGBColorSpace;
  paperTex.anisotropy = 16;

  // Pre-bake subtle cotton bond fiber grain onto offscreen canvas for fast redraws while typing
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 1024;
  grainCanvas.height = 1024;
  const gCtx = grainCanvas.getContext('2d');
  gCtx.fillStyle = '#EFE8D8';
  gCtx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 6500; i++) {
    const gx = (i * 197.3) % 1024;
    const gy = (i * 431.7) % 1024;
    gCtx.fillStyle = i % 2 === 0 ? 'rgba(92, 74, 52, 0.042)' : 'rgba(255, 255, 255, 0.07)';
    gCtx.fillRect(gx, gy, 2 + (i % 3), 1);
  }
  // Subtle cream vignette toward platen edge (bottom of canvas)
  const platenShade = gCtx.createLinearGradient(0, 740, 0, 1024);
  platenShade.addColorStop(0, 'rgba(30, 24, 18, 0.0)');
  platenShade.addColorStop(1, 'rgba(30, 24, 18, 0.18)');
  gCtx.fillStyle = platenShade;
  gCtx.fillRect(0, 740, 1024, 284);

  // Three circular concave keycap textures (M, C, P)
  const keyLetters = ['M', 'C', 'P'];
  const keyTextures = keyLetters.map((letter) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 118, 12, 128, 128, 122);
    grad.addColorStop(0, '#23262C');
    grad.addColorStop(0.76, '#15171B');
    grad.addColorStop(1, '#0C0D10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128, 128, 106, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F5F0E4';
    ctx.font = '600 132px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 128, 134);

    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  });

  let carriageRoot = null;
  let activeTypebar = null;
  const keyNodes = [null, null, null];
  const keyBaseY = [0, 0, 0];

  root.traverse((obj) => {
    if (obj.name === 'CarriageRoot') carriageRoot = obj;
    if (obj.name === 'ActiveTypebarPivot') activeTypebar = obj;
    for (let i = 0; i < 3; i++) {
      if (obj.name === `TypeKey${i}`) {
        keyNodes[i] = obj;
        keyBaseY[i] = obj.position.y;
      }
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'TypeChassisMatte') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16171a,
        metalness: 0.18,
        roughness: 0.72,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0035,
        clearcoat: 0.0,
      });
    } else if (matName === 'TypeRubberPlaten') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x111215,
        metalness: 0.02,
        roughness: 0.88,
        roughnessMap: anodizedTex,
      });
    } else if (matName === 'TypeBrushedChrome') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xe3e6eb,
        metalness: 0.96,
        roughness: 0.16,
        envMapIntensity: 1.3,
      });
    } else if (matName === 'TypeMachinedSteel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xbcc1c8,
        metalness: 0.92,
        roughness: 0.28,
        envMapIntensity: 1.15,
      });
    } else if (matName === 'TypeBrassAccent') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xc9a34e,
        metalness: 0.92,
        roughness: 0.24,
        envMapIntensity: 1.2,
      });
    } else if (matName === 'TypeVermilionFelt') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x9e231c,
        metalness: 0.04,
        roughness: 0.84,
      });
    } else if (matName === 'TypePaperSheet') {
      obj.material = new THREE.MeshStandardMaterial({
        map: paperTex,
        metalness: 0.0,
        roughness: 0.92,
      });
    } else if (matName.startsWith('TypeKeyCap')) {
      const idx = Number(matName.replace('TypeKeyCap', '')) || 0;
      obj.material = new THREE.MeshPhysicalMaterial({
        map: keyTextures[idx],
        metalness: 0.08,
        roughness: 0.42,
        clearcoat: 0.15,
        clearcoatRoughness: 0.35,
      });
    }
  });

  const deckAo = createContactShadow(6.4, 4.4, theme === 'dark' ? 0.72 : 0.34, 0.002);
  deckAo.position.set(0.0, 0.002, 0.58);
  scene.add(deckAo);

  let currentState = phraseStore.getState();

  function drawPaper(visibleCount = null) {
    const ctx = paperCtx;
    ctx.drawImage(grainCanvas, 0, 0);

    // Archival top margin header
    ctx.fillStyle = '#5F584E';
    ctx.font = '600 24px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MCP · ARCHIVE FOLIO 012', 102, 92);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#A82A22';
    ctx.fillText('LETTERA · PICA 10', 922, 92);

    // Crisp vermilion-ink ledger header rule
    ctx.strokeStyle = 'rgba(168, 42, 34, 0.64)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(102, 126);
    ctx.lineTo(922, 126);
    ctx.stroke();

    // Vertical margin guide line
    ctx.strokeStyle = 'rgba(168, 42, 34, 0.30)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(192, 152);
    ctx.lineTo(192, 748);
    ctx.stroke();

    const words = currentState.words;
    const totalChars = words.reduce((acc, w) => acc + w.length, 0);
    let remaining = visibleCount === null ? totalChars : Math.max(0, visibleCount);

    // Uniform optical sizing so long phrases still sit cleanly inside the sheet
    let fontSize = 114;
    while (fontSize > 58) {
      ctx.font = `600 ${fontSize}px "Courier New", Courier, monospace`;
      const widest = Math.max(...words.map((w) => ctx.measureText(w).width));
      if (widest <= 676) break;
      fontSize -= 4;
    }

    const rowYs = [278, 438, 598];
    const tabs = ['M', 'C', 'P'];

    words.forEach((word, i) => {
      const y = rowYs[i];
      const shown = word.slice(0, Math.min(word.length, remaining));
      remaining = Math.max(0, remaining - word.length);

      // Subtle ruled typewriter baseline
      ctx.strokeStyle = 'rgba(28, 25, 22, 0.11)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(222, y + fontSize * 0.44);
      ctx.lineTo(916, y + fontSize * 0.44);
      ctx.stroke();

      // Vermilion tab letter in left margin
      ctx.fillStyle = '#A82A22';
      ctx.font = '700 36px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tabs[i], 148, y + 2);

      // Freshly struck black ribbon ink with subtle micro double-strike impression
      if (shown.length > 0) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${fontSize}px "Courier New", Courier, monospace`;
        ctx.fillStyle = 'rgba(18, 18, 20, 0.28)';
        ctx.fillText(shown, 229, y + 2);
        ctx.fillStyle = '#141416';
        ctx.fillText(shown, 228, y);
      }
    });

    // Subtle bottom folio footer near paper bail
    if (visibleCount === null || visibleCount >= totalChars) {
      const refCode = (currentState.slug || currentState.cleanWords.join('-')).toUpperCase();
      ctx.fillStyle = 'rgba(42, 38, 34, 0.54)';
      ctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`REF // ${refCode}`, 228, 720);
    }

    paperTex.needsUpdate = true;
  }

  // Mechanical carriage & keystroke animation state
  let animPhase = 'idle'; // 'idle' | 'typing' | 'returning'
  let animTime = 0;
  let typedChars = 999;
  let totalTargetChars = 16;
  let lastStruckChar = -1;
  let carriageX = 0;
  let carriageTargetX = 0;
  let typebarKick = 0;
  const keyPress = [0, 0, 0];

  function triggerType() {
    if (animPhase !== 'idle') return;
    phraseStore.nextRandom({ source: 'mechanical-typewriter' });
    currentState = phraseStore.getState();
    totalTargetChars = currentState.words.reduce((acc, w) => acc + w.length, 0);
    animPhase = 'typing';
    animTime = 0;
    typedChars = 0;
    lastStruckChar = -1;
    carriageTargetX = 0.56;
    drawPaper(0);
  }

  function onClick(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    triggerType();
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('click', onClick);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (animPhase === 'typing') {
      animTime += dt;
      const charInterval = 0.048;
      const nextCount = Math.min(totalTargetChars, Math.floor(animTime / charInterval) + 1);

      if (nextCount > lastStruckChar) {
        lastStruckChar = nextCount;
        typedChars = nextCount;
        drawPaper(typedChars);

        // Snap central typebar up + depress matching M/C/P key
        typebarKick = 1.0;
        const w0 = currentState.words[0].length;
        const w1 = w0 + currentState.words[1].length;
        const activeKey = typedChars <= w0 ? 0 : typedChars <= w1 ? 1 : 2;
        keyPress[activeKey] = 1.0;

        // Advance carriage incrementally to the left as characters are typed
        const frac = typedChars / Math.max(1, totalTargetChars);
        carriageTargetX = 0.52 - frac * 1.04;

        sound.playMechanicalDetent(0.95 + (typedChars % 5) * 0.035, 0.2);
      }

      if (typedChars >= totalTargetChars && animTime >= totalTargetChars * charInterval + 0.14) {
        animPhase = 'returning';
        animTime = 0;
        carriageTargetX = 0.0;
        sound.playSteelClack(0.62);
      }
    } else if (animPhase === 'returning') {
      animTime += dt;
      if (animTime >= 0.34) {
        animPhase = 'idle';
        carriageTargetX = 0.0;
        drawPaper(null);
      }
    }

    // Smooth carriage glide
    carriageX += (carriageTargetX - carriageX) * Math.min(1, dt * 14);
    if (carriageRoot) {
      carriageRoot.position.x = carriageX;
    }

    // Snap typebar kick back to resting fan
    typebarKick = Math.max(0, typebarKick - dt * 11.0);
    if (activeTypebar) {
      // Blender X rotation pivots bar up toward platen (-Z in Three.js)
      activeTypebar.rotation.x = typebarKick * 1.18;
    }

    // Spring M / C / P keycaps back up
    for (let i = 0; i < 3; i++) {
      keyPress[i] = Math.max(0, keyPress[i] - dt * 8.5);
      if (keyNodes[i]) {
        keyNodes[i].position.y = keyBaseY[i] - keyPress[i] * 0.11;
      }
    }
  }

  drawPaper(null);
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'mechanical-typewriter') return;
      animPhase = 'idle';
      carriageTargetX = 0;
      drawPaper(null);
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      deckAo.material.opacity = nextTheme === 'dark' ? 0.72 : 0.34;
    },

    triggerPrimary() {
      triggerType();
    },

    setSettled(settled) {
      if (settled) {
        animPhase = 'idle';
        carriageX = 0;
        carriageTargetX = 0;
        typebarKick = 0;
        if (carriageRoot) carriageRoot.position.x = 0;
        if (activeTypebar) activeTypebar.rotation.x = 0;
        for (let i = 0; i < 3; i++) {
          keyPress[i] = 0;
          if (keyNodes[i]) keyNodes[i].position.y = keyBaseY[i];
        }
        drawPaper(null);
      }
    },

    isMoving() {
      return Boolean(animPhase !== 'idle' || Math.abs(carriageTargetX - carriageX) > .0005 || typebarKick > 0);
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
      canvas.removeEventListener('click', onClick);
      paperTex.dispose();
      keyTextures.forEach((t) => t.dispose());
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
