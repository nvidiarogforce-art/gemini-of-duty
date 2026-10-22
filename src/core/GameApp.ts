import * as THREE from 'three';
import {
  BuiltMapData,
  CombatantState,
  GameSettings,
  KillFeedEntry,
  MapId,
  MatchConfig,
  MatchPhase,
  PLAYER_DIMENSIONS,
  PrimaryWeaponId,
  TeamId,
  WeaponId,
} from '../types/contracts';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { SceneRenderer } from '../rendering/SceneRenderer';
import { VFXManager } from '../rendering/VFXManager';
import { CollisionWorld, CombatantHitboxTarget } from '../physics/CollisionWorld';
import { buildMapById, MAP_SUMMARIES } from '../maps/MapRegistry';
import { SpawnEvaluator } from '../maps/SpawnEvaluator';
import {
  PRIMARY_WEAPONS,
  WEAPON_DEFINITIONS,
  calculateWeaponDamage,
} from '../weapons/WeaponDefinitions';
import {
  ViewmodelFactory,
  WeaponViewmodelRig,
} from '../weapons/ViewmodelFactory';
import { PlayerController } from '../player/PlayerController';
import { BotController } from '../ai/BotController';
import { SoundManager } from '../audio/SoundManager';
import { UIManager } from '../ui/UIManager';

const AEGIS_CALLSIGNS = ['WARDEN-2', 'TALON-3', 'SIERRA-4'];
const KESTREL_CALLSIGNS = ['VIPER-1', 'RAZOR-2', 'KRONOS-3', 'ASH-4', 'VEX-5', 'ONYX-6', 'DRAKE-7'];

/**
 * Lead Integrator & Match Coordinator for BLACKLINE // TACTICAL RESPONSE
 */
export class GameApp {
  public readonly sceneRenderer: SceneRenderer;
  public readonly materials: MaterialLibrary;
  public readonly collisionWorld: CollisionWorld;
  public readonly vfx: VFXManager;
  public readonly sound: SoundManager;
  public readonly ui: UIManager;
  public readonly player: PlayerController;
  public readonly spawnEvaluator: SpawnEvaluator;

  public currentMap: BuiltMapData | null = null;
  public currentMapId: MapId = 'breakwater';
  public phase: MatchPhase = 'menu';
  public matchConfig: MatchConfig;
  public settings: GameSettings;

  public bots: BotController[] = [];
  public viewmodels: Record<WeaponId, WeaponViewmodelRig>;
  private viewmodelContainer = new THREE.Group();

  // Match telemetry
  public matchElapsed = 0;
  public remainingSeconds = 480;
  public aegisScore = 0;
  public kestrelScore = 0;
  private killFeedCounter = 0;
  private playerRespawnTimer = 0;
  private botRespawnTimers = new Map<string, number>();
  public practiceAiActive = true;
  public inspectionPoseActive = false;

  // Frame timing & performance metrics
  private lastFrameTime = performance.now();
  private accumulator = 0;
  private readonly fixedStep = 1 / 60;
  private fpsFrameCount = 0;
  private fpsElapsed = 0;
  public measuredFps = 60;
  public measuredFrameTimeMs = 16.6;
  private menuOrbitAngle = 0;

  constructor(viewportEl: HTMLElement, uiRootEl: HTMLElement) {
    this.sceneRenderer = new SceneRenderer(viewportEl);
    this.materials = new MaterialLibrary();
    this.collisionWorld = new CollisionWorld();
    this.vfx = new VFXManager();
    this.sceneRenderer.scene.add(this.vfx.root);

    this.sound = new SoundManager();
    this.spawnEvaluator = new SpawnEvaluator();

    this.ui = new UIManager(uiRootEl, this.sound, {
      onStartMatch: (cfg) => this.startMatch(cfg),
      onMapPreviewChange: (mapId) => {
        if (this.phase === 'menu' && mapId !== this.currentMapId) {
          this.loadMap(mapId);
        }
      },
      onResumeMatch: () => this.resumeMatch(),
      onRestartMatch: () => this.startMatch(this.matchConfig),
      onReturnToMenu: () => this.returnToMenu(),
      onSettingsChange: (newSettings) => this.applySettings(newSettings),
    });

    this.settings = this.ui.getSettings();
    this.matchConfig = this.ui.getMatchConfig();

    this.player = new PlayerController(
      WEAPON_DEFINITIONS[this.matchConfig.primaryWeapon],
      WEAPON_DEFINITIONS.pistol
    );

    // Create all 5 weapon 3D viewmodels and attach to camera
    this.viewmodels = ViewmodelFactory.createAll();
    this.sceneRenderer.camera.add(this.viewmodelContainer);
    for (const id of Object.keys(this.viewmodels) as WeaponId[]) {
      const vm = this.viewmodels[id];
      vm.root.visible = false;
      this.viewmodelContainer.add(vm.root);
    }

    this.applySettings(this.settings);
    this.loadMap('breakwater');
    this.bindEvents();

    // Start main loop
    this.sceneRenderer.renderer.setAnimationLoop(() => this.onAnimationFrame());
  }

