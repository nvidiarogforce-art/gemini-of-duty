import * as THREE from 'three';
import { SurfaceMaterialType } from '../types/contracts';

interface PooledTracer {
  mesh: THREE.Mesh;
  active: boolean;
  timer: number;
  maxTime: number;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  active: boolean;
  timer: number;
  maxTime: number;
  gravity: number;
}

interface PooledCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVel: THREE.Vector3;
  active: boolean;
  timer: number;
}

interface ActiveGrenade {
  id: string;
  throwerId: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuseTimer: number;
  bounced: boolean;
}

/**
 * Pooled Visual Effects Manager
 * Handles bullet tracers, surface-specific impact particles, bullet decals,
 * ejected brass shell casings, dynamic muzzle flash light, and frag grenades.
 */
export class VFXManager {
  public readonly root = new THREE.Group();
  private tracers: PooledTracer[] = [];
  private particles: PooledParticle[] = [];
  private casings: PooledCasing[] = [];
  private decals: THREE.Mesh[] = [];
  private decalIndex = 0;
  private readonly maxDecals = 48;

  private muzzleLight: THREE.PointLight;
  private muzzleLightTimer = 0;

  private activeGrenades: ActiveGrenade[] = [];
  private grenadeCounter = 0;

  // Weather particle system (rain for Breakwater, snow for Northstar, dust for Mesa)
  private weatherPoints: THREE.Points | null = null;
  private weatherVelocities: Float32Array | null = null;
  private weatherType: 'rain_harbor' | 'desert_wind' | 'arctic_facility' = 'rain_harbor';
  private indoorZones: THREE.Box3[] = [];

  constructor() {
    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 11, 1.8);
    this.root.add(this.muzzleLight);

