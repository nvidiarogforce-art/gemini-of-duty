import * as THREE from 'three';
import {
  BotDifficulty,
  CombatantState,
  NavWaypoint,
  PLAYER_DIMENSIONS,
  TeamId,
  WeaponDefinition,
  WeaponId,
} from '../types/contracts';
import { CollisionWorld } from '../physics/CollisionWorld';
import { CharacterModelRig, createCharacterModel } from './CharacterModelFactory';

export interface DifficultyProfile {
  reactionDelaySeconds: number;
  aimErrorRadians: number;
  turnSpeedRadPerSec: number;
  burstLengthMin: number;
  burstLengthMax: number;
  burstPauseSeconds: number;
  strafeFrequency: number;
  crouchInCombatChance: number;
  visionConeCos: number; // cos(half-angle)
  hearingRangeMeters: number;
}

export const DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  recruit: {
    reactionDelaySeconds: 0.52,
    aimErrorRadians: 0.075,
    turnSpeedRadPerSec: 3.4,
    burstLengthMin: 2,
    burstLengthMax: 4,
    burstPauseSeconds: 0.55,
    strafeFrequency: 0.8,
    crouchInCombatChance: 0.15,
    visionConeCos: Math.cos(THREE.MathUtils.degToRad(72)),
    hearingRangeMeters: 22,
  },
  regular: {
    reactionDelaySeconds: 0.30,
    aimErrorRadians: 0.042,
    turnSpeedRadPerSec: 5.5,
    burstLengthMin: 3,
    burstLengthMax: 6,
    burstPauseSeconds: 0.32,
    strafeFrequency: 1.4,
    crouchInCombatChance: 0.35,
    visionConeCos: Math.cos(THREE.MathUtils.degToRad(88)),
    hearingRangeMeters: 34,
  },
  veteran: {
    reactionDelaySeconds: 0.16,
    aimErrorRadians: 0.020,
    turnSpeedRadPerSec: 8.2,
    burstLengthMin: 4,
    burstLengthMax: 8,
    burstPauseSeconds: 0.18,
    strafeFrequency: 2.1,
    crouchInCombatChance: 0.55,
    visionConeCos: Math.cos(THREE.MathUtils.degToRad(105)),
    hearingRangeMeters: 48,
  },
};

export interface BotFireRequest {
  botId: string;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  weaponId: WeaponId;
}

/**
 * Tactical AI Bot Controller
 * Implements A* waypoint navigation, perception with cone + LOS occlusion + reaction delay,
 * sound cue investigation, cover usage, anti-bunching separation, reloading, and smooth aiming.
 */
export class BotController {
  public readonly state: CombatantState;
  public readonly rig: CharacterModelRig;

  private profile: DifficultyProfile;
  private currentWaypointId: string | null = null;
  private pathQueue: string[] = [];
  private repathTimer = 0;
  private stuckTimer = 0;
  private lastProgressPos = new THREE.Vector3();

  // Perception memory (strictly separated from perfect world knowledge)
  private targetId: string | null = null;
  private targetFirstSeenTime = 0;
  private targetLastSeenTime = 0;
  private targetLastKnownPos = new THREE.Vector3();
  private hasLineOfSightToTarget = false;

  // Combat & weapon state
  public magazineAmmo: number = 30;
  public isReloading = false;
  private reloadTimer = 0;
  private fireCooldown = 0;
  private burstShotsRemaining = 0;
  private burstPauseTimer = 0;
  private strafeDir = 1;
  private strafeTimer = 0;
  private flinchTimer = 0;
  private footstepTimer = 0;

  constructor(
    id: string,
    name: string,
    team: TeamId,
    weapon: WeaponDefinition,
    difficulty: BotDifficulty,
    isFriendlyToPlayer: boolean
  ) {
    this.profile = DIFFICULTY_PROFILES[difficulty];
    this.magazineAmmo = weapon.magazineSize;

    this.state = {
      id,
      name,
      team,
      isPlayer: false,
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
      activeWeapon: weapon.id,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      lastDeathTime: -999,
      lastDamagedTime: -999,
      lastDamagedById: null,
    };

    this.rig = createCharacterModel(team, isFriendlyToPlayer);
  }

