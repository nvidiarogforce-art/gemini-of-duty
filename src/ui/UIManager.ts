import * as THREE from 'three';
import {
  BotDifficulty,
  CombatantState,
  DEFAULT_SETTINGS,
  GameModeId,
  GameSettings,
  KillFeedEntry,
  MapId,
  MatchConfig,
  MatchPhase,
  PrimaryWeaponId,
  QualityPreset,
  TeamId,
  WeaponId,
} from '../types/contracts';
import { WEAPON_DEFINITIONS } from '../weapons/WeaponDefinitions';
import { SoundManager } from '../audio/SoundManager';

export const SETTINGS_STORAGE_KEY = 'blackline_fps_settings_v1';

export interface UICallbacks {
  onStartMatch: (config: MatchConfig) => void;
  onMapPreviewChange: (mapId: MapId) => void;
  onResumeMatch: () => void;
  onRestartMatch: () => void;
  onReturnToMenu: () => void;
  onSettingsChange: (settings: GameSettings) => void;
}

export interface HudTelemetryState {
  health: number;
  maxHealth: number;
  stance: 'STAND' | 'CROUCH' | 'SPRINT';
  activeWeapon: WeaponId;
  primaryWeapon: PrimaryWeaponId;
  magAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number; // 0 to 1
  grenadeCount?: number;
  grenadeCooldown?: number; // seconds remaining
  spreadRadians: number;
  adsProgress: number; // 0 to 1
  isSprinting: boolean;
  modeId: GameModeId;
  remainingSeconds: number;
  aegisScore: number;
  kestrelScore: number;
  scoreLimit: number;
  countdownSeconds?: number | null;
}

export interface MatchEndSummary {
  outcome: 'victory' | 'defeat' | 'draw';
  title?: string;
  subtitle?: string;
  modeId: GameModeId;
  mapId: MapId;
  aegisScore: number;
  kestrelScore: number;
  combatants: CombatantState[];
}

interface ActiveDamageArc {
  id: number;
  element: HTMLElement;
  attackerX: number;
  attackerZ: number;
  age: number;
  duration: number;
}

interface MapCardMeta {
  id: MapId;
  name: string;
  location: string;
  timeOfDay: string;
  description: string;
}

const MAP_CARDS: MapCardMeta[] = [
  {
    id: 'breakwater',
    name: 'Breakwater Terminal',
    location: 'NORTH SEA // SECTOR 04',
    timeOfDay: '22:40 OVERCAST RAIN',
    description:
      'Wet-asphalt container yard, twin warehouse bays, central customs house, and elevated crane catwalks.',
  },
  {
    id: 'mesa',
    name: 'Mesa Relay',
    location: 'SONORAN CANYON // OUTPOST 11',
    timeOfDay: '17:50 GOLDEN DUSK',
    description:
      'High-desert communications compound with radar dish rotunda, canyon skybridge, and cliffside sniper overlooks.',
  },
  {
    id: 'northstar',
    name: 'Northstar Facility',
    location: 'SVALBARD RIDGE // SUB-ZERO LAB',
    timeOfDay: '08:15 ARCTIC DAWN',
    description:
      'Symmetrical snowbound research complex featuring central server rotunda, cryo-containment bays, and upper walkways.',
  },
];

const MODE_META: Record<
  GameModeId,
  { name: string; shortTag: string; sub: string; scoreLimit: number; timeLimitSeconds: number }
> = {
  tdm: {
    name: 'Team Deathmatch',
    shortTag: 'TDM // 4v4',
    sub: '40 Kills • Aegis vs Kestrel',
    scoreLimit: 40,
    timeLimitSeconds: 480,
  },
  ffa: {
    name: 'Free-For-All',
    shortTag: 'FFA // LONE WOLF',
    sub: '25 Kills • Every Operator Hostile',
    scoreLimit: 25,
    timeLimitSeconds: 480,
  },
  practice: {
    name: 'Tactical Practice',
    shortTag: 'RANGE // SANDBOX',
    sub: 'Pop-up Targets • Instant Resupply',
    scoreLimit: 999,
    timeLimitSeconds: 3600,
  },
};

const DIFFICULTY_META: Record<BotDifficulty, { label: string; sub: string }> = {
  recruit: { label: 'Recruit', sub: '0.45s Reaction • Forgiving Aim' },
  regular: { label: 'Regular', sub: '0.26s Reaction • Tactical Cover' },
  veteran: { label: 'Veteran', sub: '0.14s Reaction • Lethal Precision' },
};

/**
 * ============================================================================
 * BLACKLINE // TACTICAL RESPONSE — UI & HUD MANAGER
 * ============================================================================
 */
export class UIManager {
  private root: HTMLElement;
  private sound: SoundManager | null;
  private callbacks: Partial<UICallbacks> = {};

  private settings: GameSettings;
  private matchConfig: MatchConfig = {
    mapId: 'breakwater',
    modeId: 'tdm',
    difficulty: 'regular',
    primaryWeapon: 'ar',
    scoreLimit: 40,
    timeLimitSeconds: 480,
  };

  private currentPhase: MatchPhase = 'menu';
  private isSettingsOpen = false;
  private isControlsOpen = false;
  private isScoreboardOpen = false;

  // Main sections
  private mainMenuEl!: HTMLElement;
  private hudEl!: HTMLElement;
  private scoreboardOverlayEl!: HTMLElement;
  private pauseModalEl!: HTMLElement;
  private settingsModalEl!: HTMLElement;
  private controlsModalEl!: HTMLElement;
  private endModalEl!: HTMLElement;

  // Main menu interactive elements
  private spineSummaryEl!: HTMLElement;
  private statsTitleEl!: HTMLElement;
  private statFillDamage!: HTMLElement;
  private statValDamage!: HTMLElement;
  private statFillRpm!: HTMLElement;
  private statValRpm!: HTMLElement;
  private statFillRange!: HTMLElement;
  private statValRange!: HTMLElement;
  private statFillMobility!: HTMLElement;
  private statValMobility!: HTMLElement;

  // HUD elements
  private damageVignetteEl!: HTMLElement;
  private scopeOverlayEl!: HTMLElement;
  private crosshairEl!: HTMLElement;
  private chTopEl!: HTMLElement;
  private chBottomEl!: HTMLElement;
  private chLeftEl!: HTMLElement;
  private chRightEl!: HTMLElement;
  private hitmarkerEl!: HTMLElement;
  private damageIndicatorsEl!: HTMLElement;

  private topLeftLabelEl!: HTMLElement;
  private topLeftScoreEl!: HTMLElement;
  private topLeftBarEl!: HTMLElement;
  private topRightLabelEl!: HTMLElement;
  private topRightScoreEl!: HTMLElement;
  private topRightBarEl!: HTMLElement;
  private matchTimerEl!: HTMLElement;
  private matchModeTagEl!: HTMLElement;

  private fpsBadgeEl!: HTMLElement;
  private killFeedContainerEl!: HTMLElement;

  private hpCardEl!: HTMLElement;
  private hpNumberEl!: HTMLElement;
  private hpBarFillEl!: HTMLElement;
  private stancePillEl!: HTMLElement;

  private reloadWarningEl!: HTMLElement;
  private weaponNameEl!: HTMLElement;
  private fireModeBadgeEl!: HTMLElement;
  private ammoMagEl!: HTMLElement;
  private ammoReserveEl!: HTMLElement;
  private slotPrimaryEl!: HTMLElement;
  private slotPrimaryLabelEl!: HTMLElement;
  private slotSidearmEl!: HTMLElement;
  private slotGrenadeEl!: HTMLElement;
  private slotGrenadeLabelEl!: HTMLElement;

  private killBannerEl!: HTMLElement;
  private reloadProgressBoxEl!: HTMLElement;
  private reloadBarFillEl!: HTMLElement;
  private practiceHintEl!: HTMLElement;
  private countdownBannerEl!: HTMLElement;
  private countdownValueEl!: HTMLElement;

  // Scoreboard & End-of-Match elements
  private sbSubtitleEl!: HTMLElement;
  private sbTbodyEl!: HTMLElement;
  private eomOutcomeEl!: HTMLElement;
  private eomSubtitleEl!: HTMLElement;
  private eomMvpStripEl!: HTMLElement;
  private eomTbodyEl!: HTMLElement;

  // Active timers & dynamic HUD items
  private hitmarkerHideTimeout: number | null = null;
  private killBannerHideTimeout: number | null = null;
  private activeDamageArcs: ActiveDamageArc[] = [];
  private nextDamageArcId = 1;
  private lastPlayerPos = new THREE.Vector3();
  private lastPlayerYaw = 0;
  private killFeedDomMap = new Map<string, { el: HTMLElement; createdAt: number }>();

