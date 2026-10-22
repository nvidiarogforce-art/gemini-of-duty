import * as THREE from 'three';
import {
  CombatantState,
  GameSettings,
  PLAYER_DIMENSIONS,
  PrimaryWeaponId,
  SurfaceMaterialType,
  TeamId,
  WeaponDefinition,
  WeaponId,
} from '../types/contracts';
import { CollisionWorld } from '../physics/CollisionWorld';

export interface WeaponRuntimeSlot {
  weaponId: WeaponId;
  magazine: number;
  reserve: number;
}

export interface PlayerFireCommand {
  weaponDef: WeaponDefinition;
  origin: THREE.Vector3;
  directions: THREE.Vector3[]; // 1 for standard, 8 for shotgun
  muzzleWorldPos: THREE.Vector3;
}

/**
 * Responsive First-Person Player Controller
 * Handles pointer-lock mouse look, normalized WASD movement, sprint, jump, crouch with
 * ceiling clearance validation, ADS transitions, learnable recoil + recovery, dynamic spread,
 * reload state machine, weapon switching, and camera feel (bob, landing dip, sway).
 */
export class PlayerController {
  public readonly state: CombatantState;
  private keys = new Set<string>();
  private isMouseDown = false;
  private semiTriggerConsumed = false;
  private isRightMouseDown = false;

  // Loadout slots: Primary & Sidearm
  public primarySlot: WeaponRuntimeSlot;
  public sidearmSlot: WeaponRuntimeSlot;
  public activeSlot: 'primary' | 'sidearm' = 'primary';

  // Weapon state machine
  public isReloading = false;
  public reloadTimer = 0;
  public reloadDuration = 2.0;
  private reloadMidTriggered = false;
  private reloadBoltTriggered = false;

  public equipProgress = 1.0; // 0 -> 1 when drawing weapon
  public adsProgress = 0.0;   // 0 -> 1 when aiming down sights
  public currentSpread = 0.01;
  private fireCooldown = 0;
  private shotIndexInBurst = 0;
  private timeSinceLastShot = 99;

  // Recoil & camera feel
  public recoilOffsetPitch = 0;
  public recoilOffsetYaw = 0;
  public viewmodelRecoilKick = { pitch: 0, yaw: 0, back: 0 };
  public swayX = 0;
  public swayY = 0;
  private bobPhase = 0;
  private landingDip = 0;
  private damageFlinchRoll = 0;
  private currentEyeHeight = PLAYER_DIMENSIONS.standingEyeHeight;
  public groundMaterial: SurfaceMaterialType = 'concrete';
  private footstepTimer = 0;

  // Frag grenade cooldown
  public grenadeCooldown = 0;
  public grenadeCount = 2;
  private pendingGrenadeThrow = false;

  constructor(primaryWeaponDef: WeaponDefinition, sidearmDef: WeaponDefinition) {
    this.primarySlot = {
      weaponId: primaryWeaponDef.id,
      magazine: primaryWeaponDef.magazineSize,
      reserve: primaryWeaponDef.reserveAmmoMax,
    };
    this.sidearmSlot = {
      weaponId: sidearmDef.id,
      magazine: sidearmDef.magazineSize,
      reserve: sidearmDef.reserveAmmoMax,
    };

    this.state = {
      id: 'player',
      name: 'VANGUARD-1',
      team: 'aegis',
      isPlayer: true,
      isAlive: true,
      health: 100,
      maxHealth: 100,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      isCrouching: false,
      isSprinting: false,
      isAiming: false,
      isGrounded: true,
      activeWeapon: primaryWeaponDef.id,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      lastDeathTime: -999,
      lastDamagedTime: -999,
      lastDamagedById: null,
    };
  }

  public getCurrentSlot(): WeaponRuntimeSlot {
    return this.activeSlot === 'primary' ? this.primarySlot : this.sidearmSlot;
  }

  public setPrimaryWeapon(primaryDef: WeaponDefinition): void {
    this.primarySlot = {
      weaponId: primaryDef.id,
      magazine: primaryDef.magazineSize,
      reserve: primaryDef.reserveAmmoMax,
    };
    this.activeSlot = 'primary';
    this.state.activeWeapon = primaryDef.id;
    this.isReloading = false;
    this.equipProgress = 1.0;
  }