  public setDifficulty(difficulty: BotDifficulty): void {
    this.profile = DIFFICULTY_PROFILES[difficulty];
  }

  public spawnAt(pos: THREE.Vector3, yaw: number, weapon: WeaponDefinition): void {
    this.state.isAlive = true;
    this.state.health = this.state.maxHealth;
    this.state.position.copy(pos);
    this.state.velocity.set(0, 0, 0);
    this.state.yaw = yaw;
    this.state.pitch = 0;
    this.state.isCrouching = false;
    this.state.isSprinting = false;
    this.state.activeWeapon = weapon.id;
    this.magazineAmmo = weapon.magazineSize;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.targetId = null;
    this.hasLineOfSightToTarget = false;
    this.pathQueue = [];
    this.currentWaypointId = null;
    this.stuckTimer = 0;
    this.lastProgressPos.copy(pos);
    this.rig.root.visible = true;
    this.rig.root.position.copy(pos);
    this.rig.root.rotation.y = yaw;
  }

  public onDamaged(attackerId: string, attackerPos: THREE.Vector3, now: number): void {
    this.flinchTimer = 0.22;
    this.state.lastDamagedTime = now;
    this.state.lastDamagedById = attackerId;

    // Alert bot to the attacker's direction after a brief reaction window
    if (!this.targetId || !this.hasLineOfSightToTarget) {
      this.targetId = attackerId;
      this.targetLastKnownPos.copy(attackerPos);
      this.targetLastSeenTime = now;
      this.targetFirstSeenTime = now - this.profile.reactionDelaySeconds * 0.5;
    }
  }

  public notifySoundCue(shooterId: string, shooterTeam: TeamId, soundPos: THREE.Vector3, now: number): void {
    if (!this.state.isAlive || shooterId === this.state.id) return;
    if (this.state.team !== 'ffa' && this.state.team === shooterTeam) return;
    if (this.hasLineOfSightToTarget) return;

    const dist = this.state.position.distanceTo(soundPos);
    if (dist <= this.profile.hearingRangeMeters) {
      this.targetId = shooterId;
      this.targetLastKnownPos.copy(soundPos);
      this.targetLastSeenTime = now;
      if (this.targetFirstSeenTime === 0) {
        this.targetFirstSeenTime = now;
      }
    }
  }

  public update(
    dt: number,
    now: number,
    collisionWorld: CollisionWorld,
    waypoints: Map<string, NavWaypoint>,
    allCombatants: CombatantState[],
    weaponDef: WeaponDefinition,
    playerCameraPos: THREE.Vector3,
    aiEnabled: boolean = true,
    onFootstep?: (pos: THREE.Vector3, isSprint: boolean) => void
  ): BotFireRequest | null {
    if (!this.state.isAlive) {
      this.rig.root.visible = false;
      return null;
    }

    this.rig.root.visible = true;
    if (this.flinchTimer > 0) this.flinchTimer = Math.max(0, this.flinchTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Passive health regeneration after 5.5s out of combat
    if (now - this.state.lastDamagedTime > 5.5 && this.state.health < this.state.maxHealth) {
      this.state.health = Math.min(this.state.maxHealth, this.state.health + 18 * dt);
    }

    // Handle reload timer
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.magazineAmmo = weaponDef.magazineSize;
      }
    } else if (this.magazineAmmo <= 0) {
      this.isReloading = true;
      this.reloadTimer = weaponDef.reloadTime;
    }

