import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  WEAPON_DEFINITIONS,
  PRIMARY_WEAPONS,
  calculateWeaponDamage,
} from '../src/weapons/WeaponDefinitions';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { SpawnEvaluator } from '../src/maps/SpawnEvaluator';
import { PLAYER_DIMENSIONS, AABBCollider, SpawnPoint, CombatantState } from '../src/types/contracts';

describe('Weapons & Damage Calculations', () => {
  it('defines all 4 primary weapons and the sidearm with distinct profiles', () => {
    expect(PRIMARY_WEAPONS).toEqual(['ar', 'smg', 'shotgun', 'dmr']);
    expect(WEAPON_DEFINITIONS.ar.fireMode).toBe('auto');
    expect(WEAPON_DEFINITIONS.smg.rpm).toBeGreaterThan(WEAPON_DEFINITIONS.ar.rpm);
    expect(WEAPON_DEFINITIONS.shotgun.pelletCount).toBe(8);
    expect(WEAPON_DEFINITIONS.dmr.baseDamage).toBeGreaterThan(WEAPON_DEFINITIONS.ar.baseDamage);
    expect(WEAPON_DEFINITIONS.pistol.category).toBe('Sidearm');
  });

  it('applies distance falloff and headshot multipliers accurately', () => {
    const ar = WEAPON_DEFINITIONS.ar;
    const closeBody = calculateWeaponDamage(ar, 5, false);
    const closeHead = calculateWeaponDamage(ar, 5, true);
    const farBody = calculateWeaponDamage(ar, ar.falloffEnd + 15, false);

    expect(closeBody).toBe(ar.baseDamage);
    expect(closeHead).toBe(Math.round(ar.baseDamage * ar.headshotMultiplier));
    expect(farBody).toBe(Math.round(ar.baseDamage * ar.minDamageMultiplier));
    expect(farBody).toBeLessThan(closeBody);
  });
});

describe('CollisionWorld Physics, Step-up, Crouching & Cover Obstruction', () => {
  it('prevents standing up under a low ceiling obstacle', () => {
    const world = new CollisionWorld();
    const lowDuct: AABBCollider = {
      id: 'low_duct',
      box: new THREE.Box3(new THREE.Vector3(-2, 1.35, -2), new THREE.Vector3(2, 2.2, 2)),
      material: 'metal',
      blocksMovement: true,
      blocksBullets: true,
      blocksSight: true,
    };
    world.setMapData([lowDuct], []);

    // At origin under the 1.35m ceiling, standing height (1.80m) is blocked
    expect(world.canStandUp(new THREE.Vector3(0, 0, 0))).toBe(false);
    // Outside the duct at x = 5, standing is allowed
    expect(world.canStandUp(new THREE.Vector3(5, 0, 0))).toBe(true);
  });

  it('steps up onto low stairs/ledges (<= 0.42m) and blocks tall walls', () => {
    const world = new CollisionWorld();
    const stepCol: AABBCollider = {
      id: 'step',
      box: new THREE.Box3(new THREE.Vector3(-1, 0, -2), new THREE.Vector3(1, 0.32, -1)),
      material: 'concrete',
      blocksMovement: true,
      blocksBullets: true,
      blocksSight: true,
    };
    world.setMapData([stepCol], []);

    const res = world.moveCharacter(
      new THREE.Vector3(0, 0, -0.8),
      new THREE.Vector3(0, 0, -4.0),
      0.1,
      PLAYER_DIMENSIONS.standingHeight,
      true
    );
    expect(res.position.y).toBeCloseTo(0.32, 2);
    expect(res.isGrounded).toBe(true);
  });

  it('protects combatants behind solid cover and registers head/body hits when exposed', () => {
    const world = new CollisionWorld();
    const coverBlock: AABBCollider = {
      id: 'cover',
      box: new THREE.Box3(new THREE.Vector3(-2, 0, -5), new THREE.Vector3(2, 1.2, -4)),
      material: 'concrete',
      blocksMovement: true,
      blocksBullets: true,
      blocksSight: true,
    };
    world.setMapData([coverBlock], []);

    const target = {
      id: 'bot_1',
      position: new THREE.Vector3(0, 0, -10),
      isCrouching: false,
      isAlive: true,
    };

    // 1. Shot at y = 0.8m hits the 1.2m tall cover wall in front of the target
    const blockedHit = world.raycastBullet(
      new THREE.Vector3(0, 0.8, 0),
      new THREE.Vector3(0, 0, -1),
      100,
      'player',
      [target]
    );
    expect(blockedHit.hitType).toBe('world');
    expect(blockedHit.combatantId).toBeUndefined();

    // 2. Shot at y = 1.65m clears the 1.2m cover and hits the standing target's head
    const headHit = world.raycastBullet(
      new THREE.Vector3(0, 1.65, 0),
      new THREE.Vector3(0, 0, -1),
      100,
      'player',
      [target]
    );
    expect(headHit.hitType).toBe('combatant');
    expect(headHit.combatantId).toBe('bot_1');
    expect(headHit.isHeadshot).toBe(true);
  });
});

describe('SpawnEvaluator Safety Selection', () => {
  it('selects a safe occluded spawn away from living enemies', () => {
    const world = new CollisionWorld();
    const wall: AABBCollider = {
      id: 'wall',
      box: new THREE.Box3(new THREE.Vector3(-10, 0, -2), new THREE.Vector3(10, 4, 2)),
      material: 'concrete',
      blocksMovement: true,
      blocksBullets: true,
      blocksSight: true,
    };
    world.setMapData([wall], []);

    const spawns: SpawnPoint[] = [
      {
        id: 'unsafe_exposed',
        position: new THREE.Vector3(0, 0, 10),
        yaw: 0,
        teamAffinity: 'aegis',
        zoneName: 'Exposed',
      },
      {
        id: 'safe_occluded',
        position: new THREE.Vector3(0, 0, -22),
        yaw: 0,
        teamAffinity: 'aegis',
        zoneName: 'Safe',
      },
    ];

    const enemy: CombatantState = {
      id: 'enemy_1',
      name: 'Kestrel-1',
      team: 'kestrel',
      isPlayer: false,
      isAlive: true,
      health: 100,
      maxHealth: 100,
      position: new THREE.Vector3(0, 0, 14),
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      isCrouching: false,
      isSprinting: false,
      isAiming: false,
      isGrounded: true,
      activeWeapon: 'ar',
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      lastDeathTime: 0,
      lastDamagedTime: 0,
      lastDamagedById: null,
    };

    const evaluator = new SpawnEvaluator();
    const chosen = evaluator.selectBestSpawn(spawns, 'aegis', 'tdm', [enemy], world, 10);
    expect(chosen.id).toBe('safe_occluded');
  });
});
