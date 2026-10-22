import * as THREE from 'three';
import { WeaponId } from '../types/contracts';

export interface WeaponAnimationState {
  dt: number;
  elapsed: number;
  moveSpeedRatio: number;
  isSprinting: boolean;
  isGrounded: boolean;
  isCrouching: boolean;
  adsProgress: number;
  recoilKick: { pitch: number; yaw: number; back: number };
  reloadProgress: number;
  isReloading: boolean;
  equipProgress: number;
  swayX: number;
  swayY: number;
  wallProximity: number;
  reducedMotion: boolean;
}

export interface WeaponViewmodelRig {
  weaponId: WeaponId;
  root: THREE.Group;
  weaponGroup: THREE.Group;
  magazineGroup: THREE.Group;
  boltGroup: THREE.Group;
  muzzlePoint: THREE.Object3D;
  hipPosition: THREE.Vector3;
  adsPosition: THREE.Vector3;
  triggerMuzzleFlash: () => void;
  updateAnimation: (state: WeaponAnimationState) => void;
  dispose: () => void;
}

interface SharedViewmodelMaterials {
  gunmetalDark: THREE.MeshStandardMaterial;
  gunmetalUpper: THREE.MeshStandardMaterial;
  anodizedRail: THREE.MeshStandardMaterial;
  polymerGrip: THREE.MeshStandardMaterial;
  coyoteTan: THREE.MeshStandardMaterial;
  oliveDrab: THREE.MeshStandardMaterial;
  walnutTactical: THREE.MeshStandardMaterial;
  steelBarrel: THREE.MeshStandardMaterial;
  chromeBolt: THREE.MeshStandardMaterial;
  brassAccent: THREE.MeshStandardMaterial;
  opticGlass: THREE.MeshStandardMaterial;
  reticleCyan: THREE.MeshBasicMaterial;
  reticleRed: THREE.MeshBasicMaterial;
  tritiumGreen: THREE.MeshBasicMaterial;
  gloveFabric: THREE.MeshStandardMaterial;
  gloveKnuckle: THREE.MeshStandardMaterial;
  sleeveCamo: THREE.MeshStandardMaterial;
  wristWatch: THREE.MeshStandardMaterial;
  watchFace: THREE.MeshBasicMaterial;
  shellRed: THREE.MeshStandardMaterial;
}

