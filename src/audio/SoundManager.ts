import * as THREE from 'three';
import {
  DEFAULT_SETTINGS,
  GameSettings,
  SurfaceMaterialType,
  WeaponId,
} from '../types/contracts';

/**
 * ============================================================================
 * BLACKLINE // TACTICAL RESPONSE — PROCEDURAL WEB AUDIO ENGINE
 * ============================================================================
 * 100% procedural Web Audio synthesis with zero external audio assets.
 * Features:
 * - Pre-computed white, pink, and brown noise buffers
 * - Concurrency capping to prevent clipping and node leaks under rapid fire
 * - 3D distance attenuation and stereo panning relative to listener yaw
 * - Distinct weapon acoustic signatures (5.56mm AR, subsonic SMG, 12G Shotgun,
 *   7.62mm DMR supersonic crack + tail, 9mm sidearm)
 * - Surface-aware footsteps & impacts (concrete, metal, wood, sandstone, snow, water, glass, dirt)
 * - Continuous procedural environmental ambience with clean teardown
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;

  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private activeSfxCount = 0;
  private readonly maxConcurrentSfx = 28;

  private currentAmbienceType: 'rain_harbor' | 'desert_wind' | 'arctic_facility' | null = null;
  private ambienceCleanupFns: Array<() => void> = [];
  private lastHoverTime = 0;
  private listenerYaw = 0;

  constructor(initialSettings?: Partial<GameSettings>) {
    if (initialSettings) {
      this.settings = { ...this.settings, ...initialSettings };
    }
  }

  /**
   * Lazily initializes or resumes the Web Audio API context upon user interaction.
   */
  public resumeContext(): void {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        this.ctx = new AudioCtx();

        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -10;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.12;

        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.ambienceGain = this.ctx.createGain();

        this.sfxGain.connect(this.compressor);
        this.ambienceGain.connect(this.compressor);
        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.buildNoiseBuffers();
        this.syncGainLevels();

        if (this.currentAmbienceType && this.ambienceCleanupFns.length === 0) {
          const pendingType = this.currentAmbienceType;
          this.currentAmbienceType = null;
          this.startAmbience(pendingType);
        }
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {
          // Ignore autoplay restriction errors until next user gesture
        });
      }
    } catch {
      // Fallback silently in environments without Web Audio API
    }
  }

  /**
   * Updates audio mix levels from GameSettings.
   */
  public applySettings(settings: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.syncGainLevels();
  }

  /**
   * Direct volume setter convenience method.
   */
  public setVolumes(master: number, sfx: number, ambience: number): void {
    this.settings.masterVolume = THREE.MathUtils.clamp(master, 0, 1);
    this.settings.sfxVolume = THREE.MathUtils.clamp(sfx, 0, 1);
    this.settings.ambienceVolume = THREE.MathUtils.clamp(ambience, 0, 1);
    this.syncGainLevels();
  }

  /**
   * Updates listener yaw so 3D sounds pan accurately even when listenerYaw is omitted in individual calls.
   */
  public setListenerOrientation(yaw: number): void {
    this.listenerYaw = yaw;
  }

  private syncGainLevels(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(
      THREE.MathUtils.clamp(this.settings.masterVolume, 0, 1),
      now,
      0.015
    );
    this.sfxGain.gain.setTargetAtTime(
      THREE.MathUtils.clamp(this.settings.sfxVolume, 0, 1),
      now,
      0.015
    );
    this.ambienceGain.gain.setTargetAtTime(
      THREE.MathUtils.clamp(this.settings.ambienceVolume, 0, 1),
      now,
      0.03
    );
  }

  private buildNoiseBuffers(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2; // 2 seconds loopable noise buffers

    // White Noise
    this.whiteNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const whiteData = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    // Pink Noise (Paul Kellet's refinement)
    this.pinkNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const pinkData = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // Brown Noise
    this.brownNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const brownData = this.brownNoiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      brownData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = brownData[i];
      brownData[i] *= 3.2;
    }
  }

  private ensureReady(): boolean {
    if (!this.ctx) {
      this.resumeContext();
    }
    if (!this.ctx || !this.sfxGain) return false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    if (this.activeSfxCount >= this.maxConcurrentSfx) {
      return false;
    }
    return true;
  }

  private trackVoice(durationSeconds: number): void {
    this.activeSfxCount++;
    const ms = Math.max(30, Math.ceil(durationSeconds * 1000));
    window.setTimeout(() => {
      this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
    }, ms);
  }

  /**
   * Creates a spatial output node (Gain + StereoPanner/Panner) connected to sfxGain.
   */
  private createSpatialRoute(
    origin?: THREE.Vector3,
    listenerPos?: THREE.Vector3,
    listenerYaw?: number,
    maxDist = 75
  ): { input: AudioNode; distanceFactor: number } {
    const ctx = this.ctx!;
    const outGain = ctx.createGain();
    let distanceFactor = 1.0;

    if (origin && listenerPos) {
      const dx = origin.x - listenerPos.x;
      const dy = origin.y - listenerPos.y;
      const dz = origin.z - listenerPos.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist > 0.4) {
        distanceFactor = Math.max(0.04, 1 - Math.min(dist / maxDist, 0.96));
        distanceFactor = distanceFactor * distanceFactor;

        const yaw = listenerYaw !== undefined ? listenerYaw : this.listenerYaw;
        // Right vector in Three.js (-Z forward, +X right) for yaw rotation around Y
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        const invHorizontal = 1 / Math.max(0.001, Math.hypot(dx, dz));
        const pan = THREE.MathUtils.clamp((dx * rightX + dz * rightZ) * invHorizontal, -0.92, 0.92);

        if (typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(pan, ctx.currentTime);
          outGain.connect(panner);
          panner.connect(this.sfxGain!);
        } else {
          outGain.connect(this.sfxGain!);
        }
      } else {
        outGain.connect(this.sfxGain!);
      }
    } else {
      outGain.connect(this.sfxGain!);
    }

    outGain.gain.setValueAtTime(distanceFactor, ctx.currentTime);
    return { input: outGain, distanceFactor };
  }

  /**
   * Synthesizes weapon fire with distinct acoustic profiles per weapon class.
   */
  public playWeaponFire(
    weaponId: WeaponId,
    origin?: THREE.Vector3,
    listenerPos?: THREE.Vector3,
    listenerYaw?: number
  ): void {
    if (!this.ensureReady() || !this.ctx || !this.whiteNoiseBuffer || !this.pinkNoiseBuffer) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { input, distanceFactor } = this.createSpatialRoute(origin, listenerPos, listenerYaw, 95);
    if (distanceFactor <= 0.045) return;

    const jitter = 0.96 + Math.random() * 0.08;

    switch (weaponId) {
      case 'ar': {
        // M4A8 Vanguard: Punchy 5.56mm supersonic crack + low-mid chamber thump + mechanical bolt click
        this.trackVoice(0.32);

        // 1. Sub-bass & low-mid barrel punch
        const punchOsc = ctx.createOscillator();
        const punchGain = ctx.createGain();
        punchOsc.type = 'triangle';
        punchOsc.frequency.setValueAtTime(165 * jitter, now);
        punchOsc.frequency.exponentialRampToValueAtTime(38, now + 0.09);
        punchGain.gain.setValueAtTime(0.68, now);
        punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
        punchOsc.connect(punchGain);
        punchGain.connect(input);
        punchOsc.start(now);
        punchOsc.stop(now + 0.1);

        // 2. High-pressure 5.56mm muzzle blast (filtered white noise)
        const blastSrc = ctx.createBufferSource();
        blastSrc.buffer = this.whiteNoiseBuffer;
        blastSrc.playbackRate.value = 1.05 * jitter;
        const blastFilter = ctx.createBiquadFilter();
        blastFilter.type = 'bandpass';
        blastFilter.frequency.setValueAtTime(1850 * jitter, now);
        blastFilter.frequency.exponentialRampToValueAtTime(520, now + 0.22);
        blastFilter.Q.value = 1.1;

        const blastGain = ctx.createGain();
        blastGain.gain.setValueAtTime(0.85, now);
        blastGain.gain.exponentialRampToValueAtTime(0.18, now + 0.045);
        blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        blastSrc.connect(blastFilter);
        blastFilter.connect(blastGain);
        blastGain.connect(input);
        blastSrc.start(now, Math.random() * 0.8);
        blastSrc.stop(now + 0.25);

        // 3. Mechanical bolt carrier clack (first-person proximity emphasis)
        if (distanceFactor > 0.65) {
          const mechOsc = ctx.createOscillator();
          const mechGain = ctx.createGain();
          mechOsc.type = 'square';
          mechOsc.frequency.setValueAtTime(2400 * jitter, now + 0.015);
          mechOsc.frequency.exponentialRampToValueAtTime(950, now + 0.045);
          mechGain.gain.setValueAtTime(0.16, now + 0.015);
          mechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
          mechOsc.connect(mechGain);
          mechGain.connect(input);
          mechOsc.start(now + 0.015);
          mechOsc.stop(now + 0.05);
        }
        break;
      }

      case 'smg': {
        // VX-9 Spectre: Tight, high-rate subsonic/suppressed tactical thump + snappy cyclic bolt
        this.trackVoice(0.2);

        const thumpOsc = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        thumpOsc.type = 'sine';
        thumpOsc.frequency.setValueAtTime(220 * jitter, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(58, now + 0.065);
        thumpGain.gain.setValueAtTime(0.55, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        thumpOsc.connect(thumpGain);
        thumpGain.connect(input);
        thumpOsc.start(now);
        thumpOsc.stop(now + 0.075);

        const snapSrc = ctx.createBufferSource();
        snapSrc.buffer = this.pinkNoiseBuffer;
        snapSrc.playbackRate.value = 1.35 * jitter;
        const snapFilter = ctx.createBiquadFilter();
        snapFilter.type = 'bandpass';
        snapFilter.frequency.setValueAtTime(2600 * jitter, now);
        snapFilter.frequency.exponentialRampToValueAtTime(900, now + 0.12);
        snapFilter.Q.value = 1.6;

        const snapGain = ctx.createGain();
        snapGain.gain.setValueAtTime(0.62, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        snapSrc.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(input);
        snapSrc.start(now, Math.random() * 0.9);
        snapSrc.stop(now + 0.14);
        break;
      }

      case 'shotgun': {
        // M870 Breacher: Massive 12-gauge chest-thumping boom + wide transient + pump action rack
        this.trackVoice(0.65);

        // Deep low-end cannon boom
        const boomOsc = ctx.createOscillator();
        const boomGain = ctx.createGain();
        boomOsc.type = 'sawtooth';
        boomOsc.frequency.setValueAtTime(125 * jitter, now);
        boomOsc.frequency.exponentialRampToValueAtTime(26, now + 0.19);
        boomGain.gain.setValueAtTime(0.95, now);
        boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
        boomOsc.connect(boomGain);
        boomGain.connect(input);
        boomOsc.start(now);
        boomOsc.stop(now + 0.22);

        // Wide-spectrum shotgun blast + room tail
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = this.whiteNoiseBuffer;
        const lowPass = ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.setValueAtTime(3600 * jitter, now);
        lowPass.frequency.exponentialRampToValueAtTime(340, now + 0.44);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(1.0, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.28, now + 0.08);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

        noiseSrc.connect(lowPass);
        lowPass.connect(noiseGain);
        noiseGain.connect(input);
        noiseSrc.start(now, Math.random() * 0.5);
        noiseSrc.stop(now + 0.48);

        // Delayed pump-action rack (ch-chk) for local player or nearby shooters
        if (distanceFactor > 0.5) {
          this.schedulePumpRack(now + 0.26, input);
        }
        break;
      }

      case 'dmr': {
        // SR-25 Longbow: High-caliber 7.62mm supersonic snap + metallic ring + long canyon/harbor echo tail
        this.trackVoice(0.6);

        // Supersonic whip crack
        const crackOsc = ctx.createOscillator();
        const crackGain = ctx.createGain();
        crackOsc.type = 'sawtooth';
        crackOsc.frequency.setValueAtTime(3200 * jitter, now);
        crackOsc.frequency.exponentialRampToValueAtTime(140, now + 0.055);
        crackGain.gain.setValueAtTime(0.75, now);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        crackOsc.connect(crackGain);
        crackGain.connect(input);
        crackOsc.start(now);
        crackOsc.stop(now + 0.065);

        // High-caliber body punch
        const bodyOsc = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(145 * jitter, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(32, now + 0.14);
        bodyGain.gain.setValueAtTime(0.85, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        bodyOsc.connect(bodyGain);
        bodyGain.connect(input);
        bodyOsc.start(now);
        bodyOsc.stop(now + 0.16);

        // Extended echo tail
        const tailSrc = ctx.createBufferSource();
        tailSrc.buffer = this.pinkNoiseBuffer;
        const tailFilter = ctx.createBiquadFilter();
        tailFilter.type = 'bandpass';
        tailFilter.frequency.setValueAtTime(1450 * jitter, now);
        tailFilter.frequency.exponentialRampToValueAtTime(380, now + 0.52);
        tailFilter.Q.value = 0.9;

        const tailGain = ctx.createGain();
        tailGain.gain.setValueAtTime(0.9, now);
        tailGain.gain.exponentialRampToValueAtTime(0.22, now + 0.07);
        tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);

        tailSrc.connect(tailFilter);
        tailFilter.connect(tailGain);
        tailGain.connect(input);
        tailSrc.start(now, Math.random() * 0.6);
        tailSrc.stop(now + 0.55);
        break;
      }

      case 'pistol':
      default: {
        // P226 Sentinel: Crisp 9mm pop + slide snap
        this.trackVoice(0.22);

        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = 'triangle';
        popOsc.frequency.setValueAtTime(240 * jitter, now);
        popOsc.frequency.exponentialRampToValueAtTime(62, now + 0.065);
        popGain.gain.setValueAtTime(0.58, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        popOsc.connect(popGain);
        popGain.connect(input);
        popOsc.start(now);
        popOsc.stop(now + 0.075);

        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = this.whiteNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2350 * jitter, now);
        bp.frequency.exponentialRampToValueAtTime(780, now + 0.15);
        bp.Q.value = 1.3;

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.68, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        noiseSrc.connect(bp);
        bp.connect(nGain);
        nGain.connect(input);
        noiseSrc.start(now, Math.random() * 0.7);
        noiseSrc.stop(now + 0.17);
        break;
      }
    }
  }

  private schedulePumpRack(startTime: number, destination: AudioNode): void {
    if (!this.ctx || !this.whiteNoiseBuffer) return;
    const ctx = this.ctx;

    for (let step = 0; step < 2; step++) {
      const t = startTime + step * 0.085;
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(step === 0 ? 1900 : 2450, t);
      filter.Q.value = 3.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.06);
    }
  }

  /**
   * Empty magazine metallic trigger click.
   */
  public playDryFire(): void {
    if (!this.ensureReady() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.06);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1950, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.028);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  /**
   * Multi-stage tactical reload mechanical audio.
   */
  public playReloadStep(phase: 'mag_out' | 'mag_in' | 'bolt_rack'): void {
    if (!this.ensureReady() || !this.ctx || !this.whiteNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.18);

    if (phase === 'mag_out') {
      // Magazine release button click + polymer/metal slide out
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 0.1);

      const scrape = ctx.createBufferSource();
      scrape.buffer = this.whiteNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200, now);
      bp.Q.value = 2.5;
      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.18, now + 0.015);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      scrape.connect(bp);
      bp.connect(sGain);
      sGain.connect(this.sfxGain!);
      scrape.start(now + 0.015, 0.2);
      scrape.stop(now + 0.12);
    } else if (phase === 'mag_in') {
      // Firm magazine seat thud + locking catch click
      const thud = ctx.createOscillator();
      const tGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(160, now);
      thud.frequency.exponentialRampToValueAtTime(65, now + 0.06);
      tGain.gain.setValueAtTime(0.38, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      thud.connect(tGain);
      tGain.connect(this.sfxGain!);
      thud.start(now);
      thud.stop(now + 0.07);

      const lock = ctx.createOscillator();
      const lGain = ctx.createGain();
      lock.type = 'square';
      lock.frequency.setValueAtTime(1450, now + 0.035);
      lock.frequency.exponentialRampToValueAtTime(2100, now + 0.065);
      lGain.gain.setValueAtTime(0.22, now + 0.035);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      lock.connect(lGain);
      lGain.connect(this.sfxGain!);
      lock.start(now + 0.035);
      lock.stop(now + 0.075);
    } else {
      // Bolt carrier rack & forward slam
      this.schedulePumpRack(now, this.sfxGain!);
    }
  }

  /**
   * Surface-material aware footstep synthesis.
   */
  public playFootstep(
    surface: SurfaceMaterialType,
    isSprint: boolean,
    origin?: THREE.Vector3,
    listenerPos?: THREE.Vector3
  ): void {
    if (!this.ensureReady() || !this.ctx || !this.whiteNoiseBuffer || !this.pinkNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { input, distanceFactor } = this.createSpatialRoute(origin, listenerPos, undefined, 32);
    if (distanceFactor <= 0.05) return;

    this.trackVoice(0.14);
    const energy = isSprint ? 0.36 : 0.21;
    const pitchJitter = 0.92 + Math.random() * 0.16;

    // Heel/boot thud component
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = surface === 'metal' ? 'triangle' : 'sine';

    let baseFreq = 95;
    if (surface === 'metal') baseFreq = 185;
    else if (surface === 'wood') baseFreq = 125;
    else if (surface === 'snow') baseFreq = 75;
    else if (surface === 'water') baseFreq = 110;

    thudOsc.frequency.setValueAtTime(baseFreq * pitchJitter, now);
    thudOsc.frequency.exponentialRampToValueAtTime(34, now + 0.065);
    thudGain.gain.setValueAtTime(energy, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    thudOsc.connect(thudGain);
    thudGain.connect(input);
    thudOsc.start(now);
    thudOsc.stop(now + 0.075);

    // Surface texture grit/splash/clang component
    const texSrc = ctx.createBufferSource();
    texSrc.buffer = surface === 'snow' || surface === 'sandstone' ? this.whiteNoiseBuffer : this.pinkNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    const texGain = ctx.createGain();

    switch (surface) {
      case 'metal':
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2400 * pitchJitter, now);
        filter.Q.value = 4.5;
        texGain.gain.setValueAtTime(energy * 0.85, now);
        texGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        break;
      case 'snow':
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1650 * pitchJitter, now);
        filter.Q.value = 1.4;
        texGain.gain.setValueAtTime(energy * 0.9, now);
        texGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        break;
      case 'sandstone':
      case 'dirt':
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1950 * pitchJitter, now);
        filter.Q.value = 1.2;
        texGain.gain.setValueAtTime(energy * 0.75, now);
        texGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
        break;
      case 'water':
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1350 * pitchJitter, now);
        filter.Q.value = 0.9;
        texGain.gain.setValueAtTime(energy * 0.95, now);
        texGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        break;
      case 'wood':
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(820 * pitchJitter, now);
        filter.Q.value = 2.2;
        texGain.gain.setValueAtTime(energy * 0.7, now);
        texGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        break;
      case 'concrete':
      default:
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1250 * pitchJitter, now);
        filter.Q.value = 1.5;
        texGain.gain.setValueAtTime(energy * 0.65, now);
        texGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        break;
    }

    texSrc.connect(filter);
    filter.connect(texGain);
    texGain.connect(input);
    texSrc.start(now, Math.random() * 1.1);
    texSrc.stop(now + 0.13);
  }

  /**
   * Tactical gear rustle + upward jump impulse sound.
   */
  public playJump(): void {
    if (!this.ensureReady() || !this.ctx || !this.pinkNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.14);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(155, now + 0.09);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.12);

    const rustle = ctx.createBufferSource();
    rustle.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, now);
    bp.Q.value = 1.2;
    const rGain = ctx.createGain();
    rGain.gain.setValueAtTime(0.15, now);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    rustle.connect(bp);
    bp.connect(rGain);
    rGain.connect(this.sfxGain!);
    rustle.start(now, Math.random());
    rustle.stop(now + 0.12);
  }

  /**
   * Heavy landing impact scaled by vertical speed and surface material.
   */
  public playLand(surface: SurfaceMaterialType, impactSpeed: number): void {
    if (!this.ensureReady() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const intensity = THREE.MathUtils.clamp(Math.abs(impactSpeed) / 10, 0.25, 1.0);

    this.playFootstep(surface, true);

    this.trackVoice(0.16);
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.13);
    subGain.gain.setValueAtTime(0.42 * intensity, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    sub.connect(subGain);
    subGain.connect(this.sfxGain!);
    sub.start(now);
    sub.stop(now + 0.15);
  }

  /**
   * Bullet surface impact (ricochet ping on metal, masonry chip on concrete/sandstone, etc.)
   */
  public playImpact(
    surface: SurfaceMaterialType,
    origin?: THREE.Vector3,
    listenerPos?: THREE.Vector3
  ): void {
    if (!this.ensureReady() || !this.ctx || !this.whiteNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { input, distanceFactor } = this.createSpatialRoute(origin, listenerPos, undefined, 55);
    if (distanceFactor <= 0.05) return;

    this.trackVoice(0.15);
    const jitter = 0.9 + Math.random() * 0.22;

    if (surface === 'metal') {
      // Metallic ricochet ping
      const ping = ctx.createOscillator();
      const pGain = ctx.createGain();
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(2900 * jitter, now);
      ping.frequency.exponentialRampToValueAtTime(1150 * jitter, now + 0.12);
      pGain.gain.setValueAtTime(0.36, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      ping.connect(pGain);
      pGain.connect(input);
      ping.start(now);
      ping.stop(now + 0.14);
    } else if (surface === 'glass') {
      const glass = ctx.createOscillator();
      const gGain = ctx.createGain();
      glass.type = 'sine';
      glass.frequency.setValueAtTime(4200 * jitter, now);
      glass.frequency.exponentialRampToValueAtTime(1800, now + 0.09);
      gGain.gain.setValueAtTime(0.32, now);
      gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      glass.connect(gGain);
      gGain.connect(input);
      glass.start(now);
      glass.stop(now + 0.11);
    }

    // Debris snap
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((surface === 'wood' ? 1100 : 2100) * jitter, now);
    bp.Q.value = 1.6;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.34, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(input);
    noise.start(now, Math.random());
    noise.stop(now + 0.09);
  }

  /**
   * Crisp Call-of-Duty style tactile hitmarker thwack + high-pitched headshot/kill confirm chime.
   */
  public playHitmarker(isHeadshot: boolean, isKill = false): void {
    if (!this.ensureReady() || !this.ctx || !this.whiteNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.18);

    // Crisp transient tick ("thwack")
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(isHeadshot ? 3400 : 2650, now);
    hp.Q.value = 2.4;

    const tickGain = ctx.createGain();
    tickGain.gain.setValueAtTime(0.55, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    src.connect(hp);
    hp.connect(tickGain);
    tickGain.connect(this.sfxGain!);
    src.start(now, 0.1);
    src.stop(now + 0.042);

    // Body punch tick
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1650 : 1120, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);
    oGain.gain.setValueAtTime(0.42, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(oGain);
    oGain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.045);

    // Headshot / lethal confirmation metallic harmonic chime
    if (isHeadshot || isKill) {
      const chime = ctx.createOscillator();
      const cGain = ctx.createGain();
      chime.type = 'sine';
      const startFreq = isHeadshot ? 2950 : 2250;
      chime.frequency.setValueAtTime(startFreq, now + 0.012);
      chime.frequency.exponentialRampToValueAtTime(startFreq * 1.25, now + 0.12);

      cGain.gain.setValueAtTime(0.32, now + 0.012);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      chime.connect(cGain);
      cGain.connect(this.sfxGain!);
      chime.start(now + 0.012);
      chime.stop(now + 0.15);
    }
  }

  /**
   * Visceral low-end impact + sharp flinch hiss when the player takes damage.
   */
  public playPlayerDamage(): void {
    if (!this.ensureReady() || !this.ctx || !this.pinkNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.22);

    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(115, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.16);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280, now);

    sGain.gain.setValueAtTime(0.65, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    sub.connect(lp);
    lp.connect(sGain);
    sGain.connect(this.sfxGain!);
    sub.start(now);
    sub.stop(now + 0.19);

    const hiss = ctx.createBufferSource();
    hiss.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.Q.value = 1.4;
    const hGain = ctx.createGain();
    hGain.gain.setValueAtTime(0.35, now);
    hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    hiss.connect(bp);
    bp.connect(hGain);
    hGain.connect(this.sfxGain!);
    hiss.start(now, Math.random());
    hiss.stop(now + 0.13);
  }

  /**
   * Metallic clink when a frag grenade bounces off geometry.
   */
  public playGrenadeBounce(origin?: THREE.Vector3, listenerPos?: THREE.Vector3): void {
    if (!this.ensureReady() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { input, distanceFactor } = this.createSpatialRoute(origin, listenerPos, undefined, 45);
    if (distanceFactor <= 0.05) return;

    this.trackVoice(0.1);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2150 + Math.random() * 300, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.075);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(input);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  /**
   * Heavy concussive frag grenade detonation with sub-bass shockwave and debris tail.
   */
  public playGrenadeExplosion(origin?: THREE.Vector3, listenerPos?: THREE.Vector3): void {
    if (!this.ensureReady() || !this.ctx || !this.brownNoiseBuffer || !this.whiteNoiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { input, distanceFactor } = this.createSpatialRoute(origin, listenerPos, undefined, 110);
    if (distanceFactor <= 0.03) return;

    this.trackVoice(1.2);

    // 1. Sub-bass concussive shockwave
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.55);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    subOsc.connect(subGain);
    subGain.connect(input);
    subOsc.start(now);
    subOsc.stop(now + 0.62);

    // 2. Explosive transient crack + rumble
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = this.brownNoiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, now);
    lp.frequency.exponentialRampToValueAtTime(160, now + 1.1);

    const rGain = ctx.createGain();
    rGain.gain.setValueAtTime(1.0, now);
    rGain.gain.exponentialRampToValueAtTime(0.35, now + 0.18);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

    rumbleSrc.connect(lp);
    lp.connect(rGain);
    rGain.connect(input);
    rumbleSrc.start(now, 0);
    rumbleSrc.stop(now + 1.18);

    // 3. Shrapnel / debris scatter
    const debrisSrc = ctx.createBufferSource();
    debrisSrc.buffer = this.whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(620, now + 0.65);
    bp.Q.value = 1.0;

    const dGain = ctx.createGain();
    dGain.gain.setValueAtTime(0.65, now);
    dGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    debrisSrc.connect(bp);
    bp.connect(dGain);
    dGain.connect(input);
    debrisSrc.start(now, 0.2);
    debrisSrc.stop(now + 0.72);
  }

  /**
   * Subtle tactical UI hover tick (throttled to avoid buzz).
   */
  public playUiHover(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastHoverTime < 45) return;
    this.lastHoverTime = nowMs;

    if (!this.ensureReady() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.04);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(1820, now + 0.022);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Crisp UI confirmation click.
   */
  public playUiClick(): void {
    if (!this.ensureReady() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.trackVoice(0.07);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(1960, now + 0.045);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.052);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.056);
  }

  /**
   * Tactical stingers for match start, kill confirmation, victory, and defeat.
   */
  public playMatchNotification(type: 'start' | 'victory' | 'defeat' | 'kill'): void {
    if (!this.ensureReady() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (type === 'kill') {
      this.trackVoice(0.25);
      const notes = [880, 1318.5];
      notes.forEach((freq, idx) => {
        const t = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.15);
      });
      return;
    }

    if (type === 'start') {
      this.trackVoice(0.55);
      const freqs = [220, 330, 440];
      freqs.forEach((freq, idx) => {
        const t = now + idx * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1400, t);

        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.34);
      });
      return;
    }

    if (type === 'victory') {
      this.trackVoice(1.1);
      const chord = [261.63, 329.63, 392.0, 523.25];
      chord.forEach((freq, idx) => {
        const t = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.88);
      });
      return;
    }

    if (type === 'defeat') {
      this.trackVoice(1.1);
      const notes = [293.66, 277.18, 220.0];
      notes.forEach((freq, idx) => {
        const t = now + idx * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(680, t);

        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.68);
      });
    }
  }

  /**
   * Starts continuous procedural environmental ambience for the active map.
   */
  public startAmbience(type: 'rain_harbor' | 'desert_wind' | 'arctic_facility'): void {
    if (this.currentAmbienceType === type && this.ambienceCleanupFns.length > 0) {
      return;
    }
    this.stopAmbience();
    this.currentAmbienceType = type;

    if (!this.ctx || !this.ambienceGain || !this.pinkNoiseBuffer || !this.brownNoiseBuffer) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (type === 'rain_harbor') {
      // Breakwater Terminal: Steady rain patter + low distant harbor swell
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.pinkNoiseBuffer;
      rainSrc.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.setValueAtTime(1350, now);
      rainFilter.Q.value = 0.75;

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.001, now);
      rainGain.gain.linearRampToValueAtTime(0.18, now + 0.8);

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.ambienceGain);
      rainSrc.start(now);

      // Low harbor rumble
      const swellSrc = ctx.createBufferSource();
      swellSrc.buffer = this.brownNoiseBuffer;
      swellSrc.loop = true;

      const swellFilter = ctx.createBiquadFilter();
      swellFilter.type = 'lowpass';
      swellFilter.frequency.setValueAtTime(140, now);

      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(0.22, now);

      swellSrc.connect(swellFilter);
      swellFilter.connect(swellGain);
      swellGain.connect(this.ambienceGain);
      swellSrc.start(now);

      this.ambienceCleanupFns.push(() => {
        try {
          rainSrc.stop();
          rainSrc.disconnect();
          swellSrc.stop();
          swellSrc.disconnect();
        } catch {
          // Ignore already stopped nodes
        }
      });
    } else if (type === 'desert_wind') {
      // Mesa Relay: Sweeping canyon wind with slow LFO filter modulation
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.pinkNoiseBuffer;
      windSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(420, now);
      windFilter.Q.value = 2.4;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.14, now);
      lfoGain.gain.setValueAtTime(210, now);
      lfo.connect(lfoGain);
      lfoGain.connect(windFilter.frequency);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.001, now);
      windGain.gain.linearRampToValueAtTime(0.22, now + 0.8);

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.ambienceGain);
      windSrc.start(now);
      lfo.start(now);

      this.ambienceCleanupFns.push(() => {
        try {
          windSrc.stop();
          windSrc.disconnect();
          lfo.stop();
          lfo.disconnect();
        } catch {
          // Ignore
        }
      });
    } else if (type === 'arctic_facility') {
      // Northstar Facility: High-altitude icy wind howl + subtle facility transformer hum
      const galeSrc = ctx.createBufferSource();
      galeSrc.buffer = this.pinkNoiseBuffer;
      galeSrc.loop = true;

      const galeFilter = ctx.createBiquadFilter();
      galeFilter.type = 'bandpass';
      galeFilter.frequency.setValueAtTime(680, now);
      galeFilter.Q.value = 3.6;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.21, now);
      lfoGain.gain.setValueAtTime(290, now);
      lfo.connect(lfoGain);
      lfoGain.connect(galeFilter.frequency);

      const galeGain = ctx.createGain();
      galeGain.gain.setValueAtTime(0.18, now);

      galeSrc.connect(galeFilter);
      galeFilter.connect(galeGain);
      galeGain.connect(this.ambienceGain);

      const humOsc = ctx.createOscillator();
      const humGain = ctx.createGain();
      humOsc.type = 'sine';
      humOsc.frequency.setValueAtTime(60, now);
      humGain.gain.setValueAtTime(0.045, now);
      humOsc.connect(humGain);
      humGain.connect(this.ambienceGain);

      galeSrc.start(now);
      lfo.start(now);
      humOsc.start(now);

      this.ambienceCleanupFns.push(() => {
        try {
          galeSrc.stop();
          galeSrc.disconnect();
          lfo.stop();
          lfo.disconnect();
          humOsc.stop();
          humOsc.disconnect();
        } catch {
          // Ignore
        }
      });
    }
  }

  /**
   * Stops and disconnects all active environmental ambience nodes cleanly.
   */
  public stopAmbience(): void {
    this.currentAmbienceType = null;
    while (this.ambienceCleanupFns.length > 0) {
      const fn = this.ambienceCleanupFns.pop();
      if (fn) fn();
    }
  }
}