  public applySettings(settings: GameSettings): void {
    this.settings = settings;
    this.sceneRenderer.applyQualityPreset(settings.qualityPreset);
    this.sceneRenderer.camera.fov = settings.fov;
    this.sceneRenderer.camera.updateProjectionMatrix();
    this.sound.applySettings(settings);
    if (this.currentMap) {
      this.vfx.configureWeather(
        this.currentMap.config.ambientAudioType,
        this.currentMap.indoorZones,
        settings.qualityPreset
      );
    }
  }

  public loadMap(mapId: MapId): void {
    if (this.currentMap) {
      this.sceneRenderer.scene.remove(this.currentMap.rootGroup);
      this.currentMap.dispose();
      this.currentMap = null;
    }

    this.currentMapId = mapId;
    const built = buildMapById(mapId, this.materials);
    this.currentMap = built;
    this.sceneRenderer.scene.add(built.rootGroup);
    this.sceneRenderer.applyMapAtmosphere(built.config);
    this.collisionWorld.setMapData(built.colliders, built.raycastMeshes);
    this.vfx.clearMatchEffects();
    this.vfx.configureWeather(
      built.config.ambientAudioType,
      built.indoorZones,
      this.settings.qualityPreset
    );
    this.sceneRenderer.renderer.compile(this.sceneRenderer.scene, this.sceneRenderer.camera);
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
    this.fpsFrameCount = 0;
    this.fpsElapsed = 0;
    this.measuredFps = 120;
    this.measuredFrameTimeMs = 8.3;
    this.ui.updateFps(this.measuredFps, this.measuredFrameTimeMs);
  }

  public startMatch(config: MatchConfig): void {
    this.sound.resumeContext();
    this.matchConfig = { ...config };
    this.ui.setMatchConfig(this.matchConfig);

    if (this.currentMapId !== config.mapId || !this.currentMap) {
      this.loadMap(config.mapId);
    }

    // Clear previous bots
    this.clearBots();
    this.vfx.clearMatchEffects();
    this.spawnEvaluator.reset();

    // Reset match counters
    this.matchElapsed = 0;
    this.remainingSeconds = config.timeLimitSeconds;
    this.aegisScore = 0;
    this.kestrelScore = 0;
    this.playerRespawnTimer = 0;
    this.botRespawnTimers.clear();
    this.practiceAiActive = true;
    this.inspectionPoseActive = false;

    // Reset player stats & spawn
    this.player.state.kills = 0;
    this.player.state.deaths = 0;
    this.player.state.assists = 0;
    this.player.state.score = 0;
    const playerTeam: TeamId = config.modeId === 'ffa' ? 'ffa' : 'aegis';
    const primaryDef = WEAPON_DEFINITIONS[config.primaryWeapon];
    const playerSpawn = this.spawnEvaluator.selectBestSpawn(
      this.currentMap!.spawnPoints,
      playerTeam,
      config.modeId,
      [],
      this.collisionWorld,
      0
    );
    this.player.spawnAt(
      playerSpawn.position,
      playerSpawn.yaw,
      playerTeam,
      primaryDef,
      WEAPON_DEFINITIONS.pistol
    );
    this.setActiveViewmodel(this.player.state.activeWeapon);
    this.viewmodelContainer.visible = true;

    // Spawn 7 AI Bots (3 Allies + 4 Enemies in TDM; 7 Hostiles in FFA/Practice)
    this.spawnMatchBots(config);

    // Start map ambience & match start notification
    this.sound.startAmbience(this.currentMap!.config.ambientAudioType);
    this.sound.playMatchNotification('start');

    this.phase = 'playing';
    this.ui.setPhase('playing');
    this.ui.clearCombatOverlays();
    this.updateScoreboardUI();
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
    this.fpsFrameCount = 0;
    this.fpsElapsed = 0;
    this.measuredFps = 120;
    this.measuredFrameTimeMs = 8.3;
    this.ui.updateFps(this.measuredFps, this.measuredFrameTimeMs);
    this.requestPointerLockSafe();
  }

