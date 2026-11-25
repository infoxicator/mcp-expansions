import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

const UNSEATED_X = 0.56;
const PACKET_NAMES = ['SOP', "SOP'", "SOP''"];
const NODE_ROLES = ['NEAR · M', 'E-MARK · C', 'FAR · P'];

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = await createStudioScene(theme, 'discover-identity');

  // Macro overhead product flat-lay camera framing VCONN terminal + all 3 cable identity nodes with balanced margins
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 55);
  camera.position.set(0.28, 18.15, 4.60);
  camera.lookAt(0.16, 0.25, 0.0);
  camera.rotateZ(THREE.MathUtils.degToRad(-13));

  const root = await studio.loadGLB('./assets/models/discover-identity.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();
  const cableTex = studio.getCableJacketTexture();

  // Etched VCONN bench terminal faceplate texture
  const termCanvas = document.createElement('canvas');
  termCanvas.width = 512;
  termCanvas.height = 610;
  const tctx = termCanvas.getContext('2d');
  tctx.clearRect(0, 0, 512, 610);
  tctx.strokeStyle = 'rgba(225, 222, 214, 0.22)';
  tctx.lineWidth = 3;
  tctx.strokeRect(18, 18, 476, 574);
  tctx.fillStyle = 'rgba(232, 228, 220, 0.78)';
  tctx.font = '600 34px "JetBrains Mono", ui-monospace, monospace';
  tctx.textAlign = 'left';
  tctx.textBaseline = 'middle';
  tctx.fillText('VCONN', 44, 118);
  tctx.fillStyle = 'rgba(232, 228, 220, 0.48)';
  tctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
  tctx.fillText('5.0V · 1W', 44, 158);
  tctx.fillText('PD 3.1', 44, 488);
  tctx.fillText('VDM ID', 44, 522);
  const termTex = new THREE.CanvasTexture(termCanvas);
  termTex.flipY = false;
  termTex.colorSpace = THREE.SRGBColorSpace;
  termTex.anisotropy = 8;

  // 3 dynamic OLED readout canvases (512x344 matching 1.16 x 0.78 aspect)
  const screens = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 344;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return { canvas: c, ctx, tex };
  });

  let cableAssembly = null;
  let vconnLedMat = null;

  root.traverse((obj) => {
    if (obj.name === 'CableAssembly') cableAssembly = obj;
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'TerminalMatteAlu') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x1a1c20,
        metalness: 0.16,
        roughness: 0.72,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.003,
        clearcoat: 0.0,
      });
    } else if (matName === 'PlugMatteBlack') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x17181b,
        metalness: 0.16,
        roughness: 0.66,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0026,
      });
    } else if (matName === 'FerruleSilverAlu') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0xc2c5ca,
        metalness: 0.86,
        roughness: 0.30,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.002,
      });
    } else if (matName === 'USBC_Steel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd8dce2,
        metalness: 0.96,
        roughness: 0.20,
        envMapIntensity: 1.25,
      });
    } else if (matName === 'CableTPE') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x151619,
        metalness: 0.0,
        roughness: 0.68,
        roughnessMap: cableTex,
        bumpMap: cableTex,
        bumpScale: 0.002,
      });
    } else if (matName === 'DarkSeam') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x0a0b0d,
        metalness: 0.06,
        roughness: 0.88,
      });
    } else if (matName === 'LedVconn') {
      vconnLedMat = new THREE.MeshStandardMaterial({
        color: 0x442a08,
        emissive: 0xffa629,
        emissiveIntensity: 0.0,
        roughness: 0.22,
        metalness: 0.0,
      });
      obj.material = vconnLedMat;
    } else if (matName === 'TerminalLabel') {
      obj.material = new THREE.MeshBasicMaterial({
        map: termTex,
        transparent: true,
        depthWrite: false,
      });
      obj.castShadow = false;
    } else if (matName.startsWith('NodeScreen')) {
      const idx = Number(matName.replace('NodeScreen', '')) || 0;
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x030406,
        map: screens[idx].tex,
        emissive: 0xffffff,
        emissiveMap: screens[idx].tex,
        emissiveIntensity: 1.22,
        roughness: 0.72,
        metalness: 0.0,
      });
      obj.castShadow = false;
    }
  });

  // Grounded AO contact shadows
  const termAo = createContactShadow(1.75, 2.0, theme === 'dark' ? 0.64 : 0.30, 0.002);
  termAo.position.set(-2.85, 0.002, 0);
  scene.add(termAo);

  const cableAo = createContactShadow(6.2, 1.5, theme === 'dark' ? 0.56 : 0.25, 0.002);
  cableAo.position.set(0.75, 0.002, 0);
  scene.add(cableAo);

  // State machine
  let currentState = phraseStore.getState();
  let isSeated = true;
  let cableX = 0.0;
  let cableVel = 0.0;
  let vconnOn = true;
  let revealedNodes = [true, true, true];
  let seqPhase = 'idle'; // 'idle' | 'unplugging' | 'discovering'
  let seqTime = 0;
  let dirtyNodes = [true, true, true];

  function drawNodeScreen(idx) {
    const { ctx, canvas: c, tex } = screens[idx];
    const w = c.width;
    const h = c.height;
    const active = revealedNodes[idx];

    ctx.fillStyle = '#060709';
    ctx.fillRect(0, 0, w, h);

    // Subtle OLED matrix grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);

    // Top packet tag (SOP / SOP' / SOP'') + status dot
    const amber = '#FFB347';
    const ivory = '#F5EFE2';
    const dim = 'rgba(245, 239, 226, 0.42)';

    ctx.save();
    ctx.textBaseline = 'middle';

    // Status LED dot on top-right
    ctx.beginPath();
    ctx.arc(w - 42, 48, 10, 0, Math.PI * 2);
    ctx.fillStyle = active ? amber : 'rgba(255, 179, 71, 0.14)';
    if (active) {
      ctx.shadowColor = 'rgba(255, 179, 71, 0.65)';
      ctx.shadowBlur = 12;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = active ? amber : 'rgba(245, 239, 226, 0.24)';
    ctx.font = '600 32px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(PACKET_NAMES[idx], 34, 50);

    // Divider line
    ctx.fillStyle = active ? 'rgba(255, 179, 71, 0.24)' : 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(34, 86, w - 68, 2);

    if (active) {
      const word = currentState.cleanWords[idx].replace(/,$/, '').toUpperCase();
      const maxW = w - 64;
      let fontSize = 96;
      while (fontSize > 38) {
        ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        if (ctx.measureText(word).width <= maxW) break;
        fontSize -= 4;
      }
      ctx.shadowColor = 'rgba(245, 239, 226, 0.35)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = ivory;
      ctx.textAlign = 'center';
      ctx.fillText(word, w * 0.5, 198);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(245, 239, 226, 0.16)';
      ctx.font = '500 32px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('— — —', w * 0.5, 198);
    }

    // Quiet bottom node role caption
    ctx.fillStyle = active ? dim : 'rgba(245, 239, 226, 0.14)';
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(NODE_ROLES[idx], 34, h - 38);
    ctx.textAlign = 'right';
    ctx.fillText(active ? 'ACK' : 'WAIT', w - 34, h - 38);

    ctx.restore();
    tex.needsUpdate = true;
    dirtyNodes[idx] = false;
  }

  function triggerDiscoveryCycle() {
    if (isSeated) {
      // Quick tactile unseat → advance phrase → snap back in → VCONN amber → SOP / SOP' / SOP'' ticks
      isSeated = false;
      vconnOn = false;
      revealedNodes = [false, false, false];
      dirtyNodes = [true, true, true];
      seqPhase = 'unplugging';
      seqTime = 0;
      sound.playUsbUnplug();
    } else {
      startSeatDiscovery();
    }
  }

  function startSeatDiscovery() {
    phraseStore.nextRandom({ source: 'discover-identity' });
    currentState = phraseStore.getState();
    isSeated = true;
    vconnOn = true;
    revealedNodes = [false, false, false];
    dirtyNodes = [true, true, true];
    seqPhase = 'discovering';
    seqTime = 0;
    sound.playUsbPlug();
  }

  // Pointer drag/click on cable assembly
  let isDragging = false;
  let dragStartX = 0;
  let dragStartCableX = 0;
  let dragMoved = false;

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    isDragging = true;
    dragMoved = false;
    seqPhase = 'idle';
    dragStartX = e.clientX;
    dragStartCableX = cableX;
    cableVel = 0;
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    if (!isDragging) {
      canvas.style.cursor = 'grab';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 6) dragMoved = true;
    const nextX = Math.max(0.0, Math.min(UNSEATED_X * 1.2, dragStartCableX + (dx / rect.width) * 3.0));
    if (isSeated && nextX > 0.22) {
      isSeated = false;
      vconnOn = false;
      revealedNodes = [false, false, false];
      dirtyNodes = [true, true, true];
      sound.playUsbUnplug();
    } else if (!isSeated && nextX < 0.14) {
      cableX = 0.0;
      isDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
      canvas.style.cursor = 'grab';
      startSeatDiscovery();
      return;
    }
    cableX = nextX;
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grab';
    if (e.type === 'pointercancel') return;
    if (!dragMoved) {
      triggerDiscoveryCycle();
    } else if (cableX < UNSEATED_X * 0.45 && !isSeated) {
      startSeatDiscovery();
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (seqPhase === 'unplugging') {
      seqTime += dt;
      if (seqTime >= 0.30) {
        startSeatDiscovery();
      }
    } else if (seqPhase === 'discovering') {
      seqTime += dt;
      const thresholds = [0.22, 0.52, 0.84];
      thresholds.forEach((th, idx) => {
        if (seqTime >= th && !revealedNodes[idx]) {
          revealedNodes[idx] = true;
          dirtyNodes[idx] = true;
          sound.playRelayTick(0.95 + idx * 0.18, 0.16);
        }
      });
      if (seqTime >= 0.96) {
        seqPhase = 'idle';
      }
    }

    if (!isDragging) {
      const targetX = isSeated ? 0.0 : UNSEATED_X;
      const force = (targetX - cableX) * 280 - cableVel * 24;
      cableVel += force * dt;
      cableX += cableVel * dt;
      if (Math.abs(targetX - cableX) < 0.001 && Math.abs(cableVel) < 0.004) {
        cableX = targetX;
        cableVel = 0;
      }
      if (cableX < 0) {
        cableX = 0;
        cableVel = 0;
      }
    }

    if (cableAssembly) cableAssembly.position.x = cableX;
    cableAo.position.x = 0.75 + cableX;

    if (vconnLedMat) {
      const targetGlow = vconnOn ? 3.2 : 0.0;
      vconnLedMat.emissiveIntensity += (targetGlow - vconnLedMat.emissiveIntensity) * Math.min(1, dt * 16);
    }

    for (let i = 0; i < 3; i++) {
      if (dirtyNodes[i]) drawNodeScreen(i);
    }
  }

  if (vconnLedMat) vconnLedMat.emissiveIntensity = vconnOn ? 3.2 : 0.0;
  for (let i = 0; i < 3; i++) drawNodeScreen(i);
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'discover-identity') return;
      if (isSeated) {
        revealedNodes = [true, true, true];
        dirtyNodes = [true, true, true];
      }
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      termAo.material.opacity = nextTheme === 'dark' ? 0.64 : 0.30;
      cableAo.material.opacity = nextTheme === 'dark' ? 0.56 : 0.25;
    },

    triggerPrimary() {
      triggerDiscoveryCycle();
    },

    setSettled(settled) {
      seqPhase = 'idle';
      isSeated = Boolean(settled);
      cableX = isSeated ? 0.0 : UNSEATED_X;
      cableVel = 0;
      vconnOn = isSeated;
      revealedNodes = [isSeated, isSeated, isSeated];
      dirtyNodes = [true, true, true];
    },

    isMoving() {
      return Boolean(seqPhase !== 'idle' || isDragging || dirtyNodes.some(Boolean) || cableX !== (isSeated ? 0 : UNSEATED_X));
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
      termTex.dispose();
      screens.forEach((s) => s.tex.dispose());
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