  public resetLoadout(primaryDef: WeaponDefinition, sidearmDef: WeaponDefinition): void {
    this.primarySlot = {
      weaponId: primaryDef.id,
      magazine: primaryDef.magazineSize,
      reserve: primaryDef.reserveAmmoMax,
    };
    this.sidearmSlot = {
      weaponId: sidearmDef.id,
      magazine: sidearmDef.magazineSize,
      reserve: sidearmDef.reserveAmmoMax,
    };
    this.activeSlot = 'primary';
    this.state.activeWeapon = primaryDef.id;
    this.isReloading = false;
    this.equipProgress = 0.0;
    this.adsProgress = 0.0;
    this.grenadeCount = 2;
    this.grenadeCooldown = 0;
  }

  public spawnAt(
    pos: THREE.Vector3,
    yaw: number,
    team: TeamId,
    primaryDef: WeaponDefinition,
    sidearmDef: WeaponDefinition
  ): void {
    this.state.team = team;
    this.state.isAlive = true;
    this.state.health = this.state.maxHealth;
    this.state.position.copy(pos);
    this.state.velocity.set(0, 0, 0);
    this.state.yaw = yaw;
    this.state.pitch = 0;
    this.state.isCrouching = false;
    this.state.isSprinting = false;
    this.state.isAiming = false;
    this.state.isGrounded = true;
    this.currentEyeHeight = PLAYER_DIMENSIONS.standingEyeHeight;
    this.recoilOffsetPitch = 0;
    this.recoilOffsetYaw = 0;
    this.landingDip = 0;
    this.damageFlinchRoll = 0;
    this.resetLoadout(primaryDef, sidearmDef);
  }

  public clearInputs(): void {
    this.keys.clear();
    this.isMouseDown = false;
    this.semiTriggerConsumed = false;
    this.isRightMouseDown = false;
    this.state.isAiming = false;
    this.state.isSprinting = false;
  }

  public onKeyDown(code: string): void {
    this.keys.add(code);
    if (code === 'Digit1') {
      this.switchSlot('primary');
    } else if (code === 'Digit2') {
      this.switchSlot('sidearm');
    } else if (code === 'KeyQ') {
      this.switchSlot(this.activeSlot === 'primary' ? 'sidearm' : 'primary');
    } else if (code === 'KeyC') {
      this.state.isCrouching = !this.state.isCrouching;
    } else if (code === 'KeyG') {
      if (this.grenadeCount > 0 && this.grenadeCooldown <= 0 && this.state.isAlive) {
        this.pendingGrenadeThrow = true;
      }
    }
  }

  public onKeyUp(code: string): void {
    this.keys.delete(code);
  }

  public onMouseDown(button: number): void {
    if (button === 0) {
      this.isMouseDown = true;
    } else if (button === 2) {
      this.isRightMouseDown = true;
    }
  }

  public onMouseUp(button: number): void {
    if (button === 0) {
      this.isMouseDown = false;
      this.semiTriggerConsumed = false;
    } else if (button === 2) {
      this.isRightMouseDown = false;
    }
  }

  public onMouseWheel(deltaY: number): void {
    if (Math.abs(deltaY) > 2) {
      this.switchSlot(this.activeSlot === 'primary' ? 'sidearm' : 'primary');
    }
  }

  public onMouseMove(movementX: number, movementY: number, settings: GameSettings): void {
    if (!this.state.isAlive) return;
    const baseSens = 0.0021 * settings.mouseSensitivity;
    const adsMult = THREE.MathUtils.lerp(1.0, settings.adsSensitivityMultiplier, this.adsProgress);
    const sens = baseSens * adsMult;

    const dy = settings.invertY ? -movementY : movementY;
    this.state.yaw -= movementX * sens;
    this.state.pitch = THREE.MathUtils.clamp(
      this.state.pitch - dy * sens,
      -Math.PI * 0.48,
      Math.PI * 0.48
    );

    // Weapon sway input
    const swayMult = settings.reducedCameraMotion ? 0.25 : 1.0;
    this.swayX = THREE.MathUtils.clamp(this.swayX - movementX * 0.00028 * swayMult, -0.04, 0.04);
    this.swayY = THREE.MathUtils.clamp(this.swayY - movementY * 0.00028 * swayMult, -0.04, 0.04);
  }

