import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

const UNPLUGGED_X = 0.96;
const MAGNETIC_SNAP_X = 0.44;
const NEGOTIATION_STEPS = [
  { until: 0.24, mode: 'pd', volts: '5.00', pdo: 'SRC 5V', pitch: 0.92 },
  { until: 0.48, mode: 'pd', volts: '9.00', pdo: 'PDO 2/4', pitch: 1.02 },
  { until: 0.72, mode: 'pd', volts: '15.00', pdo: 'PDO 3/4', pitch: 1.12 },
  { until: 0.98, mode: 'pd', volts: '20.00', pdo: 'PDO 4/4', pitch: 1.22 },
  { until: 1.30, mode: 'ok', volts: '20.00', pdo: 'CONTRACT OK', pitch: 1.42 },
];

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = createStudioScene(theme, '#81949a');

  // Product-photography macro flat-lay framing: matchbox meter centered (~44% width) flanked by both pale grey USB-C plugs & cables
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 45);
  camera.position.set(1.50, 11.55, 4.35);
  camera.lookAt(0.26, 0.28, 0.0);
  camera.rotateZ(THREE.MathUtils.degToRad(-11));

  const root = await studio.loadGLB('./assets/models/the-contract.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();
  const cableTex = studio.getCableJacketTexture();

  // Dynamic high-DPI monochrome OLED canvas texture (1024x566 matching 2.50 x 1.38 aspect)
  const oledCanvas = document.createElement('canvas');
  oledCanvas.width = 1024;
  oledCanvas.height = 566;
  const oledCtx = oledCanvas.getContext('2d');
  const oledTex = new THREE.CanvasTexture(oledCanvas);
  oledTex.flipY = false; // Match Blender glTF UV orientation
  oledTex.colorSpace = THREE.SRGBColorSpace;
  oledTex.anisotropy = 16;
  oledTex.minFilter = THREE.LinearMipmapLinearFilter;
  oledTex.magFilter = THREE.LinearFilter;

  // Subtle meter chassis top-face silkscreen micro-labels (IN / OUT) via a thin decal plane
  const chassisDecalCanvas = document.createElement('canvas');
  chassisDecalCanvas.width = 1024;
  chassisDecalCanvas.height = 640;
  const cdCtx = chassisDecalCanvas.getContext('2d');
  cdCtx.clearRect(0, 0, 1024, 640);
  cdCtx.fillStyle = 'rgba(218, 215, 208, 0.44)';
  cdCtx.font = '500 20px "JetBrains Mono", monospace';
  cdCtx.textAlign = 'left';
  cdCtx.textBaseline = 'middle';
  cdCtx.fillText('IN', 24, 320);
  cdCtx.textAlign = 'right';
  cdCtx.fillText('OUT', 1000, 320);
  cdCtx.textAlign = 'center';
  cdCtx.font = '400 14px "JetBrains Mono", monospace';
  cdCtx.fillStyle = 'rgba(218, 215, 208, 0.30)';
  cdCtx.fillText('MCP-PD1  ·  5–20V INLINE', 512, 608);
  const chassisDecalTex = new THREE.CanvasTexture(chassisDecalCanvas);
  chassisDecalTex.colorSpace = THREE.SRGBColorSpace;
  chassisDecalTex.anisotropy = 8;

  const chassisDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(3.12, 1.92),
    new THREE.MeshBasicMaterial({ map: chassisDecalTex, transparent: true, depthWrite: false })
  );
  chassisDecal.rotation.x = -Math.PI / 2;
  chassisDecal.position.set(0, 0.648, 0);
  scene.add(chassisDecal);

  let rightPlugRoot = null;
  let oledMaterial = null;

  root.traverse((obj) => {
    if (obj.name === 'RightPlugRoot') rightPlugRoot = obj;
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'MeterMatteBlack') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x171719,
        metalness: 0.14,
        roughness: 0.68,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0028,
        clearcoat: 0.0,
      });
    } else if (matName === 'MeterDarkSeam' || matName === 'USBC_Cavity') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        metalness: 0.05,
        roughness: 0.85,
      });
    } else if (matName === 'MeterBezel') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x0b0c0e,
        metalness: 0.12,
        roughness: 0.28,
        clearcoat: 0.35,
        clearcoatRoughness: 0.18,
      });
    } else if (matName === 'OledScreenMat') {
      oledMaterial = new THREE.MeshStandardMaterial({
        color: 0x020305,
        map: oledTex,
        emissive: 0xffffff,
        emissiveMap: oledTex,
        emissiveIntensity: 1.28,
        roughness: 0.78,
        metalness: 0.0,
      });
      obj.material = oledMaterial;
      obj.castShadow = false;
    } else if (matName === 'OledCoverGlass') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x05070a,
        metalness: 0.0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.055,
        clearcoat: 0.75,
        clearcoatRoughness: 0.06,
        reflectivity: 0.75,
        envMapIntensity: 0.65,
        depthWrite: false,
      });
      obj.castShadow = false;
    } else if (matName === 'USBC_Stainless') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd4d8de,
        metalness: 0.96,
        roughness: 0.22,
        envMapIntensity: 1.2,
      });
    } else if (matName === 'CablePaleGreyOvermold' || matName === 'CablePaleGreyStrain' || matName === 'CablePaleGreyJacket') {
      const isStrain = matName === 'CablePaleGreyStrain';
      obj.material = new THREE.MeshPhysicalMaterial({
        color: isStrain ? 0xbab7b0 : 0xc9c6be,
        metalness: 0.0,
        roughness: isStrain ? 0.68 : 0.56,
        roughnessMap: cableTex,
        bumpMap: cableTex,
        bumpScale: 0.0014,
        sheen: 0.12,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xeae7e0),
      });
    } else if (matName === 'MicroButton') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x26282e,
        metalness: 0.55,
        roughness: 0.36,
      });
    }
  });

  // Grounded AO contact shadows under meter & cables
  const meterAo = createContactShadow(3.95, 2.65, theme === 'dark' ? 0.68 : 0.32, 0.002);
  scene.add(meterAo);

  const leftPlugAo = createContactShadow(2.4, 0.95, theme === 'dark' ? 0.48 : 0.22, 0.002);
  leftPlugAo.position.set(-2.6, 0.002, 0);
  scene.add(leftPlugAo);

  const rightPlugAo = createContactShadow(2.4, 0.95, theme === 'dark' ? 0.48 : 0.22, 0.002);
  rightPlugAo.position.set(2.6, 0.002, 0);
  scene.add(rightPlugAo);

  // Keep a non-glare dummy handle (avoids specular circle hotspot on OledGlass)
  const screenGlowLight = { intensity: 0 };

  // Invisible generous hit box over the right-hand plug + cable for easy drag/click
  const hitPlug = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.1, 1.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitPlug.position.set(2.8, 0.35, 0);
  scene.add(hitPlug);

  // State machine
  let isPlugged = Boolean(startSettled);
  let plugX = isPlugged ? 0.0 : UNPLUGGED_X;
  let plugVel = 0.0;
  let hasNegotiatedOnce = Boolean(startSettled);
  let phase = isPlugged ? 'locked' : 'off'; // 'off' | 'negotiating' | 'locked'
  let negElapsed = 0;
  let lastStepIdx = -1;
  let currentWords = phraseStore.getState().cleanWords;
  let currentIndexLabel = formatCatalog(phraseStore.getState());
  let oledDirty = true;

  function formatCatalog(st) {
    if (st.isRemix) return 'REMIX';
    return `${String(st.index + 1).padStart(3, '0')}/${String(st.total).padStart(3, '0')}`;
  }

  function drawPixelGrid(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 4) {
      ctx.fillRect(x, 0, 1, h);
    }
    ctx.restore();
  }

  function drawOled() {
    const ctx = oledCtx;
    const w = oledCanvas.width;
    const h = oledCanvas.height;

    // Deep OLED black substrate
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, w, h);

    if (phase === 'off') {
      drawPixelGrid(ctx, w, h);
      oledTex.needsUpdate = true;
      screenGlowLight.intensity = 0.0;
      oledDirty = false;
      return;
    }

    const fg = '#EAF4FF';
    const fgSoft = 'rgba(234, 244, 255, 0.56)';
    const rule = 'rgba(234, 244, 255, 0.20)';

    ctx.save();
    ctx.shadowColor = 'rgba(195, 228, 255, 0.42)';
    ctx.shadowBlur = 10;

    // Top status strip (authentic inline PD meter header)
    ctx.fillStyle = fgSoft;
    ctx.font = '500 28px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    if (phase === 'negotiating') {
      const step = NEGOTIATION_STEPS[Math.max(0, Math.min(lastStepIdx, NEGOTIATION_STEPS.length - 1))];
      ctx.fillText('USB-PD', 44, 52);
      ctx.textAlign = 'right';
      ctx.fillText(step.pdo, w - 44, 52);

      // Hairline divider
      ctx.shadowBlur = 0;
      ctx.fillStyle = rule;
      ctx.fillRect(44, 86, w - 88, 2);
      ctx.shadowBlur = 12;

      if (step.mode === 'pd') {
        // Dry V / A / W negotiation readout
        const rows = [
          { val: step.volts, unit: 'V', active: true },
          { val: '0.000', unit: 'A', active: false },
          { val: '0.000', unit: 'W', active: false },
        ];
        rows.forEach((r, idx) => {
          const cy = 178 + idx * 130;
          ctx.fillStyle = r.active ? fg : 'rgba(234, 244, 255, 0.34)';
          ctx.font = '500 94px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(r.val, 46, cy);
          ctx.font = '500 48px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'right';
          ctx.fillStyle = r.active ? fgSoft : 'rgba(234, 244, 255, 0.24)';
          ctx.fillText(r.unit, w - 46, cy + 8);
        });
      } else {
        // Brief dry CONTRACT OK lock frame
        ctx.fillStyle = fg;
        ctx.fillRect(44, 210, w - 88, 128);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#050608';
        ctx.font = '600 66px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CONTRACT OK', w / 2, 276);
        ctx.shadowBlur = 8;
        ctx.fillStyle = fgSoft;
        ctx.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillText('20.00V  ·  FIXED PDO', w / 2, 412);
      }
      screenGlowLight.intensity = 0.26;
    } else if (phase === 'locked') {
      // Top restrained header
      ctx.fillText('PD 20.0V', 44, 50);
      ctx.textAlign = 'right';
      ctx.fillText(`CONTRACT · ${currentIndexLabel}`, w - 44, 50);

      // Hairline divider
      ctx.shadowBlur = 0;
      ctx.fillStyle = rule;
      ctx.fillRect(44, 82, w - 88, 2);
      ctx.shadowBlur = 12;

      // Exact 3-line V / A / W meter layout, locked to the 3 MCP words
      const units = ['M', 'C', 'P'];
      const maxWordWidth = w - 190; // Leave generous right column for unit indicator
      const upperWords = currentWords.map((word) => word.replace(/,$/, '').toUpperCase());

      // Uniform optical font size across all 3 rows so the meter feels genuinely calibrated
      let fontSize = 104;
      while (fontSize > 46) {
        ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        const widest = Math.max(...upperWords.map((txt) => ctx.measureText(txt).width));
        if (widest <= maxWordWidth) break;
        fontSize -= 4;
      }

      upperWords.forEach((word, idx) => {
        const cy = 178 + idx * 134;

        // Subtle horizontal micro-rule separating rows like a bench instrument
        if (idx > 0) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(234, 244, 255, 0.08)';
          ctx.fillRect(44, cy - 67, w - 88, 1);
          ctx.restore();
        }

        ctx.fillStyle = fg;
        ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(word, 46, cy);

        // Right-aligned single-letter unit tag where V / A / W normally sit
        ctx.fillStyle = fgSoft;
        ctx.font = '500 44px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(units[idx], w - 46, cy + 6);
      });

      screenGlowLight.intensity = 0.34;
    }

    ctx.restore();
    drawPixelGrid(ctx, w, h);
    oledTex.needsUpdate = true;
    oledDirty = false;
  }

  function startNegotiation({ advancePhrase = false } = {}) {
    if (advancePhrase) {
      phraseStore.nextRandom({ source: 'the-contract' });
    }
    const st = phraseStore.getState();
    currentWords = st.cleanWords;
    currentIndexLabel = formatCatalog(st);
    phase = 'negotiating';
    negElapsed = 0;
    lastStepIdx = 0;
    hasNegotiatedOnce = true;
    sound.playUsbPlug();
    oledDirty = true;
  }

  function seatPlug({ advanceIfReplug = true } = {}) {
    if (isPlugged && phase !== 'off') return;
    isPlugged = true;
    const shouldAdvance = advanceIfReplug && hasNegotiatedOnce;
    startNegotiation({ advancePhrase: shouldAdvance });
  }

  function unplugPlug() {
    if (!isPlugged) return;
    isPlugged = false;
    phase = 'off';
    negElapsed = 0;
    lastStepIdx = -1;
    sound.playUsbUnplug();
    oledDirty = true;
  }

  // Pointer drag + click with magnetic snap
  let isDragging = false;
  let dragStartClientX = 0;
  let dragStartPlugX = 0;
  let dragMoved = false;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    setPointer(e);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(hitPlug, false);
    const onRightHalf = pointerNdc.x > -0.15;
    if (!hits.length && !onRightHalf) return;

    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    isDragging = true;
    dragMoved = false;
    dragStartClientX = e.clientX;
    dragStartPlugX = plugX;
    plugVel = 0;
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    if (!isDragging) {
      setPointer(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(hitPlug, false);
      canvas.style.cursor = hits.length ? 'grab' : 'default';
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragStartClientX;
    if (Math.abs(dx) > 6) dragMoved = true;

    const worldDx = (dx / rect.width) * 3.8;
    const rawX = Math.max(0.0, Math.min(UNPLUGGED_X * 1.15, dragStartPlugX + worldDx));

    // Tactile magnetic pull when approaching socket
    if (!isPlugged && rawX < 0.24) {
      plugX = 0.0;
      seatPlug({ advanceIfReplug: true });
      isDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
      canvas.style.cursor = 'grab';
      return;
    }

    if (isPlugged && rawX > 0.32) {
      unplugPlug();
    }
    plugX = rawX;
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grab';

    if (!dragMoved) {
      // Crisp single click toggles plug / unplug
      if (isPlugged) unplugPlug();
      else seatPlug({ advanceIfReplug: true });
    } else {
      // Magnetic snap threshold on release
      if (plugX <= MAGNETIC_SNAP_X) {
        if (!isPlugged) seatPlug({ advanceIfReplug: true });
      } else {
        if (isPlugged) unplugPlug();
      }
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  let currentTheme = theme;

  function stepAnimation(dt) {
    // Spring-snap right plug position toward target (0.0 seated or UNPLUGGED_X poised)
    if (!isDragging) {
      const targetX = isPlugged ? 0.0 : UNPLUGGED_X;
      const stiffness = isPlugged ? 340 : 190;
      const damping = isPlugged ? 26 : 22;
      const force = (targetX - plugX) * stiffness - plugVel * damping;
      plugVel += force * dt;
      plugX += plugVel * dt;
      if (Math.abs(targetX - plugX) < 0.001 && Math.abs(plugVel) < 0.005) {
        plugX = targetX;
        plugVel = 0;
      }
      if (plugX < 0) {
        plugX = 0;
        plugVel = 0;
      }
    }

    if (rightPlugRoot) {
      rightPlugRoot.position.x = plugX;
    }
    rightPlugAo.position.x = 2.6 + plugX;
    hitPlug.position.x = 2.6 + plugX;

    // Step USB-PD negotiation sequence (< 1.5s)
    if (phase === 'negotiating') {
      negElapsed += dt;
      let stepIdx = NEGOTIATION_STEPS.findIndex((s) => negElapsed < s.until);
      if (stepIdx === -1) {
        phase = 'locked';
        sound.playRelayTick(1.55, 0.16);
        oledDirty = true;
      } else if (stepIdx !== lastStepIdx) {
        lastStepIdx = stepIdx;
        sound.playRelayTick(NEGOTIATION_STEPS[stepIdx].pitch, 0.12);
        oledDirty = true;
      }
    }

    if (oledDirty) {
      drawOled();
    }
  }

  // Initial draw
  if (rightPlugRoot) rightPlugRoot.position.x = plugX;
  rightPlugAo.position.x = 2.6 + plugX;
  hitPlug.position.x = 2.6 + plugX;
  drawOled();

  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentWords = state.cleanWords;
      currentIndexLabel = formatCatalog(state);
      if (meta.source === 'the-contract') return;
      if (isPlugged) {
        phase = 'locked';
        oledDirty = true;
      }
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      meterAo.material.opacity = nextTheme === 'dark' ? 0.68 : 0.34;
      leftPlugAo.material.opacity = nextTheme === 'dark' ? 0.48 : 0.22;
      rightPlugAo.material.opacity = nextTheme === 'dark' ? 0.48 : 0.22;
    },

    /** Space bar: plug in if unplugged, unplug if plugged in */
    triggerPrimary() {
      if (isPlugged) unplugPlug();
      else seatPlug({ advanceIfReplug: true });
    },

    /** Helper for deep-link / still settling */
    setSettled(settled) {
      isPlugged = Boolean(settled);
      plugX = isPlugged ? 0.0 : UNPLUGGED_X;
      plugVel = 0;
      phase = isPlugged ? 'locked' : 'off';
      hasNegotiatedOnce = isPlugged;
      oledDirty = true;
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
      oledTex.dispose();
      chassisDecalTex.dispose();
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
