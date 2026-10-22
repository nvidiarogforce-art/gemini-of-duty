import * as THREE from 'three';

/**
 * ============================================================================
 * BLACKLINE // TACTICAL RESPONSE — SHARED ARCHITECTURAL CONTRACTS
 * ============================================================================
 * World Scale & Coordinate Conventions:
 * - 1 unit = 1.0 meter
 * - Right-handed coordinate system: +Y up, -Z forward, +X right
 * - Player standing height: 1.80m (eye height 1.65m)
 * - Player crouched height: 1.15m (eye height 1.02m)
 * - Player collision cylinder radius: 0.36m
 * - Maximum step-up height: 0.42m
 * - Walkable slope angle: <= 46 degrees
 */

export type MapId = 'breakwater' | 'mesa' | 'northstar';
export type GameModeId = 'tdm' | 'ffa' | 'practice';
export type BotDifficulty = 'recruit' | 'regular' | 'veteran';
export type QualityPreset = 'low' | 'medium' | 'high';
export type TeamId = 'aegis' | 'kestrel' | 'ffa';
export type WeaponId = 'ar' | 'smg' | 'shotgun' | 'dmr' | 'pistol';
export type PrimaryWeaponId = 'ar' | 'smg' | 'shotgun' | 'dmr';

export interface PlayerDimensions {
  readonly radius: number;
  readonly standingHeight: number;
  readonly crouchedHeight: number;
  readonly standingEyeHeight: number;
  readonly crouchedEyeHeight: number;
  readonly stepHeight: number;
}

export const PLAYER_DIMENSIONS: PlayerDimensions = {
  radius: 0.36,
  standingHeight: 1.80,
  crouchedHeight: 1.15,
  standingEyeHeight: 1.65,
  crouchedEyeHeight: 1.02,
  stepHeight: 0.42,
};

export interface GameSettings {
  mouseSensitivity: number;       // 0.1 to 3.0, default 1.0
  adsSensitivityMultiplier: number; // 0.3 to 1.0, default 0.65
  fov: number;                    // 65 to 110, default 85
  masterVolume: number;           // 0.0 to 1.0, default 0.8
  sfxVolume: number;              // 0.0 to 1.0, default 0.85
  ambienceVolume: number;         // 0.0 to 1.0, default 0.65
  qualityPreset: QualityPreset;   // 'low' | 'medium' | 'high'
  reducedCameraMotion: boolean;   // default false
  showFps: boolean;               // default true
  invertY: boolean;               // default false
}

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  adsSensitivityMultiplier: 0.65,
  fov: 85,
  masterVolume: 0.8,
  sfxVolume: 0.85,
  ambienceVolume: 0.65,
  qualityPreset: 'high',
  reducedCameraMotion: false,
  showFps: true,
  invertY: false,
};

/**
 * Collision & Surface Material Types for Audio, VFX, and Physics
 */
export type SurfaceMaterialType =
  | 'concrete'
  | 'metal'
  | 'wood'
  | 'sandstone'
  | 'snow'
  | 'water'
  | 'glass'
  | 'dirt';

export interface AABBCollider {
  id: string;
  box: THREE.Box3;
  material: SurfaceMaterialType;
  blocksMovement: boolean;
  blocksBullets: boolean;
  blocksSight: boolean;
  isRamp?: boolean;
  rampMinY?: number;
  rampMaxY?: number;
  rampAxis?: 'x' | 'z';
  rampDir?: 1 | -1; // +1 means height increases with +axis, -1 means height increases with -axis
}

/**
 * Weapon & Combat Contracts
 */