    if (!aiEnabled) {
      // Practice mode stationary/idle option
      this.state.velocity.x = 0;
      this.state.velocity.z = 0;
      this.state.velocity.y -= 22 * dt;
      const moveRes = collisionWorld.moveCharacter(
        this.state.position,
        this.state.velocity,
        dt,
        PLAYER_DIMENSIONS.standingHeight,
        this.state.isGrounded
      );
      this.state.position.copy(moveRes.position);
      this.state.velocity.copy(moveRes.velocity);
      this.state.isGrounded = moveRes.isGrounded;
      this.syncRig(dt, now, playerCameraPos);
      return null;
    }

    // 1. Update visual perception (every frame, strictly respecting view cone & solid occlusion)
    this.updatePerception(now, collisionWorld, allCombatants);

    // Opportunistic reload when out of sight and magazine is low
    if (
      !this.isReloading &&
      !this.hasLineOfSightToTarget &&
      this.magazineAmmo < weaponDef.magazineSize * 0.35
    ) {
      this.isReloading = true;
      this.reloadTimer = weaponDef.reloadTime;
    }

    // 2. Navigation & Movement Decision
    this.repathTimer -= dt;
    const seekingCover = this.state.health < 38 || (this.isReloading && this.hasLineOfSightToTarget);

    if (this.repathTimer <= 0 || (this.pathQueue.length === 0 && !this.hasLineOfSightToTarget)) {
      this.repathTimer = 1.2 + Math.random() * 0.8;
      this.planPath(waypoints, seekingCover);
    }

    let moveDirX = 0;
    let moveDirZ = 0;
    let desiredYaw = this.state.yaw;
    let desiredPitch = 0;

    if (this.hasLineOfSightToTarget && this.targetId && !seekingCover) {
      // Combat engagement movement: face target, maintain optimal distance, strafe
      const toTarget = new THREE.Vector3().subVectors(this.targetLastKnownPos, this.state.position);
      const horizDist = Math.hypot(toTarget.x, toTarget.z);
      desiredYaw = Math.atan2(-toTarget.x, -toTarget.z);
      const eyeY = this.state.position.y + (this.state.isCrouching ? PLAYER_DIMENSIONS.crouchedEyeHeight : PLAYER_DIMENSIONS.standingEyeHeight);
      desiredPitch = Math.atan2(this.targetLastKnownPos.y - eyeY, Math.max(0.5, horizDist));

      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = (0.6 + Math.random() * 0.9) / this.profile.strafeFrequency;
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.state.isCrouching = Math.random() < this.profile.crouchInCombatChance;
      }

      const forwardX = -Math.sin(desiredYaw);
      const forwardZ = -Math.cos(desiredYaw);
      const rightX = Math.cos(desiredYaw);
      const rightZ = -Math.sin(desiredYaw);

      const idealMinDist = weaponDef.id === 'shotgun' ? 5 : weaponDef.id === 'smg' ? 9 : 14;
      const idealMaxDist = weaponDef.id === 'shotgun' ? 12 : weaponDef.id === 'dmr' ? 38 : 26;

      let advance = 0;
      if (horizDist > idealMaxDist) advance = 0.75;
      else if (horizDist < idealMinDist) advance = -0.65;