    this.initPools();
  }

  private initPools(): void {
    // 1. Bullet Tracers
    const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4);
    tracerGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd277,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.tracers.push({ mesh, active: false, timer: 0, maxTime: 0.065 });
    }

    // 2. Impact Sparks / Dust / Snow Puffs
    const partGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
    for (let i = 0; i < 96; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc66,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(partGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        active: false,
        timer: 0,
        maxTime: 0.35,
        gravity: 12,
      });
    }

    // 3. Ejected Brass Shell Casings
    const casingGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.036, 6);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0xd4a64a,
      roughness: 0.28,
      metalness: 0.88,
    });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(casingGeo, casingMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.casings.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        active: false,
        timer: 0,
      });
    }

    // 4. Bullet Impact Decals
    const decalGeo = new THREE.CircleGeometry(0.055, 8);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0x141619,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (let i = 0; i < this.maxDecals; i++) {
      const mesh = new THREE.Mesh(decalGeo, decalMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.decals.push(mesh);
    }
  }

  public configureWeather(
    type: 'rain_harbor' | 'desert_wind' | 'arctic_facility',
    indoorZones: THREE.Box3[],
    quality: 'low' | 'medium' | 'high'
  ): void {
    if (this.weatherPoints) {
      this.root.remove(this.weatherPoints);
      this.weatherPoints.geometry.dispose();
      (this.weatherPoints.material as THREE.Material).dispose();
      this.weatherPoints = null;
    }

    this.weatherType = type;
    this.indoorZones = indoorZones;

    const count =
      quality === 'low'
        ? 180
        : quality === 'medium'
          ? 420
          : type === 'desert_wind'
            ? 320
            : 700;

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 64;
      positions[i * 3 + 1] = Math.random() * 18 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 64;

      if (type === 'rain_harbor') {
        velocities[i * 3] = -1.5;
        velocities[i * 3 + 1] = -16.5 - Math.random() * 4;
        velocities[i * 3 + 2] = -0.8;
      } else if (type === 'arctic_facility') {
        velocities[i * 3] = 2.4 + (Math.random() - 0.5) * 1.2;
        velocities[i * 3 + 1] = -2.6 - Math.random() * 1.2;
        velocities[i * 3 + 2] = 1.2 + (Math.random() - 0.5) * 1.2;
      } else {
        // desert dust motes
        velocities[i * 3] = 3.2 + Math.random() * 1.5;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
        velocities[i * 3 + 2] = 0.8 + (Math.random() - 0.5);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.weatherVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: type === 'rain_harbor' ? 0x99bbdd : type === 'arctic_facility' ? 0xffffff : 0xdcb488,
      size: type === 'rain_harbor' ? 0.11 : type === 'arctic_facility' ? 0.14 : 0.09,
      transparent: true,
      opacity: type === 'rain_harbor' ? 0.42 : type === 'arctic_facility' ? 0.65 : 0.32,
      depthWrite: false,
    });

    this.weatherPoints = new THREE.Points(geo, mat);
    this.root.add(this.weatherPoints);
  }

  public spawnMuzzleFlashLight(pos: THREE.Vector3): void {
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = 4.2;
    this.muzzleLightTimer = 0.05;
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: number = 0xffd277): void {
    const tracer = this.tracers.find((t) => !t.active) ?? this.tracers[0];
    const dist = start.distanceTo(end);
    if (dist < 0.8) return;

    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    tracer.mesh.position.copy(mid);
    tracer.mesh.scale.set(1, 1, Math.min(dist, 28));
    tracer.mesh.lookAt(end);
    (tracer.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (tracer.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
    tracer.mesh.visible = true;
    tracer.active = true;
    tracer.timer = tracer.maxTime;
  }

  public spawnImpact(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    surface: SurfaceMaterialType,
    isCombatant: boolean = false,
    isHeadshot: boolean = false
  ): void {
    // 1. Decal on solid world geometry
    if (!isCombatant) {
      const decal = this.decals[this.decalIndex];
      this.decalIndex = (this.decalIndex + 1) % this.maxDecals;
      decal.position.copy(point).addScaledVector(normal, 0.015);
      const lookTarget = point.clone().add(normal);
      decal.lookAt(lookTarget);
      decal.visible = true;
    }

    // 2. Burst of surface-appropriate particles
    const count = isCombatant ? (isHeadshot ? 10 : 6) : 6;
    let colorHex = 0xd4cbc0;
    if (isCombatant) colorHex = isHeadshot ? 0xffaa22 : 0xcc2222;
    else if (surface === 'metal') colorHex = 0xffbb44;
    else if (surface === 'snow') colorHex = 0xeef6ff;
    else if (surface === 'sandstone' || surface === 'dirt') colorHex = 0xc98b5b;
    else if (surface === 'wood') colorHex = 0x996b3d;

    for (let i = 0; i < count; i++) {
      const p = this.particles.find((item) => !item.active);
      if (!p) break;
      p.active = true;
      p.maxTime = 0.22 + Math.random() * 0.22;
      p.timer = p.maxTime;
      p.gravity = surface === 'snow' || surface === 'sandstone' ? 6 : 14;
      p.mesh.position.copy(point).addScaledVector(normal, 0.03);
      p.mesh.scale.setScalar(isHeadshot ? 1.35 : 1.0);
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
      p.mesh.visible = true;

      const spread = 2.8;
      p.velocity.set(
        normal.x * (2.2 + Math.random() * 2.5) + (Math.random() - 0.5) * spread,
        normal.y * (2.2 + Math.random() * 2.5) + Math.random() * 2.2,
        normal.z * (2.2 + Math.random() * 2.5) + (Math.random() - 0.5) * spread
      );
    }
  }

  public spawnShellCasing(ejectPos: THREE.Vector3, rightDir: THREE.Vector3, upDir: THREE.Vector3): void {
    const c = this.casings.find((item) => !item.active) ?? this.casings[0];
    c.active = true;
    c.timer = 0.65;
    c.mesh.position.copy(ejectPos);
    c.mesh.visible = true;
    c.velocity
      .copy(rightDir)
      .multiplyScalar(1.8 + Math.random() * 0.8)
      .addScaledVector(upDir, 1.4 + Math.random() * 0.6);
    c.rotVel.set(Math.random() * 18, Math.random() * 18, Math.random() * 18);
  }

  public spawnFragGrenade(
    throwerId: string,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number = 17.5
  ): void {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3b4d36, roughness: 0.5, metalness: 0.4 })
    );
    const blink = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3322 })
    );
    blink.position.y = 0.08;
    group.add(body, blink);
    group.position.copy(origin);
    this.root.add(group);

    this.activeGrenades.push({
      id: `gren_${++this.grenadeCounter}`,
      throwerId,
      mesh: group,
      position: origin.clone(),
      velocity: direction.clone().normalize().multiplyScalar(speed).add(new THREE.Vector3(0, 2.8, 0)),
      fuseTimer: 2.6,
      bounced: false,
    });
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onGrenadeBounce?: (pos: THREE.Vector3) => void,
    onGrenadeDetonate?: (throwerId: string, pos: THREE.Vector3) => void
  ): void {
    // Muzzle light fade
    if (this.muzzleLightTimer > 0) {
      this.muzzleLightTimer -= dt;
      if (this.muzzleLightTimer <= 0) {
        this.muzzleLight.intensity = 0;
      }
    }

    // Tracers
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.timer -= dt;
      if (t.timer <= 0) {
        t.active = false;
        t.mesh.visible = false;
      } else {
        (t.mesh.material as THREE.MeshBasicMaterial).opacity = (t.timer / t.maxTime) * 0.85;
      }
    }

    // Impact particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.timer -= dt;
      if (p.timer <= 0) {
        p.active = false;
        p.mesh.visible = false;
      } else {
        p.velocity.y -= p.gravity * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.timer / p.maxTime;
      }
    }

    // Shell casings
    for (const c of this.casings) {
      if (!c.active) continue;
      c.timer -= dt;
      if (c.timer <= 0) {
        c.active = false;
        c.mesh.visible = false;
      } else {
        c.velocity.y -= 14 * dt;
        c.mesh.position.addScaledVector(c.velocity, dt);
        c.mesh.rotation.x += c.rotVel.x * dt;
        c.mesh.rotation.y += c.rotVel.y * dt;
      }
    }

    // Active Frag Grenades
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuseTimer -= dt;
      g.velocity.y -= 18.0 * dt;
      g.position.addScaledVector(g.velocity, dt);

      // Floor bounce
      if (g.position.y <= 0.1) {
        g.position.y = 0.1;
        g.velocity.y = Math.abs(g.velocity.y) * 0.42;
        g.velocity.x *= 0.68;
        g.velocity.z *= 0.68;
        if (!g.bounced) {
          g.bounced = true;
          onGrenadeBounce?.(g.position);
        }
      }

      g.mesh.position.copy(g.position);
      g.mesh.rotation.x += 6 * dt;

      if (g.fuseTimer <= 0) {
        // Spawn explosion burst
        this.spawnImpact(g.position, new THREE.Vector3(0, 1, 0), 'metal', false, true);
        this.spawnMuzzleFlashLight(g.position);
        onGrenadeDetonate?.(g.throwerId, g.position.clone());
        this.root.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }

    // Weather particles (with indoor zone occlusion check)
    if (this.weatherPoints && this.weatherVelocities) {
      const posAttr = this.weatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = posAttr.count;
      const pt = new THREE.Vector3();

      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        arr[ix] += this.weatherVelocities[ix] * dt;
        arr[ix + 1] += this.weatherVelocities[ix + 1] * dt;
        arr[ix + 2] += this.weatherVelocities[ix + 2] * dt;

        // Respawn around player when falling below ground or drifting out of box
        if (arr[ix + 1] < 0.2 || Math.abs(arr[ix] - playerPos.x) > 34 || Math.abs(arr[ix + 2] - playerPos.z) > 34) {
          arr[ix] = playerPos.x + (Math.random() - 0.5) * 60;
          arr[ix + 1] = 14 + Math.random() * 6;
          arr[ix + 2] = playerPos.z + (Math.random() - 0.5) * 60;
        }

        // Keep indoor spaces sheltered from rain/snow!
        pt.set(arr[ix], arr[ix + 1], arr[ix + 2]);
        for (const zone of this.indoorZones) {
          if (zone.containsPoint(pt)) {
            arr[ix + 1] = zone.max.y + 1.5;
            break;
          }
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  public clearMatchEffects(): void {
    for (const d of this.decals) d.visible = false;
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const g of this.activeGrenades) {
      this.root.remove(g.mesh);
    }
    this.activeGrenades = [];
  }
}