function createViewmodelMaterials(): SharedViewmodelMaterials {
  return {
    gunmetalDark: new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      roughness: 0.42,
      metalness: 0.82,
    }),
    gunmetalUpper: new THREE.MeshStandardMaterial({
      color: 0x2b313b,
      roughness: 0.34,
      metalness: 0.86,
    }),
    anodizedRail: new THREE.MeshStandardMaterial({
      color: 0x3a414d,
      roughness: 0.30,
      metalness: 0.88,
    }),
    polymerGrip: new THREE.MeshStandardMaterial({
      color: 0x16181c,
      roughness: 0.76,
      metalness: 0.15,
    }),
    coyoteTan: new THREE.MeshStandardMaterial({
      color: 0x8c7355,
      roughness: 0.62,
      metalness: 0.18,
    }),
    oliveDrab: new THREE.MeshStandardMaterial({
      color: 0x4a5746,
      roughness: 0.64,
      metalness: 0.16,
    }),
    walnutTactical: new THREE.MeshStandardMaterial({
      color: 0x6e472b,
      roughness: 0.58,
      metalness: 0.12,
    }),
    steelBarrel: new THREE.MeshStandardMaterial({
      color: 0x525b66,
      roughness: 0.24,
      metalness: 0.92,
    }),
    chromeBolt: new THREE.MeshStandardMaterial({
      color: 0x9aa4b4,
      roughness: 0.18,
      metalness: 0.96,
    }),
    brassAccent: new THREE.MeshStandardMaterial({
      color: 0xc89d44,
      roughness: 0.28,
      metalness: 0.88,
    }),
    opticGlass: new THREE.MeshStandardMaterial({
      color: 0x102838,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    reticleCyan: new THREE.MeshBasicMaterial({
      color: 0x38f6ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
    reticleRed: new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
    tritiumGreen: new THREE.MeshBasicMaterial({
      color: 0x4cff72,
    }),
    gloveFabric: new THREE.MeshStandardMaterial({
      color: 0x242930,
      roughness: 0.68,
      metalness: 0.14,
    }),
    gloveKnuckle: new THREE.MeshStandardMaterial({
      color: 0x4a4238,
      roughness: 0.48,
      metalness: 0.35,
    }),
    sleeveCamo: new THREE.MeshStandardMaterial({
      color: 0x2c353b,
      roughness: 0.82,
      metalness: 0.08,
    }),
    wristWatch: new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.32,
      metalness: 0.78,
    }),
    watchFace: new THREE.MeshBasicMaterial({
      color: 0x18e0b5,
    }),
    shellRed: new THREE.MeshStandardMaterial({
      color: 0xb82828,
      roughness: 0.45,
      metalness: 0.22,
    }),
  };
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Mesh {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    mesh.rotation.set(rx, ry, rz);
  }
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  rTop: number,
  rBottom: number,
  len: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = Math.PI / 2,
  ry = 0,
  rz = 0,
  radialSegments = 12
): THREE.Mesh {
  const geom = new THREE.CylinderGeometry(rTop, rBottom, len, radialSegments);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

/**
 * Adds Picatinny rail ridges along a Z segment
 */
function addPicatinnyRail(
  parent: THREE.Object3D,
  y: number,
  zStart: number,
  zEnd: number,
  width: number,
  mat: THREE.Material
): void {
  const length = Math.abs(zEnd - zStart);
  const zMid = (zStart + zEnd) * 0.5;
  addBox(parent, width, 0.004, length, mat, 0, y, zMid);
  const slots = Math.max(3, Math.floor(length / 0.014));
  const step = length / slots;
  for (let i = 0; i <= slots; i++) {
    const z = Math.min(zStart, zEnd) + i * step;
    addBox(parent, width + 0.002, 0.0035, 0.005, mat, 0, y + 0.003, z);
  }
}

/**
 * Builds an EOTech / Holographic reflex sight centered at (0, mountY + 0.025, z)
 * Returns the exact Y coordinate of the reticle center so ADS aligns perfectly.
 */
function buildHoloSight(
  parent: THREE.Object3D,
  mountY: number,
  z: number,
  mats: SharedViewmodelMaterials,
  useCyanReticle = true
): number {
  const sightGroup = new THREE.Group();
  sightGroup.position.set(0, mountY, z);
  parent.add(sightGroup);

  const reticleLocalY = 0.024;

  // Base clamp
  addBox(sightGroup, 0.032, 0.009, 0.062, mats.gunmetalDark, 0, 0.0045, 0);
  // Left & Right protective hood pillars
  addBox(sightGroup, 0.0045, 0.028, 0.048, mats.gunmetalUpper, -0.0155, 0.021, 0);
  addBox(sightGroup, 0.0045, 0.028, 0.048, mats.gunmetalUpper, 0.0155, 0.021, 0);
  // Top hood bar
  addBox(sightGroup, 0.0355, 0.0045, 0.048, mats.gunmetalUpper, 0, 0.036, 0);

  // Translucent lens plane
  addBox(sightGroup, 0.026, 0.022, 0.0015, mats.opticGlass, 0, reticleLocalY, -0.004);

  // Illuminated reticle (ring + center dot + side ticks)
  const retMat = useCyanReticle ? mats.reticleCyan : mats.reticleRed;
  const ringGeom = new THREE.RingGeometry(0.0048, 0.0058, 24);
  const ringMesh = new THREE.Mesh(ringGeom, retMat);
  ringMesh.position.set(0, reticleLocalY, -0.002);
  sightGroup.add(ringMesh);

  const dotGeom = new THREE.CircleGeometry(0.0011, 12);
  const dotMesh = new THREE.Mesh(dotGeom, retMat);
  dotMesh.position.set(0, reticleLocalY, -0.0018);
  sightGroup.add(dotMesh);

  // Horizontal & vertical stadia ticks
  addBox(sightGroup, 0.0035, 0.0007, 0.0004, retMat, -0.0072, reticleLocalY, -0.0018);
  addBox(sightGroup, 0.0035, 0.0007, 0.0004, retMat, 0.0072, reticleLocalY, -0.0018);
  addBox(sightGroup, 0.0007, 0.0035, 0.0004, retMat, 0, reticleLocalY - 0.0072, -0.0018);

  return mountY + reticleLocalY;
}

/**
 * Builds a low-profile Micro Reflex Red-Dot sight (for SMG / Shotgun / Pistol)
 */
function buildMicroReflexSight(
  parent: THREE.Object3D,
  mountY: number,
  z: number,
  scale: number,
  mats: SharedViewmodelMaterials,
  useCyan = false
): number {
  const sightGroup = new THREE.Group();
  sightGroup.position.set(0, mountY, z);
  parent.add(sightGroup);

  const h = 0.020 * scale;
  const w = 0.026 * scale;
  const reticleLocalY = 0.006 * scale + h * 0.55;

  // Base plate
  addBox(sightGroup, w, 0.006 * scale, 0.038 * scale, mats.gunmetalDark, 0, 0.003 * scale, 0);
  // Forward frame walls
  addBox(sightGroup, 0.0032 * scale, h, 0.014 * scale, mats.gunmetalUpper, -w * 0.46, 0.006 * scale + h * 0.5, -0.008 * scale);
  addBox(sightGroup, 0.0032 * scale, h, 0.014 * scale, mats.gunmetalUpper, w * 0.46, 0.006 * scale + h * 0.5, -0.008 * scale);
  addBox(sightGroup, w, 0.0032 * scale, 0.014 * scale, mats.gunmetalUpper, 0, 0.006 * scale + h, -0.008 * scale);

  // Glass window
  addBox(sightGroup, w * 0.84, h * 0.82, 0.0012, mats.opticGlass, 0, reticleLocalY, -0.008 * scale);

  const retMat = useCyan ? mats.reticleCyan : mats.reticleRed;
  const dotGeom = new THREE.CircleGeometry(0.0013 * scale, 12);
  const dotMesh = new THREE.Mesh(dotGeom, retMat);
  dotMesh.position.set(0, reticleLocalY, -0.006 * scale);
  sightGroup.add(dotMesh);

  const ringGeom = new THREE.RingGeometry(0.0038 * scale, 0.0045 * scale, 20);
  const ringMesh = new THREE.Mesh(ringGeom, retMat);
  ringMesh.position.set(0, reticleLocalY, -0.0062 * scale);
  sightGroup.add(ringMesh);

  return mountY + reticleLocalY;
}

/**
 * Builds a precision Marksman Scope (for SR-25 Longbow DMR) with open bore & illuminated chevron/crosshair
 */
function buildMarksmanScope(
  parent: THREE.Object3D,
  mountY: number,
  z: number,
  mats: SharedViewmodelMaterials
): number {
  const scopeGroup = new THREE.Group();
  scopeGroup.position.set(0, mountY, z);
  parent.add(scopeGroup);

  const scopeCenterY = 0.028;
  // Low-profile scope mount bases strictly below the hollow tube (y = 0..0.009, tube bottom is at y = 0.0095)
  addBox(scopeGroup, 0.024, 0.009, 0.018, mats.gunmetalDark, 0, 0.0045, 0.042);
  addBox(scopeGroup, 0.024, 0.009, 0.018, mats.gunmetalDark, 0, 0.0045, -0.042);

  // Hollow ocular & objective housings using Ring + open-ended Cylinder so player looks cleanly through it!
  const outerTubeGeom = new THREE.CylinderGeometry(0.0185, 0.0185, 0.165, 24, 1, true);
  const outerTube = new THREE.Mesh(outerTubeGeom, mats.gunmetalUpper);
  outerTube.rotation.x = Math.PI / 2;
  outerTube.position.set(0, scopeCenterY, 0);
  scopeGroup.add(outerTube);

  // Ocular rim (back towards eye)
  const rimGeom = new THREE.RingGeometry(0.0155, 0.0205, 24);
  const rearRim = new THREE.Mesh(rimGeom, mats.polymerGrip);
  rearRim.position.set(0, scopeCenterY, 0.0826);
  scopeGroup.add(rearRim);

  // Objective bell rim (front)
  const frontRim = new THREE.Mesh(rimGeom, mats.gunmetalDark);
  frontRim.rotation.y = Math.PI;
  frontRim.position.set(0, scopeCenterY, -0.0826);
  scopeGroup.add(frontRim);

  // Compact Windage & Elevation turrets mounted strictly outside the outer tube radius (0.0195)
  addCylinder(scopeGroup, 0.0055, 0.0055, 0.008, mats.brassAccent, 0, scopeCenterY + 0.023, 0, 0, 0, 0, 12);
  addCylinder(scopeGroup, 0.0055, 0.0055, 0.008, mats.brassAccent, 0.023, scopeCenterY, 0, 0, 0, Math.PI / 2, 12);

  // Glass lens + Precision Mil-Dot Crosshair
  const lensGeom = new THREE.CircleGeometry(0.0155, 24);
  const lensMesh = new THREE.Mesh(lensGeom, mats.opticGlass);
  lensMesh.position.set(0, scopeCenterY, 0.065);
  scopeGroup.add(lensMesh);

  // Fine reticle crosshairs
  addBox(scopeGroup, 0.028, 0.00045, 0.0003, mats.reticleCyan, 0, scopeCenterY, 0.066);
  addBox(scopeGroup, 0.00045, 0.028, 0.0003, mats.reticleCyan, 0, scopeCenterY, 0.066);

  const centerRingGeom = new THREE.RingGeometry(0.0028, 0.0036, 24);
  const centerRing = new THREE.Mesh(centerRingGeom, mats.reticleRed);
  centerRing.position.set(0, scopeCenterY, 0.0662);
  scopeGroup.add(centerRing);

  const centerDotGeom = new THREE.CircleGeometry(0.0008, 12);
  const centerDot = new THREE.Mesh(centerDotGeom, mats.reticleRed);
  centerDot.position.set(0, scopeCenterY, 0.0664);
  scopeGroup.add(centerDot);

  return mountY + scopeCenterY;
}

/**
 * Adds compact, tightly integrated tactical gloved hands and under-rail foregrip
 * directly attached to the weapon receiver/handguard with zero floating arm cylinders.
 */
function buildTacticalHands(
  weaponGroup: THREE.Group,
  supportTargetParent: THREE.Object3D,
  gripPos: THREE.Vector3,
  supportPos: THREE.Vector3,
  mats: SharedViewmodelMaterials,
  isPistol = false
): void {
  // Right hand (compact gloved grip wrapped directly around the pistol grip)
  const rightHand = new THREE.Group();
  rightHand.position.copy(gripPos);
  weaponGroup.add(rightHand);

  addBox(rightHand, 0.036, 0.056, 0.044, mats.gloveFabric, 0.002, -0.010, 0.006, 0.24, 0, 0);
  addBox(rightHand, 0.038, 0.020, 0.030, mats.gloveKnuckle, 0.004, 0.006, 0.004, 0.24, 0, 0);
  addBox(rightHand, 0.010, 0.010, 0.036, mats.gloveFabric, 0.012, 0.016, -0.020, 0.05, -0.1, 0);

  // Left hand (compact gloved support grip directly hugging the underside of the handguard/grip)
  const leftHand = new THREE.Group();
  leftHand.position.copy(supportPos);
  supportTargetParent.add(leftHand);

  if (isPistol) {
    // Two-handed tactical pistol support grip wrapped around right hand
    addBox(leftHand, 0.036, 0.054, 0.042, mats.gloveFabric, -0.004, -0.008, 0.004, 0.24, 0, 0);
    addBox(leftHand, 0.038, 0.020, 0.028, mats.gloveKnuckle, -0.006, 0.006, 0.002, 0.24, 0, 0);
  } else {
    // Low-profile angled foregrip (AFG) & tight gloved C-clamp directly on the handguard (x = 0)
    addBox(leftHand, 0.028, 0.022, 0.068, mats.polymerGrip, 0, -0.012, 0, 0.14, 0, 0);
    addBox(leftHand, 0.042, 0.024, 0.058, mats.gloveFabric, 0, -0.018, 0.004, 0.08, 0, 0);
    addBox(leftHand, 0.044, 0.014, 0.046, mats.gloveKnuckle, 0, -0.008, 0.004, 0.08, 0, 0);
  }
}

/**
 * Creates a multi-plane star muzzle flash mesh and point light at the weapon's muzzlePoint.
 */
function createMuzzleFlashRig(muzzlePoint: THREE.Object3D): {
  flashGroup: THREE.Group;
  flashMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
} {
  const flashGroup = new THREE.Group();
  flashGroup.visible = false;
  muzzlePoint.add(flashGroup);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffb84d,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Crossed star spikes
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.042), flashMat);
    plane.rotation.z = (i * Math.PI) / 3;
    flashGroup.add(plane);
  }

  // Forward jet cone
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 8), coreMat);
  jet.rotation.x = -Math.PI / 2;
  jet.position.z = -0.065;
  flashGroup.add(jet);

  return { flashGroup, flashMat, coreMat };
}