  public switchSlot(slot: 'primary' | 'sidearm'): void {
    const newWeaponId = slot === 'primary' ? this.primarySlot.weaponId : this.sidearmSlot.weaponId;
    if (this.activeSlot === slot && this.state.activeWeapon === newWeaponId && this.equipProgress >= 1.0) {
      return;
    }
    this.activeSlot = slot;
    this.state.activeWeapon = newWeaponId;
    this.isReloading = false;
    this.equipProgress = 0.0;
    this.adsProgress = 0.0;
    this.semiTriggerConsumed = true;
  }

  public startReload(weaponDef: WeaponDefinition, onAudio?: (phase: 'mag_out') => void): void {
    const slot = this.getCurrentSlot();
    if (this.isReloading || slot.magazine >= weaponDef.magazineSize || slot.reserve <= 0) return;
    this.isReloading = true;
    this.reloadDuration = slot.magazine === 0 ? weaponDef.emptyReloadTime : weaponDef.reloadTime;
    this.reloadTimer = this.reloadDuration;
    this.reloadMidTriggered = false;
    this.reloadBoltTriggered = false;
    onAudio?.('mag_out');
  }

  public applyDamageFlinch(): void {
    this.damageFlinchRoll = (Math.random() < 0.5 ? -1 : 1) * 0.035;
  }

  public consumeGrenadeThrow(): boolean {
    if (this.pendingGrenadeThrow && this.grenadeCount > 0 && this.grenadeCooldown <= 0) {
      this.pendingGrenadeThrow = false;
      this.grenadeCount--;
      this.grenadeCooldown = 1.3;
      return true;
    }
    this.pendingGrenadeThrow = false;
    return false;
  }