  private spawnMatchBots(config: MatchConfig): void {
    if (!this.currentMap) return;
    const allCombatants: CombatantState[] = [this.player.state];

    if (config.modeId === 'tdm') {
      // 3 Aegis Allies
      for (let i = 0; i < 3; i++) {
        const wId = PRIMARY_WEAPONS[(i + 1) % PRIMARY_WEAPONS.length];
        const bot = new BotController(
          `ally_${i + 1}`,
          AEGIS_CALLSIGNS[i],
          'aegis',
          WEAPON_DEFINITIONS[wId],
          config.difficulty,
          true
        );
        const sp = this.spawnEvaluator.selectBestSpawn(
          this.currentMap.spawnPoints,
          'aegis',
          'tdm',
          allCombatants,
          this.collisionWorld,
          0
        );
        bot.spawnAt(sp.position, sp.yaw, WEAPON_DEFINITIONS[wId]);
        this.sceneRenderer.scene.add(bot.rig.root);
        this.bots.push(bot);
        allCombatants.push(bot.state);
      }

      // 4 Kestrel Opponents
      for (let i = 0; i < 4; i++) {
        const wId = PRIMARY_WEAPONS[i % PRIMARY_WEAPONS.length];
        const bot = new BotController(
          `enemy_${i + 1}`,
          KESTREL_CALLSIGNS[i],
          'kestrel',
          WEAPON_DEFINITIONS[wId],
          config.difficulty,
          false
        );
        const sp = this.spawnEvaluator.selectBestSpawn(
          this.currentMap.spawnPoints,
          'kestrel',
          'tdm',
          allCombatants,
          this.collisionWorld,
          0
        );
        bot.spawnAt(sp.position, sp.yaw, WEAPON_DEFINITIONS[wId]);
        this.sceneRenderer.scene.add(bot.rig.root);
        this.bots.push(bot);
        allCombatants.push(bot.state);
      }
    } else {
      // Free-for-All or Practice: 7 Hostile Operators
      const count = config.modeId === 'practice' ? 5 : 7;
      for (let i = 0; i < count; i++) {
        const wId = PRIMARY_WEAPONS[i % PRIMARY_WEAPONS.length];
        const bot = new BotController(
          `ffa_bot_${i + 1}`,
          KESTREL_CALLSIGNS[i],
          config.modeId === 'practice' ? 'kestrel' : 'ffa',
          WEAPON_DEFINITIONS[wId],
          config.difficulty,
          false
        );
        const sp = this.spawnEvaluator.selectBestSpawn(
          this.currentMap.spawnPoints,
          'ffa',
          config.modeId,
          allCombatants,
          this.collisionWorld,
          0
        );
        bot.spawnAt(sp.position, sp.yaw, WEAPON_DEFINITIONS[wId]);
        this.sceneRenderer.scene.add(bot.rig.root);
        this.bots.push(bot);
        allCombatants.push(bot.state);
      }
    }
  }

  private clearBots(): void {
    for (const bot of this.bots) {
      this.sceneRenderer.scene.remove(bot.rig.root);
      bot.rig.dispose();
    }
    this.bots = [];
  }

