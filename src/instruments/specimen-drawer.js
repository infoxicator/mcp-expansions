import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

// Specimens 0, 2, 4 are live data/e-marked cables; 1, 3 are charge-only duds
const SPECIMEN_LIVE = [true, false, true, false, true];

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = await createStudioScene(theme, 'specimen-drawer');

  // Elevated architectural overhead macro framing the entire divided archival specimen tray with clean studio margins
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0.68, 12.95, 5.85);
  camera.lookAt(0.0, 0.28, 0.08);
  camera.rotateZ(THREE.MathUtils.degToRad(-3));

  const root = await studio.loadGLB('./assets/models/specimen-drawer.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();
  const cableTex = studio.getCableJacketTexture();

  // 1. Back rim bay number header strip (01 | 02 | 03 | 04 | 05)
  const headerCanvas = document.createElement('canvas');
  headerCanvas.width = 1024;
  headerCanvas.height = 48;
  const hctx = headerCanvas.getContext('2d');
  hctx.clearRect(0, 0, 1024, 48);
  hctx.fillStyle = 'rgba(226, 222, 214, 0.62)';
  hctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
  hctx.textAlign = 'center';
  hctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    const cx = (i + 0.5) * (1024 / 5);
    hctx.fillText(`SPEC 0${i + 1}`, cx, 24);
  }
  const headerTex = new THREE.CanvasTexture(headerCanvas);
  headerTex.flipY = false;
  headerTex.colorSpace = THREE.SRGBColorSpace;
  headerTex.anisotropy = 8;

  // 2. Wide front specimen diagnostic readout OLED (1440 x 340 matching 4.82 x 1.14 aspect)
  const readCanvas = document.createElement('canvas');
  readCanvas.width = 1440;
  readCanvas.height = 340;
  const rctx = readCanvas.getContext('2d');
  const readTex = new THREE.CanvasTexture(readCanvas);
  readTex.flipY = false;
  readTex.colorSpace = THREE.SRGBColorSpace;
  readTex.anisotropy = 16;

  const specimenRoots = [null, null, null, null, null];
  const specimenLedMats = [null, null, null, null, null];
  const specimenBaseY = [0, 0, 0, 0, 0];

  root.traverse((obj) => {
    for (let i = 0; i < 5; i++) {
      if (obj.name === `Specimen${i}`) {
        specimenRoots[i] = obj;
        specimenBaseY[i] = obj.position.y;
      }
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'DrawerMatteCharcoal') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x17181b,
        metalness: 0.14,
        roughness: 0.74,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0032,
        clearcoat: 0.0,
      });
    } else if (matName === 'DrawerFeltLiner') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x0d0e10,
        metalness: 0.0,
        roughness: 0.96,
      });
    } else if (matName === 'DrawerDivider') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x222429,
        metalness: 0.20,
        roughness: 0.64,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0022,
      });
    } else if (matName === 'SpecimenCable') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x151619,
        metalness: 0.0,
        roughness: 0.64,
        roughnessMap: cableTex,
        bumpMap: cableTex,
        bumpScale: 0.0018,
      });
    } else if (matName === 'USBC_Steel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd6dae0,
        metalness: 0.95,
        roughness: 0.22,
        envMapIntensity: 1.2,
      });
    } else if (matName === 'SpecimenCollarAlu') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0xc4c7cc,
        metalness: 0.86,
        roughness: 0.28,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0018,
      });
    } else if (matName === 'DrawerHeaderMat') {
      obj.material = new THREE.MeshBasicMaterial({
        map: headerTex,
        transparent: true,
        depthWrite: false,
      });
      obj.castShadow = false;
    } else if (matName === 'DrawerReadoutMat') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0x030406,
        map: readTex,
        emissive: 0xffffff,
        emissiveMap: readTex,
        emissiveIntensity: 1.24,
        roughness: 0.72,
        metalness: 0.0,
      });
      obj.castShadow = false;
    } else if (matName.startsWith('SpecLed')) {
      const idx = Number(matName.replace('SpecLed', '')) || 0;
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x1e2226,
        emissive: 0xffb347,
        emissiveIntensity: 0.0,
        roughness: 0.22,
      });
      specimenLedMats[idx] = ledMat;
      obj.material = ledMat;
    }
  });

  // Grounded AO shadow beneath the divided archival drawer
  const trayAo = createContactShadow(6.3, 5.2, theme === 'dark' ? 0.72 : 0.34, 0.002);
  scene.add(trayAo);

  // Invisible hit planes over the 5 specimen bays for direct bay probing
  const bayHits = [];
  for (let i = 0; i < 5; i++) {
    const bx = -2.0 + i * 1.0;
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.75, 2.45),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(bx, 0.4, -0.72);
    hit.userData.bayIndex = i;
    scene.add(hit);
    bayHits.push(hit);
  }

  // State machine
  let currentState = phraseStore.getState();
  let activeBay = 2; // Center live specimen 03 at rest
  const bayLifts = [0, 0, startSettled ? 1 : 1, 0, 0];
  let autoStepTimer = -1;
  let readoutDirty = true;

  function drawReadout() {
    const ctx = rctx;
    const w = readCanvas.width;
    const h = readCanvas.height;
    const isLive = SPECIMEN_LIVE[activeBay];

    ctx.fillStyle = '#060709';
    ctx.fillRect(0, 0, w, h);

    // Subtle OLED scanlines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);

    const amber = '#FFB347';
    const ivory = '#F5EFE2';
    const dim = 'rgba(245, 239, 226, 0.48)';

    ctx.save();
    ctx.textBaseline = 'middle';

    // Top diagnostic status header
    ctx.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = isLive ? amber : 'rgba(245, 239, 226, 0.38)';
    const specNum = `SPECIMEN 0${activeBay + 1}`;
    const statusTxt = isLive ? `${specNum}  ·  LIVE DATA  ·  E-MARKED` : `${specNum}  ·  CHARGE ONLY  ·  NO DATA LINES`;
    ctx.fillText(statusTxt, 48, 52);

    // Right-hand 5-bay diagnostic dots
    for (let i = 0; i < 5; i++) {
      const cx = w - 210 + i * 38;
      ctx.beginPath();
      ctx.arc(cx, 52, 8.5, 0, Math.PI * 2);
      if (i === activeBay) {
        ctx.fillStyle = isLive ? amber : 'rgba(245, 239, 226, 0.35)';
      } else {
        ctx.fillStyle = 'rgba(245, 239, 226, 0.14)';
      }
      ctx.fill();
    }

    // Hairline divider
    ctx.fillStyle = isLive ? 'rgba(255, 179, 71, 0.22)' : 'rgba(245, 239, 226, 0.10)';
    ctx.fillRect(48, 92, w - 96, 2);

    if (isLive) {
      const words = currentState.cleanWords.map((word) => word.replace(/,$/, '').toUpperCase());
      const letters = ['M', 'C', 'P'];
      const colW = (w - 96) / 3;

      // Optical uniform font sizing across the 3 archival columns
      let fontSize = 86;
      while (fontSize > 34) {
        ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        const widest = Math.max(...words.map((txt) => ctx.measureText(txt).width));
        if (widest <= colW - 86) break;
        fontSize -= 3;
      }

      words.forEach((word, idx) => {
        const x0 = 48 + idx * colW;
        if (idx > 0) {
          ctx.fillStyle = 'rgba(245, 239, 226, 0.10)';
          ctx.fillRect(x0 - 12, 126, 1.5, 168);
        }

        // Small letter badge (M / C / P) above/left
        ctx.fillStyle = amber;
        ctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(letters[idx], x0 + 12, 146);

        // Bold crisp readout word
        ctx.shadowColor = 'rgba(245, 239, 226, 0.32)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = ivory;
        ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.fillText(word, x0 + 12, 232);
        ctx.shadowBlur = 0;
      });
    } else {
      // Quiet dead charge-only state
      ctx.fillStyle = dim;
      ctx.font = '500 44px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VBUS ONLY  —  D+ / D− OPEN', w * 0.5, 212);
    }

    ctx.restore();
    readTex.needsUpdate = true;
    readoutDirty = false;
  }

  function selectBay(idx, { advancePhrase = true } = {}) {
    activeBay = ((idx % 5) + 5) % 5;
    const isLive = SPECIMEN_LIVE[activeBay];
    if (isLive) {
      if (advancePhrase) {
        phraseStore.nextRandom({ source: 'specimen-drawer' });
        currentState = phraseStore.getState();
      }
      sound.playRelayTick(1.18 + activeBay * 0.06, 0.18);
    } else {
      sound.playUsbUnplug();
    }
    readoutDirty = true;
  }

  function probeNextSpecimen() {
    const nextIdx = (activeBay + 1) % 5;
    selectBay(nextIdx, { advancePhrase: true });
    // If Space landed on a charge-only dud, briefly show it dark & silent then auto-advance to the next live cable
    if (!SPECIMEN_LIVE[nextIdx]) {
      autoStepTimer = 0.36;
    } else {
      autoStepTimer = -1;
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function onClick(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(bayHits, false);
    autoStepTimer = -1;
    if (hits.length) {
      const bay = hits[0].object.userData.bayIndex;
      selectBay(bay, { advancePhrase: true });
    } else {
      probeNextSpecimen();
    }
  }

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('click', onClick);

  let currentTheme = theme;

  function stepAnimation(dt) {
    if (autoStepTimer >= 0) {
      autoStepTimer -= dt;
      if (autoStepTimer <= 0) {
        autoStepTimer = -1;
        selectBay((activeBay + 1) % 5, { advancePhrase: true });
      }
    }

    const follow = 1 - Math.exp(-12 * dt);
    for (let i = 0; i < 5; i++) {
      const isSelected = i === activeBay;
      const targetLift = isSelected ? 1.0 : 0.0;
      bayLifts[i] += (targetLift - bayLifts[i]) * follow;
      if (specimenRoots[i]) {
        specimenRoots[i].position.y = specimenBaseY[i] + bayLifts[i] * 0.14;
      }
      if (specimenLedMats[i]) {
        const targetGlow = isSelected && SPECIMEN_LIVE[i] ? 3.4 : 0.0;
        specimenLedMats[i].emissiveIntensity += (targetGlow - specimenLedMats[i].emissiveIntensity) * follow;
      }
    }

    if (readoutDirty) drawReadout();
  }

  // Initial state sync
  for (let i = 0; i < 5; i++) {
    if (specimenRoots[i]) specimenRoots[i].position.y = specimenBaseY[i] + bayLifts[i] * 0.14;
    if (specimenLedMats[i]) specimenLedMats[i].emissiveIntensity = i === activeBay && SPECIMEN_LIVE[i] ? 3.4 : 0.0;
  }
  drawReadout();
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'specimen-drawer') return;
      if (!SPECIMEN_LIVE[activeBay]) activeBay = 2;
      readoutDirty = true;
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      trayAo.material.opacity = nextTheme === 'dark' ? 0.72 : 0.34;
    },

    triggerPrimary() {
      probeNextSpecimen();
    },

    setSettled(settled) {
      autoStepTimer = -1;
      activeBay = 2;
      for (let i = 0; i < 5; i++) bayLifts[i] = i === activeBay && settled ? 1.0 : 0.0;
      readoutDirty = true;
    },

    isMoving() {
      return Boolean(readoutDirty || bayLifts.some((lift, i) => Math.abs(lift - Number(i === activeBay)) > .001));
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
      headerTex.dispose();
      readTex.dispose();
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