  constructor(
    rootOrContainer?: HTMLElement | SoundManager,
    soundManager?: SoundManager,
    callbacks?: Partial<UICallbacks>
  ) {
    // Support flexible constructor signatures:
    // new UIManager(rootEl, soundManager, callbacks) OR new UIManager(soundManager) OR new UIManager()
    if (rootOrContainer instanceof HTMLElement) {
      this.root = rootOrContainer;
      this.sound = soundManager ?? null;
    } else if (rootOrContainer && typeof (rootOrContainer as SoundManager).playUiClick === 'function') {
      this.root = this.resolveOrCreateRoot();
      this.sound = rootOrContainer as SoundManager;
    } else {
      this.root = this.resolveOrCreateRoot();
      this.sound = soundManager ?? null;
    }

    if (callbacks) {
      this.callbacks = { ...callbacks };
    }

    this.settings = this.loadSettings();
    if (this.sound) {
      this.sound.applySettings(this.settings);
    }

    this.root.classList.add('bl-ui-root');
    this.buildDom();
    this.syncMenuSelectionState();
    this.syncSettingsControls();
    this.setPhase('menu');
  }

  private resolveOrCreateRoot(): HTMLElement {
    const existing = document.getElementById('ui-root') || document.querySelector('.bl-ui-root');
    if (existing instanceof HTMLElement) {
      return existing;
    }
    const el = document.createElement('div');
    el.id = 'ui-root';
    el.className = 'bl-ui-root';
    document.body.appendChild(el);
    return el;
  }

