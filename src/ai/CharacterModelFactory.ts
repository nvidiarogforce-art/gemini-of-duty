import * as THREE from 'three';
import { TeamId, WeaponId } from '../types/contracts';

export interface CharacterModelRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleFlashMesh: THREE.Mesh;
  healthBarFill: THREE.Mesh;
  healthBarGroup: THREE.Group;
  updatePose: (
    dt: number,
    elapsed: number,
    speed: number,
    isCrouching: boolean,
    pitch: number,
    flinchAmount: number,
    healthRatio: number,
    cameraPos: THREE.Vector3
  ) => void;
  triggerMuzzleFlash: () => void;
  setTeamColors: (team: TeamId, isFriendlyToPlayer: boolean) => void;
  dispose: () => void;
}

/**
 * Builds readable, articulated 3D tactical operator models for Aegis Task Force and Kestrel Syndicate
 */
export function createCharacterModel(team: TeamId, isFriendlyToPlayer: boolean): CharacterModelRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isAlly = team === 'aegis' && isFriendlyToPlayer;

  const suitMat = new THREE.MeshStandardMaterial({
    color: isAlly ? 0x354652 : 0x2a2729,
    roughness: 0.72,
    metalness: 0.15,
  });

  const vestMat = new THREE.MeshStandardMaterial({
    color: isAlly ? 0x24333d : 0x1e1b1d,
    roughness: 0.58,
    metalness: 0.35,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: isAlly ? 0x22ccff : 0xff3b28,
    emissive: isAlly ? 0x0088cc : 0xcc2211,
    emissiveIntensity: 1.5,
    roughness: 0.3,
  });

  const helmetMat = new THREE.MeshStandardMaterial({
    color: isAlly ? 0x2c3c47 : 0x382222,
    roughness: 0.45,
    metalness: 0.48,
  });

  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e22,
    roughness: 0.4,
    metalness: 0.78,
  });

  // Legs (pivot at hip y = 0.86m)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.86, 0);
  const legGeo = new THREE.BoxGeometry(0.20, 0.86, 0.22);
  const leftLegMesh = new THREE.Mesh(legGeo, suitMat);
  leftLegMesh.position.y = -0.43;
  leftLegMesh.castShadow = true;
  leftLegMesh.receiveShadow = true;
  leftLeg.add(leftLegMesh);
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.86, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, suitMat);
  rightLegMesh.position.y = -0.43;
  rightLegMesh.castShadow = true;
  rightLegMesh.receiveShadow = true;
  rightLeg.add(rightLegMesh);
  bodyGroup.add(rightLeg);

  // Torso & Ballistic Plate Carrier (y = 0.86 to 1.46)
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.60, 0.28), suitMat);
  torsoMesh.position.set(0, 1.16, 0);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyGroup.add(torsoMesh);

  const vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.32), vestMat);
  vestMesh.position.set(0, 1.18, 0);
  vestMesh.castShadow = true;
  bodyGroup.add(vestMesh);

  // Faction Identification Shoulder Strobe & Chest Strip
  const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.34), accentMat);
  chestStrip.position.set(0, 1.33, 0);
  bodyGroup.add(chestStrip);

  // Head & Ballistic Helmet + Visor (y = 1.48 to 1.80)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.50, 0);
  bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.28), helmetMat);
  headMesh.position.set(0, 0.15, 0);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.05), accentMat);
  visorMesh.position.set(0, 0.17, -0.135);
  headGroup.add(visorMesh);

  // Arms & Third-Person Rifle
  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 1.38, 0);
  const armGeo = new THREE.BoxGeometry(0.14, 0.50, 0.15);
  const rArmMesh = new THREE.Mesh(armGeo, suitMat);
  rArmMesh.position.set(0, -0.18, -0.14);
  rArmMesh.rotation.x = Math.PI * 0.38;
  rArmMesh.castShadow = true;
  rightArm.add(rArmMesh);

  // Shoulder pad with faction color
  const rPad = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.18), accentMat);
  rPad.position.set(0.02, -0.02, 0);
  rightArm.add(rPad);

  // Rifle in right hand
  const rifleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.68), gunMat);
  rifleMesh.position.set(-0.08, -0.18, -0.42);
  rifleMesh.castShadow = true;
  rightArm.add(rifleMesh);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(-0.08, -0.16, -0.80);
  rightArm.add(muzzlePoint);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffcc55,
    transparent: true,
    opacity: 0.9,
  });
  const muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), flashMat);
  muzzleFlashMesh.visible = false;
  muzzlePoint.add(muzzleFlashMesh);

  bodyGroup.add(rightArm);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 1.38, 0);
  const lArmMesh = new THREE.Mesh(armGeo, suitMat);
  lArmMesh.position.set(0.08, -0.18, -0.18);
  lArmMesh.rotation.x = Math.PI * 0.42;
  lArmMesh.rotation.z = -0.25;
  lArmMesh.castShadow = true;
  leftArm.add(lArmMesh);

  const lPad = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.18), accentMat);
  lPad.position.set(-0.02, -0.02, 0);
  leftArm.add(lPad);
  bodyGroup.add(leftArm);

  // Overhead tactical nameplate / health bar
  const healthBarGroup = new THREE.Group();
  healthBarGroup.position.set(0, 1.98, 0);
  root.add(healthBarGroup);

  const bgMat = new THREE.MeshBasicMaterial({ color: 0x0d1117, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.08), bgMat);
  healthBarGroup.add(bgPlane);

  const fillMat = new THREE.MeshBasicMaterial({
    color: isAlly ? 0x22ccff : 0xff3b28,
    side: THREE.DoubleSide,
  });
  const healthBarFill = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.05), fillMat);
  healthBarFill.position.z = 0.005;
  healthBarGroup.add(healthBarFill);

  let flashTimer = 0;

  return {
    root,
    bodyGroup,
    headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    muzzlePoint,
    muzzleFlashMesh,
    healthBarFill,
    healthBarGroup,
    triggerMuzzleFlash() {
      flashTimer = 0.055;
      muzzleFlashMesh.visible = true;
      muzzleFlashMesh.scale.setScalar(0.85 + Math.random() * 0.45);
    },
    setTeamColors(newTeam: TeamId, friendly: boolean) {
      const ally = newTeam === 'aegis' && friendly;
      suitMat.color.setHex(ally ? 0x354652 : 0x2a2729);
      vestMat.color.setHex(ally ? 0x24333d : 0x1e1b1d);
      accentMat.color.setHex(ally ? 0x22ccff : 0xff3b28);
      accentMat.emissive.setHex(ally ? 0x0088cc : 0xcc2211);
      helmetMat.color.setHex(ally ? 0x2c3c47 : 0x382222);
      fillMat.color.setHex(ally ? 0x22ccff : 0xff3b28);
    },
    updatePose(dt, elapsed, speed, isCrouching, pitch, flinchAmount, healthRatio, cameraPos) {
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) muzzleFlashMesh.visible = false;
      }

      // Crouch compression
      const targetBodyY = isCrouching ? -0.45 : 0;
      bodyGroup.position.y = THREE.MathUtils.lerp(bodyGroup.position.y, targetBodyY, Math.min(1, dt * 14));
      leftLeg.scale.y = isCrouching ? 0.62 : 1.0;
      rightLeg.scale.y = isCrouching ? 0.62 : 1.0;
      leftLeg.position.y = isCrouching ? 0.55 : 0.86;
      rightLeg.position.y = isCrouching ? 0.55 : 0.86;

      // Walk cycle leg swing
      const swingAmp = Math.min(0.65, speed * 0.11);
      const phase = elapsed * 9.5;
      leftLeg.rotation.x = Math.sin(phase) * swingAmp;
      rightLeg.rotation.x = -Math.sin(phase) * swingAmp;

      // Head pitch & hit flinch
      headGroup.rotation.x = THREE.MathUtils.clamp(pitch * 0.5, -0.45, 0.45) - flinchAmount * 0.35;
      rightArm.rotation.x = THREE.MathUtils.clamp(pitch * 0.6, -0.5, 0.5) + flinchAmount * 0.25;
      leftArm.rotation.x = rightArm.rotation.x;

      // Billboard overhead health bar toward player camera
      healthBarGroup.position.y = isCrouching ? 1.42 : 1.98;
      healthBarGroup.lookAt(cameraPos);
      const clampedHp = Math.max(0.01, Math.min(1, healthRatio));
      healthBarFill.scale.x = clampedHp;
      healthBarFill.position.x = -(1 - clampedHp) * 0.30;
    },
    dispose() {
      suitMat.dispose();
      vestMat.dispose();
      accentMat.dispose();
      helmetMat.dispose();
      gunMat.dispose();
      flashMat.dispose();
      bgMat.dispose();
      fillMat.dispose();
    },
  };
}
