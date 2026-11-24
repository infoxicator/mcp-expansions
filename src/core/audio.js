// Muted-by-default WebAudio procedural physical sound engine

class SoundEngine {
  constructor() {
    this.muted = true; // Muted by default per spec
    this.ctx = null;
    this.noiseBuffer = null;
    this.listeners = new Set();
  }

  isMuted() {
    return this.muted;
  }

  setMuted(val) {
    this.muted = Boolean(val);
    if (!this.muted) {
      this._ensureContext();
    }
    for (const fn of this.listeners) fn(this.muted);
  }

  toggle() {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playSubtleUiClick(0.25);
    }
    return this.muted;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _ensureContext() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const len = Math.floor(this.ctx.sampleRate * 0.15);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  /**
   * Heavy, satisfying chrome bearing-steel clack.
   * @param {number} intensity 0..1 scaled by impact velocity
   */
  playSteelClack(intensity = 0.8) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const clamped = Math.max(0.03, Math.min(1.0, intensity));
    const gainScale = Math.pow(clamped, 1.35) * 0.65;
    const now = ctx.currentTime;

    // 1. Ultra-short crisp steel-on-steel impulse burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(3400 + clamped * 1600, now);
    hp.Q.setValueAtTime(2.2, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(gainScale * 0.85, now);
    nGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.006);
    noise.connect(hp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.01);

    // 2. Hardened steel sphere high-Q ringing modes (inharmonic bearing partials)
    const partials = [
      { freq: 3920, amp: 0.42, decay: 0.042 },
      { freq: 6580, amp: 0.28, decay: 0.028 },
      { freq: 10450, amp: 0.14, decay: 0.016 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq * (0.985 + Math.random() * 0.03), now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainScale * p.amp, now);
      g.gain.exponentialRampToValueAtTime(0.0004, now + p.decay);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.005);
    }

    // 3. Low dense metallic body thump (gives weight)
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(260 + clamped * 60, now);
    body.frequency.exponentialRampToValueAtTime(110, now + 0.018);
    const bGain = ctx.createGain();
    bGain.gain.setValueAtTime(gainScale * 0.45, now);
    bGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.022);
    body.connect(bGain).connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.028);
  }

  /** Tactile USB-C magnetic plug seat click */
  playUsbPlug() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Metallic spring latch snap
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.Q.setValueAtTime(3.0, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.012);
    noise.connect(bp).connect(g).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.016);

    // Subtle seated thud
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.022);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22, now);
    og.gain.exponentialRampToValueAtTime(0.0005, now + 0.028);
    osc.connect(og).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  /** Dry USB-C unplug release */
  playUsbUnplug() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500, now);
    bp.Q.setValueAtTime(1.8, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.016);
    noise.connect(bp).connect(g).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.02);
  }

  /** Dry micro relay / PD step tick */
  playRelayTick(pitch = 1.0, volume = 0.14) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1750 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(820 * pitch, now + 0.009);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0004, now + 0.012);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.015);
  }

  /** Mechanical rotor / ratchet / dial detent */
  playMechanicalDetent(pitch = 1.0, volume = 0.22) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2100 * pitch, now);
    bp.Q.setValueAtTime(2.6, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0004, now + 0.01);
    noise.connect(bp).connect(g).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.014);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(320 * pitch, now);
    body.frequency.exponentialRampToValueAtTime(120, now + 0.014);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(volume * 0.6, now);
    bg.gain.exponentialRampToValueAtTime(0.0004, now + 0.018);
    body.connect(bg).connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.022);
  }

  /** Split-flap / card clatter */
  playFlapClack(volume = 0.2) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1180 + Math.random() * 240, now);
    bp.Q.setValueAtTime(1.5, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.024);
    noise.connect(bp).connect(g).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.03);
  }

  playSubtleUiClick(volume = 0.14) {
    this.playRelayTick(1.15, volume);
  }
}

export const sound = new SoundEngine();