  /**
   * Registers or updates UI action callbacks.
   */
  public setCallbacks(callbacks: Partial<UICallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Attaches a SoundManager instance if not passed at construction time.
   */
  public setSoundManager(sound: SoundManager): void {
    this.sound = sound;
    this.sound.applySettings(this.settings);
  }

  /**
   * Safely loads GameSettings from localStorage under `'blackline_fps_settings_v1'`.
   */
  public loadSettings(): GameSettings {
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return this.sanitizeSettings(parsed);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Safely persists GameSettings to localStorage under `'blackline_fps_settings_v1'`.
   */
  public saveSettings(settings: GameSettings = this.settings): void {
    this.settings = this.sanitizeSettings(settings);
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  private sanitizeSettings(input: Partial<GameSettings>): GameSettings {
    const clamp = THREE.MathUtils.clamp;
    const validPreset: QualityPreset =
      input.qualityPreset === 'low' || input.qualityPreset === 'medium' || input.qualityPreset === 'high'
        ? input.qualityPreset
        : DEFAULT_SETTINGS.qualityPreset;

    return {
      mouseSensitivity:
        typeof input.mouseSensitivity === 'number' && !Number.isNaN(input.mouseSensitivity)
          ? clamp(input.mouseSensitivity, 0.1, 3.0)
          : DEFAULT_SETTINGS.mouseSensitivity,
      adsSensitivityMultiplier:
        typeof input.adsSensitivityMultiplier === 'number' && !Number.isNaN(input.adsSensitivityMultiplier)
          ? clamp(input.adsSensitivityMultiplier, 0.3, 1.0)
          : DEFAULT_SETTINGS.adsSensitivityMultiplier,
      fov:
        typeof input.fov === 'number' && !Number.isNaN(input.fov)
          ? clamp(Math.round(input.fov), 65, 110)
          : DEFAULT_SETTINGS.fov,
      masterVolume:
        typeof input.masterVolume === 'number' && !Number.isNaN(input.masterVolume)
          ? clamp(input.masterVolume, 0, 1)
          : DEFAULT_SETTINGS.masterVolume,
      sfxVolume:
        typeof input.sfxVolume === 'number' && !Number.isNaN(input.sfxVolume)
          ? clamp(input.sfxVolume, 0, 1)
          : DEFAULT_SETTINGS.sfxVolume,
      ambienceVolume:
        typeof input.ambienceVolume === 'number' && !Number.isNaN(input.ambienceVolume)
          ? clamp(input.ambienceVolume, 0, 1)
          : DEFAULT_SETTINGS.ambienceVolume,
      qualityPreset: validPreset,
      reducedCameraMotion:
        typeof input.reducedCameraMotion === 'boolean'
          ? input.reducedCameraMotion
          : DEFAULT_SETTINGS.reducedCameraMotion,
      showFps: typeof input.showFps === 'boolean' ? input.showFps : DEFAULT_SETTINGS.showFps,
      invertY: typeof input.invertY === 'boolean' ? input.invertY : DEFAULT_SETTINGS.invertY,
    };
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<GameSettings>): GameSettings {
    this.settings = this.sanitizeSettings({ ...this.settings, ...partial });
    this.saveSettings(this.settings);
    this.syncSettingsControls();
    if (this.fpsBadgeEl) {
      this.fpsBadgeEl.classList.toggle('bl-hidden', !this.settings.showFps);
    }
    if (this.sound) {
      this.sound.applySettings(this.settings);
    }
    if (this.callbacks.onSettingsChange) {
      this.callbacks.onSettingsChange({ ...this.settings });
    }
    return { ...this.settings };
  }

  public resetSettings(): GameSettings {
    return this.updateSettings({ ...DEFAULT_SETTINGS });
  }

  public getMatchConfig(): MatchConfig {
    const modeInfo = MODE_META[this.matchConfig.modeId];
    return {
      ...this.matchConfig,
      scoreLimit: modeInfo.scoreLimit,
      timeLimitSeconds: modeInfo.timeLimitSeconds,
    };
  }

  public setMatchConfig(partial: Partial<MatchConfig>): void {
    this.matchConfig = { ...this.matchConfig, ...partial };
    const modeInfo = MODE_META[this.matchConfig.modeId];
    this.matchConfig.scoreLimit = modeInfo.scoreLimit;
    this.matchConfig.timeLimitSeconds = modeInfo.timeLimitSeconds;
    this.syncMenuSelectionState();
  }

  /**
   * Transitions UI visibility to match the active MatchPhase.
   */
  public setPhase(phase: MatchPhase): void {
    this.currentPhase = phase;

    const showMenu = phase === 'menu' || phase === 'loading';
    const showHud = phase === 'countdown' || phase === 'playing' || phase === 'paused';
    const showPause = phase === 'paused' && !this.isSettingsOpen && !this.isControlsOpen;
    const showEnd = phase === 'ended';

    this.mainMenuEl.classList.toggle('bl-hidden', !showMenu);
    this.hudEl.classList.toggle('bl-hidden', !showHud);
    this.pauseModalEl.classList.toggle('bl-hidden', !showPause);
    this.endModalEl.classList.toggle('bl-hidden', !showEnd);

    if (phase !== 'playing' && phase !== 'countdown') {
      this.showScoreboard(false);
    }
    if (phase === 'playing') {
      this.closeSettingsModal();
      this.closeControlsModal();
      this.countdownBannerEl.classList.add('bl-hidden');
    }
  }

  public showMainMenu(): void {
    this.closeSettingsModal();
    this.closeControlsModal();
    this.setPhase('menu');
  }

  public showHud(): void {
    this.setPhase('playing');
  }

  public showPauseMenu(visible = true): void {
    if (visible) {
      this.setPhase('paused');
    } else if (this.currentPhase === 'paused') {
      this.setPhase('playing');
    }
  }

  public showScoreboard(visible: boolean): void {
    this.isScoreboardOpen = visible;
    this.scoreboardOverlayEl.classList.toggle('bl-hidden', !visible);
  }

  public isModalOpen(): boolean {
    return (
      this.isSettingsOpen ||
      this.isControlsOpen ||
      this.currentPhase === 'paused' ||
      this.currentPhase === 'ended'
    );
  }

  public openSettingsModal(): void {
    this.isSettingsOpen = true;
    this.isControlsOpen = false;
    this.controlsModalEl.classList.add('bl-hidden');
    this.pauseModalEl.classList.add('bl-hidden');
    this.settingsModalEl.classList.remove('bl-hidden');
    this.syncSettingsControls();
  }

  public closeSettingsModal(): void {
    if (!this.isSettingsOpen) return;
    this.isSettingsOpen = false;
    this.settingsModalEl.classList.add('bl-hidden');
    if (this.currentPhase === 'paused') {
      this.pauseModalEl.classList.remove('bl-hidden');
    }
  }

  public openControlsModal(): void {
    this.isControlsOpen = true;
    this.isSettingsOpen = false;
    this.settingsModalEl.classList.add('bl-hidden');
    this.pauseModalEl.classList.add('bl-hidden');
    this.controlsModalEl.classList.remove('bl-hidden');
  }

  public closeControlsModal(): void {
    if (!this.isControlsOpen) return;
    this.isControlsOpen = false;
    this.controlsModalEl.classList.add('bl-hidden');
    if (this.currentPhase === 'paused') {
      this.pauseModalEl.classList.remove('bl-hidden');
    }
  }

  /**
   * Builds all DOM layers inside the UI root.
   */
  private buildDom(): void {
    this.root.innerHTML = '';

    this.mainMenuEl = this.createMainMenuDom();
    this.hudEl = this.createHudDom();
    this.scoreboardOverlayEl = this.createScoreboardDom();
    this.pauseModalEl = this.createPauseModalDom();
    this.settingsModalEl = this.createSettingsModalDom();
    this.controlsModalEl = this.createControlsModalDom();
    this.endModalEl = this.createEndModalDom();

    this.root.append(
      this.mainMenuEl,
      this.hudEl,
      this.scoreboardOverlayEl,
      this.pauseModalEl,
      this.settingsModalEl,
      this.controlsModalEl,
      this.endModalEl
    );

    this.bindInteractiveAudio();
  }

  private createMainMenuDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-main-menu';

    const mapCardsHtml = MAP_CARDS.map(
      (m) => `
      <button type="button" class="bl-map-card" data-map-select="${m.id}">
        <div class="bl-map-preview" data-map="${m.id}">
          <span class="bl-map-tag">${m.timeOfDay}</span>
        </div>
        <div class="bl-map-body">
          <div class="bl-map-meta">${m.location}</div>
          <div class="bl-map-name">${m.name}</div>
          <div class="bl-map-desc">${m.description}</div>
        </div>
      </button>
    `
    ).join('');

    const modesHtml = (['tdm', 'ffa', 'practice'] as GameModeId[])
      .map((modeId) => {
        const meta = MODE_META[modeId];
        return `
        <button type="button" class="bl-choice-pill" data-mode-select="${modeId}">
          <span class="bl-pill-label">${meta.name}</span>
          <span class="bl-pill-sub">${meta.sub}</span>
        </button>
      `;
      })
      .join('');

    const diffHtml = (['recruit', 'regular', 'veteran'] as BotDifficulty[])
      .map((diff) => {
        const meta = DIFFICULTY_META[diff];
        return `
        <button type="button" class="bl-choice-pill" data-diff-select="${diff}">
          <span class="bl-pill-label">${meta.label}</span>
          <span class="bl-pill-sub">${meta.sub}</span>
        </button>
      `;
      })
      .join('');

    const primaryWeapons: PrimaryWeaponId[] = ['ar', 'smg', 'shotgun', 'dmr'];
    const weaponsHtml = primaryWeapons
      .map((wId) => {
        const def = WEAPON_DEFINITIONS[wId];
        return `
        <button type="button" class="bl-weapon-card" data-weapon-select="${wId}">
          <div class="bl-weapon-card-top">
            <span class="bl-weapon-class-tag">${def.classLabel}</span>
            <span class="bl-weapon-rpm-tag">${def.rpm} RPM</span>
          </div>
          <div class="bl-weapon-card-name">${def.name}</div>
          <div class="bl-weapon-card-sub">${def.magazineSize} RND // ${def.fireMode.toUpperCase()}</div>
        </button>
      `;
      })
      .join('');

    el.innerHTML = `
      <div class="bl-menu-spine">
        <div class="bl-brand-block">
          <div class="bl-brand-kicker">
            <span class="bl-brand-kicker-dot"></span>
            <span>DIRECTIVE 09 // READY FOR DEPLOYMENT</span>
          </div>
          <h1 class="bl-brand-title">BLACKLINE</h1>
          <div class="bl-brand-subtitle">TACTICAL RESPONSE // TASK FORCE</div>
        </div>

        <nav class="bl-nav-stack" aria-label="Main Menu">
          <button type="button" class="bl-nav-item bl-nav-deploy" data-action="deploy">
            <span>DEPLOY TO COMBAT</span>
            <span class="bl-nav-hint">[ENTER]</span>
          </button>
          <button type="button" class="bl-nav-item" data-action="quick-practice">
            <span>TACTICAL FIRING RANGE</span>
            <span class="bl-nav-hint">SANDBOX</span>
          </button>
          <button type="button" class="bl-nav-item" data-action="open-settings">
            <span>SYSTEM &amp; AUDIO SETTINGS</span>
            <span class="bl-nav-hint">CONFIG</span>
          </button>
          <button type="button" class="bl-nav-item" data-action="open-controls">
            <span>OPERATOR KEYBINDS</span>
            <span class="bl-nav-hint">CONTROLS</span>
          </button>
        </nav>

        <div class="bl-spine-footer">
          <div>DEPLOYMENT BRIEF // <span class="bl-spine-summary" data-ref="spine-summary">BREAKWATER • TDM • M4A8</span></div>
          <div>ENGINE // THREE.JS WEBGL2 PROCEDURAL AUDIO-VISUAL PIPELINE</div>
        </div>
      </div>

      <div class="bl-menu-deck">
        <div class="bl-deck-section">
          <div class="bl-section-header">
            <span class="bl-section-title">01 // THEATER OF OPERATIONS</span>
            <span class="bl-section-subtitle">SELECT DEPLOYMENT SECTOR (LIVE 3D BACKDROP)</span>
          </div>
          <div class="bl-map-grid">
            ${mapCardsHtml}
          </div>
        </div>

        <div class="bl-mode-difficulty-row">
          <div class="bl-deck-section">
            <div class="bl-section-header">
              <span class="bl-section-title">02 // COMBAT DOCTRINE</span>
              <span class="bl-section-subtitle">ENGAGEMENT RULES</span>
            </div>
            <div class="bl-pill-group">
              ${modesHtml}
            </div>
          </div>

          <div class="bl-deck-section">
            <div class="bl-section-header">
              <span class="bl-section-title">03 // AI THREAT LEVEL</span>
              <span class="bl-section-subtitle">BOT COMBATANTS</span>
            </div>
            <div class="bl-pill-group">
              ${diffHtml}
            </div>
          </div>
        </div>

        <div class="bl-deck-section">
          <div class="bl-section-header">
            <span class="bl-section-title">04 // OPERATOR LOADOUT</span>
            <span class="bl-section-subtitle">PRIMARY WEAPON + P226 SENTINEL SIDEARM + M67 FRAG</span>
          </div>
          <div class="bl-loadout-layout">
            <div class="bl-weapon-grid">
              ${weaponsHtml}
            </div>
            <div class="bl-weapon-stats-panel">
              <div class="bl-stats-header">
                <span class="bl-stats-weapon-title" data-ref="stats-title">M4A8 VANGUARD</span>
                <span class="bl-stats-sidearm-note">+ P226 SENTINEL // M67 FRAG</span>
              </div>
              <div class="bl-stat-rows">
                <div class="bl-stat-row">
                  <span>DAMAGE</span>
                  <div class="bl-stat-track"><div class="bl-stat-fill" data-ref="stat-fill-dmg"></div></div>
                  <span class="bl-stat-val" data-ref="stat-val-dmg">27</span>
                </div>
                <div class="bl-stat-row">
                  <span>FIRE RATE</span>
                  <div class="bl-stat-track"><div class="bl-stat-fill" data-ref="stat-fill-rpm"></div></div>
                  <span class="bl-stat-val" data-ref="stat-val-rpm">720</span>
                </div>
                <div class="bl-stat-row">
                  <span>RANGE</span>
                  <div class="bl-stat-track"><div class="bl-stat-fill" data-ref="stat-fill-rng"></div></div>
                  <span class="bl-stat-val" data-ref="stat-val-rng">62M</span>
                </div>
                <div class="bl-stat-row">
                  <span>MOBILITY</span>
                  <div class="bl-stat-track"><div class="bl-stat-fill" data-ref="stat-fill-mob"></div></div>
                  <span class="bl-stat-val" data-ref="stat-val-mob">96%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.spineSummaryEl = el.querySelector('[data-ref="spine-summary"]')!;
    this.statsTitleEl = el.querySelector('[data-ref="stats-title"]')!;
    this.statFillDamage = el.querySelector('[data-ref="stat-fill-dmg"]')!;
    this.statValDamage = el.querySelector('[data-ref="stat-val-dmg"]')!;
    this.statFillRpm = el.querySelector('[data-ref="stat-fill-rpm"]')!;
    this.statValRpm = el.querySelector('[data-ref="stat-val-rpm"]')!;
    this.statFillRange = el.querySelector('[data-ref="stat-fill-rng"]')!;
    this.statValRange = el.querySelector('[data-ref="stat-val-rng"]')!;
    this.statFillMobility = el.querySelector('[data-ref="stat-fill-mob"]')!;
    this.statValMobility = el.querySelector('[data-ref="stat-val-mob"]')!;

    // Event bindings for map selection
    el.querySelectorAll<HTMLElement>('[data-map-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mapId = btn.dataset.mapSelect as MapId;
        this.matchConfig.mapId = mapId;
        this.syncMenuSelectionState();
        this.callbacks.onMapPreviewChange?.(mapId);
      });
    });

    // Event bindings for mode selection
    el.querySelectorAll<HTMLElement>('[data-mode-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeId = btn.dataset.modeSelect as GameModeId;
        this.setMatchConfig({ modeId });
      });
    });

    // Event bindings for difficulty selection
    el.querySelectorAll<HTMLElement>('[data-diff-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const difficulty = btn.dataset.diffSelect as BotDifficulty;
        this.setMatchConfig({ difficulty });
      });
    });

    // Event bindings for primary weapon selection
    el.querySelectorAll<HTMLElement>('[data-weapon-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const primaryWeapon = btn.dataset.weaponSelect as PrimaryWeaponId;
        this.setMatchConfig({ primaryWeapon });
      });
    });

    // Primary nav actions
    el.querySelector('[data-action="deploy"]')?.addEventListener('click', () => {
      this.sound?.resumeContext();
      this.callbacks.onStartMatch?.(this.getMatchConfig());
    });

    el.querySelector('[data-action="quick-practice"]')?.addEventListener('click', () => {
      this.sound?.resumeContext();
      this.setMatchConfig({ modeId: 'practice' });
      this.callbacks.onStartMatch?.(this.getMatchConfig());
    });

    el.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    el.querySelector('[data-action="open-controls"]')?.addEventListener('click', () => {
      this.openControlsModal();
    });

    return el;
  }

  private createHudDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-hud bl-hidden';

    el.innerHTML = `
      <div class="bl-damage-vignette" data-ref="damage-vignette"></div>

      <div class="bl-scope-overlay" data-ref="scope-overlay">
        <div class="bl-scope-reticle">
          <div class="bl-scope-mil-dots">
            <div class="bl-scope-center-chevron"></div>
          </div>
        </div>
      </div>

      <div class="bl-damage-indicators" data-ref="damage-indicators"></div>

      <div class="bl-crosshair" data-ref="crosshair">
        <div class="bl-ch-dot"></div>
        <div class="bl-ch-line bl-ch-top" data-ref="ch-top"></div>
        <div class="bl-ch-line bl-ch-bottom" data-ref="ch-bottom"></div>
        <div class="bl-ch-line bl-ch-left" data-ref="ch-left"></div>
        <div class="bl-ch-line bl-ch-right" data-ref="ch-right"></div>
      </div>

      <div class="bl-hitmarker" data-ref="hitmarker">
        <div class="bl-hm-arm bl-hm-tl"></div>
        <div class="bl-hm-arm bl-hm-tr"></div>
        <div class="bl-hm-arm bl-hm-bl"></div>
        <div class="bl-hm-arm bl-hm-br"></div>
      </div>

      <div class="bl-hud-top-center">
        <div class="bl-score-header">
          <div class="bl-team-score-box">
            <div class="bl-team-label-row">
              <span class="bl-team-name is-aegis" data-ref="tl-label">AEGIS</span>
              <span class="bl-team-score-num" data-ref="tl-score">0</span>
            </div>
            <div class="bl-team-bar-track">
              <div class="bl-team-bar-fill is-aegis" data-ref="tl-bar" style="width: 0%"></div>
            </div>
          </div>

          <div class="bl-clock-center">
            <div class="bl-match-timer" data-ref="match-timer">08:00</div>
            <div class="bl-match-mode-tag" data-ref="match-mode-tag">TDM // 40 PTS</div>
          </div>

          <div class="bl-team-score-box is-right">
            <div class="bl-team-label-row">
              <span class="bl-team-score-num" data-ref="tr-score">0</span>
              <span class="bl-team-name is-kestrel" data-ref="tr-label">KESTREL</span>
            </div>
            <div class="bl-team-bar-track">
              <div class="bl-team-bar-fill is-kestrel" data-ref="tr-bar" style="width: 0%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="bl-practice-hint bl-hidden" data-ref="practice-hint">
        PRACTICE SANDBOX // [1/2] SWITCH WEAPONS • [G] FRAG GRENADE • [TAB] TELEMETRY • [ESC] MENU
      </div>

      <div class="bl-countdown-banner bl-hidden" data-ref="countdown-banner">
        <span class="bl-countdown-label">DEPLOYMENT IN</span>
        <span class="bl-countdown-value" data-ref="countdown-value">3</span>
      </div>

      <div class="bl-hud-top-right">
        <div class="bl-fps-badge" data-ref="fps-badge">60 FPS // 16.7 ms</div>
        <div class="bl-killfeed" data-ref="killfeed"></div>
      </div>

      <div class="bl-center-stack">
        <div class="bl-kill-banner bl-hidden" data-ref="kill-banner">+100 ELIMINATION</div>
        <div class="bl-reload-progress-box bl-hidden" data-ref="reload-box">
          <span class="bl-reload-label">RELOADING...</span>
          <div class="bl-reload-bar-track">
            <div class="bl-reload-bar-fill" data-ref="reload-bar"></div>
          </div>
        </div>
      </div>

      <div class="bl-hud-bottom-left" data-ref="hp-card">
        <div class="bl-hp-top-row">
          <div class="bl-hp-value-wrap">
            <span class="bl-hp-label">HP</span>
            <span class="bl-hp-number" data-ref="hp-number">100</span>
          </div>
          <span class="bl-stance-pill" data-ref="stance-pill">STAND</span>
        </div>
        <div class="bl-hp-bar-track">
          <div class="bl-hp-bar-fill" data-ref="hp-bar-fill"></div>
        </div>
      </div>

      <div class="bl-hud-bottom-right">
        <div class="bl-reload-warning bl-hidden" data-ref="reload-warning">[R] RELOAD MAGAZINE</div>
        <div class="bl-weapon-hud-card">
          <div class="bl-weapon-hud-top">
            <span class="bl-weapon-hud-name" data-ref="weapon-name">M4A8 VANGUARD</span>
            <span class="bl-firemode-badge" data-ref="firemode-badge">AUTO</span>
          </div>
          <div class="bl-ammo-row">
            <span class="bl-ammo-mag" data-ref="ammo-mag">30</span>
            <span class="bl-ammo-sep">/</span>
            <span class="bl-ammo-reserve" data-ref="ammo-reserve">120</span>
          </div>
        </div>
        <div class="bl-slot-pills">
          <div class="bl-slot-pill is-active" data-ref="slot-primary">
            <span class="bl-slot-key">[1]</span>
            <span data-ref="slot-primary-label">M4A8 VANGUARD</span>
          </div>
          <div class="bl-slot-pill" data-ref="slot-sidearm">
            <span class="bl-slot-key">[2]</span>
            <span>P226 SENTINEL</span>
          </div>
          <div class="bl-slot-pill" data-ref="slot-grenade">
            <span class="bl-slot-key">[G]</span>
            <span data-ref="slot-grenade-label">FRAG READY</span>
          </div>
        </div>
      </div>
    `;

    this.damageVignetteEl = el.querySelector('[data-ref="damage-vignette"]')!;
    this.scopeOverlayEl = el.querySelector('[data-ref="scope-overlay"]')!;
    this.crosshairEl = el.querySelector('[data-ref="crosshair"]')!;
    this.chTopEl = el.querySelector('[data-ref="ch-top"]')!;
    this.chBottomEl = el.querySelector('[data-ref="ch-bottom"]')!;
    this.chLeftEl = el.querySelector('[data-ref="ch-left"]')!;
    this.chRightEl = el.querySelector('[data-ref="ch-right"]')!;
    this.hitmarkerEl = el.querySelector('[data-ref="hitmarker"]')!;
    this.damageIndicatorsEl = el.querySelector('[data-ref="damage-indicators"]')!;

    this.topLeftLabelEl = el.querySelector('[data-ref="tl-label"]')!;
    this.topLeftScoreEl = el.querySelector('[data-ref="tl-score"]')!;
    this.topLeftBarEl = el.querySelector('[data-ref="tl-bar"]')!;
    this.topRightLabelEl = el.querySelector('[data-ref="tr-label"]')!;
    this.topRightScoreEl = el.querySelector('[data-ref="tr-score"]')!;
    this.topRightBarEl = el.querySelector('[data-ref="tr-bar"]')!;
    this.matchTimerEl = el.querySelector('[data-ref="match-timer"]')!;
    this.matchModeTagEl = el.querySelector('[data-ref="match-mode-tag"]')!;

    this.fpsBadgeEl = el.querySelector('[data-ref="fps-badge"]')!;
    this.fpsBadgeEl.classList.toggle('bl-hidden', !this.settings.showFps);
    this.killFeedContainerEl = el.querySelector('[data-ref="killfeed"]')!;

    this.hpCardEl = el.querySelector('[data-ref="hp-card"]')!;
    this.hpNumberEl = el.querySelector('[data-ref="hp-number"]')!;
    this.hpBarFillEl = el.querySelector('[data-ref="hp-bar-fill"]')!;
    this.stancePillEl = el.querySelector('[data-ref="stance-pill"]')!;

    this.reloadWarningEl = el.querySelector('[data-ref="reload-warning"]')!;
    this.weaponNameEl = el.querySelector('[data-ref="weapon-name"]')!;
    this.fireModeBadgeEl = el.querySelector('[data-ref="firemode-badge"]')!;
    this.ammoMagEl = el.querySelector('[data-ref="ammo-mag"]')!;
    this.ammoReserveEl = el.querySelector('[data-ref="ammo-reserve"]')!;
    this.slotPrimaryEl = el.querySelector('[data-ref="slot-primary"]')!;
    this.slotPrimaryLabelEl = el.querySelector('[data-ref="slot-primary-label"]')!;
    this.slotSidearmEl = el.querySelector('[data-ref="slot-sidearm"]')!;
    this.slotGrenadeEl = el.querySelector('[data-ref="slot-grenade"]')!;
    this.slotGrenadeLabelEl = el.querySelector('[data-ref="slot-grenade-label"]')!;

    this.killBannerEl = el.querySelector('[data-ref="kill-banner"]')!;
    this.reloadProgressBoxEl = el.querySelector('[data-ref="reload-box"]')!;
    this.reloadBarFillEl = el.querySelector('[data-ref="reload-bar"]')!;
    this.practiceHintEl = el.querySelector('[data-ref="practice-hint"]')!;
    this.countdownBannerEl = el.querySelector('[data-ref="countdown-banner"]')!;
    this.countdownValueEl = el.querySelector('[data-ref="countdown-value"]')!;

    return el;
  }

  private createScoreboardDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-scoreboard-overlay bl-hidden';

    el.innerHTML = `
      <div class="bl-scoreboard-card">
        <div class="bl-sb-header">
          <span class="bl-sb-title">TACTICAL ROSTER &amp; TELEMETRY</span>
          <span class="bl-sb-subtitle" data-ref="sb-subtitle">BREAKWATER TERMINAL // TDM</span>
        </div>
        <table class="bl-sb-table">
          <thead>
            <tr>
              <th>OPERATOR</th>
              <th>FACTION</th>
              <th>KILLS</th>
              <th>DEATHS</th>
              <th>K/D</th>
              <th>SCORE</th>
            </tr>
          </thead>
          <tbody data-ref="sb-tbody"></tbody>
        </table>
      </div>
    `;

    this.sbSubtitleEl = el.querySelector('[data-ref="sb-subtitle"]')!;
    this.sbTbodyEl = el.querySelector('[data-ref="sb-tbody"]')!;
    return el;
  }

  private createPauseModalDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-modal-backdrop bl-hidden';

    el.innerHTML = `
      <div class="bl-modal-panel">
        <div class="bl-modal-header">
          <h2 class="bl-modal-title">OPERATION PAUSED</h2>
          <span class="bl-nav-hint">[ESC] TO RESUME</span>
        </div>
        <div class="bl-nav-stack">
          <button type="button" class="bl-nav-item bl-nav-deploy" data-pause-action="resume">
            <span>RESUME COMBAT</span>
            <span class="bl-nav-hint">[ESC]</span>
          </button>
          <button type="button" class="bl-nav-item" data-pause-action="settings">
            <span>SYSTEM &amp; AUDIO SETTINGS</span>
            <span class="bl-nav-hint">CONFIG</span>
          </button>
          <button type="button" class="bl-nav-item" data-pause-action="controls">
            <span>OPERATOR KEYBINDS</span>
            <span class="bl-nav-hint">CONTROLS</span>
          </button>
          <button type="button" class="bl-nav-item" data-pause-action="restart">
            <span>RESTART OPERATION</span>
            <span class="bl-nav-hint">REDEPLOY</span>
          </button>
          <button type="button" class="bl-nav-item" data-pause-action="menu">
            <span>ABORT TO COMMAND MENU</span>
            <span class="bl-nav-hint">EXIT</span>
          </button>
        </div>
      </div>
    `;

    el.querySelector('[data-pause-action="resume"]')?.addEventListener('click', () => {
      this.callbacks.onResumeMatch?.();
    });
    el.querySelector('[data-pause-action="settings"]')?.addEventListener('click', () => {
      this.openSettingsModal();
    });
    el.querySelector('[data-pause-action="controls"]')?.addEventListener('click', () => {
      this.openControlsModal();
    });
    el.querySelector('[data-pause-action="restart"]')?.addEventListener('click', () => {
      this.callbacks.onRestartMatch?.();
    });
    el.querySelector('[data-pause-action="menu"]')?.addEventListener('click', () => {
      this.callbacks.onReturnToMenu?.();
    });

    return el;
  }

  private createSettingsModalDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-modal-backdrop bl-hidden';

    el.innerHTML = `
      <div class="bl-modal-panel">
        <div class="bl-modal-header">
          <h2 class="bl-modal-title">SYSTEM &amp; AUDIO CONFIGURATION</h2>
          <button type="button" class="bl-close-btn" data-settings-action="close">CLOSE</button>
        </div>

        <div class="bl-settings-grid">
          <div class="bl-setting-row">
            <span class="bl-setting-label">MOUSE LOOK SENSITIVITY</span>
            <input type="range" class="bl-slider" data-setting="mouseSensitivity" min="0.1" max="3.0" step="0.05" />
            <span class="bl-setting-val" data-setting-val="mouseSensitivity">1.00</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">ADS ZOOM SENSITIVITY</span>
            <input type="range" class="bl-slider" data-setting="adsSensitivityMultiplier" min="0.3" max="1.0" step="0.05" />
            <span class="bl-setting-val" data-setting-val="adsSensitivityMultiplier">0.65</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">HORIZONTAL FIELD OF VIEW</span>
            <input type="range" class="bl-slider" data-setting="fov" min="65" max="110" step="1" />
            <span class="bl-setting-val" data-setting-val="fov">85°</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">MASTER AUDIO VOLUME</span>
            <input type="range" class="bl-slider" data-setting="masterVolume" min="0" max="1" step="0.02" />
            <span class="bl-setting-val" data-setting-val="masterVolume">80%</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">COMBAT SFX VOLUME</span>
            <input type="range" class="bl-slider" data-setting="sfxVolume" min="0" max="1" step="0.02" />
            <span class="bl-setting-val" data-setting-val="sfxVolume">85%</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">ENVIRONMENTAL AMBIENCE</span>
            <input type="range" class="bl-slider" data-setting="ambienceVolume" min="0" max="1" step="0.02" />
            <span class="bl-setting-val" data-setting-val="ambienceVolume">65%</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">GRAPHICS QUALITY PRESET</span>
            <select class="bl-select" data-setting="qualityPreset">
              <option value="low">LOW // MAX FRAMERATE</option>
              <option value="medium">MEDIUM // BALANCED</option>
              <option value="high">HIGH // ULTRA SHADOWS &amp; VFX</option>
            </select>
            <span class="bl-setting-val" data-setting-val="qualityPreset">HIGH</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">REDUCED CAMERA MOTION</span>
            <input type="checkbox" class="bl-checkbox" data-setting="reducedCameraMotion" />
            <span class="bl-setting-val" data-setting-val="reducedCameraMotion">OFF</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">SHOW FPS &amp; FRAME TELEMETRY</span>
            <input type="checkbox" class="bl-checkbox" data-setting="showFps" />
            <span class="bl-setting-val" data-setting-val="showFps">ON</span>
          </div>

          <div class="bl-setting-row">
            <span class="bl-setting-label">INVERT VERTICAL LOOK (Y-AXIS)</span>
            <input type="checkbox" class="bl-checkbox" data-setting="invertY" />
            <span class="bl-setting-val" data-setting-val="invertY">OFF</span>
          </div>
        </div>

        <div class="bl-modal-footer">
          <button type="button" class="bl-action-btn" data-settings-action="reset">RESET DEFAULTS</button>
          <button type="button" class="bl-action-btn is-primary" data-settings-action="close">APPLY &amp; RETURN</button>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-settings-action="close"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeSettingsModal());
    });