export function createWeaponViewmodel(weaponId: WeaponId): WeaponViewmodelRig {
  const mats = createViewmodelMaterials();
  const root = new THREE.Group();
  root.name = `viewmodel_root_${weaponId}`;

  const weaponGroup = new THREE.Group();
  weaponGroup.name = `weapon_body_${weaponId}`;
  root.add(weaponGroup);

  const magazineGroup = new THREE.Group();
  magazineGroup.name = `weapon_mag_${weaponId}`;
  weaponGroup.add(magazineGroup);

  const boltGroup = new THREE.Group();
  boltGroup.name = `weapon_bolt_${weaponId}`;
  weaponGroup.add(boltGroup);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.name = `weapon_muzzle_${weaponId}`;
  weaponGroup.add(muzzlePoint);

  let sightCenterY = 0.072;
  let hipPosition = new THREE.Vector3(0.145, -0.135, -0.32);
  let adsZ = -0.22;
  let boltTravelZ = 0.042;

  if (weaponId === 'ar') {
    // ========================================================================
    // 1. M4A8 VANGUARD — Two-Tone Coyote Tan & Gunmetal Tactical Carbine
    // ========================================================================
    // Upper & Lower Receiver (Matte Gunmetal + Coyote Tan lower accent)
    addBox(weaponGroup, 0.042, 0.044, 0.21, mats.gunmetalUpper, 0, 0.024, -0.02);
    addBox(weaponGroup, 0.040, 0.036, 0.16, mats.coyoteTan, 0, -0.012, -0.01);
    // Magwell flare
    addBox(weaponGroup, 0.044, 0.026, 0.068, mats.coyoteTan, 0, -0.024, -0.048);
    // Octagonal M-LOK handguard with Coyote Tan rail covers
    addBox(weaponGroup, 0.038, 0.042, 0.24, mats.anodizedRail, 0, 0.024, -0.245);
    addBox(weaponGroup, 0.042, 0.022, 0.16, mats.coyoteTan, 0, 0.022, -0.235);
    // Side vent slots
    for (let i = 0; i < 4; i++) {
      const slotZ = -0.16 - i * 0.045;
      addBox(weaponGroup, 0.043, 0.008, 0.026, mats.polymerGrip, 0, 0.024, slotZ);
    }
    // Top Picatinny rail
    addPicatinnyRail(weaponGroup, 0.048, 0.07, -0.36, 0.026, mats.anodizedRail);
    // Side-mounted PEQ tactical laser box on forward rail
    addBox(weaponGroup, 0.022, 0.016, 0.055, mats.coyoteTan, -0.022, 0.034, -0.31);
    // Free-float match barrel & Birdcage compensator
    addCylinder(weaponGroup, 0.009, 0.010, 0.16, mats.steelBarrel, 0, 0.024, -0.43);
    addCylinder(weaponGroup, 0.012, 0.012, 0.042, mats.brassAccent, 0, 0.024, -0.52);
    // Flip-up folded front sight post
    addBox(weaponGroup, 0.024, 0.014, 0.022, mats.gunmetalDark, 0, 0.055, -0.345);
    // Ergonomic Coyote Tan pistol grip & SOPMOD stock
    addBox(weaponGroup, 0.032, 0.095, 0.042, mats.coyoteTan, 0, -0.068, 0.042, 0.28, 0, 0);
    addCylinder(weaponGroup, 0.015, 0.015, 0.16, mats.gunmetalDark, 0, 0.022, 0.16);
    addBox(weaponGroup, 0.040, 0.088, 0.13, mats.coyoteTan, 0, 0.002, 0.195);
    addBox(weaponGroup, 0.042, 0.032, 0.11, mats.polymerGrip, 0, 0.034, 0.195);
    // Brass shell deflector & forward assist
    addBox(weaponGroup, 0.008, 0.014, 0.016, mats.brassAccent, 0.023, 0.028, -0.005);

    // Reciprocating Chrome Bolt Carrier Group & ejection port
    boltGroup.position.set(0, 0.026, -0.035);
    addBox(boltGroup, 0.006, 0.016, 0.058, mats.chromeBolt, 0.019, 0, 0);
    addBox(boltGroup, 0.028, 0.010, 0.018, mats.coyoteTan, 0, 0.018, 0.11); // charging handle

    // Curved 30-round Coyote Tan PMAG
    magazineGroup.position.set(0, -0.088, -0.052);
    addBox(magazineGroup, 0.028, 0.125, 0.056, mats.coyoteTan, 0, 0, 0, -0.14, 0, 0);
    addBox(magazineGroup, 0.030, 0.012, 0.058, mats.brassAccent, 0, 0.056, 0.006, -0.14, 0, 0);

    // Holographic Sight (Cyan reticle)
    sightCenterY = buildHoloSight(weaponGroup, 0.050, -0.015, mats, true);

    // Tactical Hands
    buildTacticalHands(
      weaponGroup,
      weaponGroup,
      new THREE.Vector3(0, -0.055, 0.045),
      new THREE.Vector3(0, 0.004, -0.23),
      mats,
      false
    );

    muzzlePoint.position.set(0, 0.024, -0.55);
    hipPosition.set(0.145, -0.132, -0.31);
    adsZ = -0.20;
    boltTravelZ = 0.045;
  } else if (weaponId === 'smg') {
    // ========================================================================
    // 2. VX-9 SPECTRE — Submachine Gun (Compact CQB Vector/MPX hybrid)
    // ========================================================================
    // Compact two-tone titanium/anodized receiver with forward-angled vector magwell
    addBox(weaponGroup, 0.040, 0.058, 0.24, mats.anodizedRail, 0, 0.016, -0.06);
    addBox(weaponGroup, 0.042, 0.022, 0.19, mats.steelBarrel, 0, 0.032, -0.055);
    addBox(weaponGroup, 0.038, 0.068, 0.075, mats.gunmetalDark, 0, -0.028, -0.125, 0.18, 0, 0);
    // Short vented shroud & integrated fat ribbed suppressor
    addBox(weaponGroup, 0.036, 0.044, 0.11, mats.gunmetalUpper, 0, 0.020, -0.225);
    addCylinder(weaponGroup, 0.016, 0.016, 0.14, mats.polymerGrip, 0, 0.020, -0.34);
    addCylinder(weaponGroup, 0.017, 0.017, 0.018, mats.brassAccent, 0, 0.020, -0.29);
    addPicatinnyRail(weaponGroup, 0.047, 0.05, -0.26, 0.024, mats.anodizedRail);

    // Vertical stubby foregrip
    addBox(weaponGroup, 0.024, 0.065, 0.028, mats.polymerGrip, 0, -0.028, -0.225, -0.08, 0, 0);
    // Pistol grip & dual-rod PDW collapsible wire stock
    addBox(weaponGroup, 0.030, 0.088, 0.038, mats.polymerGrip, 0, -0.058, 0.032, 0.24, 0, 0);
    addCylinder(weaponGroup, 0.004, 0.004, 0.16, mats.chromeBolt, -0.018, 0.024, 0.14);
    addCylinder(weaponGroup, 0.004, 0.004, 0.16, mats.chromeBolt, 0.018, 0.024, 0.14);
    addBox(weaponGroup, 0.034, 0.078, 0.020, mats.polymerGrip, 0, 0.005, 0.22);

    // Side-charging reciprocating bolt handle
    boltGroup.position.set(0, 0.024, -0.08);
    addBox(boltGroup, 0.006, 0.014, 0.048, mats.chromeBolt, 0.018, 0, 0);
    addBox(boltGroup, 0.024, 0.008, 0.012, mats.brassAccent, -0.024, 0.006, -0.04);

    // Extended forward-angled 36-round stick magazine with brass witness strip
    magazineGroup.position.set(0, -0.105, -0.138);
    addBox(magazineGroup, 0.022, 0.155, 0.032, mats.polymerGrip, 0, 0, 0, 0.22, 0, 0);
    addBox(magazineGroup, 0.024, 0.11, 0.010, mats.brassAccent, 0, 0.01, -0.002, 0.22, 0, 0);

    // Micro Reflex Sight (Red dot + ring)
    sightCenterY = buildMicroReflexSight(weaponGroup, 0.049, -0.02, 1.08, mats, false);

    buildTacticalHands(
      weaponGroup,
      weaponGroup,
      new THREE.Vector3(0, -0.048, 0.035),
      new THREE.Vector3(0, -0.035, -0.225),
      mats,
      false
    );

    muzzlePoint.position.set(0, 0.020, -0.405);
    hipPosition.set(0.135, -0.128, -0.28);
    adsZ = -0.19;
    boltTravelZ = 0.038;
  } else if (weaponId === 'shotgun') {
    // ========================================================================
    // 3. M870 BREACHER — Tactical Combat Shotgun (Brushed Steel + Walnut/Tan Pump)
    // ========================================================================
    // Heavy milled steel receiver with chrome/steel side plate
    addBox(weaponGroup, 0.044, 0.052, 0.23, mats.steelBarrel, 0, 0.018, -0.03);
    addBox(weaponGroup, 0.046, 0.026, 0.16, mats.gunmetalDark, 0, 0.006, -0.03);
    // Long 18.5" heavy barrel + under-slung 8-shell magazine tube
    addCylinder(weaponGroup, 0.0125, 0.0125, 0.46, mats.steelBarrel, 0, 0.030, -0.37);
    addCylinder(weaponGroup, 0.0115, 0.0115, 0.43, mats.gunmetalDark, 0, 0.004, -0.355);
    // Barrel/tube clamp & perforated tactical heatshield
    addBox(weaponGroup, 0.030, 0.042, 0.022, mats.anodizedRail, 0, 0.017, -0.52);
    addBox(weaponGroup, 0.032, 0.014, 0.26, mats.gunmetalDark, 0, 0.038, -0.28);
    // Breacher toothed standoff muzzle brake
    addCylinder(weaponGroup, 0.0155, 0.014, 0.048, mats.chromeBolt, 0, 0.030, -0.61);

    // Side saddle with 5 visible crimson 12-gauge shells on BOTH sides for high visibility
    for (let i = 0; i < 4; i++) {
      const sz = 0.02 - i * 0.028;
      addCylinder(weaponGroup, 0.007, 0.007, 0.042, mats.shellRed, -0.026, 0.018, sz, 0, 0, 0, 10);
      addCylinder(weaponGroup, 0.0072, 0.0072, 0.010, mats.brassAccent, -0.026, 0.001, sz, 0, 0, 0, 10);
      addCylinder(weaponGroup, 0.007, 0.007, 0.042, mats.shellRed, 0.026, 0.018, sz, 0, 0, 0, 10);
      addCylinder(weaponGroup, 0.0072, 0.0072, 0.010, mats.brassAccent, 0.026, 0.001, sz, 0, 0, 0, 10);
    }

    // Pistol grip & heavy shock-absorbing tactical walnut/tan stock
    addBox(weaponGroup, 0.034, 0.092, 0.044, mats.polymerGrip, 0, -0.056, 0.065, 0.32, 0, 0);
    addBox(weaponGroup, 0.040, 0.078, 0.19, mats.walnutTactical, 0, 0.002, 0.175, -0.06, 0, 0);
    addPicatinnyRail(weaponGroup, 0.046, 0.06, -0.12, 0.026, mats.anodizedRail);

    // Bolt & Ribbed Tactical Walnut/Tan Corncob Pump Forend (slides back on fire/pump)
    boltGroup.position.set(0, 0, 0);
    addBox(boltGroup, 0.006, 0.018, 0.068, mats.chromeBolt, 0.020, 0.022, -0.04);
    addBox(boltGroup, 0.048, 0.040, 0.16, mats.walnutTactical, 0, -0.002, -0.285);
    for (let i = 0; i < 5; i++) {
      addBox(boltGroup, 0.051, 0.034, 0.012, mats.polymerGrip, 0, -0.002, -0.23 - i * 0.026);
    }

    // Shell carrier / speedloader group at bottom port for reload animation
    magazineGroup.position.set(0, -0.022, -0.055);
    addCylinder(magazineGroup, 0.0085, 0.0085, 0.058, mats.shellRed, 0, 0, 0);
    addCylinder(magazineGroup, 0.0088, 0.0088, 0.014, mats.brassAccent, 0, 0, 0.024);

    // Wide CQB Ghost-Ring Reflex Sight
    sightCenterY = buildMicroReflexSight(weaponGroup, 0.048, -0.02, 1.15, mats, true);

    // Left hand attached to boltGroup so it pumps along with the forend!
    buildTacticalHands(
      weaponGroup,
      boltGroup,
      new THREE.Vector3(0, -0.048, 0.065),
      new THREE.Vector3(0, -0.016, -0.285),
      mats,
      false
    );

    muzzlePoint.position.set(0, 0.030, -0.635);
    hipPosition.set(0.15, -0.14, -0.32);
    adsZ = -0.21;
    boltTravelZ = 0.075;
  } else if (weaponId === 'dmr') {
    // ========================================================================
    // 4. SR-25 LONGBOW — Designated Marksman Rifle (Olive Drab Chassis + Stainless Barrel)
    // ========================================================================
    // Long billet 7.62 receiver & Olive-Drab precision chassis handguard
    addBox(weaponGroup, 0.044, 0.048, 0.25, mats.oliveDrab, 0, 0.022, -0.02);
    addBox(weaponGroup, 0.042, 0.038, 0.19, mats.gunmetalDark, 0, -0.014, -0.01);
    addBox(weaponGroup, 0.040, 0.044, 0.32, mats.oliveDrab, 0, 0.022, -0.30);
    addPicatinnyRail(weaponGroup, 0.048, 0.09, -0.45, 0.028, mats.anodizedRail);

    // Heavy stainless fluted match barrel + Long multi-baffle tactical suppressor
    addCylinder(weaponGroup, 0.0105, 0.0115, 0.18, mats.chromeBolt, 0, 0.022, -0.54);
    addCylinder(weaponGroup, 0.0165, 0.0165, 0.17, mats.gunmetalDark, 0, 0.022, -0.68);
    // Folded front bipod legs under rail
    addCylinder(weaponGroup, 0.0055, 0.0055, 0.14, mats.chromeBolt, -0.020, -0.010, -0.38);
    addCylinder(weaponGroup, 0.0055, 0.0055, 0.14, mats.chromeBolt, 0.020, -0.010, -0.38);

    // Precision Olive Drab sniper stock with adjustable cheek riser
    addBox(weaponGroup, 0.038, 0.088, 0.21, mats.oliveDrab, 0, 0.004, 0.20);
    addBox(weaponGroup, 0.042, 0.024, 0.11, mats.polymerGrip, 0, 0.042, 0.17);
    addBox(weaponGroup, 0.032, 0.095, 0.044, mats.polymerGrip, 0, -0.066, 0.052, 0.25, 0, 0);

    // Bolt carrier group
    boltGroup.position.set(0, 0.024, -0.035);
    addBox(boltGroup, 0.006, 0.018, 0.072, mats.chromeBolt, 0.020, 0, 0);
    addBox(boltGroup, 0.032, 0.010, 0.018, mats.brassAccent, 0, 0.020, 0.13);

    // Straight waffle 20/12-round 7.62 NATO steel box magazine
    magazineGroup.position.set(0, -0.078, -0.058);
    addBox(magazineGroup, 0.030, 0.105, 0.068, mats.gunmetalDark, 0, 0, 0, -0.04, 0, 0);
    addBox(magazineGroup, 0.032, 0.012, 0.070, mats.brassAccent, 0, -0.048, 0, -0.04, 0, 0);

    // 3.5x Tactical Marksman Scope
    sightCenterY = buildMarksmanScope(weaponGroup, 0.050, -0.015, mats);

    buildTacticalHands(
      weaponGroup,
      weaponGroup,
      new THREE.Vector3(0, -0.055, 0.052),
      new THREE.Vector3(0, 0.002, -0.25),
      mats,
      false
    );

    muzzlePoint.position.set(0, 0.022, -0.77);
    hipPosition.set(0.15, -0.138, -0.32);
    adsZ = -0.175;
    boltTravelZ = 0.052;
  } else {
    // ========================================================================
    // 5. P226 SENTINEL — Two-Tone Stainless & Gunmetal Tactical Sidearm
    // ========================================================================
    // Alloy frame with under-barrel rail & beaver tail
    addBox(weaponGroup, 0.028, 0.022, 0.175, mats.gunmetalDark, 0, 0.008, -0.035);
    // Trigger guard
    addBox(weaponGroup, 0.014, 0.022, 0.045, mats.gunmetalDark, 0, -0.012, -0.015);
    // Under-barrel tactical weapon light / laser module
    addBox(weaponGroup, 0.024, 0.018, 0.056, mats.coyoteTan, 0, -0.008, -0.088);
    addCylinder(weaponGroup, 0.007, 0.007, 0.012, mats.chromeBolt, 0, -0.008, -0.118);
    // Match TiN gold barrel & threaded muzzle tip
    addCylinder(weaponGroup, 0.0075, 0.0075, 0.16, mats.brassAccent, 0, 0.024, -0.055);
    addCylinder(weaponGroup, 0.0085, 0.0085, 0.022, mats.steelBarrel, 0, 0.024, -0.135);

    // Ergonomic stippled grip with Coyote Tan grip panels
    addBox(weaponGroup, 0.028, 0.092, 0.042, mats.polymerGrip, 0, -0.042, 0.028, 0.24, 0, 0);
    addBox(weaponGroup, 0.030, 0.068, 0.028, mats.coyoteTan, 0, -0.042, 0.028, 0.24, 0, 0);

    // Reciprocating Brushed Steel Top Slide + Micro Reflex Optic + Tritium Irons
    boltGroup.position.set(0, 0, 0);
    addBox(boltGroup, 0.029, 0.024, 0.178, mats.steelBarrel, 0, 0.025, -0.034);
    // Front & rear tritium night sights
    addBox(boltGroup, 0.005, 0.007, 0.010, mats.gunmetalDark, 0, 0.040, -0.115);
    addBox(boltGroup, 0.0025, 0.0025, 0.002, mats.tritiumGreen, 0, 0.041, -0.110);
    addBox(boltGroup, 0.006, 0.007, 0.010, mats.gunmetalDark, -0.007, 0.040, 0.045);
    addBox(boltGroup, 0.006, 0.007, 0.010, mats.gunmetalDark, 0.007, 0.040, 0.045);
    addBox(boltGroup, 0.0022, 0.0022, 0.002, mats.tritiumGreen, -0.007, 0.041, 0.050);
    addBox(boltGroup, 0.0022, 0.0022, 0.002, mats.tritiumGreen, 0.007, 0.041, 0.050);

    // Slide-mounted Micro Reflex Red Dot
    sightCenterY = buildMicroReflexSight(boltGroup, 0.037, 0.002, 0.78, mats, true);

    // Detachable double-stack magazine inside grip
    magazineGroup.position.set(0, -0.048, 0.030);
    addBox(magazineGroup, 0.022, 0.095, 0.034, mats.steelBarrel, 0, 0, 0, 0.24, 0, 0);
    addBox(magazineGroup, 0.030, 0.012, 0.044, mats.polymerGrip, 0, -0.046, 0.011, 0.24, 0, 0);

    buildTacticalHands(
      weaponGroup,
      weaponGroup,
      new THREE.Vector3(0, -0.035, 0.032),
      new THREE.Vector3(0, -0.036, 0.026),
      mats,
      true
    );

    muzzlePoint.position.set(0, 0.024, -0.15);
    hipPosition.set(0.115, -0.125, -0.27);
    adsZ = -0.22;
    boltTravelZ = 0.036;
  }

  // Exact ADS sight alignment: places the optical reticle center at (0, 0) in camera view!
  const adsPosition = new THREE.Vector3(0, -sightCenterY, adsZ);

  const magRestPos = magazineGroup.position.clone();
  const magRestRot = magazineGroup.rotation.clone();
  const boltRestPos = boltGroup.position.clone();

  const { flashGroup, flashMat, coreMat } = createMuzzleFlashRig(muzzlePoint);
  let muzzleFlashTimer = 0;
  let boltKickAmount = 0;
  let walkPhase = 0;
  let smoothedSprint = 0;
  let smoothedWall = 0;
  let smoothedAirOffset = 0;

  const triggerMuzzleFlash = (): void => {
    muzzleFlashTimer = 0.048;
    boltKickAmount = 1.0;
    flashGroup.visible = true;
    flashGroup.rotation.z = Math.random() * Math.PI * 2;
    const scale = 0.85 + Math.random() * 0.45;
    flashGroup.scale.set(scale, scale, scale);
  };

  const updateAnimation = (state: WeaponAnimationState): void => {
    const dt = Math.min(state.dt, 0.1);
    const ads = THREE.MathUtils.clamp(state.adsProgress, 0, 1);
    const hipWeight = 1.0 - ads * 0.86;
    const motionScale = state.reducedMotion ? 0.35 : 1.0;

    // 1. Muzzle flash decay & reciprocating bolt blowback
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
      const ratio = muzzleFlashTimer / 0.048;
      flashMat.opacity = ratio * 0.92;
      coreMat.opacity = ratio;
      if (muzzleFlashTimer <= 0) {
        flashGroup.visible = false;
      }
    }

    if (boltKickAmount > 0) {
      boltKickAmount = Math.max(0, boltKickAmount - dt * 16.0);
    }

    // 2. Smooth sprint & wall proximity transitions
    const targetSprint = state.isSprinting && !state.isReloading && ads < 0.2 ? 1.0 : 0.0;
    smoothedSprint = THREE.MathUtils.lerp(smoothedSprint, targetSprint, Math.min(1, dt * 11));
    smoothedWall = THREE.MathUtils.lerp(
      smoothedWall,
      THREE.MathUtils.clamp(state.wallProximity, 0, 1),
      Math.min(1, dt * 14)
    );

    const targetAir = state.isGrounded ? 0 : 1.0;
    smoothedAirOffset = THREE.MathUtils.lerp(smoothedAirOffset, targetAir, Math.min(1, dt * 8));

    // 3. Base Hip <-> ADS position interpolation
    const posX = THREE.MathUtils.lerp(hipPosition.x, adsPosition.x, ads);
    const posY = THREE.MathUtils.lerp(hipPosition.y, adsPosition.y, ads);
    const posZ = THREE.MathUtils.lerp(hipPosition.z, adsPosition.z, ads);

    // 4. Idle breathing & Figure-8 walk/sprint bob
    const breathX = Math.cos(state.elapsed * 1.45) * 0.0016 * hipWeight * motionScale;
    const breathY = Math.sin(state.elapsed * 2.1) * 0.0024 * hipWeight * motionScale;

    const speedRatio = state.isGrounded ? THREE.MathUtils.clamp(state.moveSpeedRatio, 0, 1.4) : 0;
    const bobFreq = state.isSprinting ? 11.2 : 7.8;
    walkPhase += dt * bobFreq * Math.max(0.15, speedRatio);

    const bobAmp = speedRatio * hipWeight * motionScale;
    const bobX = Math.cos(walkPhase) * 0.0085 * bobAmp;
    const bobY = Math.abs(Math.sin(walkPhase)) * -0.0095 * bobAmp;
    const bobRoll = Math.cos(walkPhase) * 0.025 * bobAmp;

    // 5. Crouch subtle tactical cant (vanishes in ADS)
    const crouchCantRoll = state.isCrouching ? -0.065 * (1 - ads) : 0;
    const crouchOffsetY = state.isCrouching ? -0.008 * (1 - ads) : 0;

    // 6. Sprint low-ready tactical pose
    const sprintOffsetX = -0.055 * smoothedSprint;
    const sprintOffsetY = -0.048 * smoothedSprint;
    const sprintOffsetZ = 0.035 * smoothedSprint;
    const sprintPitch = -0.26 * smoothedSprint;
    const sprintYaw = 0.42 * smoothedSprint;
    const sprintRoll = -0.22 * smoothedSprint;

    // 7. Equip / Raise transition (0 -> 1)
    const equip = THREE.MathUtils.clamp(state.equipProgress, 0, 1);
    const equipEase = 1 - Math.pow(1 - equip, 3);
    const equipDropY = (1 - equipEase) * -0.22;
    const equipPitch = (1 - equipEase) * -0.55;

    // 8. Reload multi-stage choreography (tilt weapon -> drop mag -> insert mag -> rack bolt)
    let reloadTiltPitch = 0;
    let reloadTiltRoll = 0;
    let reloadTiltYaw = 0;
    let reloadOffsetY = 0;
    let boltReloadOffsetZ = 0;

    if (state.isReloading) {
      const p = THREE.MathUtils.clamp(state.reloadProgress, 0, 1);
      // Smooth envelope for weapon inspection tilt during reload
      const env = Math.sin(p * Math.PI);
      reloadTiltPitch = 0.24 * env;
      reloadTiltRoll = 0.36 * env;
      reloadTiltYaw = 0.16 * env;
      reloadOffsetY = -0.032 * env;

      if (p < 0.22) {
        // Stage 1: Tilt & release mag
        const t = p / 0.22;
        magazineGroup.position.set(
          magRestPos.x - 0.02 * t,
          magRestPos.y - 0.14 * t * t,
          magRestPos.z + 0.03 * t
        );
        magazineGroup.rotation.set(magRestRot.x + 0.35 * t, magRestRot.y, magRestRot.z - 0.2 * t);
      } else if (p < 0.58) {
        // Stage 2: Fetch fresh mag & bring up into magwell
        const t = (p - 0.22) / 0.36;
        const easeOut = 1 - Math.pow(1 - t, 2);
        magazineGroup.position.set(
          THREE.MathUtils.lerp(magRestPos.x - 0.03, magRestPos.x, easeOut),
          THREE.MathUtils.lerp(magRestPos.y - 0.18, magRestPos.y, easeOut),
          THREE.MathUtils.lerp(magRestPos.z + 0.04, magRestPos.z, easeOut)
        );
        magazineGroup.rotation.set(
          THREE.MathUtils.lerp(magRestRot.x + 0.3, magRestRot.x, easeOut),
          magRestRot.y,
          THREE.MathUtils.lerp(magRestRot.z - 0.2, magRestRot.z, easeOut)
        );
      } else {
        // Stage 3: Mag seated + tap impulse + rack bolt/charging handle
        magazineGroup.position.copy(magRestPos);
        magazineGroup.rotation.copy(magRestRot);

        if (p >= 0.70 && p <= 0.92) {
          const rackPhase = (p - 0.70) / 0.22;
          const rackCurve = Math.sin(rackPhase * Math.PI);
          boltReloadOffsetZ = boltTravelZ * 1.15 * rackCurve;
          reloadTiltPitch -= 0.08 * rackCurve;
        }
      }
    } else {
      magazineGroup.position.copy(magRestPos);
      magazineGroup.rotation.copy(magRestRot);
    }

    // Update reciprocating bolt position (firing kick + reload rack)
    boltGroup.position.set(
      boltRestPos.x,
      boltRestPos.y,
      boltRestPos.z + Math.max(boltKickAmount * boltTravelZ, boltReloadOffsetZ)
    );

    // 9. Close-wall obstruction pullback (prevents barrel clipping into geometry)
    const wallPullZ = smoothedWall * 0.13;
    const wallPullY = smoothedWall * 0.038;
    const wallPitch = smoothedWall * 0.32;

    // 10. Recoil kick & Mouse Sway
    const swayScale = THREE.MathUtils.lerp(1.0, 0.22, ads);
    const swayPosX = THREE.MathUtils.clamp(-state.swayX * 0.022 * swayScale, -0.025, 0.025);
    const swayPosY = THREE.MathUtils.clamp(-state.swayY * 0.022 * swayScale, -0.025, 0.025);
    const swayRotY = THREE.MathUtils.clamp(-state.swayX * 0.085 * swayScale, -0.10, 0.10);
    const swayRotX = THREE.MathUtils.clamp(-state.swayY * 0.085 * swayScale, -0.10, 0.10);

    const recoilBack = state.recoilKick.back * THREE.MathUtils.lerp(1.0, 0.68, ads);
    const recoilPitch = state.recoilKick.pitch * THREE.MathUtils.lerp(1.0, 0.55, ads);
    const recoilYaw = state.recoilKick.yaw * THREE.MathUtils.lerp(1.0, 0.50, ads);

    // Apply composed transform to weaponGroup
    weaponGroup.position.set(
      posX + breathX + bobX + sprintOffsetX + swayPosX,
      posY +
        breathY +
        bobY +
        crouchOffsetY +
        sprintOffsetY +
        equipDropY +
        reloadOffsetY +
        wallPullY +
        swayPosY -
        smoothedAirOffset * 0.012 * hipWeight,
      posZ + sprintOffsetZ + wallPullZ + recoilBack
    );

    weaponGroup.rotation.set(
      sprintPitch + equipPitch + reloadTiltPitch + wallPitch + recoilPitch + swayRotX,
      sprintYaw + reloadTiltYaw + recoilYaw + swayRotY,
      bobRoll + crouchCantRoll + sprintRoll + reloadTiltRoll
    );
  };

  const dispose = (): void => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    Object.values(mats).forEach((mat) => mat.dispose());
    flashMat.dispose();
    coreMat.dispose();
  };

  return {
    weaponId,
    root,
    weaponGroup,
    magazineGroup,
    boltGroup,
    muzzlePoint,
    hipPosition,
    adsPosition,
    triggerMuzzleFlash,
    updateAnimation,
    dispose,
  };
}

export class ViewmodelFactory {
  public static create(weaponId: WeaponId): WeaponViewmodelRig {
    return createWeaponViewmodel(weaponId);
  }

  public static createAll(): Record<WeaponId, WeaponViewmodelRig> {
    return {
      ar: createWeaponViewmodel('ar'),
      smg: createWeaponViewmodel('smg'),
      shotgun: createWeaponViewmodel('shotgun'),
      dmr: createWeaponViewmodel('dmr'),
      pistol: createWeaponViewmodel('pistol'),
    };
  }
}
