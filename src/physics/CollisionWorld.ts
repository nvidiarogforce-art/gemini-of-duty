import * as THREE from 'three';
import {
  AABBCollider,
  PLAYER_DIMENSIONS,
  SurfaceMaterialType,
} from '../types/contracts';

export interface MoveResult {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  groundMaterial: SurfaceMaterialType;
  hitCeiling: boolean;
  landedSpeed: number;
}

export interface CombatantHitboxTarget {
  id: string;
  position: THREE.Vector3; // feet position
  isCrouching: boolean;
  isAlive: boolean;
}

export interface BulletHitResult {
  hitType: 'none' | 'world' | 'combatant';
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  surfaceMaterial: SurfaceMaterialType;
  combatantId?: string;
  isHeadshot?: boolean;
}

/**
 * Deterministic Physics & Collision System
 * Supports cylinder-vs-AABB sliding, stairs/step-up, smooth ramps, ceiling collision,
 * crouch head-clearance checks, line-of-sight occlusion, and hitscan raycasting.
 */
export class CollisionWorld {
  private colliders: AABBCollider[] = [];
  private raycastMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();

  public setMapData(colliders: AABBCollider[], raycastMeshes: THREE.Object3D[]): void {
    this.colliders = colliders;
    this.raycastMeshes = raycastMeshes;
  }

  public getColliders(): AABBCollider[] {
    return this.colliders;
  }