  public update(
    dt: number,
    now: number,
    collisionWorld: CollisionWorld,
    weaponDef: WeaponDefinition,
    settings: GameSettings,
    camera: THREE.PerspectiveCamera,
    muzzleWorldPos: THREE.Vector3,
    callbacks: {
      onFootstep: (surface: SurfaceMaterialType, isSprint: boolean) => void;
      onJump: () => void;
      onLand: (surface: SurfaceMaterialType, speed: number) => void;
      onReloadStep: (phase: 'mag_out' | 'mag_in' | 'bolt_rack') => void;
      onDryFire: () => void;
    }
  ): PlayerFireCommand | null {
    if (!this.state.isAlive) return null;

    if (this.grenadeCooldown > 0) this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.timeSinceLastShot += dt;

    // Health regeneration after 4.8 seconds out of combat
    if (now - this.state.lastDamagedTime > 4.8 && this.state.health < this.state.maxHealth) {
      this.state.health = Math.min(this.state.maxHealth, this.state.health + 22 * dt);
    }

    // 1. Handle crouch & standing clearance
    const holdCrouch = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    const wantsCrouch = holdCrouch || this.state.isCrouching;
    if (!wantsCrouch && !collisionWorld.canStandUp(this.state.position)) {
      // Blocked by low ceiling — stay crouched until clear
      this.state.isCrouching = true;
    } else if (holdCrouch) {
      this.state.isCrouching = true;
    } else if (!this.keys.has('KeyC') && this.state.isCrouching && !holdCrouch) {
      // Verify if player released hold-crouch or toggled
      if (!collisionWorld.canStandUp(this.state.position)) {
        this.state.isCrouching = true;
      }
    }

    // 2. Normalized WASD movement input
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;

    const inputLen = Math.hypot(moveForward, moveRight);
    if (inputLen > 1) {
      moveForward /= inputLen;
      moveRight /= inputLen;
    }

    // Aiming & Sprinting priority
    this.state.isAiming = this.isRightMouseDown && !this.isReloading && this.equipProgress >= 0.85;
    const wantsSprint =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      moveForward > 0.4 &&
      !this.state.isAiming &&
      !this.isReloading &&
      !this.isMouseDown;

    if (wantsSprint && this.state.isCrouching && collisionWorld.canStandUp(this.state.position)) {
      this.state.isCrouching = false;
    }
    this.state.isSprinting = wantsSprint && !this.state.isCrouching;

    // World-space desired velocity
    const forwardX = -Math.sin(this.state.yaw);
    const forwardZ = -Math.cos(this.state.yaw);
    const rightX = Math.cos(this.state.yaw);
    const rightZ = -Math.sin(this.state.yaw);

    const wishDirX = forwardX * moveForward + rightX * moveRight;
    const wishDirZ = forwardZ * moveForward + rightZ * moveRight;

    let baseSpeed = 5.2;
    if (this.state.isCrouching) baseSpeed = 3.0;
    else if (this.state.isSprinting) baseSpeed = 7.15;

    const adsSpeedMult = THREE.MathUtils.lerp(1.0, weaponDef.adsMoveSpeedMultiplier, this.adsProgress);
    const targetSpeed = baseSpeed * weaponDef.moveSpeedMultiplier * adsSpeedMult;

    const accel = this.state.isGrounded ? 15.0 : 4.5;
    this.state.velocity.x = THREE.MathUtils.lerp(
      this.state.velocity.x,
      wishDirX * targetSpeed,
      Math.min(1, dt * accel)
    );
    this.state.velocity.z = THREE.MathUtils.lerp(
      this.state.velocity.z,
      wishDirZ * targetSpeed,
      Math.min(1, dt * accel)
    );

    // Jump
    if (this.keys.has('Space') && this.state.isGrounded) {
      if (this.state.isCrouching && collisionWorld.canStandUp(this.state.position)) {
        this.state.isCrouching = false;
      } else {
        this.state.velocity.y = 7.6;
        this.state.isGrounded = false;
        callbacks.onJump();
      }
    }

    // Gravity
    this.state.velocity.y -= 21.5 * dt;

    // Move & collide
    const charHeight = this.state.isCrouching
      ? PLAYER_DIMENSIONS.crouchedHeight
      : PLAYER_DIMENSIONS.standingHeight;
    const moveRes = collisionWorld.moveCharacter(
      this.state.position,
      this.state.velocity,
      dt,
      charHeight,
      this.state.isGrounded
    );
    this.state.position.copy(moveRes.position);
    this.state.velocity.copy(moveRes.velocity);
    this.state.isGrounded = moveRes.isGrounded;
    this.groundMaterial = moveRes.groundMaterial;

    if (moveRes.landedSpeed > 2.6) {
      const dipMult = settings.reducedCameraMotion ? 0.35 : 1.0;
      this.landingDip = Math.min(0.22, moveRes.landedSpeed * 0.022 * dipMult);
      callbacks.onLand(this.groundMaterial, moveRes.landedSpeed);
    }

    // Footsteps
    const horizSpeed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    if (this.state.isGrounded && horizSpeed > 1.3) {
      const stepRate = this.state.isSprinting ? 1.5 : this.state.isCrouching ? 0.72 : 1.05;
      this.footstepTimer -= dt * stepRate;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.40;
        callbacks.onFootstep(this.groundMaterial, this.state.isSprinting);
      }
    } else {
      this.footstepTimer = 0.15;
    }

    // 3. Reload & Equip state transitions
    if (this.keys.has('KeyR')) {
      this.startReload(weaponDef, callbacks.onReloadStep);
    }

