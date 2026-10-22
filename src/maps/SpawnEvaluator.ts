import * as THREE from 'three';
import {
  CombatantState,
  GameModeId,
  PLAYER_DIMENSIONS,
  SpawnPoint,
  TeamId,
} from '../types/contracts';
import { CollisionWorld } from '../physics/CollisionWorld';

/**
 * Validated Spawn Selection System
 * Evaluates candidate spawn points using opponent distance, line-of-sight occlusion,
 * team distribution, and recent death avoidance.
 */
export class SpawnEvaluator {
  private lastUsedTime: Map<string, number> = new Map();

  public reset(): void {
    this.lastUsedTime.clear();
  }

  public selectBestSpawn(
    spawnPoints: SpawnPoint[],
    team: TeamId,
    mode: GameModeId,
    combatants: CombatantState[],
    collisionWorld: CollisionWorld,
    now: number,
    avoidPos?: THREE.Vector3
  ): SpawnPoint {
    if (spawnPoints.length === 0) {
      return {
        id: 'fallback_spawn',
        position: new THREE.Vector3(0, 0, 0),
        yaw: 0,
        teamAffinity: 'any',
        zoneName: 'Central',
      };
    }

    let bestSpawn = spawnPoints[0];
    let bestScore = -Infinity;

    for (const sp of spawnPoints) {
      let score = 100;

      // 1. Team affinity bonus in Team Deathmatch
      if (mode === 'tdm') {
        if (sp.teamAffinity === team) score += 28;
        else if (sp.teamAffinity !== 'any' && sp.teamAffinity !== team) score -= 18;
      }

      // 2. Avoid spawning right where the combatant just died
      if (avoidPos) {
        const deathDist = sp.position.distanceTo(avoidPos);
        if (deathDist < 10) score -= (10 - deathDist) * 8;
      }

      // 3. Avoid recently used spawn point
      const lastUsed = this.lastUsedTime.get(sp.id) ?? -999;
      if (now - lastUsed < 4.5) {
        score -= (4.5 - (now - lastUsed)) * 18;
      }

      // 4. Evaluate against all living combatants
      let minEnemyDist = 999;
      const spEye = new THREE.Vector3(
        sp.position.x,
        sp.position.y + PLAYER_DIMENSIONS.standingEyeHeight,
        sp.position.z
      );

      for (const c of combatants) {
        if (!c.isAlive) continue;
        const dist = sp.position.distanceTo(c.position);
        const isEnemy = mode === 'ffa' || c.team !== team;

        if (isEnemy) {
          if (dist < minEnemyDist) minEnemyDist = dist;

          // Heavy penalty if too close to an enemy (< 14m)
          if (dist < 4.0) {
            score -= 220;
          } else if (dist < 14.0) {
            score -= (14.0 - dist) * 11;
          }

          // Check if enemy has direct line of sight to this spawn point
          if (dist < 48) {
            const enemyEye = new THREE.Vector3(
              c.position.x,
              c.position.y + PLAYER_DIMENSIONS.standingEyeHeight,
              c.position.z
            );
            if (collisionWorld.hasLineOfSight(enemyEye, spEye)) {
              score -= 85;
            }
          }
        } else {
          // Friendly combatant: don't overlap directly (< 2.2m), slight bonus for nearby ally support (6-16m)
          if (dist < 2.2) score -= 90;
          else if (dist >= 5 && dist <= 18) score += 8;
        }
      }

      // Ideal enemy distance sweet spot (18m to 42m so action resumes quickly but safely)
      if (minEnemyDist < 900) {
        if (minEnemyDist >= 18 && minEnemyDist <= 45) {
          score += 32;
        } else if (minEnemyDist > 45) {
          score += Math.max(0, 32 - (minEnemyDist - 45) * 0.6);
        }
      }

      // Small random tie-breaker
      score += Math.random() * 4;

      if (score > bestScore) {
        bestScore = score;
        bestSpawn = sp;
      }
    }

    this.lastUsedTime.set(bestSpawn.id, now);
    return bestSpawn;
  }
}
