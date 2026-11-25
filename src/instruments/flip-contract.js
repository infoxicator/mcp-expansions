import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = createStudioScene(theme, '#bb7453');

  // Macro studio flat-lay framing the matte-black receptacle block on left + reversible anodized USB-C plug on right
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 45);
  camera.position.set(1.15, 12.65, 4.70);
  camera.lookAt(0.05, 0.34, 0.0);
  camera.rotateZ(THREE.MathUtils.degToRad(7));

  const root = await studio.loadGLB('./assets/models/flip-contract.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();
  const cableTex = studio.getCableJacketTexture();

  // High-DPI brushed-aluminum I/O legend strip texture (1024 x 744 matching 2.78 x 2.02 aspect)
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 1024;
  plateCanvas.height = 744;
  const pctx = plateCanvas.getContext('2d');
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  plateTex.flipY = false;
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 16;

  // Pre-bake brushed horizontal aluminum grain into offscreen base
  const aluBase = document.createElement('canvas');
  aluBase.width = 1024;
  aluBase.height = 744;
  const actx = aluBase.getContext('2d');
  const grad = actx.createLinearGradient(0, 0, 1024, 744);
  grad.addColorStop(0.0, '#D8D9DC');
  grad.addColorStop(0.5, '#CFD1D5');
  grad.addColorStop(1.0, '#C6C8CD');
  actx.fillStyle = grad;
  actx.fillRect(0, 0, 1024, 744);

  let seed = 7331;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < 744; y += 2) {
    const alpha = 0.018 + rand() * 0.025;
    actx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(20,22,26,${alpha})`;
    actx.fillRect(0, y, 1024, 1);
  }

  let flipPlugRoot = null;
  let plugBasePos = new THREE.Vector3();
  let ledCC1Mat = null;
  let ledCC2Mat = null;

  root.traverse((obj) => {
    if (obj.name === 'FlipPlugRoot') {
      flipPlugRoot = obj;
      plugBasePos.copy(obj.position);
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'BlockMatteBlack') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16171a,
        metalness: 0.14,
        roughness: 0.72,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.003,
        clearcoat: 0.0,
      });
    } else if (matName === 'BlockSeam') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x090a0c,
        metalness: 0.06,
        roughness: 0.88,
      });
    } else if (matName === 'USBC_Steel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd8dce2,
        metalness: 0.96,
        roughness: 0.20,
        envMapIntensity: 1.25,
      });
    } else if (matName === 'LegendPlateMat') {
      obj.material = new THREE.MeshStandardMaterial({
        map: plateTex,
        metalness: 0.26,
        roughness: 0.44,
        envMapIntensity: 0.85,
      });
      obj.castShadow = false;
    } else if (matName === 'PlugPaleAlu') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0xcfd2d6,
        metalness: 0.84,
        roughness: 0.28,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0018,
      });
    } else if (matName === 'PlugPaleStrain') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0xbdbab2,
        metalness: 0.0,
        roughness: 0.62,
        roughnessMap: cableTex,
        bumpMap: cableTex,
        bumpScale: 0.0015,
      });
    } else if (matName === 'SideADotBrass') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd2a84e,
        metalness: 0.92,
        roughness: 0.22,
      });
    } else if (matName === 'SideBStripeDark') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x181a1f,
        metalness: 0.2,
        roughness: 0.48,
      });
    } else if (matName === 'LedCC1') {
      ledCC1Mat = new THREE.MeshStandardMaterial({
        color: 0x442a08,
        emissive: 0xffa82b,
        emissiveIntensity: 3.0,
        roughness: 0.2,
      });
      obj.material = ledCC1Mat;
    } else if (matName === 'LedCC2') {
      ledCC2Mat = new THREE.MeshStandardMaterial({
        color: 0x102838,
        emissive: 0x4cc4ff,
        emissiveIntensity: 0.0,
        roughness: 0.2,
      });
      obj.material = ledCC2Mat;
    }
  });

  const blockAo = createContactShadow(4.1, 3.1, theme === 'dark' ? 0.68 : 0.34, 0.002);
  blockAo.position.set(-0.82, 0.002, 0);
  scene.add(blockAo);

  const plugAo = createContactShadow(2.8, 1.05, theme === 'dark' ? 0.46 : 0.22, 0.002);
  plugAo.position.set(1.9, 0.002, 0);
  scene.add(plugAo);

  // State machine
  let currentState = phraseStore.getState();
  let ccChannel = 1; // 1 => Side A (0 deg), 2 => Side B (180 deg)
  let flipState = 'seated'; // 'seated' | 'flipping'
  let flipTime = 0;
  let rollAngle = 0;
  let rollStart = 0;
  let rollTarget = 0;
  let plateDirty = true;

  function drawLegendPlate() {
    const ctx = pctx;
    const w = plateCanvas.width;
    const h = plateCanvas.height;
    ctx.drawImage(aluBase, 0, 0);

    // Subtle recessed milled border frame
    ctx.strokeStyle = 'rgba(24, 26, 30, 0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    // Header bar
    ctx.fillStyle = '#181A1F';
    ctx.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const orientStr = ccChannel === 1 ? 'CC1 · SIDE A (0°)' : 'CC2 · SIDE B (180°)';
    ctx.fillText(orientStr, 50, 62);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(24, 26, 31, 0.56)';
    const idxStr = currentState.isRemix
      ? 'REMIX'
      : `${String(currentState.index + 1).padStart(3, '0')}/${String(currentState.total).padStart(3, '0')}`;
    ctx.fillText(`I/O · ${idxStr}`, w - 120, 62);

    // Hairline divider
    ctx.fillStyle = 'rgba(24, 26, 31, 0.24)';
    ctx.fillRect(50, 96, w - 165, 2);

    // Right vertical channel indicator rail aligning with physical CC1/CC2 LEDs
    ctx.fillStyle = 'rgba(24, 26, 31, 0.16)';
    ctx.fillRect(w - 102, 46, 2, h - 92);

    ctx.textAlign = 'center';
    ctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = ccChannel === 1 ? '#14161A' : 'rgba(24, 26, 31, 0.36)';
    ctx.fillText('CC1', w - 58, 198);
    ctx.fillStyle = ccChannel === 2 ? '#14161A' : 'rgba(24, 26, 31, 0.36)';
    ctx.fillText('CC2', w - 58, h - 198);

    // Crisp 3-row laser-etched phrase readout
    const words = currentState.cleanWords.map((word) => word.replace(/,$/, '').toUpperCase());
    const maxW = w - 255;
    let fontSize = 110;
    while (fontSize > 48) {
      ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      const widest = Math.max(...words.map((txt) => ctx.measureText(txt).width));
      if (widest <= maxW) break;
      fontSize -= 4;
    }

    const pins = ['M', 'C', 'P'];
    const seatedVisual = flipState === 'seated';
    words.forEach((word, idx) => {
      const cy = 224 + idx * 170;
      if (idx > 0) {
        ctx.fillStyle = 'rgba(24, 26, 31, 0.10)';
        ctx.fillRect(50, cy - 85, w - 165, 1.5);
      }

      // Pinout pill badge
      ctx.fillStyle = seatedVisual ? '#181A1F' : 'rgba(24, 26, 31, 0.28)';
      ctx.fillRect(50, cy - 30, 56, 60);
      ctx.fillStyle = '#E4E5E8';
      ctx.font = '600 34px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pins[idx], 78, cy + 2);

      // Etched main word
      ctx.fillStyle = seatedVisual ? '#111317' : 'rgba(24, 26, 31, 0.22)';
      ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(word, 128, cy + 2);
    });

    // Bottom quiet engineering spec line
    ctx.fillStyle = 'rgba(24, 26, 31, 0.48)';
    ctx.font = '500 20px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('REVERSIBLE TYPE-C  ·  CC POLARITY LOCK', 50, h - 46);

    plateTex.needsUpdate = true;
    plateDirty = false;
  }

  function triggerFlip() {
    if (flipState === 'flipping') return;
    flipState = 'flipping';
    flipTime = 0;
    rollStart = rollAngle;
    rollTarget = rollAngle + Math.PI;
    sound.playUsbUnplug();
    plateDirty = true;
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    triggerFlip();
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('pointerdown', onPointerDown);

  let currentTheme = theme;
  let swappedMidFlip = false;

  function stepAnimation(dt) {
    let xOffset = 0;
    let yLift = 0;

    if (flipState === 'flipping') {
      flipTime += dt;
      const total = 0.92;
      const t = Math.min(1.0, flipTime / total);

      if (t < 0.26) {
        // Pull plug cleanly out of receptacle
        const k = t / 0.26;
        const ease = 1 - Math.pow(1 - k, 2);
        xOffset = ease * 0.96;
        yLift = ease * 0.08;
      } else if (t < 0.72) {
        // Mid-air crisp 180° axial roll
        const k = (t - 0.26) / 0.46;
        const smooth = k * k * (3 - 2 * k);
        xOffset = 0.96;
        yLift = 0.08 + Math.sin(k * Math.PI) * 0.18;
        rollAngle = rollStart + (rollTarget - rollStart) * smooth;
        if (k >= 0.5 && !swappedMidFlip) {
          swappedMidFlip = true;
          sound.playMechanicalDetent(1.12, 0.16);
        }
      } else {
        // Re-seat firmly into receptacle
        const k = (t - 0.72) / 0.28;
        const ease = k * k;
        xOffset = 0.96 * (1 - ease);
        yLift = 0.08 * (1 - ease);
        rollAngle = rollTarget;
      }

      if (t >= 1.0) {
        flipState = 'seated';
        swappedMidFlip = false;
        ccChannel = ccChannel === 1 ? 2 : 1;
        phraseStore.nextRandom({ source: 'flip-contract' });
        currentState = phraseStore.getState();
        sound.playUsbPlug();
        plateDirty = true;
      }
    }

    if (flipPlugRoot) {
      flipPlugRoot.position.set(plugBasePos.x + xOffset, plugBasePos.y + yLift, plugBasePos.z);
      flipPlugRoot.rotation.x = rollAngle;
    }
    plugAo.position.x = 1.9 + xOffset;

    const cc1Active = flipState === 'seated' && ccChannel === 1;
    const cc2Active = flipState === 'seated' && ccChannel === 2;
    if (ledCC1Mat) {
      ledCC1Mat.emissiveIntensity += ((cc1Active ? 3.2 : 0.0) - ledCC1Mat.emissiveIntensity) * Math.min(1, dt * 16);
    }
    if (ledCC2Mat) {
      ledCC2Mat.emissiveIntensity += ((cc2Active ? 3.2 : 0.0) - ledCC2Mat.emissiveIntensity) * Math.min(1, dt * 16);
    }

    if (plateDirty) drawLegendPlate();
  }

  drawLegendPlate();
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'flip-contract') return;
      plateDirty = true;
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      blockAo.material.opacity = nextTheme === 'dark' ? 0.68 : 0.34;
      plugAo.material.opacity = nextTheme === 'dark' ? 0.46 : 0.22;
    },

    triggerPrimary() {
      triggerFlip();
    },

    setSettled(settled) {
      flipState = 'seated';
      swappedMidFlip = false;
      if (settled && flipPlugRoot) {
        flipPlugRoot.position.copy(plugBasePos);
        flipPlugRoot.rotation.x = rollAngle;
      }
      plateDirty = true;
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
      plateTex.dispose();
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
