import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const STUDIO_THEMES = {
  light: {
    bgHex: 0xf2ede4,
    bgCss: '#F2EDE4',
    shadowOpacity: 0.31,
    aoOpacity: 0.30,
    exposure: 1.04,
    envIntensity: .85,
    keyIntensity: .79,
    fillIntensity: 0.24,
    rimIntensity: 0.32,
  },
  dark: {
    bgHex: 0x131312,
    bgCss: '#131312',
    shadowOpacity: 0.42,
    aoOpacity: 0.64,
    exposure: 1.10,
    envIntensity: 1.0,
    keyIntensity: 1.06,
    fillIntensity: 0.52,
    rimIntensity: 1.18,
  },
};

class StudioRuntime {
  constructor() {
    this.renderer = null;
    this.pmrem = null;
    this.environments = {};
    this.environmentReady = null;
    this.gltfLoader = null;

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
      const gl = c.getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
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
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(1080, 1080, false);
    this.currentSize = 1080;

    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./vendor/three/jsm/libs/draco/gltf/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    return renderer;
  }

  prepareLighting() {
    this.ensureRenderer();
    this.environmentReady ??= Promise.all(['light','dark'].map(async (theme) => {
      const panorama = await new HDRLoader().loadAsync('./assets/lighting/' + theme + '.hdr');
      this.environments[theme] = this.pmrem.fromEquirectangular(panorama).texture;
      panorama.dispose();
    })).catch((error) => {
        this.environmentReady = null;
        throw error;
      });
    return this.environmentReady;
  }

  async loadGLB(url) {
    // The browser caches the compressed bytes. Each mounted instrument owns the
    // decoded geometry it disposes when it leaves the three-poster window.
    return (await this.gltfLoader.loadAsync(url)).scene;
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
    if (!scene.userData.surfacesReady) {
      const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
      scene.traverse((object) => {
        if (object.isMesh && scene.userData.fixed.has(object.userData.name ?? object.name)) {
          object.material = depthOnly;
          object.castShadow = false;
          object.renderOrder = -2;
          return;
        }
        if (object.geometry?.attributes.color && object.material?.isMeshStandardMaterial) {
          object.material.vertexColors = true;
        }
      });
      scene.userData.surfacesReady = true;
    }
    this.renderPhotograph(renderer, scene, camera, w, h);

    const ctx = targetCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(renderer.domElement, 0, 0, w, h);
    }
  }

  renderPhotograph(renderer, scene, camera, w, h) {
    if (!this.negative) {
      const depth = new THREE.DepthTexture(w, h);
      this.negative = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType, depthTexture: depth, samples: 2,
      });
      const lens = new THREE.ShaderMaterial({
        uniforms: {
          photograph: { value: null }, frame: { value: this.negative.texture }, depth: { value: depth },
          pixel: { value: new THREE.Vector2() }, focus: { value: 1 },
          clip: { value: new THREE.Vector2() },
        },
        vertexShader: `
          varying vec2 coord;
          void main() { coord = uv; gl_Position = vec4(position.xy, 0., 1.); }
        `,
        fragmentShader: `
          uniform sampler2D frame, depth, photograph;
          uniform vec2 pixel, clip;
          uniform float focus;
          varying vec2 coord;
          void main() {
            float z = texture2D(depth, coord).r;
            float distance = clip.x * clip.y / (clip.y - z * (clip.y - clip.x));
            float radius = min(1.6, max(0., abs(distance - focus) - .36) * .84);
            vec4 sampleColor = texture2D(frame, coord) * .4;
            for (int i = 0; i < 6; i++) {
              float a = float(i) * 1.047198;
              sampleColor += .1 * texture2D(frame, coord + vec2(cos(a), sin(a)) * pixel * radius);
            }
            gl_FragColor = vec4(sampleColor.rgb / max(sampleColor.a, .0001), 1.);
            #include <tonemapping_fragment>
            gl_FragColor.rgb = mix(texture2D(photograph, coord).rgb, gl_FragColor.rgb, sampleColor.a);
            #include <colorspace_fragment>
            float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056,.00583715))));
            gl_FragColor.rgb += (grain - .5) * .006;
          }
        `,
        depthTest: false, depthWrite: false,
      });
      this.lens = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lens);
      this.lens.frustumCulled = false;
      this.lensCamera = new THREE.Camera();
    }
    this.negative.setSize(w, h);
    const uniforms = this.lens.material.uniforms;
    uniforms.photograph.value = scene.userData.photograph;
    uniforms.depth.value = this.negative.depthTexture;
    uniforms.pixel.value.set(1 / w, 1 / h);
    uniforms.clip.value.set(camera.near, camera.far);
    // Focus on the instrument face, leaving detail on its reading plane intact.
    uniforms.focus.value = camera.position.length() - .65;
    renderer.setRenderTarget(this.negative);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.lens, this.lensCamera);
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
      const n = 205 + Math.floor(rand() * 45);
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
        const v = Math.max(125, Math.min(250, Math.floor(214 + streak + (rand() - 0.5) * 16)));
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
    rctx.fillStyle = 'rgb(27, 27, 27)';
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
    drawGlyph(actx, '#73797b', '#646a6c', 1.2, 0);
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
export async function createStudioScene(theme, instrumentId) {
  const preset = STUDIO_THEMES[theme === 'dark' ? 'dark' : 'light'];
  const scene = new THREE.Scene();
  const base = './assets/plates/' + instrumentId + '/';
  const loader = new THREE.TextureLoader();
  const [light, dark, names] = await Promise.all([
    loader.loadAsync(base + 'light.webp'), loader.loadAsync(base + 'dark.webp'),
    fetch(base + 'hardware.json').then(response => response.json()),
  ]);
  light.colorSpace = dark.colorSpace = THREE.SRGBColorSpace;
  scene.userData.plates = { light, dark };
  scene.userData.fixed = new Set(names);
  scene.userData.photograph = scene.userData.plates[theme];
  scene.environment = studio.environments[theme];
  scene.environmentIntensity = preset.envIntensity;
  scene.environmentRotation.y = -.16;

  // Main overhead-left softbox key directional light with crisp soft shadows
  const keyLight = new THREE.DirectionalLight(0xfffaf2, preset.keyIntensity);
  keyLight.position.set(-4.6, 7.3, 3.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 24;
  const d = 5.8;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.015;
  keyLight.shadow.radius = 10;
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
    scene.userData.photograph = scene.userData.plates[nextTheme];
    scene.environment = studio.environments[nextTheme];
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