      moveDirX = forwardX * advance + rightX * this.strafeDir * 0.75;
      moveDirZ = forwardZ * advance + rightZ * this.strafeDir * 0.75;
      this.state.isSprinting = false;
      this.state.isAiming = true;
    } else {
      // Follow waypoint path
      this.state.isCrouching = false;
      this.state.isAiming = false;
      const wp = this.getNextWaypoint(waypoints);
      if (wp) {
        const dx = wp.position.x - this.state.position.x;
        const dz = wp.position.z - this.state.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          moveDirX = dx / dist;
          moveDirZ = dz / dist;
          desiredYaw = Math.atan2(-moveDirX, -moveDirZ);
          this.state.isSprinting = !this.hasLineOfSightToTarget && !this.isReloading && dist > 4.0;
        }
      }

      // If recently saw an enemy (< 2.5s ago), keep looking toward their last known position while moving
      if (this.targetId && now - this.targetLastSeenTime < 2.5) {
        const toLast = new THREE.Vector3().subVectors(this.targetLastKnownPos, this.state.position);
        desiredYaw = Math.atan2(-toLast.x, -toLast.z);
        this.state.isSprinting = false;
      }
    }

    // Anti-bunching separation from nearby bots
    for (const other of allCombatants) {
      if (other.id === this.state.id || !other.isAlive) continue;
      const dx = this.state.position.x - other.position.x;
      const dz = this.state.position.z - other.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 2.25 && distSq > 1e-4) {
        const dist = Math.sqrt(distSq);
        const push = (1.5 - dist) / 1.5;
        moveDirX += (dx / dist) * push * 0.9;
        moveDirZ += (dz / dist) * push * 0.9;
      }
    }

    // Normalize horizontal move direction
    const moveLen = Math.hypot(moveDirX, moveDirZ);
    if (moveLen > 1) {
      moveDirX /= moveLen;
      moveDirZ /= moveLen;
    }

    // Smooth angular rotation (never snaps instantaneously)
    this.state.yaw = this.rotateAngleTowards(
      this.state.yaw,
      desiredYaw,
      this.profile.turnSpeedRadPerSec * dt
    );
    this.state.pitch = THREE.MathUtils.lerp(
      this.state.pitch,
      THREE.MathUtils.clamp(desiredPitch, -1.1, 1.1),
      Math.min(1, dt * 8)
    );

    // Apply velocity & physics
    const baseSpeed = this.state.isCrouching ? 2.8 : this.state.isSprinting ? 6.2 : 4.6;
    const speed = baseSpeed * weaponDef.moveSpeedMultiplier;
    this.state.velocity.x = THREE.MathUtils.lerp(this.state.velocity.x, moveDirX * speed, Math.min(1, dt * 12));
    this.state.velocity.z = THREE.MathUtils.lerp(this.state.velocity.z, moveDirZ * speed, Math.min(1, dt * 12));
    this.state.velocity.y -= 22.0 * dt;

    const charHeight = this.state.isCrouching ? PLAYER_DIMENSIONS.crouchedHeight : PLAYER_DIMENSIONS.standingHeight;
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

    // Stuck recovery check
    if (moveLen > 0.3) {
      if (this.state.position.distanceToSquared(this.lastProgressPos) < 0.08) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.1) {
          this.stuckTimer = 0;
          this.strafeDir *= -1;
          this.planPath(waypoints, false);
          if (this.state.isGrounded) {
            this.state.velocity.y = 6.2; // small hop over ledge/corner if stuck
          }
        }
      } else {
        this.stuckTimer = 0;
        this.lastProgressPos.copy(this.state.position);
      }
    }

    // Footstep sound trigger
    const actualHorizSpeed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    if (this.state.isGrounded && actualHorizSpeed > 1.2) {
      this.footstepTimer -= dt * (this.state.isSprinting ? 1.45 : 1.0);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.42;
        onFootstep?.(this.state.position, this.state.isSprinting);
      }
    }

    this.syncRig(dt, now, playerCameraPos);

    // 3. Firing logic
    if (
      this.hasLineOfSightToTarget &&
      this.targetId &&
      !this.isReloading &&
      this.magazineAmmo > 0 &&
      now - this.targetFirstSeenTime >= this.profile.reactionDelaySeconds
    ) {
      const yawDiff = Math.abs(this.angleDiff(this.state.yaw, desiredYaw));
      if (yawDiff < 0.35) {
        if (this.burstPauseTimer > 0) {
          this.burstPauseTimer -= dt;
        } else if (this.fireCooldown <= 0) {
          if (this.burstShotsRemaining <= 0) {
            this.burstShotsRemaining =
              this.profile.burstLengthMin +
              Math.floor(Math.random() * (this.profile.burstLengthMax - this.profile.burstLengthMin + 1));
          }

          this.burstShotsRemaining--;
          this.magazineAmmo--;
          this.fireCooldown = 60 / weaponDef.rpm;

          if (this.burstShotsRemaining <= 0) {
            this.burstPauseTimer = this.profile.burstPauseSeconds * (0.8 + Math.random() * 0.4);
          }

          this.rig.triggerMuzzleFlash();

          // Compute shot origin & direction with controlled aim error
          const eyeY =
            this.state.position.y +
            (this.state.isCrouching ? PLAYER_DIMENSIONS.crouchedEyeHeight : PLAYER_DIMENSIONS.standingEyeHeight);
          const origin = new THREE.Vector3(this.state.position.x, eyeY, this.state.position.z);
          const aimDir = new THREE.Vector3().subVectors(this.targetLastKnownPos, origin).normalize();

          const errYaw = (Math.random() - 0.5) * 2 * this.profile.aimErrorRadians;
          const errPitch = (Math.random() - 0.5) * 2 * this.profile.aimErrorRadians;
          aimDir.x += errYaw;
          aimDir.y += errPitch;
          aimDir.z += (Math.random() - 0.5) * this.profile.aimErrorRadians;
          aimDir.normalize();

          return {
            botId: this.state.id,
            origin,
            direction: aimDir,
            weaponId: weaponDef.id,
          };
        }
      }
    }

    return null;
  }

  private updatePerception(
    now: number,
    collisionWorld: CollisionWorld,
    allCombatants: CombatantState[]
  ): void {
    const eyeY =
      this.state.position.y +
      (this.state.isCrouching ? PLAYER_DIMENSIONS.crouchedEyeHeight : PLAYER_DIMENSIONS.standingEyeHeight);
    const eyePos = new THREE.Vector3(this.state.position.x, eyeY, this.state.position.z);
    const forward = new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw)).normalize();

    let bestEnemy: CombatantState | null = null;
    let bestScore = Infinity;

    for (const c of allCombatants) {
      if (!c.isAlive || c.id === this.state.id) continue;
      if (this.state.team !== 'ffa' && c.team === this.state.team) continue;

      const targetChestY =
        c.position.y + (c.isCrouching ? PLAYER_DIMENSIONS.crouchedHeight * 0.65 : PLAYER_DIMENSIONS.standingHeight * 0.72);
      const targetPt = new THREE.Vector3(c.position.x, targetChestY, c.position.z);
      const toEnemy = new THREE.Vector3().subVectors(targetPt, eyePos);
      const dist = toEnemy.length();
      if (dist > 68) continue;

      const dirXZ = new THREE.Vector3(toEnemy.x, 0, toEnemy.z).normalize();
      const dot = forward.dot(dirXZ);

      // Must be inside vision cone OR very close (< 4.5m peripheral awareness) OR already tracking this target
      const inCone = dot >= this.profile.visionConeCos || dist < 4.5 || c.id === this.targetId;
      if (!inCone) continue;

      if (collisionWorld.hasLineOfSight(eyePos, targetPt)) {
        const score = dist * (c.id === this.targetId ? 0.75 : 1.0);
        if (score < bestScore) {
          bestScore = score;
          bestEnemy = c;
        }
      }
    }

    if (bestEnemy) {
      const chestY =
        bestEnemy.position.y +
        (bestEnemy.isCrouching ? PLAYER_DIMENSIONS.crouchedHeight * 0.68 : PLAYER_DIMENSIONS.standingHeight * 0.74);
      if (this.targetId !== bestEnemy.id || !this.hasLineOfSightToTarget) {
        this.targetFirstSeenTime = now;
      }
      this.targetId = bestEnemy.id;
      this.targetLastSeenTime = now;
      this.targetLastKnownPos.set(bestEnemy.position.x, chestY, bestEnemy.position.z);
      this.hasLineOfSightToTarget = true;
    } else {
      this.hasLineOfSightToTarget = false;
      if (this.targetId && now - this.targetLastSeenTime > 4.5) {
        this.targetId = null;
      }
    }
  }

  private getNextWaypoint(waypoints: Map<string, NavWaypoint>): NavWaypoint | null {
    if (this.pathQueue.length === 0) return null;
    const wpId = this.pathQueue[0];
    const wp = waypoints.get(wpId);
    if (!wp) {
      this.pathQueue.shift();
      return null;
    }

    const dx = wp.position.x - this.state.position.x;
    const dz = wp.position.z - this.state.position.z;
    const dy = Math.abs(wp.position.y - this.state.position.y);
    if (Math.hypot(dx, dz) < Math.max(1.3, wp.radius) && dy < 1.8) {
      this.currentWaypointId = wp.id;
      this.pathQueue.shift();
      return this.pathQueue.length > 0 ? waypoints.get(this.pathQueue[0]) ?? null : null;
    }
    return wp;
  }

  private planPath(waypoints: Map<string, NavWaypoint>, preferCover: boolean): void {
    if (waypoints.size === 0) return;

    // Find closest waypoint to current position
    let startId = this.currentWaypointId;
    if (!startId || !waypoints.has(startId)) {
      let bestD = Infinity;
      for (const [id, wp] of waypoints) {
        const d = this.state.position.distanceToSquared(wp.position);
        if (d < bestD) {
          bestD = d;
          startId = id;
        }
      }
    }
    if (!startId) return;

    // Pick destination waypoint
    const candidates: NavWaypoint[] = [];
    for (const wp of waypoints.values()) {
      if (wp.id === startId) continue;
      if (preferCover && wp.tacticalType === 'cover') {
        candidates.push(wp, wp); // weight cover nodes higher when low HP/reloading
      } else if (!preferCover && (wp.tacticalType === 'objective' || wp.tacticalType === 'overlook')) {
        candidates.push(wp, wp);
      } else {
        candidates.push(wp);
      }
    }

    if (candidates.length === 0) return;
    const goal = candidates[Math.floor(Math.random() * candidates.length)];
    this.pathQueue = this.findAStarPath(startId, goal.id, waypoints);
  }

  private findAStarPath(
    startId: string,
    goalId: string,
    waypoints: Map<string, NavWaypoint>
  ): string[] {
    const startNode = waypoints.get(startId);
    const goalNode = waypoints.get(goalId);
    if (!startNode || !goalNode) return [goalId];

    const openSet = new Set<string>([startId]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startId, 0]]);
    const fScore = new Map<string, number>([[startId, startNode.position.distanceTo(goalNode.position)]]);

    while (openSet.size > 0) {
      let current = '';
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = id;
        }
      }

      if (current === goalId) {
        const path: string[] = [current];
        while (cameFrom.has(current)) {
          current = cameFrom.get(current)!;
          if (current !== startId) path.unshift(current);
        }
        return path;
      }

      openSet.delete(current);
      const currentWp = waypoints.get(current);
      if (!currentWp) continue;

      for (const neighborId of currentWp.connections) {
        const neighborWp = waypoints.get(neighborId);
        if (!neighborWp) continue;
        const tentativeG = (gScore.get(current) ?? Infinity) + currentWp.position.distanceTo(neighborWp.position);
        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + neighborWp.position.distanceTo(goalNode.position));
          openSet.add(neighborId);
        }
      }
    }

    return [goalId];
  }

  private syncRig(dt: number, now: number, playerCameraPos: THREE.Vector3): void {
    this.rig.root.position.copy(this.state.position);
    this.rig.root.rotation.y = this.state.yaw;
    const horizSpeed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    this.rig.updatePose(
      dt,
      now,
      horizSpeed,
      this.state.isCrouching,
      this.state.pitch,
      this.flinchTimer,
      this.state.health / this.state.maxHealth,
      playerCameraPos
    );
  }

  private angleDiff(a: number, b: number): number {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  private rotateAngleTowards(current: number, target: number, maxStep: number): number {
    const diff = this.angleDiff(current, target);
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
  }
}
