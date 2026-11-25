import * as THREE from 'three';
import { studio, createStudioScene, createContactShadow } from '../core/studio.js';
import { sound } from '../core/audio.js';

const SEGMENTS_U = 112;
const SEGMENTS_V = 28;
const CABLE_RADIUS = 0.24;

export async function createInstrument({ canvas, phraseStore, theme, startSettled = false, onReady }) {
  const { scene, applyTheme: applyStudioTheme } = await createStudioScene(theme, 'jacket-legend');

  // Macro overhead product flat-lay camera framing the full cable + both anodized USB-C plugs & stainless tongues
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0.0, 12.9, 2.60);
  camera.lookAt(0.0, 0.22, 0.0);
  camera.rotateZ(THREE.MathUtils.degToRad(-14));

  const root = await studio.loadGLB('./assets/models/jacket-legend.glb');
  scene.add(root);

  const anodizedTex = studio.getAnodizedTexture();
  const cableTex = studio.getCableJacketTexture();

  let plugLeft = null;
  let plugRight = null;

  root.traverse((obj) => {
    if (obj.name === 'PlugLeft') plugLeft = obj;
    if (obj.name === 'PlugRight') plugRight = obj;
    if (obj.name === 'CableJacketRef') {
      obj.visible = false; // Replaced by dynamic flexing parallel-transport cable mesh
      return;
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material?.name || '';
    if (matName === 'PlugAnodizedAlu') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x24262b,
        metalness: 0.78,
        roughness: 0.36,
        roughnessMap: anodizedTex,
        bumpMap: anodizedTex,
        bumpScale: 0.0025,
      });
    } else if (matName === 'PlugMatteTPE' || matName === 'PlugStrainTPE') {
      obj.material = new THREE.MeshPhysicalMaterial({
        color: 0x16171a,
        metalness: 0.0,
        roughness: 0.68,
        roughnessMap: cableTex,
        bumpMap: cableTex,
        bumpScale: 0.0018,
      });
    } else if (matName === 'USBC_Steel') {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xd8dce2,
        metalness: 0.96,
        roughness: 0.19,
        envMapIntensity: 1.25,
      });
    }
  });

  // High-DPI white AWM industrial inkjet legend mapped onto the matte-black cable jacket
  const legendCanvas = document.createElement('canvas');
  legendCanvas.width = 2048;
  legendCanvas.height = 512;
  const lctx = legendCanvas.getContext('2d');
  const legendTex = new THREE.CanvasTexture(legendCanvas);
  legendTex.colorSpace = THREE.SRGBColorSpace;
  legendTex.anisotropy = 16;
  legendTex.wrapS = THREE.ClampToEdgeWrapping;
  legendTex.wrapT = THREE.RepeatWrapping;

  const cableMat = new THREE.MeshPhysicalMaterial({
    map: legendTex,
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.64,
    roughnessMap: cableTex,
    bumpMap: cableTex,
    bumpScale: 0.002,
    sheen: 0.14,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(0x50545c),
  });

  // Dynamic cable geometry with locked upright crown UV (v = 0.5 faces +Y toward camera)
  const vertexCount = (SEGMENTS_U + 1) * (SEGMENTS_V + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = [];

  for (let iu = 0; iu <= SEGMENTS_U; iu++) {
    const u = iu / SEGMENTS_U;
    for (let iv = 0; iv <= SEGMENTS_V; iv++) {
      const v = iv / SEGMENTS_V;
      const idx = (iu * (SEGMENTS_V + 1) + iv) * 2;
      uvs[idx] = u;
      uvs[idx + 1] = v;
    }
  }
  for (let iu = 0; iu < SEGMENTS_U; iu++) {
    for (let iv = 0; iv < SEGMENTS_V; iv++) {
      const a = iu * (SEGMENTS_V + 1) + iv;
      const b = (iu + 1) * (SEGMENTS_V + 1) + iv;
      const c = (iu + 1) * (SEGMENTS_V + 1) + (iv + 1);
      const d = iu * (SEGMENTS_V + 1) + (iv + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  cableGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  cableGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  cableGeo.setIndex(indices);

  const cableMesh = new THREE.Mesh(cableGeo, cableMat);
  cableMesh.castShadow = true;
  cableMesh.receiveShadow = true;
  scene.add(cableMesh);

  // Subtle grounded shadow strip under cable & plugs
  const cableAo = createContactShadow(6.8, 1.35, theme === 'dark' ? 0.56 : 0.24, 0.002);
  scene.add(cableAo);

  // Helper to evaluate cable centerline point at parameter t in [0, 1] for a given tension in [0, 1]
  // tension = 1 => taut straight horizontal macro cable from x = -2.25 to +2.25
  // tension = 0 => relaxed studio coiled loop on the bench
  const tmpP = new THREE.Vector3();
  const tmpP2 = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  function sampleCenterline(t, tension, out) {
    // Straight taut target
    const sx = -2.18 + t * 4.36;
    const sy = CABLE_RADIUS + 0.015;
    const sz = 0.0;

    // Coiled studio S-loop target (t=0 left plug, loops gracefully into a central coil, exits right plug)
    const ang = (t - 0.5) * Math.PI * 2.15;
    const cx = (t - 0.5) * 3.15 - Math.sin(ang) * 0.92;
    const cz = Math.sin(t * Math.PI) * 1.18 * Math.cos(ang * 0.85) - 0.12 * Math.sin(t * Math.PI * 2);
    // Tiny natural vertical arch at loop crossing so cable never self-intersects
    const lift = Math.sin(t * Math.PI) * Math.max(0, Math.cos((t - 0.62) * Math.PI * 3.5)) * 0.24;
    const cy = CABLE_RADIUS + 0.015 + lift;

    // Smooth cubic ease on tension
    const k = tension * tension * (3.0 - 2.0 * tension);
    out.set(
      cx + (sx - cx) * k,
      cy + (sy - cy) * k,
      cz + (sz - cz) * k
    );
    return out;
  }

  function updateCableGeometry(tension) {
    const posAttr = cableGeo.attributes.position;
    const normAttr = cableGeo.attributes.normal;
    const eps = 0.0025;

    for (let iu = 0; iu <= SEGMENTS_U; iu++) {
      const t = iu / SEGMENTS_U;
      sampleCenterline(t, tension, tmpP);
      const tNext = Math.min(1.0, t + eps);
      const tPrev = Math.max(0.0, t - eps);
      sampleCenterline(tNext, tension, tmpP2);
      sampleCenterline(tPrev, tension, tmpTan);
      tmpTan.subVectors(tmpP2, tmpTan).normalize();

      // Right vector lies cleanly in horizontal plane so +Y crown stays facing camera
      tmpRight.crossVectors(tmpTan, worldUp).normalize();
      tmpUp.crossVectors(tmpRight, tmpTan).normalize();

      for (let iv = 0; iv <= SEGMENTS_V; iv++) {
        // v = 0.5 => phi = 0 => exact +tmpUp crown facing camera!
        // v increases from 0 -> 1 => phi goes -pi -> +pi
        const v = iv / SEGMENTS_V;
        const phi = (v - 0.5) * Math.PI * 2.0;
        // Careful orientation: as canvas y goes down (v decreases in Three default flipY=true),
        // we want canvas top (v > 0.5) toward -Z (top of screen) and canvas bottom (v < 0.5) toward +Z (bottom of screen).
        // tmpRight = tan x worldUp: when tan = (+1, 0, 0), tmpRight = (0, 0, +1) (bottom of screen!).
        // So sin(phi) * (-tmpRight) maps v > 0.5 to -Z (top of screen) and v < 0.5 to +Z (bottom of screen)!
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const nx = tmpUp.x * cosP - tmpRight.x * sinP;
        const ny = tmpUp.y * cosP - tmpRight.y * sinP;
        const nz = tmpUp.z * cosP - tmpRight.z * sinP;

        const vi = (iu * (SEGMENTS_V + 1) + iv) * 3;
        positions[vi] = tmpP.x + nx * CABLE_RADIUS;
        positions[vi + 1] = tmpP.y + ny * CABLE_RADIUS;
        positions[vi + 2] = tmpP.z + nz * CABLE_RADIUS;
        normals[vi] = nx;
        normals[vi + 1] = ny;
        normals[vi + 2] = nz;
      }
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    cableGeo.computeBoundingSphere();

    // Anchor PlugLeft & PlugRight flush with cable endpoints & tangents
    const strainOffset = 1.02;
    if (plugLeft) {
      sampleCenterline(0.0, tension, tmpP);
      sampleCenterline(0.02, tension, tmpP2);
      tmpTan.subVectors(tmpP2, tmpP).normalize();
      plugLeft.position.set(
        tmpP.x - tmpTan.x * strainOffset,
        tmpP.y,
        tmpP.z - tmpTan.z * strainOffset
      );
      plugLeft.rotation.y = Math.atan2(-tmpTan.z, tmpTan.x);
    }
    if (plugRight) {
      sampleCenterline(1.0, tension, tmpP);
      sampleCenterline(0.98, tension, tmpP2);
      tmpTan.subVectors(tmpP, tmpP2).normalize();
      plugRight.position.set(
        tmpP.x + tmpTan.x * strainOffset,
        tmpP.y,
        tmpP.z + tmpTan.z * strainOffset
      );
      plugRight.rotation.y = Math.atan2(-tmpTan.z, tmpTan.x);
    }

    // Update contact shadow scale to match taut vs coiled footprint
    cableAo.scale.set(0.76 + 0.24 * tension, 1.0 + (1.0 - tension) * 1.45, 1.0);
  }

  let currentState = phraseStore.getState();

  function drawJacketLegend() {
    const ctx = lctx;
    const w = legendCanvas.width;
    const h = legendCanvas.height;

    // Deep matte-black TPE cable jacket base
    ctx.fillStyle = '#15171A';
    ctx.fillRect(0, 0, w, h);

    // Subtle extruded rubber micro-streaks along the cable length
    ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 1);
    }

    const words = currentState.cleanWords.map((word) => word.replace(/,$/, '').toUpperCase());
    const phraseText = words.join('   ');

    // Top crown sits at y = h * 0.5 (v = 0.5). Print authentic industrial white inkjet specification legend
    // in two calibrated tiers: crisp AWM spec hairline above + bold readable 3-word legend centered on crown.
    const cy = h * 0.5;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Subtle technical AWM header strip above the main words
    ctx.save();
    ctx.translate(w * 0.5, cy - 42);
    ctx.scale(1.28, 1.0);
    ctx.fillStyle = 'rgba(232, 230, 224, 0.56)';
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
    const idxStr = currentState.isRemix ? 'REMIX' : `${String(currentState.index + 1).padStart(3, '0')}/${String(currentState.total).padStart(3, '0')}`;
    ctx.fillText(`AWM  2725  80°C  30V  ·  E321048  ·  USB4  240W  ·  MCP  ${idxStr}`, 0, 0);
    ctx.restore();

    // Main bold white inkjet phrase along the crown centerline (aspect-compensated for cable length/circumference ratio)
    const maxW = (w - 150) / 1.32;
    let fontSize = 74;
    while (fontSize > 34) {
      ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      if (ctx.measureText(phraseText).width <= maxW) break;
      fontSize -= 2;
    }

    ctx.save();
    ctx.translate(w * 0.5, cy + 16);
    ctx.scale(1.32, 1.0);
    ctx.fillStyle = '#F4F1EA';
    ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(phraseText, 0, 0);
    ctx.restore();

    const textW = ctx.measureText(phraseText).width * 1.32;
    const edgeL = Math.max(46, w * 0.5 - textW * 0.5 - 32);
    const edgeR = Math.min(w - 46, w * 0.5 + textW * 0.5 + 32);
    ctx.fillStyle = 'rgba(232, 230, 224, 0.34)';
    if (edgeL > 90) ctx.fillRect(46, cy + 15, edgeL - 62, 3);
    if (w - edgeR > 90) ctx.fillRect(edgeR + 16, cy + 15, w - 46 - edgeR - 16, 3);

    ctx.restore();
    legendTex.needsUpdate = true;
  }

  // Interaction state: tension 0 (coiled) .. 1 (pulled taut & legible)
  let tension = startSettled ? 1.0 : 1.0;
  let targetTension = 1.0;
  let tensionVel = 0.0;
  let cyclePhase = 'idle'; // 'idle' | 'coiling' | 'pulling'
  let cycleTimer = 0;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartTension = 1.0;
  let dragMoved = false;
  let coiledDuringDrag = false;

  function triggerCoilAndPull() {
    if (tension > 0.55) {
      // Quick tactile coil-in → swap phrase → pull taut straight
      cyclePhase = 'coiling';
      cycleTimer = 0;
      targetTension = 0.06;
      sound.playUsbUnplug();
    } else {
      phraseStore.nextRandom({ source: 'jacket-legend' });
      currentState = phraseStore.getState();
      drawJacketLegend();
      cyclePhase = 'idle';
      targetTension = 1.0;
      sound.playUsbPlug();
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    isDragging = true;
    dragMoved = false;
    coiledDuringDrag = tension < 0.25;
    cyclePhase = 'idle';
    dragStartX = e.clientX;
    dragStartTension = tension;
    tensionVel = 0;
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    if (!isDragging) {
      canvas.style.cursor = 'ew-resize';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 6) dragMoved = true;
    const nextT = Math.max(0.0, Math.min(1.0, dragStartTension + (dx / rect.width) * 2.2));
    if (nextT < 0.25 && !coiledDuringDrag) {
      coiledDuringDrag = true;
      sound.playUsbUnplug();
    }
    if (nextT > 0.82 && coiledDuringDrag) {
      coiledDuringDrag = false;
      phraseStore.nextRandom({ source: 'jacket-legend' });
      currentState = phraseStore.getState();
      drawJacketLegend();
      sound.playUsbPlug();
    }
    tension = nextT;
    targetTension = nextT;
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.style.cursor = 'ew-resize';
    if (e.type === 'pointercancel') return;
    if (!dragMoved) {
      triggerCoilAndPull();
    } else {
      targetTension = tension >= 0.45 ? 1.0 : 0.0;
      if (targetTension === 1.0 && coiledDuringDrag) {
        phraseStore.nextRandom({ source: 'jacket-legend' });
        currentState = phraseStore.getState();
        drawJacketLegend();
        sound.playUsbPlug();
      }
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  let currentTheme = theme;
  let lastGeoTension = -1;

  function stepAnimation(dt) {
    if (cyclePhase === 'coiling') {
      cycleTimer += dt;
      if (cycleTimer >= 0.42) {
        phraseStore.nextRandom({ source: 'jacket-legend' });
        currentState = phraseStore.getState();
        drawJacketLegend();
        cyclePhase = 'pulling';
        targetTension = 1.0;
        sound.playUsbPlug();
      }
    } else if (cyclePhase === 'pulling' && Math.abs(tension - 1.0) < 0.01) {
      cyclePhase = 'idle';
    }

    if (!isDragging) {
      const stiffness = 135;
      const damping = 17.5;
      const force = (targetTension - tension) * stiffness - tensionVel * damping;
      tensionVel += force * dt;
      tension = Math.max(0.0, Math.min(1.0, tension + tensionVel * dt));
      if (Math.abs(targetTension - tension) < 0.0008 && Math.abs(tensionVel) < 0.003) {
        tension = targetTension;
        tensionVel = 0;
      }
    }

    if (Math.abs(tension - lastGeoTension) > 0.0004) {
      updateCableGeometry(tension);
      lastGeoTension = tension;
    }
  }

  drawJacketLegend();
  updateCableGeometry(tension);
  lastGeoTension = tension;
  if (onReady) onReady();

  return {
    setPhrase(state, meta = {}) {
      currentState = state;
      if (meta.source === 'jacket-legend') return;
      drawJacketLegend();
    },

    setTheme(nextTheme) {
      currentTheme = nextTheme;
      applyStudioTheme(nextTheme);
      cableAo.material.opacity = nextTheme === 'dark' ? 0.56 : 0.24;
    },

    triggerPrimary() {
      triggerCoilAndPull();
    },

    setSettled(settled) {
      cyclePhase = 'idle';
      tension = settled ? 1.0 : 0.0;
      targetTension = tension;
      tensionVel = 0;
      updateCableGeometry(tension);
      lastGeoTension = tension;
    },

    isMoving() {
      return Boolean(cyclePhase !== 'idle' || isDragging || Math.abs(targetTension - tension) > .0002);
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
      legendTex.dispose();
      cableGeo.dispose();
      cableMat.dispose();
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