  /**
   * Checks if a combatant at `feetPos` can stand up without colliding with a low ceiling
   */
  public canStandUp(feetPos: THREE.Vector3): boolean {
    const r = PLAYER_DIMENSIONS.radius * 0.92;
    const minY = feetPos.y + PLAYER_DIMENSIONS.crouchedHeight;
    const maxY = feetPos.y + PLAYER_DIMENSIONS.standingHeight;

    for (const col of this.colliders) {
      if (!col.blocksMovement || col.isRamp) continue;
      const b = col.box;
      if (
        feetPos.x + r > b.min.x &&
        feetPos.x - r < b.max.x &&
        feetPos.z + r > b.min.z &&
        feetPos.z - r < b.max.z &&
        maxY > b.min.y &&
        minY < b.max.y
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolves character movement with step-up, ramps, wall sliding, and ground/ceiling detection
   */
  public moveCharacter(
    currentPos: THREE.Vector3,
    velocity: THREE.Vector3,
    dt: number,
    height: number,
    wasGrounded: boolean
  ): MoveResult {
    const radius = PLAYER_DIMENSIONS.radius;
    const stepHeight = PLAYER_DIMENSIONS.stepHeight;
    const pos = currentPos.clone();
    const vel = velocity.clone();

    let isGrounded = false;
    let groundMaterial: SurfaceMaterialType = 'concrete';
    let hitCeiling = false;
    let landedSpeed = 0;

    // 1. Horizontal movement & wall sliding (sub-stepped if fast)
    const horizDist = Math.hypot(vel.x * dt, vel.z * dt);
    const steps = Math.max(1, Math.ceil(horizDist / 0.25));
    const stepDt = dt / steps;

    for (let s = 0; s < steps; s++) {
      pos.x += vel.x * stepDt;
      pos.z += vel.z * stepDt;

      // Check ramps first so walking onto a ramp raises Y smoothly
      for (const col of this.colliders) {
        if (!col.blocksMovement || !col.isRamp) continue;
        const b = col.box;
        if (
          pos.x + radius * 0.5 > b.min.x &&
          pos.x - radius * 0.5 < b.max.x &&
          pos.z + radius * 0.5 > b.min.z &&
          pos.z - radius * 0.5 < b.max.z
        ) {
          const rampH = this.getRampHeightAt(col, pos.x, pos.z);
          if (pos.y <= rampH + 0.35 && pos.y + height >= b.min.y) {
            if (rampH > pos.y && rampH - pos.y <= stepHeight + 0.25) {
              pos.y = rampH;
              isGrounded = true;
              groundMaterial = col.material;
            }
          }
        }
      }

      // Resolve solid AABB horizontal overlaps
      for (const col of this.colliders) {
        if (!col.blocksMovement || col.isRamp) continue;
        const b = col.box;

        // Vertical overlap check
        if (pos.y + height <= b.min.y + 0.02 || pos.y >= b.max.y - 0.02) {
          continue;
        }

        // Clamp closest point on AABB in XZ plane to circle center (pos.x, pos.z)
        const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          // Can we step up onto this obstacle?
          const stepUpAmount = b.max.y - pos.y;
          if (
            (wasGrounded || isGrounded) &&
            stepUpAmount > 0 &&
            stepUpAmount <= stepHeight &&
            this.hasHeadClearanceAt(pos.x, b.max.y, pos.z, radius * 0.85, height)
          ) {
            pos.y = b.max.y;
            isGrounded = true;
            groundMaterial = col.material;
            continue;
          }

          // Push out horizontally in XZ
          if (distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const overlap = radius - dist;
            const nx = dx / dist;
            const nz = dz / dist;
            pos.x += nx * overlap;
            pos.z += nz * overlap;
            // Cancel velocity component into wall normal
            const vn = vel.x * nx + vel.z * nz;
            if (vn < 0) {
              vel.x -= nx * vn;
              vel.z -= nz * vn;
            }
          } else {
            // Center is inside AABB in XZ: push out along minimum penetration axis
            const penLeft = Math.abs(pos.x - b.min.x) + radius;
            const penRight = Math.abs(b.max.x - pos.x) + radius;
            const penBack = Math.abs(pos.z - b.min.z) + radius;
            const penFront = Math.abs(b.max.z - pos.z) + radius;
            const minPen = Math.min(penLeft, penRight, penBack, penFront);
            if (minPen === penLeft) {
              pos.x = b.min.x - radius;
              if (vel.x > 0) vel.x = 0;
            } else if (minPen === penRight) {
              pos.x = b.max.x + radius;
              if (vel.x < 0) vel.x = 0;
            } else if (minPen === penBack) {
              pos.z = b.min.z - radius;
              if (vel.z > 0) vel.z = 0;
            } else {
              pos.z = b.max.z + radius;
              if (vel.z < 0) vel.z = 0;
            }
          }
        }
      }
    }

    // 2. Vertical movement & Floor / Ceiling resolution
    const prevVy = vel.y;
    pos.y += vel.y * dt;

    // Check ramps for floor support
    let highestFloorY = -Infinity;
    let bestFloorMat: SurfaceMaterialType = 'concrete';

    for (const col of this.colliders) {
      if (!col.blocksMovement) continue;
      const b = col.box;

      if (col.isRamp) {
        if (
          pos.x + radius * 0.4 > b.min.x &&
          pos.x - radius * 0.4 < b.max.x &&
          pos.z + radius * 0.4 > b.min.z &&
          pos.z - radius * 0.4 < b.max.z
        ) {
          const rampY = this.getRampHeightAt(col, pos.x, pos.z);
          // Snap to ramp when walking down or falling onto it
          const snapTolerance = wasGrounded && vel.y <= 0 ? 0.32 : 0.12;
          if (pos.y <= rampY + snapTolerance && currentPos.y >= rampY - 0.4) {
            if (rampY > highestFloorY) {
              highestFloorY = rampY;
              bestFloorMat = col.material;
            }
          }
        }
        continue;
      }

      // Check XZ overlap for vertical floor/ceiling collision
      const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      if (dx * dx + dz * dz >= (radius * 0.92) * (radius * 0.92)) {
        continue;
      }

      // Landing on top of box
      if (vel.y <= 0 && currentPos.y >= b.max.y - 0.22 && pos.y <= b.max.y + 0.08) {
        if (b.max.y > highestFloorY) {
          highestFloorY = b.max.y;
          bestFloorMat = col.material;
        }
      }

      // Hitting ceiling
      if (vel.y > 0 && currentPos.y + height <= b.min.y + 0.2 && pos.y + height > b.min.y) {
        pos.y = b.min.y - height;
        vel.y = 0;
        hitCeiling = true;
      }
    }

    // Default ground floor at y = 0 if within arena bounds
    if (pos.y <= 0.04 && currentPos.y >= -0.5 && highestFloorY < 0) {
      highestFloorY = 0;
    }

    if (highestFloorY > -Infinity && pos.y <= highestFloorY + 0.1) {
      if (!wasGrounded && prevVy < -2.5) {
        landedSpeed = -prevVy;
      }
      pos.y = highestFloorY;
      vel.y = 0;
      isGrounded = true;
      groundMaterial = bestFloorMat;
    }

    return {
      position: pos,
      velocity: vel,
      isGrounded,
      groundMaterial,
      hitCeiling,
      landedSpeed,
    };
  }

  private getRampHeightAt(col: AABBCollider, x: number, z: number): number {
    const b = col.box;
    const minY = col.rampMinY ?? b.min.y;
    const maxY = col.rampMaxY ?? b.max.y;
    const axis = col.rampAxis ?? 'z';
    const dir = col.rampDir ?? 1;

    let t = 0;
    if (axis === 'z') {
      const span = Math.max(0.01, b.max.z - b.min.z);
      t = (z - b.min.z) / span;
    } else {
      const span = Math.max(0.01, b.max.x - b.min.x);
      t = (x - b.min.x) / span;
    }
    t = Math.max(0, Math.min(1, t));
    if (dir === -1) t = 1 - t;
    return minY + t * (maxY - minY);
  }

  private hasHeadClearanceAt(x: number, feetY: number, z: number, r: number, height: number): boolean {
    for (const col of this.colliders) {
      if (!col.blocksMovement || col.isRamp) continue;
      const b = col.box;
      if (
        x + r > b.min.x &&
        x - r < b.max.x &&
        z + r > b.min.z &&
        z - r < b.max.z &&
        feetY + height > b.min.y + 0.04 &&
        feetY < b.max.y - 0.04
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns 0..1 indicating how close the camera/weapon is to a wall in front of the player
   * so the weapon viewmodel pulls back cleanly without clipping through geometry.
   */
  public getWallProximity(eyePos: THREE.Vector3, forward: THREE.Vector3, checkDist: number = 0.85): number {
    const hit = this.raycastWorldOnly(eyePos, forward, checkDist);
    if (!hit) return 0;
    return Math.max(0, Math.min(1, 1 - hit.distance / checkDist));
  }

  /**
   * Checks if there is unobstructed line of sight between two 3D points
   */
  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const diff = new THREE.Vector3().subVectors(to, from);
    const dist = diff.length();
    if (dist < 0.05) return true;
    const dir = diff.divideScalar(dist);

    const ray = new THREE.Ray(from, dir);
    const hitPt = new THREE.Vector3();

    for (const col of this.colliders) {
      if (!col.blocksSight) continue;
      if (ray.intersectBox(col.box, hitPt)) {
        if (from.distanceToSquared(hitPt) < (dist - 0.12) * (dist - 0.12)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Raycasts against world geometry only
   */
  public raycastWorldOnly(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number
  ): { distance: number; point: THREE.Vector3; normal: THREE.Vector3; material: SurfaceMaterialType } | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let closestDist = maxDistance;
    let closestPoint: THREE.Vector3 | null = null;
    let closestNormal = new THREE.Vector3(0, 1, 0);
    let closestMat: SurfaceMaterialType = 'concrete';

    const hitPt = new THREE.Vector3();

    for (const col of this.colliders) {
      if (!col.blocksBullets) continue;
      if (ray.intersectBox(col.box, hitPt)) {
        const d = origin.distanceTo(hitPt);
        if (d < closestDist && d > 0.01) {
          closestDist = d;
          closestPoint = hitPt.clone();
          closestMat = col.material;
          closestNormal = this.computeBoxNormal(col.box, hitPt);
        }
      }
    }

    // Ground plane at y = 0 fallback
    if (direction.y < -1e-4 && origin.y > 0) {
      const t = -origin.y / direction.y;
      if (t > 0.01 && t < closestDist) {
        closestDist = t;
        closestPoint = origin.clone().addScaledVector(direction, t);
        closestNormal.set(0, 1, 0);
        closestMat = 'concrete';
      }
    }

    if (!closestPoint) return null;
    return {
      distance: closestDist,
      point: closestPoint,
      normal: closestNormal,
      material: closestMat,
    };
  }

  /**
   * Full combat hitscan: checks world geometry and all living combatants (with separate head & body hitboxes).
   * Guarantees solid cover protects targets behind walls.
   */
  public raycastBullet(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    shooterId: string,
    targets: CombatantHitboxTarget[]
  ): BulletHitResult {
    const dir = direction.clone().normalize();
    const worldHit = this.raycastWorldOnly(origin, dir, maxDistance);
    let bestDist = worldHit ? worldHit.distance : maxDistance;

    let hitCombatantId: string | undefined;
    let hitHeadshot = false;
    let hitPoint = worldHit ? worldHit.point.clone() : origin.clone().addScaledVector(dir, maxDistance);
    let hitNormal = worldHit ? worldHit.normal.clone() : dir.clone().negate();

    const ray = new THREE.Ray(origin, dir);
    const intersectPt = new THREE.Vector3();

    for (const t of targets) {
      if (!t.isAlive || t.id === shooterId) continue;

      const totalH = t.isCrouching ? PLAYER_DIMENSIONS.crouchedHeight : PLAYER_DIMENSIONS.standingHeight;
      const headRadius = 0.22;
      const headCenterY = t.position.y + totalH - headRadius * 0.95;

      // 1. Check Head Sphere first
      const headSphere = new THREE.Sphere(
        new THREE.Vector3(t.position.x, headCenterY, t.position.z),
        headRadius
      );
      if (ray.intersectSphere(headSphere, intersectPt)) {
        const d = origin.distanceTo(intersectPt);
        if (d < bestDist && d > 0.05) {
          bestDist = d;
          hitCombatantId = t.id;
          hitHeadshot = true;
          hitPoint = intersectPt.clone();
          hitNormal = new THREE.Vector3().subVectors(intersectPt, headSphere.center).normalize();
        }
      }

      // 2. Check Body AABB (feet to neck)
      const bodyHalfW = 0.34;
      const bodyMaxY = headCenterY - headRadius * 0.65;
      const bodyBox = new THREE.Box3(
        new THREE.Vector3(t.position.x - bodyHalfW, t.position.y, t.position.z - bodyHalfW),
        new THREE.Vector3(t.position.x + bodyHalfW, bodyMaxY, t.position.z + bodyHalfW)
      );
      if (ray.intersectBox(bodyBox, intersectPt)) {
        const d = origin.distanceTo(intersectPt);
        if (d < bestDist && d > 0.05) {
          bestDist = d;
          hitCombatantId = t.id;
          hitHeadshot = false;
          hitPoint = intersectPt.clone();
          hitNormal = this.computeBoxNormal(bodyBox, intersectPt);
        }
      }
    }

    if (hitCombatantId) {
      return {
        hitType: 'combatant',
        distance: bestDist,
        point: hitPoint,
        normal: hitNormal,
        surfaceMaterial: 'metal',
        combatantId: hitCombatantId,
        isHeadshot: hitHeadshot,
      };
    }

    if (worldHit) {
      return {
        hitType: 'world',
        distance: worldHit.distance,
        point: worldHit.point,
        normal: worldHit.normal,
        surfaceMaterial: worldHit.material,
      };
    }

    return {
      hitType: 'none',
      distance: maxDistance,
      point: hitPoint,
      normal: hitNormal,
      surfaceMaterial: 'concrete',
    };
  }

  private computeBoxNormal(box: THREE.Box3, pt: THREE.Vector3): THREE.Vector3 {
    const eps = 0.04;
    if (Math.abs(pt.x - box.min.x) < eps) return new THREE.Vector3(-1, 0, 0);
    if (Math.abs(pt.x - box.max.x) < eps) return new THREE.Vector3(1, 0, 0);
    if (Math.abs(pt.y - box.min.y) < eps) return new THREE.Vector3(0, -1, 0);
    if (Math.abs(pt.y - box.max.y) < eps) return new THREE.Vector3(0, 1, 0);
    if (Math.abs(pt.z - box.min.z) < eps) return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3(0, 0, 1);
  }
}