    el.querySelector('[data-settings-action="reset"]')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // Bind live input changes
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting as keyof GameSettings;
        if (!key) return;
        let value: number | boolean | QualityPreset;
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          value = input.checked;
        } else if (key === 'qualityPreset') {
          value = input.value as QualityPreset;
        } else {
          value = parseFloat(input.value);
        }
        this.updateSettings({ [key]: value } as Partial<GameSettings>);
      });
    });

    return el;
  }

  private createControlsModalDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-modal-backdrop bl-hidden';

    const bindings: Array<[string, string]> = [
      ['Move Forward / Strafe / Back', 'W / A / S / D'],
      ['Aim & Look', 'MOUSE'],
      ['Fire Weapon', 'LEFT MOUSE BUTTON'],
      ['Aim Down Sights (ADS)', 'RIGHT MOUSE BUTTON (HOLD)'],
      ['Sprint', 'LEFT SHIFT (HOLD)'],
      ['Crouch / Low Profile', 'C or LEFT CTRL'],
      ['Jump / Vault', 'SPACEBAR'],
      ['Reload Magazine', 'R'],
      ['Equip Primary Weapon', '1'],
      ['Equip P226 Sentinel Sidearm', '2'],
      ['Quick Swap Weapon', 'Q or MOUSE WHEEL'],
      ['Throw M67 Frag Grenade', 'G'],
      ['Tactical Roster / Scoreboard', 'TAB (HOLD)'],
      ['Pause / System Menu', 'ESC'],
    ];

    const gridHtml = bindings
      .map(
        ([action, key]) => `
      <div class="bl-keybind-item">
        <span class="bl-keybind-action">${action}</span>
        <span class="bl-keybind-key">${key}</span>
      </div>
    `
      )
      .join('');

    el.innerHTML = `
      <div class="bl-modal-panel is-wide">
        <div class="bl-modal-header">
          <h2 class="bl-modal-title">OPERATOR CONTROLS &amp; KEYBINDS</h2>
          <button type="button" class="bl-close-btn" data-controls-action="close">CLOSE</button>
        </div>
        <div class="bl-controls-grid">
          ${gridHtml}
        </div>
        <div class="bl-modal-footer">
          <button type="button" class="bl-action-btn is-primary" data-controls-action="close">RETURN</button>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-controls-action="close"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeControlsModal());
    });

    return el;
  }

  private createEndModalDom(): HTMLElement {
    const el = document.createElement('section');
    el.className = 'bl-modal-backdrop bl-hidden';

    el.innerHTML = `
      <div class="bl-modal-panel is-wide">
        <div class="bl-eom-banner">
          <div class="bl-eom-outcome is-victory" data-ref="eom-outcome">VICTORY</div>
          <div class="bl-sb-subtitle" data-ref="eom-subtitle">AEGIS TASK FORCE DOMINATED THE SECTOR</div>
        </div>

        <div class="bl-mvp-strip" data-ref="eom-mvp">
          <span class="bl-mvp-tag">★ MATCH MVP</span>
          <span>OPERATOR // 0 KILLS // 0 SCORE</span>
        </div>

        <table class="bl-sb-table">
          <thead>
            <tr>
              <th>OPERATOR</th>
              <th>FACTION</th>
              <th>KILLS</th>
              <th>DEATHS</th>
              <th>K/D</th>
              <th>SCORE</th>
            </tr>
          </thead>
          <tbody data-ref="eom-tbody"></tbody>
        </table>

        <div class="bl-modal-footer">
          <button type="button" class="bl-action-btn" data-eom-action="menu">RETURN TO MENU</button>
          <button type="button" class="bl-action-btn is-primary" data-eom-action="rematch">PLAY AGAIN (REMATCH)</button>
        </div>
      </div>
    `;

    this.eomOutcomeEl = el.querySelector('[data-ref="eom-outcome"]')!;
    this.eomSubtitleEl = el.querySelector('[data-ref="eom-subtitle"]')!;
    this.eomMvpStripEl = el.querySelector('[data-ref="eom-mvp"]')!;
    this.eomTbodyEl = el.querySelector('[data-ref="eom-tbody"]')!;

    el.querySelector('[data-eom-action="rematch"]')?.addEventListener('click', () => {
      this.callbacks.onRestartMatch?.();
    });
    el.querySelector('[data-eom-action="menu"]')?.addEventListener('click', () => {
      this.callbacks.onReturnToMenu?.();
    });

    return el;
  }

  private bindInteractiveAudio(): void {
    const buttons = this.root.querySelectorAll('button, select, input[type="checkbox"]');
    buttons.forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        this.sound?.playUiHover();
      });
      btn.addEventListener('click', () => {
        this.sound?.playUiClick();
      });
    });
  }

  private syncMenuSelectionState(): void {
    const { mapId, modeId, difficulty, primaryWeapon } = this.matchConfig;

    this.mainMenuEl.querySelectorAll<HTMLElement>('[data-map-select]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.mapSelect === mapId);
    });

    this.mainMenuEl.querySelectorAll<HTMLElement>('[data-mode-select]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.modeSelect === modeId);
    });

    this.mainMenuEl.querySelectorAll<HTMLElement>('[data-diff-select]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.diffSelect === difficulty);
    });

    this.mainMenuEl.querySelectorAll<HTMLElement>('[data-weapon-select]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.weaponSelect === primaryWeapon);
    });

    const weaponDef = WEAPON_DEFINITIONS[primaryWeapon];
    const mapMeta = MAP_CARDS.find((m) => m.id === mapId) ?? MAP_CARDS[0];
    const modeMeta = MODE_META[modeId];

    this.spineSummaryEl.textContent = `${mapMeta.name.toUpperCase()} • ${modeMeta.shortTag} • ${weaponDef.name}`;
    this.statsTitleEl.textContent = `${weaponDef.name} // ${weaponDef.classLabel.toUpperCase()}`;

    const effectiveDamage =
      weaponDef.pelletCount > 1
        ? weaponDef.baseDamage * weaponDef.pelletCount
        : weaponDef.baseDamage;
    const dmgPct = THREE.MathUtils.clamp((effectiveDamage / 155) * 100, 15, 100);
    const rpmPct = THREE.MathUtils.clamp((weaponDef.rpm / 950) * 100, 12, 100);
    const rangePct = THREE.MathUtils.clamp((weaponDef.falloffEnd / 115) * 100, 18, 100);
    const mobPct = THREE.MathUtils.clamp(weaponDef.moveSpeedMultiplier * 95, 20, 100);

    this.statFillDamage.style.width = `${dmgPct.toFixed(0)}%`;
    this.statValDamage.textContent =
      weaponDef.pelletCount > 1
        ? `${weaponDef.baseDamage}x${weaponDef.pelletCount}`
        : `${weaponDef.baseDamage}`;

    this.statFillRpm.style.width = `${rpmPct.toFixed(0)}%`;
    this.statValRpm.textContent = `${weaponDef.rpm}`;

    this.statFillRange.style.width = `${rangePct.toFixed(0)}%`;
    this.statValRange.textContent = `${weaponDef.falloffEnd}M`;

    this.statFillMobility.style.width = `${mobPct.toFixed(0)}%`;
    this.statValMobility.textContent = `${Math.round(weaponDef.moveSpeedMultiplier * 100)}%`;
  }

  private syncSettingsControls(): void {
    if (!this.settingsModalEl) return;

    const setSlider = (key: keyof GameSettings, formatted: string) => {
      const input = this.settingsModalEl.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
      const label = this.settingsModalEl.querySelector<HTMLElement>(`[data-setting-val="${key}"]`);
      if (input) input.value = String(this.settings[key]);
      if (label) label.textContent = formatted;
    };

    setSlider('mouseSensitivity', this.settings.mouseSensitivity.toFixed(2));
    setSlider('adsSensitivityMultiplier', this.settings.adsSensitivityMultiplier.toFixed(2));
    setSlider('fov', `${Math.round(this.settings.fov)}°`);
    setSlider('masterVolume', `${Math.round(this.settings.masterVolume * 100)}%`);
    setSlider('sfxVolume', `${Math.round(this.settings.sfxVolume * 100)}%`);
    setSlider('ambienceVolume', `${Math.round(this.settings.ambienceVolume * 100)}%`);

    const presetSelect = this.settingsModalEl.querySelector<HTMLSelectElement>(
      '[data-setting="qualityPreset"]'
    );
    const presetVal = this.settingsModalEl.querySelector<HTMLElement>(
      '[data-setting-val="qualityPreset"]'
    );
    if (presetSelect) presetSelect.value = this.settings.qualityPreset;
    if (presetVal) presetVal.textContent = this.settings.qualityPreset.toUpperCase();

    const setToggle = (key: 'reducedCameraMotion' | 'showFps' | 'invertY') => {
      const cb = this.settingsModalEl.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
      const val = this.settingsModalEl.querySelector<HTMLElement>(`[data-setting-val="${key}"]`);
      const checked = Boolean(this.settings[key]);
      if (cb) cb.checked = checked;
      if (val) val.textContent = checked ? 'ON' : 'OFF';
    };

    setToggle('reducedCameraMotion');
    setToggle('showFps');
    setToggle('invertY');
  }

  /**
   * Comprehensive HUD telemetry update method.
   */
  public updateHud(state: HudTelemetryState): void {
    this.updateHealth(state.health, state.maxHealth, state.stance);
    this.updateAmmo(
      state.activeWeapon,
      state.magAmmo,
      state.reserveAmmo,
      state.isReloading,
      state.reloadProgress,
      state.grenadeCount,
      state.grenadeCooldown,
      state.primaryWeapon
    );
    this.updateCrosshair(state.spreadRadians, state.adsProgress, state.activeWeapon, state.isSprinting);
    this.updateMatchHeader(
      state.modeId,
      state.remainingSeconds,
      state.aegisScore,
      state.kestrelScore,
      state.scoreLimit
    );
    if (state.countdownSeconds !== undefined) {
      this.updateCountdown(state.countdownSeconds);
    }
  }

  public updateHealth(
    health: number,
    maxHealth = 100,
    stance: 'STAND' | 'CROUCH' | 'SPRINT' = 'STAND'
  ): void {
    const clampedHp = Math.max(0, Math.ceil(health));
    const pct = THREE.MathUtils.clamp((clampedHp / Math.max(1, maxHealth)) * 100, 0, 100);
    const isLow = clampedHp > 0 && clampedHp <= 35;

    this.hpNumberEl.textContent = String(clampedHp);
    this.hpBarFillEl.style.width = `${pct.toFixed(1)}%`;
    this.stancePillEl.textContent = stance;
    this.hpCardEl.classList.toggle('is-low-hp', isLow);

    if (clampedHp <= 0) {
      this.damageVignetteEl.style.opacity = '0.88';
      this.damageVignetteEl.classList.remove('is-critical');
    } else if (isLow) {
      this.damageVignetteEl.style.opacity = String(THREE.MathUtils.lerp(0.35, 0.85, 1 - clampedHp / 35));
      this.damageVignetteEl.classList.add('is-critical');
    } else if (clampedHp < 75) {
      this.damageVignetteEl.style.opacity = String(THREE.MathUtils.lerp(0, 0.3, 1 - (clampedHp - 35) / 40));
      this.damageVignetteEl.classList.remove('is-critical');
    } else {
      this.damageVignetteEl.style.opacity = '0';
      this.damageVignetteEl.classList.remove('is-critical');
    }
  }

  public updateAmmo(
    weaponId: WeaponId,
    magAmmo: number,
    reserveAmmo: number,
    isReloading = false,
    reloadProgress = 0,
    grenadeCount = 1,
    grenadeCooldown = 0,
    primaryWeaponId?: PrimaryWeaponId
  ): void {
    const def = WEAPON_DEFINITIONS[weaponId];
    const primaryDef = WEAPON_DEFINITIONS[primaryWeaponId ?? this.matchConfig.primaryWeapon];

    this.weaponNameEl.textContent = def.name;
    this.fireModeBadgeEl.textContent = def.fireMode.toUpperCase();
    this.ammoMagEl.textContent = String(Math.max(0, magAmmo));
    this.ammoReserveEl.textContent = String(Math.max(0, reserveAmmo));

    const lowThreshold = Math.max(2, Math.floor(def.magazineSize * 0.28));
    const isEmpty = magAmmo <= 0;
    const isLow = !isEmpty && magAmmo <= lowThreshold;

    this.ammoMagEl.classList.toggle('is-low', isLow);
    this.ammoMagEl.classList.toggle('is-empty', isEmpty);

    const showReloadWarn = !isReloading && (isEmpty || isLow) && reserveAmmo > 0;
    this.reloadWarningEl.classList.toggle('bl-hidden', !showReloadWarn);
    this.reloadWarningEl.textContent = isEmpty ? '[R] EMPTY // RELOAD NOW' : '[R] LOW AMMO';

    this.reloadProgressBoxEl.classList.toggle('bl-hidden', !isReloading);
    if (isReloading) {
      const pct = THREE.MathUtils.clamp(reloadProgress * 100, 0, 100);
      this.reloadBarFillEl.style.width = `${pct.toFixed(1)}%`;
    }

    this.slotPrimaryLabelEl.textContent = primaryDef.name;
    this.slotPrimaryEl.classList.toggle('is-active', weaponId !== 'pistol');
    this.slotSidearmEl.classList.toggle('is-active', weaponId === 'pistol');

    if (grenadeCooldown > 0.05) {
      this.slotGrenadeLabelEl.textContent = `FRAG ${grenadeCooldown.toFixed(1)}s`;
      this.slotGrenadeEl.classList.remove('is-active');
    } else if (grenadeCount > 0) {
      this.slotGrenadeLabelEl.textContent = `FRAG x${grenadeCount}`;
      this.slotGrenadeEl.classList.add('is-active');
    } else {
      this.slotGrenadeLabelEl.textContent = 'FRAG 0';
      this.slotGrenadeEl.classList.remove('is-active');
    }
  }

  public updateCrosshair(
    spreadRadians: number,
    adsProgress: number,
    _weaponId: WeaponId,
    isSprinting = false
  ): void {
    this.scopeOverlayEl.classList.remove('is-active');

    // Hide hip-fire crosshair when fully ADS (player uses 3D weapon optic or 3D DMR scope)
    const hideCrosshair = adsProgress > 0.82;
    this.crosshairEl.classList.toggle('is-hidden', hideCrosshair);

    const gapPx = THREE.MathUtils.clamp(
      4 + spreadRadians * 420 + (isSprinting ? 10 : 0) * (1 - adsProgress),
      3,
      46
    );

    this.chTopEl.style.transform = `translateY(${-gapPx.toFixed(1)}px)`;
    this.chBottomEl.style.transform = `translateY(${gapPx.toFixed(1)}px)`;
    this.chLeftEl.style.transform = `translateX(${-gapPx.toFixed(1)}px)`;
    this.chRightEl.style.transform = `translateX(${gapPx.toFixed(1)}px)`;
  }

  public updateMatchHeader(
    modeId: GameModeId,
    remainingSeconds: number,
    aegisScore: number,
    kestrelScore: number,
    scoreLimit: number
  ): void {
    const clampedSec = Math.max(0, Math.ceil(remainingSeconds));
    const mins = Math.floor(clampedSec / 60);
    const secs = clampedSec % 60;
    this.matchTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const safeLimit = Math.max(1, scoreLimit);
    if (modeId === 'tdm') {
      this.topLeftLabelEl.textContent = 'AEGIS';
      this.topRightLabelEl.textContent = 'KESTREL';
      this.matchModeTagEl.textContent = `TDM // ${scoreLimit} PTS`;
    } else if (modeId === 'ffa') {
      this.topLeftLabelEl.textContent = 'YOU';
      this.topRightLabelEl.textContent = 'TOP HOSTILE';
      this.matchModeTagEl.textContent = `FFA // ${scoreLimit} KILLS`;
    } else {
      this.topLeftLabelEl.textContent = 'HITS / KILLS';
      this.topRightLabelEl.textContent = 'RANGE BOTS';
      this.matchModeTagEl.textContent = 'PRACTICE SANDBOX';
    }

    this.topLeftScoreEl.textContent = String(aegisScore);
    this.topRightScoreEl.textContent = String(kestrelScore);
    this.topLeftBarEl.style.width = `${THREE.MathUtils.clamp((aegisScore / safeLimit) * 100, 0, 100).toFixed(1)}%`;
    this.topRightBarEl.style.width = `${THREE.MathUtils.clamp((kestrelScore / safeLimit) * 100, 0, 100).toFixed(1)}%`;

    this.practiceHintEl.classList.toggle('bl-hidden', modeId !== 'practice');
  }

  public updateCountdown(secondsLeft: number | null): void {
    if (secondsLeft === null || secondsLeft <= 0) {
      this.countdownBannerEl.classList.add('bl-hidden');
      return;
    }
    this.countdownBannerEl.classList.remove('bl-hidden');
    this.countdownValueEl.textContent = String(Math.ceil(secondsLeft));
  }

  public updateFps(fps: number, frameTimeMs?: number): void {
    if (!this.settings.showFps) {
      this.fpsBadgeEl.classList.add('bl-hidden');
      return;
    }
    this.fpsBadgeEl.classList.remove('bl-hidden');
    const roundedFps = Math.round(fps);
    const ms = frameTimeMs !== undefined ? frameTimeMs : fps > 0 ? 1000 / fps : 16.7;
    this.fpsBadgeEl.textContent = `${roundedFps} FPS // ${ms.toFixed(1)} ms`;
  }

  /**
   * Flashes tactical hitmarker X (white for body, amber for headshot, crimson for kill).
   */
  public showHitmarker(isHeadshot: boolean, isKill = false): void {
    this.hitmarkerEl.classList.remove('is-headshot', 'is-kill');
    if (isKill) {
      this.hitmarkerEl.classList.add('is-kill');
    } else if (isHeadshot) {
      this.hitmarkerEl.classList.add('is-headshot');
    }
    this.hitmarkerEl.classList.add('is-active');

    if (this.hitmarkerHideTimeout !== null) {
      window.clearTimeout(this.hitmarkerHideTimeout);
    }
    this.hitmarkerHideTimeout = window.setTimeout(() => {
      this.hitmarkerEl.classList.remove('is-active');
      this.hitmarkerHideTimeout = null;
    }, 150);
  }

  /**
   * Displays a center-screen elimination confirmation banner.
   */
  public showKillBanner(victimName: string, isHeadshot: boolean, scoreAwarded = 100): void {
    const hsTag = isHeadshot ? ' // HEADSHOT' : '';
    this.killBannerEl.textContent = `+${scoreAwarded} ELIMINATED ${victimName.toUpperCase()}${hsTag}`;
    this.killBannerEl.classList.remove('bl-hidden');

    if (this.killBannerHideTimeout !== null) {
      window.clearTimeout(this.killBannerHideTimeout);
    }
    this.killBannerHideTimeout = window.setTimeout(() => {
      this.killBannerEl.classList.add('bl-hidden');
      this.killBannerHideTimeout = null;
    }, 2100);
  }

  /**
   * Spawns a radial directional damage indicator arc pointing toward the attacker in 3D space.
   */
  public addDamageIndicator(
    attackerPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    playerYaw: number
  ): void {
    this.lastPlayerPos.copy(playerPos);
    this.lastPlayerYaw = playerYaw;

    const arcEl = document.createElement('div');
    arcEl.className = 'bl-damage-arc';
    this.damageIndicatorsEl.appendChild(arcEl);

    const arc: ActiveDamageArc = {
      id: this.nextDamageArcId++,
      element: arcEl,
      attackerX: attackerPos.x,
      attackerZ: attackerPos.z,
      age: 0,
      duration: 1.35,
    };

    this.activeDamageArcs.push(arc);
    this.positionDamageArc(arc);
  }

  private positionDamageArc(arc: ActiveDamageArc): void {
    const dx = arc.attackerX - this.lastPlayerPos.x;
    const dz = arc.attackerZ - this.lastPlayerPos.z;

    // In Three.js right-handed coords (-Z forward, +X right), yaw=0 looks along -Z
    const worldAngle = Math.atan2(dx, -dz);
    const relAngle = worldAngle + this.lastPlayerYaw;
    const deg = THREE.MathUtils.radToDeg(relAngle);
    const alpha = THREE.MathUtils.clamp(1 - arc.age / arc.duration, 0, 1);

    arc.element.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    arc.element.style.opacity = alpha.toFixed(2);
  }

  /**
   * Appends a live Kill Feed entry to the top-right feed.
   */
  public addKillFeedEntry(entry: KillFeedEntry): void {
    if (this.killFeedDomMap.has(entry.id)) return;

    const item = document.createElement('div');
    item.className = 'bl-killfeed-item';

    const weaponLabel =
      entry.weaponId === 'grenade'
        ? 'M67 FRAG'
        : WEAPON_DEFINITIONS[entry.weaponId]?.name ?? entry.weaponId.toUpperCase();
    const hsBadge = entry.isHeadshot ? '<span class="bl-kf-hs">[HS]</span>' : '';

    item.innerHTML = `
      <span class="bl-kf-attacker bl-kf-team-${entry.attackerTeam}">${this.escapeHtml(entry.attackerName)}</span>
      <span class="bl-kf-weapon">${weaponLabel}</span>
      ${hsBadge}
      <span class="bl-kf-victim bl-kf-team-${entry.victimTeam}">${this.escapeHtml(entry.victimName)}</span>
    `;

    this.killFeedContainerEl.prepend(item);
    this.killFeedDomMap.set(entry.id, { el: item, createdAt: performance.now() });

    // Cap visible killfeed entries at 5
    while (this.killFeedContainerEl.children.length > 5) {
      const last = this.killFeedContainerEl.lastElementChild;
      if (!last) break;
      last.remove();
    }
  }

  /**
   * Updates the [TAB] Scoreboard table rows.
   */
  public updateScoreboard(
    combatants: CombatantState[],
    modeId: GameModeId = this.matchConfig.modeId,
    mapName?: string
  ): void {
    const mapLabel =
      mapName ?? MAP_CARDS.find((m) => m.id === this.matchConfig.mapId)?.name ?? 'SECTOR';
    this.sbSubtitleEl.textContent = `${mapLabel.toUpperCase()} // ${MODE_META[modeId].shortTag}`;
    this.renderScoreboardRows(this.sbTbodyEl, combatants);
  }

  private renderScoreboardRows(tbody: HTMLElement, combatants: CombatantState[]): void {
    const sorted = [...combatants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });

    tbody.innerHTML = sorted
      .map((c) => {
        const kd = c.deaths === 0 ? c.kills.toFixed(2) : (c.kills / c.deaths).toFixed(2);
        const factionLabel = this.formatTeamLabel(c.team);
        const cleanName = c.name.replace(/\s*\(YOU\)\s*/gi, '');
        return `
        <tr class="${c.isPlayer ? 'is-player' : ''}">
          <td>${this.escapeHtml(cleanName)}${c.isPlayer ? ' (YOU)' : ''}</td>
          <td><span class="bl-sb-faction-badge bl-sb-faction-${c.team}">${factionLabel}</span></td>
          <td>${c.kills}</td>
          <td>${c.deaths}</td>
          <td>${kd}</td>
          <td>${c.score}</td>
        </tr>
      `;
      })
      .join('');
  }

  public clearCombatOverlays(): void {
    for (const arc of this.activeDamageArcs) {
      arc.element.remove();
    }
    this.activeDamageArcs = [];
    this.damageVignetteEl.style.opacity = '0';
    this.damageVignetteEl.classList.remove('is-critical');
    this.killBannerEl.classList.add('bl-hidden');
    for (const [, item] of this.killFeedDomMap) {
      item.el.remove();
    }
    this.killFeedDomMap.clear();
  }

  private formatTeamLabel(team: TeamId): string {
    if (team === 'aegis') return 'AEGIS';
    if (team === 'kestrel') return 'KESTREL';
    return 'FREE AGENT';
  }

  /**
   * Displays the End-of-Match screen with VICTORY/DEFEAT/DRAW banner, MVP highlight, and full scoreboard.
   */
  public showEndScreen(summary: MatchEndSummary): void {
    this.setPhase('ended');

    this.eomOutcomeEl.classList.remove('is-victory', 'is-defeat', 'is-draw');
    if (summary.outcome === 'victory') {
      this.eomOutcomeEl.textContent = summary.title ?? 'MISSION VICTORY';
      this.eomOutcomeEl.classList.add('is-victory');
    } else if (summary.outcome === 'defeat') {
      this.eomOutcomeEl.textContent = summary.title ?? 'MISSION DEFEAT';
      this.eomOutcomeEl.classList.add('is-defeat');
    } else {
      this.eomOutcomeEl.textContent = summary.title ?? 'TACTICAL DRAW';
      this.eomOutcomeEl.classList.add('is-draw');
    }

    const mapMeta = MAP_CARDS.find((m) => m.id === summary.mapId) ?? MAP_CARDS[0];
    this.eomSubtitleEl.textContent =
      summary.subtitle ??
      `${mapMeta.name.toUpperCase()} // FINAL SCORE ${summary.aegisScore} - ${summary.kestrelScore}`;

    const sorted = [...summary.combatants].sort((a, b) => b.score - a.score || b.kills - a.kills);
    const mvp = sorted[0];
    if (mvp) {
      this.eomMvpStripEl.innerHTML = `
        <span class="bl-mvp-tag">★ MATCH MVP // ${this.escapeHtml(mvp.name.toUpperCase())}</span>
        <span>${mvp.kills} KILLS • ${mvp.deaths} DEATHS • ${mvp.score} PTS</span>
      `;
    }

    this.renderScoreboardRows(this.eomTbodyEl, sorted);
  }

  /**
   * Per-frame UI update to decay directional damage arcs and expire old killfeed items.
   */
  public update(dt: number, playerPos?: THREE.Vector3, playerYaw?: number): void {
    if (playerPos) this.lastPlayerPos.copy(playerPos);
    if (playerYaw !== undefined) this.lastPlayerYaw = playerYaw;

    for (let i = this.activeDamageArcs.length - 1; i >= 0; i--) {
      const arc = this.activeDamageArcs[i];
      arc.age += dt;
      if (arc.age >= arc.duration) {
        arc.element.remove();
        this.activeDamageArcs.splice(i, 1);
      } else {
        this.positionDamageArc(arc);
      }
    }

    const nowMs = performance.now();
    for (const [id, item] of this.killFeedDomMap.entries()) {
      if (nowMs - item.createdAt > 5500) {
        item.el.remove();
        this.killFeedDomMap.delete(id);
      }
    }
  }

  public tick(dt: number, playerPos?: THREE.Vector3, playerYaw?: number): void {
    this.update(dt, playerPos, playerYaw);
  }

  private escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