    if (this.equipProgress < 1.0) {
      this.equipProgress = Math.min(1.0, this.equipProgress + dt / Math.max(0.1, weaponDef.equipTime));
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      const progress = 1 - this.reloadTimer / this.reloadDuration;
      if (progress >= 0.48 && !this.reloadMidTriggered) {
        this.reloadMidTriggered = true;
        callbacks.onReloadStep('mag_in');
      }
      if (progress >= 0.80 && !this.reloadBoltTriggered) {
        this.reloadBoltTriggered = true;
        callbacks.onReloadStep('bolt_rack');
      }
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const slot = this.getCurrentSlot();
        const needed = weaponDef.magazineSize - slot.magazine;
        const transfer = Math.min(needed, slot.reserve);
        slot.magazine += transfer;
        slot.reserve -= transfer;
      }
    }

    // ADS transition & Dynamic FOV
    const targetAds = this.state.isAiming ? 1.0 : 0.0;
    this.adsProgress = THREE.MathUtils.lerp(
      this.adsProgress,
      targetAds,
      Math.min(1, dt / Math.max(0.05, weaponDef.adsTime))
    );

    const targetFov = settings.fov * THREE.MathUtils.lerp(1.0, weaponDef.adsFovZoom, this.adsProgress);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 16));
      camera.updateProjectionMatrix();
    }

    // 4. Spread & Recoil recovery
    const baseSpread = THREE.MathUtils.lerp(weaponDef.hipSpreadBase, weaponDef.adsSpreadBase, this.adsProgress);
    const movePenalty = (horizSpeed / 6.0) * (this.state.isAiming ? 0.008 : 0.025);
    const airPenalty = this.state.isGrounded ? 0 : 0.045;
    const crouchBonus = this.state.isCrouching ? 0.72 : 1.0;
    const minSpread = (baseSpread + movePenalty + airPenalty) * crouchBonus;

    this.currentSpread = Math.max(
      minSpread,
      this.currentSpread - weaponDef.spreadRecoveryRate * dt
    );

    if (this.timeSinceLastShot > 0.14) {
      this.shotIndexInBurst = Math.max(0, this.shotIndexInBurst - dt * 14);
    }

    const recRecov = THREE.MathUtils.degToRad(weaponDef.recoilRecoveryRate) * dt;
    this.recoilOffsetPitch = THREE.MathUtils.lerp(this.recoilOffsetPitch, 0, Math.min(1, recRecov * 6));
    this.recoilOffsetYaw = THREE.MathUtils.lerp(this.recoilOffsetYaw, 0, Math.min(1, recRecov * 6));

    this.viewmodelRecoilKick.pitch = THREE.MathUtils.lerp(this.viewmodelRecoilKick.pitch, 0, Math.min(1, dt * 16));
    this.viewmodelRecoilKick.yaw = THREE.MathUtils.lerp(this.viewmodelRecoilKick.yaw, 0, Math.min(1, dt * 16));
    this.viewmodelRecoilKick.back = THREE.MathUtils.lerp(this.viewmodelRecoilKick.back, 0, Math.min(1, dt * 18));

    this.swayX = THREE.MathUtils.lerp(this.swayX, 0, Math.min(1, dt * 10));
    this.swayY = THREE.MathUtils.lerp(this.swayY, 0, Math.min(1, dt * 10));
    this.landingDip = THREE.MathUtils.lerp(this.landingDip, 0, Math.min(1, dt * 10));
    this.damageFlinchRoll = THREE.MathUtils.lerp(this.damageFlinchRoll, 0, Math.min(1, dt * 10));

    // 5. Camera Position & Rotation
    const targetEye = this.state.isCrouching
      ? PLAYER_DIMENSIONS.crouchedEyeHeight
      : PLAYER_DIMENSIONS.standingEyeHeight;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetEye, Math.min(1, dt * 14));

    const motionScale = settings.reducedCameraMotion ? 0.25 : 1.0;
    if (this.state.isGrounded && horizSpeed > 0.5) {
      this.bobPhase += dt * (this.state.isSprinting ? 13.5 : 9.2);
    }
    const bobAmp =
      (this.state.isGrounded ? Math.min(1, horizSpeed / 5.5) : 0) *
      (1 - this.adsProgress * 0.75) *
      motionScale;
    const bobY = Math.sin(this.bobPhase * 2) * 0.022 * bobAmp;
    const bobX = Math.cos(this.bobPhase) * 0.015 * bobAmp;

    camera.position.set(
      this.state.position.x + bobX,
      this.state.position.y + this.currentEyeHeight + bobY - this.landingDip,
      this.state.position.z
    );

    const euler = new THREE.Euler(
      THREE.MathUtils.clamp(this.state.pitch + this.recoilOffsetPitch, -Math.PI * 0.49, Math.PI * 0.49),
      this.state.yaw + this.recoilOffsetYaw,
      this.damageFlinchRoll * motionScale,
      'YXZ'
    );
    camera.quaternion.setFromEuler(euler);

    // 6. Weapon Firing Check
    const canFire =
      this.isMouseDown &&
      !this.isReloading &&
      this.equipProgress >= 0.92 &&
      this.fireCooldown <= 0 &&
      (weaponDef.fireMode === 'auto' || !this.semiTriggerConsumed);

    if (canFire) {
      const slot = this.getCurrentSlot();
      if (slot.magazine <= 0) {
        this.semiTriggerConsumed = true;
        this.fireCooldown = 0.22;
        callbacks.onDryFire();
        if (slot.reserve > 0) {
          this.startReload(weaponDef, callbacks.onReloadStep);
        }
        return null;
      }

      if (weaponDef.fireMode === 'semi') {
        this.semiTriggerConsumed = true;
      }

      slot.magazine--;
      this.fireCooldown = 60 / weaponDef.rpm;
      this.timeSinceLastShot = 0;

      // Build shot ray directions (1 for normal weapons, 8 pellets for shotgun)
      const baseForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

      const directions: THREE.Vector3[] = [];
      for (let i = 0; i < weaponDef.pelletCount; i++) {
        // First shot of rifle/SMG/DMR/pistol is crisp & accurate; shotgun always uses pellet cone
        const spreadCone =
          weaponDef.pelletCount > 1
            ? this.currentSpread
            : this.shotIndexInBurst < 0.5 && this.adsProgress > 0.8
              ? this.currentSpread * 0.25
              : this.currentSpread;

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spreadCone;
        const dir = baseForward
          .clone()
          .addScaledVector(rightVec, Math.cos(angle) * radius)
          .addScaledVector(upVec, Math.sin(angle) * radius)
          .normalize();
        directions.push(dir);
      }

      // Apply learnable recoil pattern step
      const patIdx = Math.min(
        weaponDef.recoilPattern.length - 1,
        Math.floor(this.shotIndexInBurst)
      );
      const [patYaw, patPitch] = weaponDef.recoilPattern[patIdx] ?? [0, weaponDef.recoilPitchPerShot];
      const adsRecoilMult = THREE.MathUtils.lerp(1.0, 0.72, this.adsProgress);
      const pitchRad = THREE.MathUtils.degToRad(patPitch * adsRecoilMult);
      const yawRad = THREE.MathUtils.degToRad(
        (patYaw + (Math.random() - 0.5) * weaponDef.recoilYawVariance) * adsRecoilMult
      );

      this.state.pitch = THREE.MathUtils.clamp(this.state.pitch + pitchRad * 0.65, -Math.PI * 0.48, Math.PI * 0.48);
      this.state.yaw += yawRad * 0.65;
      this.recoilOffsetPitch += pitchRad * 0.35;
      this.recoilOffsetYaw += yawRad * 0.35;

      this.viewmodelRecoilKick.pitch = Math.min(0.14, this.viewmodelRecoilKick.pitch + pitchRad * 1.6);
      this.viewmodelRecoilKick.yaw = yawRad * 1.2;
      this.viewmodelRecoilKick.back = 0.045;

      const maxSpread = THREE.MathUtils.lerp(weaponDef.hipSpreadMax, weaponDef.adsSpreadMax, this.adsProgress);
      this.currentSpread = Math.min(maxSpread, this.currentSpread + weaponDef.spreadIncreasePerShot);
      this.shotIndexInBurst += 1;

      if (slot.magazine === 0 && slot.reserve > 0) {
        // Auto-queue reload slightly after empty shot
        setTimeout(() => {
          if (this.state.isAlive && !this.isReloading && this.getCurrentSlot().magazine === 0) {
            this.startReload(weaponDef, callbacks.onReloadStep);
          }
        }, 240);
      }

      return {
        weaponDef,
        origin: camera.position.clone(),
        directions,
        muzzleWorldPos: muzzleWorldPos.clone(),
      };
    }

    return null;
  }
}
