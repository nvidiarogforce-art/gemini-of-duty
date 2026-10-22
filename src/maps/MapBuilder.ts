import * as THREE from 'three';
import {
  AABBCollider,
  NavWaypoint,
  SpawnPoint,
  SurfaceMaterialType,
  TeamId,
} from '../types/contracts';
import { MaterialLibrary } from '../rendering/MaterialLibrary';

/**
 * Unified Map Geometry, Collision, Prop, and Navigation Builder
 * Ensures every visual obstacle, wall, stair, ramp, doorway, and prop has aligned collision
 * and realistic proportions (standing height ~1.80m, cover height ~1.10m crouch / 1.95m standing).
 */
export class MapBuilder {
  public readonly rootGroup = new THREE.Group();
  public readonly colliders: AABBCollider[] = [];
  public readonly raycastMeshes: THREE.Object3D[] = [];
  public readonly spawnPoints: SpawnPoint[] = [];
  public readonly waypoints = new Map<string, NavWaypoint>();
  public readonly animatedObjects: Array<(dt: number, elapsed: number) => void> = [];
  public readonly indoorZones: THREE.Box3[] = [];
  private colliderCounter = 0;

  constructor(public readonly materials: MaterialLibrary) {}

  /**
   * Adds a solid box with matching visual mesh and AABB collision
   */
  public addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    matName: string,
    options: {
      castShadow?: boolean;
      receiveShadow?: boolean;
      collide?: boolean;
      blocksBullets?: boolean;
      blocksSight?: boolean;
      surfaceOverride?: SurfaceMaterialType;
    } = {}
  ): THREE.Mesh {
    const mat = this.materials.get(matName);
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    const surface = options.surfaceOverride ?? this.materials.getSurfaceTypeForMaterial(matName);
    mesh.userData.surfaceMaterial = surface;

    this.rootGroup.add(mesh);

    const collide = options.collide ?? true;
    const blocksBullets = options.blocksBullets ?? collide;
    const blocksSight = options.blocksSight ?? (collide && matName !== 'tinted_glass');

    if (blocksBullets) {
      this.raycastMeshes.push(mesh);
    }

    if (collide || blocksBullets || blocksSight) {
      const box = new THREE.Box3(
        new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
      );
      this.colliders.push({
        id: `col_${++this.colliderCounter}`,
        box,
        material: surface,
        blocksMovement: collide,
        blocksBullets,
        blocksSight,
      });
    }

    return mesh;
  }

  /**
   * Adds a wall with a clean doorway opening (left pier, right pier, top lintel)
   * Doorway default width: 2.2m, doorway height: 2.45m (comfortably clears 1.8m player).
   */
  public addWallWithDoorway(
    x: number,
    floorY: number,
    z: number,
    length: number,
    height: number,
    thickness: number,
    axis: 'x' | 'z',
    doorOffsetFromCenter: number = 0,
    doorWidth: number = 2.2,
    doorHeight: number = 2.45,
    matName: string = 'concrete_wall',
    trimMatName: string = 'steel_dark'
  ): void {
    const halfLen = length / 2;
    const doorMin = doorOffsetFromCenter - doorWidth / 2;
    const doorMax = doorOffsetFromCenter + doorWidth / 2;

    const seg1Len = doorMin - -halfLen;
    const seg2Len = halfLen - doorMax;

    if (axis === 'x') {
      if (seg1Len > 0.05) {
        const cx = x - halfLen + seg1Len / 2;
        this.addBox(cx, floorY + height / 2, z, seg1Len, height, thickness, matName);
      }
      if (seg2Len > 0.05) {
        const cx = x + doorMax + seg2Len / 2;
        this.addBox(cx, floorY + height / 2, z, seg2Len, height, thickness, matName);
      }
      const lintelH = height - doorHeight;
      if (lintelH > 0.05) {
        this.addBox(
          x + doorOffsetFromCenter,
          floorY + doorHeight + lintelH / 2,
          z,
          doorWidth,
          lintelH,
          thickness,
          matName
        );
      }
      // Door frame steel trim
      this.addBox(x + doorMin + 0.05, floorY + doorHeight / 2, z, 0.1, doorHeight, thickness + 0.06, trimMatName, { collide: false });
      this.addBox(x + doorMax - 0.05, floorY + doorHeight / 2, z, 0.1, doorHeight, thickness + 0.06, trimMatName, { collide: false });
      this.addBox(x + doorOffsetFromCenter, floorY + doorHeight - 0.05, z, doorWidth, 0.1, thickness + 0.06, trimMatName, { collide: false });
    } else {
      if (seg1Len > 0.05) {
        const cz = z - halfLen + seg1Len / 2;
        this.addBox(x, floorY + height / 2, cz, thickness, height, seg1Len, matName);
      }
      if (seg2Len > 0.05) {
        const cz = z + doorMax + seg2Len / 2;
        this.addBox(x, floorY + height / 2, cz, thickness, height, seg2Len, matName);
      }
      const lintelH = height - doorHeight;
      if (lintelH > 0.05) {
        this.addBox(
          x,
          floorY + doorHeight + lintelH / 2,
          z + doorOffsetFromCenter,
          thickness,
          lintelH,
          doorWidth,
          matName
        );
      }
      // Door frame steel trim
      this.addBox(x, floorY + doorHeight / 2, z + doorMin + 0.05, thickness + 0.06, doorHeight, 0.1, trimMatName, { collide: false });
      this.addBox(x, floorY + doorHeight / 2, z + doorMax - 0.05, thickness + 0.06, doorHeight, 0.1, trimMatName, { collide: false });
      this.addBox(x, floorY + doorHeight - 0.05, z + doorOffsetFromCenter, thickness + 0.06, 0.1, doorWidth, trimMatName, { collide: false });
    }
  }

  /**
   * Adds a walkable staircase + smooth ramp collider for seamless player and bot traversal
   */
  public addStaircase(
    x: number,
    minY: number,
    z: number,
    width: number,
    length: number,
    height: number,
    axis: 'x' | 'z',
    dir: 1 | -1,
    matName: string = 'steel_dark'
  ): void {
    const steps = Math.max(6, Math.round(height / 0.22));
    const stepH = height / steps;
    const stepLen = length / steps;

    for (let i = 0; i < steps; i++) {
      const sy = minY + (i + 0.5) * stepH;
      const offset = (-length / 2 + (i + 0.5) * stepLen) * dir;
      if (axis === 'z') {
        this.addBox(x, sy, z + offset, width, stepH, stepLen, matName, {
          collide: false,
          blocksBullets: true,
          blocksSight: false,
        });
      } else {
        this.addBox(x + offset, sy, z, stepLen, stepH, width, matName, {
          collide: false,
          blocksBullets: true,
          blocksSight: false,
        });
      }
    }

    // Add ramp collider so movement across stairs is rock-solid and smooth at any framerate
    const box =
      axis === 'z'
        ? new THREE.Box3(
            new THREE.Vector3(x - width / 2, minY, z - length / 2),
            new THREE.Vector3(x + width / 2, minY + height, z + length / 2)
          )
        : new THREE.Box3(
            new THREE.Vector3(x - length / 2, minY, z - width / 2),
            new THREE.Vector3(x + length / 2, minY + height, z + width / 2)
          );

    this.colliders.push({
      id: `ramp_${++this.colliderCounter}`,
      box,
      material: this.materials.getSurfaceTypeForMaterial(matName),
      blocksMovement: true,
      blocksBullets: false,
      blocksSight: false,
      isRamp: true,
      rampMinY: minY,
      rampMaxY: minY + height,
      rampAxis: axis,
      rampDir: dir,
    });
  }

  /**
   * Adds a detailed shipping container with corner castings, doors, and hazard decals
   */
  public addShippingContainer(
    x: number,
    floorY: number,
    z: number,
    axis: 'x' | 'z',
    colorVariant: 'container_blue' | 'container_red' | 'container_teal' | 'container_ochre' | 'container_slate',
    length: number = 6.06,
    width: number = 2.44,
    height: number = 2.59
  ): void {
    const w = axis === 'x' ? length : width;
    const d = axis === 'x' ? width : length;
    const cy = floorY + height / 2;

    this.addBox(x, cy, z, w, height, d, colorVariant);
    // Corner posts / rails
    this.addBox(x, floorY + height - 0.06, z, w + 0.05, 0.12, d + 0.05, 'steel_dark', { collide: false });
    this.addBox(x, floorY + 0.06, z, w + 0.05, 0.12, d + 0.05, 'steel_dark', { collide: false });
  }

  /**
   * Adds waist-high tactical cover (1.12m tall: protects crouched players, allows standing ADS over top)
   */
  public addTacticalCoverBlock(
    x: number,
    floorY: number,
    z: number,
    w: number,
    d: number,
    matName: string = 'concrete_wall',
    withHazardTop: boolean = true
  ): void {
    const h = 1.12;
    this.addBox(x, floorY + h / 2, z, w, h, d, matName);
    if (withHazardTop) {
      // Heavy dark steel ballistic top cap with thin corner safety trim (prevents moiré on top face)
      this.addBox(x, floorY + h + 0.03, z, w + 0.04, 0.06, d + 0.04, 'steel_dark', { collide: false });
      this.addBox(x, floorY + h - 0.04, z, w + 0.05, 0.04, d + 0.05, 'hazard_stripes', { collide: false });
    }
  }

  /**
   * Adds an industrial work light fixture with emissive lamp and optional PointLight
   */
  public addWorkLight(
    x: number,
    y: number,
    z: number,
    colorHex: number = 0xffaa44,
    intensity: number = 3.2,
    distance: number = 18,
    addPointLight: boolean = true
  ): void {
    const matName = colorHex === 0x66e0ff ? 'emissive_cyan' : colorHex === 0xff4433 ? 'emissive_red' : 'emissive_amber';
    this.addBox(x, y + 0.08, z, 0.8, 0.1, 0.28, 'steel_dark', { collide: false });
    this.addBox(x, y, z, 0.72, 0.06, 0.20, matName, { collide: false, castShadow: false });
    if (addPointLight) {
      const light = new THREE.PointLight(colorHex, intensity, distance, 1.6);
      light.position.set(x, y - 0.15, z);
      this.rootGroup.add(light);
    }
  }

  /**
   * Adds decorative industrial pipes along a wall or ceiling
   */
  public addPipeRun(
    x: number,
    y: number,
    z: number,
    length: number,
    axis: 'x' | 'y' | 'z',
    radius: number = 0.12,
    matName: string = 'metal_galvanized'
  ): void {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 10);
    const mesh = new THREE.Mesh(geo, this.materials.get(matName));
    mesh.position.set(x, y, z);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.rootGroup.add(mesh);
  }

  /**
   * Registers an indoor bounding volume (occludes outdoor rain/snow particles)
   */
  public addIndoorZone(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
    this.indoorZones.push(
      new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ))
    );
  }

  public addSpawn(
    id: string,
    x: number,
    floorY: number,
    z: number,
    yaw: number,
    teamAffinity: TeamId | 'any',
    zoneName: string
  ): void {
    this.spawnPoints.push({
      id,
      position: new THREE.Vector3(x, floorY, z),
      yaw,
      teamAffinity,
      zoneName,
    });
  }

  public addWaypoint(
    id: string,
    x: number,
    floorY: number,
    z: number,
    connections: string[],
    tacticalType: NavWaypoint['tacticalType'] = 'route',
    zoneName: string = 'Sector'
  ): void {
    this.waypoints.set(id, {
      id,
      position: new THREE.Vector3(x, floorY, z),
      radius: 1.5,
      connections,
      tacticalType,
      zoneName,
    });
  }
}
