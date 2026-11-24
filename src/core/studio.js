import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const STUDIO_THEMES = {
  light: {
    bgHex: 0xf2ede4,
    bgCss: '#F2EDE4',
    shadowOpacity: 0.16,
    aoOpacity: 0.30,
    exposure: 1.04,
    envIntensity: 1.05,
    keyIntensity: 2.15,
    fillIntensity: 0.72,
    rimIntensity: 0.78,
  },
  dark: {
    bgHex: 0x131312,
    bgCss: '#131312',
    shadowOpacity: 0.58,
    aoOpacity: 0.64,
    exposure: 1.10,
    envIntensity: 1.0,
    keyIntensity: 2.35,
    fillIntensity: 0.52,
    rimIntensity: 1.18,
  },
};

class StudioRuntime {
  constructor() {
    this.renderer = null;
    this.pmrem = null;
    this.envs = {};
    this.gltfLoader = null;
    this.modelCache = new Map();
    this.textureCache = new Map();
    this.supported = null;
    this.currentSize = 0;
  }

  checkWebGLSupport() {
    if (this.supported !== null) return this.supported;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fallback') === 'no-webgl') {
      this.supported = false;
      return false;
    }
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      this.supported = Boolean(gl);
    } catch (_) {
      this.supported = false;
    }
    return this.supported;
  }

  ensureRenderer() {
    if (this.renderer) return this.renderer;
    if (!this.checkWebGLSupport()) return null;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(1);
    renderer.setSize(1080, 1080, false);
    this.currentSize = 1080;

    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    this.envs.light = this._buildStudioEnv('light');
    this.envs.dark = this._buildStudioEnv('dark');

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./vendor/three/jsm/libs/draco/gltf/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    return renderer;
  }

  _buildStudioEnv(mode) {
    // High-contrast product photography cyclorama: dark surround + crisp bright softboxes + black velvet negative-fill flags
    const envScene = new THREE.Scene();
    const isLight = mode === 'light';

    const domeGeo = new THREE.SphereGeometry(28, 32, 20);
    const domeMat = new THREE.MeshBasicMaterial({
      color: isLight ? new THREE.Color(0.24, 0.23, 0.22) : new THREE.Color(0.05, 0.05, 0.055),
      side: THREE.BackSide,
    });
    envScene.add(new THREE.Mesh(domeGeo, domeMat));

    const addPanel = (w, h, pos, lookAt, rgb) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.lookAt(lookAt[0], lookAt[1], lookAt[2]);
      envScene.add(mesh);
    };

    if (isLight) {
      // Overhead diffused warm-daylight softbox
      addPanel(14, 9, [0, 13.5, 1.5], [0, 0, 0], [4.2, 4.1, 3.9]);
      // Left tall key strip softbox (signature curved highlight on chrome & bevels)
      addPanel(5.2, 16, [-12.5, 5.5, 7.0], [0, 0, 0], [5.8, 5.65, 5.4]);
      // Right soft fill card (cooler satin bounce)
      addPanel(6.5, 13, [13.0, 4.5, 5.5], [0, 0, 0], [2.2, 2.3, 2.45]);
      // Rear rim kicker
      addPanel(12, 3.5, [0, 9.5, -12.0], [0, 0, 0], [3.2, 3.1, 2.95]);
      // Warm paper sweep floor bounce (lifts lower hemisphere of chrome cleanly)
      addPanel(28, 28, [0, -7.5, 0], [0, 0, 0], [1.18, 1.12, 1.03]);
      // Black velvet negative-fill studio flags (creates rich silver/charcoal metallic separation on chrome!)
      addPanel(9.0, 14, [-6.5, 0.5, 12.5], [0, 0, 0], [0.02, 0.02, 0.022]);
      addPanel(8.0, 13, [7.5, 0.0, 12.0], [0, 0, 0], [0.025, 0.025, 0.028]);
      addPanel(16, 4.0, [0, 2.5, 13.5], [0, 0, 0], [0.16, 0.155, 0.15]);
    } else {
      // Sculpted obsidian studio
      addPanel(12, 8, [0, 13, 1.5], [0, 0, 0], [4.0, 3.95, 3.85]);
      addPanel(4.8, 15, [-12, 6.5, 7.5], [0, 0, 0], [6.2, 6.1, 5.9]);
      addPanel(5.5, 13, [12.5, 5.5, 4], [0, 0, 0], [2.6, 2.75, 2.95]);
      addPanel(11, 3.5, [0, 9.5, -11.5], [0, 0, 0], [3.6, 3.55, 3.45]);
      addPanel(26, 26, [0, -8, 0], [0, 0, 0], [0.11, 0.11, 0.115]);
      addPanel(8, 14, [-6, 1, 12.5], [0, 0, 0], [0.012, 0.012, 0.014]);
      addPanel(7, 12, [7, -1, 12], [0, 0, 0], [0.016, 0.016, 0.018]);
    }

    const rt = this.pmrem.fromScene(envScene, 0.028);
    envScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    return rt.texture;
  }

  getEnvironment(theme) {
    this.ensureRenderer();
    return this.envs[theme === 'dark' ? 'dark' : 'light'];
  }

  async loadGLB(url) {
    this.ensureRenderer();
    if (!this.modelCache.has(url)) {
      const promise = new Promise((resolve, reject) => {
        this.gltfLoader.load(
          url,
          (gltf) => resolve(gltf),
          undefined,
          (err) => reject(err)
        );
      });
      this.modelCache.set(url, promise);
    }
    const gltf = await this.modelCache.get(url);
    return gltf.scene.clone(true);
  }

  renderToCanvas(scene, camera, targetCanvas, theme = 'light', exposureMultiplier = 1.0) {
    const renderer = this.ensureRenderer();
    if (!renderer || !targetCanvas) return;

    const w = targetCanvas.width;
    const h = targetCanvas.height;
    if (w < 2 || h < 2) return;

    if (this.currentSize !== w || renderer.domElement.height !== h) {
      renderer.setSize(w, h, false);
      this.currentSize = w;
    }

    const preset = STUDIO_THEMES[theme === 'dark' ? 'dark' : 'light'];
    renderer.toneMappingExposure = preset.exposure * exposureMultiplier;
    renderer.render(scene, camera);

    const ctx = targetCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(renderer.domElement, 0, 0, w, h);
    }
  }

  /** Cached subtle anodized aluminum micro-grain roughness & bump map */
  getAnodizedTexture() {
    if (this.textureCache.has('anodized')) return this.textureCache.get('anodized');
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < d.length; i += 4) {
      const n = 152 + Math.floor(rand() * 44);
      d[i] = n;
      d[i + 1] = n;
      d[i + 2] = n;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.textureCache.set('anodized', tex);
    return tex;
  }

  /** Cached matte TPE/silicone cable jacket micro-texture */
  getCableJacketTexture() {
    if (this.textureCache.has('cable')) return this.textureCache.get('cable');
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    let seed = 9001;
    const rand = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let y = 0; y < size; y++) {
      const streak = (rand() - 0.5) * 10;
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const v = Math.max(125, Math.min(200, Math.floor(158 + streak + (rand() - 0.5) * 16)));
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 12);
    this.textureCache.set('cable', tex);
    return tex;
  }

  /**
   * Generate crisp laser-engraved letter textures (albedo, roughness, bump) for a mirror chrome sphere.
   * Uses flipY = false to match Blender glTF UV orientation (v=0 top, v=1 bottom).
   */
  getEngravedChromeMaps(letter) {
    const key = `chrome-engraved-${letter}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const w = 1024;
    const h = 512;

    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = w;
    albedoCanvas.height = h;
    const actx = albedoCanvas.getContext('2d');
    actx.fillStyle = '#F2F4F7';
    actx.fillRect(0, 0, w, h);

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = w;
    roughCanvas.height = h;
    const rctx = roughCanvas.getContext('2d');
    rctx.fillStyle = 'rgb(11, 11, 11)';
    rctx.fillRect(0, 0, w, h);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w;
    bumpCanvas.height = h;
    const bctx = bumpCanvas.getContext('2d');
    bctx.fillStyle = 'rgb(205, 205, 205)';
    bctx.fillRect(0, 0, w, h);

    const fontSpec = '500 108px "Inter", "Helvetica Neue", Arial, sans-serif';
    const cx = w * 0.5;
    const cy = h * 0.50;

    const drawGlyph = (ctx, fill, stroke, lineWidth, blur = 0) => {
      ctx.save();
      ctx.translate(cx, cy);
      // Flip vertically in canvas when flipY=false? Wait: in Blender v=0.5+lat/pi -> +Z (top) has v=1.0!
      // When glTF exports UV (u, v), glTF stores (u, 1 - v) in buffer, so top (+Y in Three) has glTF v=0!
      // With flipY=false, canvas y=0 maps to glTF v=0 (TOP of sphere), so drawing upright in canvas is upright on the sphere!
      ctx.scale(0.72, 1.0);
      ctx.font = fontSpec;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (blur > 0) ctx.filter = `blur(${blur}px)`;
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(letter, 0, 0);
      }
      ctx.fillStyle = fill;
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    };

    // Precision satin laser-etched finish on mirror chrome
    drawGlyph(actx, '#1B1E24', '#383C44', 2.0, 0);
    drawGlyph(rctx, 'rgb(142, 142, 142)', 'rgb(175, 175, 175)', 2.8, 0);
    drawGlyph(bctx, 'rgb(28, 28, 28)', 'rgb(96, 96, 96)', 4.2, 1.5);

    const map = new THREE.CanvasTexture(albedoCanvas);
    map.flipY = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.flipY = false;
    roughnessMap.anisotropy = 8;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.flipY = false;
    bumpMap.anisotropy = 8;

    const result = { map, roughnessMap, bumpMap };
    this.textureCache.set(key, result);
    return result;
  }

  /** Soft feathered elliptical AO contact shadow texture */
  getSoftShadowTexture() {
    if (this.textureCache.has('contact-shadow')) return this.textureCache.get('contact-shadow');
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
    grad.addColorStop(0.42, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.10)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    this.textureCache.set('contact-shadow', tex);
    return tex;
  }
}

export const studio = new StudioRuntime();

/**
 * Helper to create a studio-lit scene with seamless shadow-catching floor and calibrated lights.
 */
export function createStudioScene(theme = 'light') {
  const preset = STUDIO_THEMES[theme === 'dark' ? 'dark' : 'light'];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(preset.bgHex);
  scene.environment = studio.getEnvironment(theme);
  scene.environmentIntensity = preset.envIntensity;

  // Main overhead-left softbox key directional light with crisp soft shadows
  const keyLight = new THREE.DirectionalLight(0xfffaf2, preset.keyIntensity);
  keyLight.position.set(-3.2, 9.5, 4.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 24;
  const d = 5.8;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.015;
  keyLight.shadow.radius = 7.5;
  scene.add(keyLight);

  // Soft cool fill light from right
  const fillLight = new THREE.DirectionalLight(0xeef4ff, preset.fillIntensity);
  fillLight.position.set(5.5, 4.2, 3.8);
  scene.add(fillLight);

  // Rear subtle rim kicker to separate matte black housings in both light & dark modes
  const rimLight = new THREE.DirectionalLight(0xfff5e8, preset.rimIntensity);
  rimLight.position.set(1.8, 6.0, -5.5);
  scene.add(rimLight);

  // Seamless shadow-catcher floor plane
  const shadowGeo = new THREE.PlaneGeometry(24, 24);
  const shadowMat = new THREE.ShadowMaterial({
    opacity: preset.shadowOpacity,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.001;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const applyTheme = (nextTheme) => {
    const p = STUDIO_THEMES[nextTheme === 'dark' ? 'dark' : 'light'];
    scene.background = new THREE.Color(p.bgHex);
    scene.environment = studio.getEnvironment(nextTheme);
    scene.environmentIntensity = p.envIntensity;
    keyLight.intensity = p.keyIntensity;
    fillLight.intensity = p.fillIntensity;
    rimLight.intensity = p.rimIntensity;
    shadowMat.opacity = p.shadowOpacity;
  };

  return { scene, keyLight, fillLight, rimLight, shadowPlane, applyTheme };
}

export function createContactShadow(width, depth, opacity = 0.34, y = 0.002) {
  const mat = new THREE.MeshBasicMaterial({
    map: studio.getSoftShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}