export type FireMode = 'auto' | 'semi';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  designation: string;
  category: 'Primary' | 'Sidearm';
  classLabel: string;
  description: string;
  fireMode: FireMode;
  rpm: number;
  baseDamage: number;
  headshotMultiplier: number;
  pelletCount: number;           // 1 for standard weapons, 8 for shotgun
  falloffStart: number;          // meters where damage starts dropping
  falloffEnd: number;            // meters where damage reaches minDamageMultiplier
  minDamageMultiplier: number;   // 0.35 - 0.65
  maxRange: number;              // meters
  magazineSize: number;
  reserveAmmoMax: number;
  reloadTime: number;            // seconds (tactical)
  emptyReloadTime: number;       // seconds (dry)
  equipTime: number;             // seconds
  adsTime: number;               // seconds to transition to ADS
  adsFovZoom: number;            // FOV multiplier when aiming (e.g. 0.78 or 0.48 for DMR)
  moveSpeedMultiplier: number;   // 0.88 - 1.05
  adsMoveSpeedMultiplier: number;
  hipSpreadBase: number;         // radians
  hipSpreadMax: number;          // radians
  adsSpreadBase: number;         // radians
  adsSpreadMax: number;          // radians
  spreadIncreasePerShot: number;
  spreadRecoveryRate: number;
  recoilPitchPerShot: number;    // degrees upward kick
  recoilYawVariance: number;     // degrees horizontal variance
  recoilPattern: Array<[number, number]>; // [yaw, pitch] pattern steps
  recoilRecoveryRate: number;    // degrees/sec
  muzzleVelocityVisual: number;
  soundProfile: {
    pitchBase: number;
    punch: number;
    tailDuration: number;
    mechClick: number;
  };
}

/**
 * Map, Spawn, & Navigation Contracts
 */
export interface SpawnPoint {
  id: string;
  position: THREE.Vector3;
  yaw: number; // radians
  teamAffinity: TeamId | 'any';
  zoneName: string;
}

export interface NavWaypoint {
  id: string;
  position: THREE.Vector3; // floor position (y = ground height)
  radius: number;
  connections: string[];   // IDs of connected NavWaypoints
  tacticalType: 'route' | 'cover' | 'overlook' | 'objective' | 'choke';
  coverNormal?: THREE.Vector3; // direction toward threat if this is a cover node
  zoneName: string;
}

export interface MapEnvironmentConfig {
  id: MapId;
  name: string;
  subtitle: string;
  locationLabel: string;
  timeOfDayLabel: string;
  tacticalBrief: string;
  ambientAudioType: 'rain_harbor' | 'desert_wind' | 'arctic_facility';
  skyTopColor: number;
  skyHorizonColor: number;
  groundColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunDirection: [number, number, number];
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  exposure: number;
  previewAccentColor: string;
}

export interface BuiltMapData {
  config: MapEnvironmentConfig;
  rootGroup: THREE.Group;
  colliders: AABBCollider[];
  raycastMeshes: THREE.Object3D[];
  spawnPoints: SpawnPoint[];
  waypoints: Map<string, NavWaypoint>;
  animatedObjects: Array<(dt: number, elapsed: number) => void>;
  indoorZones: THREE.Box3[]; // volumes where weather particles are occluded
  dispose: () => void;
}

/**
 * Combatant, Damage, & Match Lifecycle Contracts
 */
export interface CombatantState {
  id: string;
  name: string;
  team: TeamId;
  isPlayer: boolean;
  isAlive: boolean;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  isCrouching: boolean;
  isSprinting: boolean;
  isAiming: boolean;
  isGrounded: boolean;
  activeWeapon: WeaponId;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  lastDeathTime: number;
  lastDamagedTime: number;
  lastDamagedById: string | null;
}

export interface DamageEvent {
  attackerId: string;
  victimId: string;
  weaponId: WeaponId | 'grenade';
  damage: number;
  isHeadshot: boolean;
  isLethal: boolean;
  hitPoint: THREE.Vector3;
  hitNormal: THREE.Vector3;
  attackerPosition: THREE.Vector3;
}

export interface KillFeedEntry {
  id: string;
  attackerName: string;
  attackerTeam: TeamId;
  victimName: string;
  victimTeam: TeamId;
  weaponId: WeaponId | 'grenade';
  isHeadshot: boolean;
  timestamp: number;
}

export interface MatchConfig {
  mapId: MapId;
  modeId: GameModeId;
  difficulty: BotDifficulty;
  primaryWeapon: PrimaryWeaponId;
  scoreLimit: number;
  timeLimitSeconds: number;
}

export type MatchPhase = 'menu' | 'loading' | 'countdown' | 'playing' | 'paused' | 'ended';