  public pauseMatch(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.player.clearInputs();
    this.ui.showPauseMenu(true);
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public resumeMatch(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.ui.showPauseMenu(false);
    this.requestPointerLockSafe();
  }

  public returnToMenu(): void {
    this.phase = 'menu';
    this.player.clearInputs();
    this.clearBots();
    this.vfx.clearMatchEffects();
    this.sound.stopAmbience();
    this.viewmodelContainer.visible = false;
    this.ui.showMainMenu();
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  private endMatch(outcome: 'victory' | 'defeat' | 'draw', subtitle?: string): void {
    this.phase = 'ended';
    this.player.clearInputs();
    this.viewmodelContainer.visible = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    this.sound.playMatchNotification(outcome === 'victory' ? 'victory' : 'defeat');
    this.ui.showEndScreen({
      outcome,
      subtitle,
      modeId: this.matchConfig.modeId,
      mapId: this.currentMapId,
      aegisScore: this.aegisScore,
      kestrelScore: this.kestrelScore,
      combatants: this.getAllCombatants(),
    });
  }

  public getAllCombatants(): CombatantState[] {
    return [this.player.state, ...this.bots.map((b) => b.state)];
  }

  private setActiveViewmodel(weaponId: WeaponId): void {
    for (const id of Object.keys(this.viewmodels) as WeaponId[]) {
      this.viewmodels[id].root.visible = id === weaponId;
    }
  }

  private requestPointerLockSafe(): void {
    try {
      const canvas = this.sceneRenderer.renderer.domElement;
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    } catch {
      // Headless or automation context may reject pointer lock; gameplay still works
    }
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' && (this.phase === 'playing' || this.phase === 'paused')) {
        e.preventDefault();
        this.updateScoreboardUI();
        this.ui.showScoreboard(true);
        return;
      }

      if (e.code === 'Escape') {
        if (this.phase === 'playing') {
          this.pauseMatch();
        } else if (this.phase === 'paused') {
          this.resumeMatch();
        }
        return;
      }

      if (this.phase !== 'playing') return;

      // Practice Mode tactical sandbox shortcuts
      if (this.matchConfig.modeId === 'practice') {
        if (e.code === 'F1') {
          e.preventDefault();
          this.practiceAiActive = !this.practiceAiActive;
          this.ui.showKillBanner(
            this.practiceAiActive ? 'BOT AI ENABLED' : 'BOT AI PAUSED (TARGET DUMMIES)',
            false,
            0
          );
          return;
        }
        if (e.code === 'F2') {
          e.preventDefault();
          const pDef = WEAPON_DEFINITIONS[this.player.primarySlot.weaponId];
          this.player.primarySlot.magazine = pDef.magazineSize;
          this.player.primarySlot.reserve = pDef.reserveAmmoMax;
          this.player.sidearmSlot.magazine = WEAPON_DEFINITIONS.pistol.magazineSize;
          this.player.sidearmSlot.reserve = WEAPON_DEFINITIONS.pistol.reserveAmmoMax;
          this.player.grenadeCount = 2;
          this.player.state.health = 100;
          this.ui.showKillBanner('LOADOUT & HEALTH RESUPPLIED', false, 0);
          return;
        }
        if (e.code === 'F3') {
          e.preventDefault();
          const idx = PRIMARY_WEAPONS.indexOf(this.matchConfig.primaryWeapon);
          const nextW = PRIMARY_WEAPONS[(idx + 1) % PRIMARY_WEAPONS.length];
          this.matchConfig.primaryWeapon = nextW;
          const nextDef = WEAPON_DEFINITIONS[nextW];
          this.player.primarySlot = {
            weaponId: nextW,
            magazine: nextDef.magazineSize,
            reserve: nextDef.reserveAmmoMax,
          };
          this.player.switchSlot('primary');
          return;
        }
      }

      this.player.onKeyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        this.ui.showScoreboard(false);
        return;
      }
      this.player.onKeyUp(e.code);
    });

    window.addEventListener('mousedown', (e) => {
      if (this.phase !== 'playing') return;
      this.sound.resumeContext();
      if (document.pointerLockElement !== this.sceneRenderer.renderer.domElement) {
        this.requestPointerLockSafe();
      }
      this.player.onMouseDown(e.button);
    });

    window.addEventListener('mouseup', (e) => {
      this.player.onMouseUp(e.button);
    });

    window.addEventListener('wheel', (e) => {
      if (this.phase !== 'playing') return;
      this.player.onMouseWheel(e.deltaY);
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.phase === 'playing') e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.phase !== 'playing') return;
      this.player.onMouseMove(e.movementX, e.movementY, this.settings);
    });

    window.addEventListener('blur', () => {
      this.player.clearInputs();
    });

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.phase === 'playing') {
        this.player.clearInputs();
      }
    });
  }

  private onAnimationFrame(): void {
    const nowMs = performance.now();
    const rawDt = (nowMs - this.lastFrameTime) / 1000;
    this.lastFrameTime = nowMs;
    const clampedDt = Math.min(rawDt, 0.1);

    // FPS tracking
    this.fpsFrameCount++;
    this.fpsElapsed += rawDt;
    if (this.fpsElapsed >= 0.4) {
      this.measuredFps = this.fpsFrameCount / this.fpsElapsed;
      this.measuredFrameTimeMs = (this.fpsElapsed / this.fpsFrameCount) * 1000;
      this.fpsFrameCount = 0;
      this.fpsElapsed = 0;
      this.ui.updateFps(this.measuredFps, this.measuredFrameTimeMs);
    }

    if (this.phase === 'menu' || this.phase === 'ended') {
      this.updateMenuCamera(clampedDt);
      if (this.currentMap) {
        for (const fn of this.currentMap.animatedObjects) {
          fn(clampedDt, nowMs / 1000);
        }
      }
      this.vfx.update(clampedDt, this.sceneRenderer.camera.position);
      this.sceneRenderer.render();
      return;
    }

    if (this.phase === 'paused') {
      this.sceneRenderer.render();
      return;
    }

    // Active Match Fixed-Step Simulation
    if (this.inspectionPoseActive) {
      this.updateViewmodelAndHUD(clampedDt);
      this.sceneRenderer.render();
      return;
    }

    this.accumulator += clampedDt;
    while (this.accumulator >= this.fixedStep) {
      this.stepSimulation(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    this.updateViewmodelAndHUD(clampedDt);
    this.sceneRenderer.render();
  }

  private updateMenuCamera(dt: number): void {
    this.menuOrbitAngle += dt * 0.14;
    const cam = this.sceneRenderer.camera;
    const radius = 24;
    const cx = Math.cos(this.menuOrbitAngle) * radius;
    const cz = Math.sin(this.menuOrbitAngle) * radius;
    cam.position.set(cx, 9.5 + Math.sin(this.menuOrbitAngle * 2) * 1.2, cz);
    cam.lookAt(0, 3.2, 0);
  }

  public equipWeaponForShowcase(weaponId: WeaponId, adsProgress: number): void {
    this.inspectionPoseActive = true;
    if (weaponId === 'pistol') {
      this.player.switchSlot('sidearm');
    } else {
      this.matchConfig.primaryWeapon = weaponId as PrimaryWeaponId;
      this.player.setPrimaryWeapon(WEAPON_DEFINITIONS[weaponId]);
      this.player.switchSlot('primary');
    }
    this.player.equipProgress = 1.0;
    this.player.adsProgress = adsProgress;
    this.player.state.isAiming = adsProgress > 0.5;
    if (adsProgress > 0) {
      this.player.onMouseDown(2);
    } else {
      this.player.onMouseUp(2);
    }
    const baseFov = this.settings.fov;
    const def = WEAPON_DEFINITIONS[weaponId];
    this.sceneRenderer.camera.fov = THREE.MathUtils.lerp(
      baseFov,
      baseFov * def.adsFovZoom,
      adsProgress
    );
    this.sceneRenderer.camera.updateProjectionMatrix();
    this.setActiveViewmodel(weaponId);
    this.updateViewmodelAndHUD(1 / 60);
    this.sceneRenderer.render();
  }

  public setCameraPoseForInspection(
    camPos: [number, number, number],
    lookAtPos: [number, number, number],
    showViewmodel: boolean = true
  ): void {
    this.inspectionPoseActive = true;
    const dx = lookAtPos[0] - camPos[0];
    const dy = lookAtPos[1] - camPos[1];
    const dz = lookAtPos[2] - camPos[2];
    const horizDist = Math.hypot(dx, dz);
    this.player.state.isAlive = true;
    this.player.state.health = 100;
    this.player.equipProgress = 1.0;
    this.player.state.position.set(
      camPos[0],
      camPos[1] - PLAYER_DIMENSIONS.standingEyeHeight,
      camPos[2]
    );
    this.player.state.velocity.set(0, 0, 0);
    this.player.state.yaw = Math.atan2(-dx, -dz);
    this.player.state.pitch = Math.atan2(dy, Math.max(0.1, horizDist));
    this.setActiveViewmodel(this.player.state.activeWeapon);
    this.viewmodelContainer.visible = showViewmodel;
    this.ui.clearCombatOverlays();
    this.sceneRenderer.camera.position.set(camPos[0], camPos[1], camPos[2]);
    this.sceneRenderer.camera.lookAt(lookAtPos[0], lookAtPos[1], lookAtPos[2]);
    this.updateViewmodelAndHUD(1 / 60);
    this.sceneRenderer.render();
  }

  public stepSimulation(dt: number): void {
    if (!this.currentMap) return;
    this.matchElapsed += dt;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - dt);

    // Animate map landmarks (rotating radar dish, harbor waves, beacons, fans)
    for (const fn of this.currentMap.animatedObjects) {
      fn(dt, this.matchElapsed);
    }

    const allCombatants = this.getAllCombatants();
    const activeWeaponDef = WEAPON_DEFINITIONS[this.player.state.activeWeapon];
    const activeVm = this.viewmodels[this.player.state.activeWeapon];
    this.setActiveViewmodel(this.player.state.activeWeapon);

    // 1. Player update or respawn timer
    if (this.player.state.isAlive) {
      const muzzleWorldPos = new THREE.Vector3();
      activeVm.muzzlePoint.getWorldPosition(muzzleWorldPos);

      const fireCmd = this.player.update(
        dt,
        this.matchElapsed,
        this.collisionWorld,
        activeWeaponDef,
        this.settings,
        this.sceneRenderer.camera,
        muzzleWorldPos,
        {
          onFootstep: (surf, sprint) => this.sound.playFootstep(surf, sprint),
          onJump: () => this.sound.playJump(),
          onLand: (surf, spd) => this.sound.playLand(surf, spd),
          onReloadStep: (phase) => this.sound.playReloadStep(phase),
          onDryFire: () => this.sound.playDryFire(),
        }
      );

      this.sound.setListenerOrientation(this.player.state.yaw);

      // Handle Frag Grenade throw
      if (this.player.consumeGrenadeThrow()) {
        const throwDir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(this.sceneRenderer.camera.quaternion)
          .normalize();
        const throwOrigin = this.sceneRenderer.camera.position
          .clone()
          .addScaledVector(throwDir, 0.55);
        this.vfx.spawnFragGrenade(this.player.state.id, throwOrigin, throwDir);
      }

      if (fireCmd) {
        activeVm.triggerMuzzleFlash();
        this.sound.playWeaponFire(fireCmd.weaponDef.id);
        this.vfx.spawnMuzzleFlashLight(fireCmd.muzzleWorldPos);

        // Eject brass shell casing
        const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(this.sceneRenderer.camera.quaternion);
        const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(this.sceneRenderer.camera.quaternion);
        this.vfx.spawnShellCasing(
          fireCmd.muzzleWorldPos.clone().addScaledVector(rightDir, 0.08),
          rightDir,
          upDir
        );

        // Alert bots to gunfire sound cue
        for (const bot of this.bots) {
          bot.notifySoundCue(
            this.player.state.id,
            this.player.state.team,
            this.player.state.position,
            this.matchElapsed
          );
        }

        // Resolve hitscan rays (1 for rifle/SMG/DMR/pistol, 8 for shotgun)
        let anyHitCombatant = false;
        let anyHeadshot = false;
        let anyKill = false;

        for (const dir of fireCmd.directions) {
          const hit = this.resolveShotRay(
            this.player.state,
            fireCmd.weaponDef.id,
            fireCmd.origin,
            dir,
            fireCmd.muzzleWorldPos
          );
          if (hit.hitEnemy) {
            anyHitCombatant = true;
            if (hit.isHeadshot) anyHeadshot = true;
            if (hit.isKill) anyKill = true;
          }
        }

        if (anyHitCombatant) {
          this.ui.showHitmarker(anyHeadshot, anyKill);
          this.sound.playHitmarker(anyHeadshot, anyKill);
        }
      }
    } else {
      this.playerRespawnTimer -= dt;
      if (this.playerRespawnTimer <= 0) {
        const sp = this.spawnEvaluator.selectBestSpawn(
          this.currentMap.spawnPoints,
          this.player.state.team,
          this.matchConfig.modeId,
          allCombatants,
          this.collisionWorld,
          this.matchElapsed,
          this.player.state.position
        );
        this.player.spawnAt(
          sp.position,
          sp.yaw,
          this.player.state.team,
          WEAPON_DEFINITIONS[this.matchConfig.primaryWeapon],
          WEAPON_DEFINITIONS.pistol
        );
        this.viewmodelContainer.visible = true;
      }
    }

    // 2. Bots update & respawn timers
    for (const bot of this.bots) {
      if (!bot.state.isAlive) {
        const t = (this.botRespawnTimers.get(bot.state.id) ?? 2.8) - dt;
        if (t <= 0) {
          this.botRespawnTimers.delete(bot.state.id);
          const sp = this.spawnEvaluator.selectBestSpawn(
            this.currentMap.spawnPoints,
            bot.state.team,
            this.matchConfig.modeId,
            allCombatants,
            this.collisionWorld,
            this.matchElapsed,
            bot.state.position
          );
          bot.spawnAt(sp.position, sp.yaw, WEAPON_DEFINITIONS[bot.state.activeWeapon]);
        } else {
          this.botRespawnTimers.set(bot.state.id, t);
        }
        continue;
      }

      const botWep = WEAPON_DEFINITIONS[bot.state.activeWeapon];
      const botFire = bot.update(
        dt,
        this.matchElapsed,
        this.collisionWorld,
        this.currentMap.waypoints,
        allCombatants,
        botWep,
        this.sceneRenderer.camera.position,
        this.practiceAiActive,
        (pos, isSprint) => {
          this.sound.playFootstep('concrete', isSprint, pos, this.player.state.position);
        }
      );

      if (botFire) {
        this.sound.playWeaponFire(
          botFire.weaponId,
          botFire.origin,
          this.player.state.position,
          this.player.state.yaw
        );
        const muzzleWorld = new THREE.Vector3();
        bot.rig.muzzlePoint.getWorldPosition(muzzleWorld);
        this.resolveShotRay(
          bot.state,
          botFire.weaponId,
          botFire.origin,
          botFire.direction,
          muzzleWorld
        );
      }
    }

    // 3. VFX & Grenade Detonation update
    this.vfx.update(
      dt,
      this.player.state.position,
      (bouncePos) => this.sound.playGrenadeBounce(bouncePos, this.player.state.position),
      (throwerId, detPos) => this.resolveGrenadeBlast(throwerId, detPos)
    );

    // 4. Match Victory / Timeout Check
    this.checkMatchCompletion();
  }

  private resolveShotRay(
    shooter: CombatantState,
    weaponId: WeaponId,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    muzzleWorldPos: THREE.Vector3
  ): { hitEnemy: boolean; isHeadshot: boolean; isKill: boolean } {
    const weaponDef = WEAPON_DEFINITIONS[weaponId];
    const allCombatants = this.getAllCombatants();

    // Filter valid targets (no friendly fire in TDM)
    const targets: CombatantHitboxTarget[] = [];
    for (const c of allCombatants) {
      if (!c.isAlive || c.id === shooter.id) continue;
      if (this.matchConfig.modeId === 'tdm' && c.team === shooter.team) continue;
      targets.push({
        id: c.id,
        position: c.position,
        isCrouching: c.isCrouching,
        isAlive: c.isAlive,
      });
    }

    const hit = this.collisionWorld.raycastBullet(
      origin,
      direction,
      weaponDef.maxRange,
      shooter.id,
      targets
    );

    // Spawn bullet tracer from muzzle to impact point
    const tracerColor = shooter.team === 'kestrel' ? 0xff6644 : 0xffd277;
    this.vfx.spawnTracer(muzzleWorldPos, hit.point, tracerColor);

    if (hit.hitType === 'world') {
      this.vfx.spawnImpact(hit.point, hit.normal, hit.surfaceMaterial, false, false);
      this.sound.playImpact(hit.surfaceMaterial, hit.point, this.player.state.position);
      return { hitEnemy: false, isHeadshot: false, isKill: false };
    }

    if (hit.hitType === 'combatant' && hit.combatantId) {
      const victim = allCombatants.find((c) => c.id === hit.combatantId);
      if (!victim || !victim.isAlive) {
        return { hitEnemy: false, isHeadshot: false, isKill: false };
      }

      const isHead = Boolean(hit.isHeadshot);
      const dmg = calculateWeaponDamage(weaponDef, hit.distance, isHead);
      this.vfx.spawnImpact(hit.point, hit.normal, 'metal', true, isHead);

      const isKill = this.applyDamageToCombatant(shooter, victim, dmg, weaponId, isHead);
      return { hitEnemy: true, isHeadshot: isHead, isKill };
    }

    return { hitEnemy: false, isHeadshot: false, isKill: false };
  }

  private resolveGrenadeBlast(throwerId: string, blastPos: THREE.Vector3): void {
    this.sound.playGrenadeExplosion(blastPos, this.player.state.position);
    const allCombatants = this.getAllCombatants();
    const thrower = allCombatants.find((c) => c.id === throwerId) ?? this.player.state;
    const blastRadius = 8.5;

    for (const c of allCombatants) {
      if (!c.isAlive) continue;
      if (this.matchConfig.modeId === 'tdm' && c.team === thrower.team && c.id !== thrower.id) {
        continue;
      }

      const targetCenter = new THREE.Vector3(
        c.position.x,
        c.position.y + PLAYER_DIMENSIONS.standingHeight * 0.55,
        c.position.z
      );
      const dist = blastPos.distanceTo(targetCenter);
      if (dist <= blastRadius) {
        // Verify solid cover obstruction between grenade and combatant
        const blastOrigin = new THREE.Vector3(blastPos.x, blastPos.y + 0.25, blastPos.z);
        if (!this.collisionWorld.hasLineOfSight(blastOrigin, targetCenter)) {
          continue;
        }
        const falloff = 1 - dist / blastRadius;
        const dmg = Math.round(135 * falloff);
        if (dmg > 5) {
          const isKill = this.applyDamageToCombatant(thrower, c, dmg, 'grenade', false);
          if (thrower.isPlayer && c.id !== thrower.id) {
            this.ui.showHitmarker(false, isKill);
            this.sound.playHitmarker(false, isKill);
          }
        }
      }
    }
  }

  private applyDamageToCombatant(
    attacker: CombatantState,
    victim: CombatantState,
    damage: number,
    weaponId: WeaponId | 'grenade',
    isHeadshot: boolean
  ): boolean {
    if (!victim.isAlive) return false;

    victim.health = Math.max(0, victim.health - damage);
    victim.lastDamagedTime = this.matchElapsed;
    victim.lastDamagedById = attacker.id;

    if (victim.isPlayer) {
      this.player.applyDamageFlinch();
      this.sound.playPlayerDamage();
      this.ui.addDamageIndicator(
        attacker.position,
        this.player.state.position,
        this.player.state.yaw
      );
    } else {
      const bot = this.bots.find((b) => b.state.id === victim.id);
      bot?.onDamaged(attacker.id, attacker.position, this.matchElapsed);
    }

    if (victim.health <= 0) {
      victim.isAlive = false;
      victim.deaths += 1;
      victim.lastDeathTime = this.matchElapsed;

      if (attacker.id !== victim.id) {
        attacker.kills += 1;
        const pts = isHeadshot ? 125 : 100;
        attacker.score += pts;

        if (this.matchConfig.modeId === 'tdm') {
          if (attacker.team === 'aegis') this.aegisScore += 1;
          else if (attacker.team === 'kestrel') this.kestrelScore += 1;
        } else {
          // FFA / Practice: track player kills vs top bot kills
          this.aegisScore = this.player.state.kills;
          let maxBotKills = 0;
          for (const b of this.bots) {
            if (b.state.kills > maxBotKills) maxBotKills = b.state.kills;
          }
          this.kestrelScore = maxBotKills;
        }

        if (attacker.isPlayer) {
          this.ui.showKillBanner(victim.name, isHeadshot, pts);
          this.sound.playMatchNotification('kill');
        }
      }

      if (victim.isPlayer) {
        this.playerRespawnTimer = 2.6;
        this.viewmodelContainer.visible = false;
      } else {
        this.botRespawnTimers.set(victim.id, 2.6);
      }

      const entry: KillFeedEntry = {
        id: `kf_${++this.killFeedCounter}`,
        attackerName: attacker.name,
        attackerTeam: attacker.team,
        victimName: victim.name,
        victimTeam: victim.team,
        weaponId,
        isHeadshot,
        timestamp: this.matchElapsed,
      };
      this.ui.addKillFeedEntry(entry);
      this.updateScoreboardUI();
      return true;
    }

    return false;
  }

  public checkMatchCompletion(): void {
    if (this.phase !== 'playing') return;
    if (this.matchConfig.modeId === 'practice') return; // Practice mode continues until player exits

    const limit = this.matchConfig.scoreLimit;

    if (this.matchConfig.modeId === 'tdm') {
      if (this.aegisScore >= limit) {
        this.endMatch('victory', `AEGIS TASK FORCE REACHED ${limit} ELIMINATIONS`);
        return;
      }
      if (this.kestrelScore >= limit) {
        this.endMatch('defeat', `KESTREL SYNDICATE REACHED ${limit} ELIMINATIONS`);
        return;
      }
      if (this.remainingSeconds <= 0) {
        if (this.aegisScore > this.kestrelScore) {
          this.endMatch('victory', `TIME EXPIRED // AEGIS LEADS ${this.aegisScore} - ${this.kestrelScore}`);
        } else if (this.kestrelScore > this.aegisScore) {
          this.endMatch('defeat', `TIME EXPIRED // KESTREL LEADS ${this.kestrelScore} - ${this.aegisScore}`);
        } else {
          this.endMatch('draw', `TIME EXPIRED // TIED AT ${this.aegisScore}`);
        }
      }
    } else if (this.matchConfig.modeId === 'ffa') {
      if (this.player.state.kills >= limit) {
        this.endMatch('victory', `YOU REACHED ${limit} ELIMINATIONS FIRST`);
        return;
      }
      for (const b of this.bots) {
        if (b.state.kills >= limit) {
          this.endMatch('defeat', `${b.state.name} REACHED ${limit} ELIMINATIONS`);
          return;
        }
      }
      if (this.remainingSeconds <= 0) {
        if (this.aegisScore > this.kestrelScore) {
          this.endMatch('victory', 'TIME EXPIRED // TOP OPERATOR');
        } else if (this.kestrelScore > this.aegisScore) {
          this.endMatch('defeat', 'TIME EXPIRED // HOSTILE OPERATOR WON');
        } else {
          this.endMatch('draw', 'TIME EXPIRED // TIED SCORE');
        }
      }
    }
  }

  private updateViewmodelAndHUD(dt: number): void {
    const activeWepId = this.player.state.activeWeapon;
    const activeVm = this.viewmodels[activeWepId];
    const slot = this.player.getCurrentSlot();

    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.sceneRenderer.camera.quaternion)
      .normalize();
    const wallProximity = this.collisionWorld.getWallProximity(
      this.sceneRenderer.camera.position,
      forward,
      0.85
    );

    const horizSpeed = Math.hypot(this.player.state.velocity.x, this.player.state.velocity.z);
    const reloadProgress = this.player.isReloading
      ? 1 - this.player.reloadTimer / Math.max(0.1, this.player.reloadDuration)
      : 0;

    activeVm.updateAnimation({
      dt,
      elapsed: this.matchElapsed,
      moveSpeedRatio: Math.min(1.3, horizSpeed / 5.2),
      isSprinting: this.player.state.isSprinting,
      isGrounded: this.player.state.isGrounded,
      isCrouching: this.player.state.isCrouching,
      adsProgress: this.player.adsProgress,
      recoilKick: this.player.viewmodelRecoilKick,
      reloadProgress,
      isReloading: this.player.isReloading,
      equipProgress: this.player.equipProgress,
      swayX: this.player.swayX,
      swayY: this.player.swayY,
      wallProximity,
      reducedMotion: this.settings.reducedCameraMotion,
    });

    const stance = this.player.state.isCrouching
      ? 'CROUCH'
      : this.player.state.isSprinting
        ? 'SPRINT'
        : 'STAND';

    this.ui.updateHud({
      health: this.player.state.health,
      maxHealth: this.player.state.maxHealth,
      stance,
      activeWeapon: activeWepId,
      primaryWeapon: this.player.primarySlot.weaponId as PrimaryWeaponId,
      magAmmo: slot.magazine,
      reserveAmmo: slot.reserve,
      isReloading: this.player.isReloading,
      reloadProgress,
      grenadeCount: this.player.grenadeCount,
      grenadeCooldown: this.player.grenadeCooldown,
      spreadRadians: this.player.currentSpread,
      adsProgress: this.player.adsProgress,
      isSprinting: this.player.state.isSprinting,
      modeId: this.matchConfig.modeId,
      remainingSeconds: this.remainingSeconds,
      aegisScore: this.aegisScore,
      kestrelScore: this.kestrelScore,
      scoreLimit: this.matchConfig.scoreLimit,
    });

    this.ui.update(dt, this.player.state.position, this.player.state.yaw);
  }

  private updateScoreboardUI(): void {
    const mapName = MAP_SUMMARIES[this.currentMapId]?.name ?? 'SECTOR';
    this.ui.updateScoreboard(this.getAllCombatants(), this.matchConfig.modeId, mapName);
  }
}
