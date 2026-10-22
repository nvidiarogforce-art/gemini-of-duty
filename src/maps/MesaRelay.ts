import * as THREE from 'three';
import { BuiltMapData, MapEnvironmentConfig } from '../types/contracts';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { MapBuilder } from './MapBuilder';

/**
 * MAP 2: MESA RELAY ("mesa")
 * Sunlit deep-space communications installation integrated into an arid sandstone canyon.
 * Dimensions: ~74m (X: -37 to +37) x 64m (Z: -32 to +32)
 */
export function buildMesaRelay(materials: MaterialLibrary): BuiltMapData {
  const b = new MapBuilder(materials);

  const config: MapEnvironmentConfig = {
    id: 'mesa',
    name: 'MESA RELAY',
    subtitle: 'Deep-Space Array & Canyon Outpost',
    locationLabel: 'SECTOR 09 // SONORAN BADLANDS',
    timeOfDayLabel: '16:40 LOCAL // HIGH SOLAR',
    tacticalBrief:
      'High-visibility desert communications array flanked by a stepped sandstone canyon and elevated north overlook. Control the central parabolic dish courtyard or push through the shaded signal processing wings.',
    ambientAudioType: 'desert_wind',
    skyTopColor: 0x3b6ea5,
    skyHorizonColor: 0xe6b88a,
    groundColor: 0xb57c52,
    fogColor: 0xd9a87e,
    fogDensity: 0.0065,
    sunColor: 0xfff0d6,
    sunIntensity: 3.4,
    sunDirection: [38, 46, -24],
    hemiSkyColor: 0x9ec5e8,
    hemiGroundColor: 0x9c6644,
    hemiIntensity: 0.85,
    exposure: 1.05,
    previewAccentColor: '#e08a44',
  };

  // ==========================================================================
  // 1. GROUND & ARENA PERIMETER (~74m x 64m)
  // ==========================================================================
  // Main desert terrain floor
  b.addBox(0, -0.5, 0, 88, 1.0, 78, 'desert_ground', {
    castShadow: false,
    receiveShadow: true,
    collide: true,
    blocksBullets: true,
    blocksSight: true,
  });

  // Central courtyard concrete foundation pad (flush at y = 0.02m)
  b.addBox(0, -0.08, -2, 30, 0.2, 30, 'pale_concrete', {
    castShadow: false,
    receiveShadow: true,
    collide: false,
    blocksBullets: true,
  });

  // Recessed cable trenches crossing the courtyard (visual detail flush with pad)
  b.addBox(0, 0.025, -2, 28, 0.02, 0.9, 'steel_dark', { collide: false });
  b.addBox(0, 0.025, -2, 0.9, 0.02, 28, 'steel_dark', { collide: false });
  b.addBox(-9, 0.03, -2, 2.2, 0.02, 0.95, 'hazard_stripes', { collide: false });
  b.addBox(9, 0.03, -2, 2.2, 0.02, 0.95, 'hazard_stripes', { collide: false });
  b.addBox(0, 0.03, -10, 0.95, 0.02, 2.2, 'hazard_stripes', { collide: false });
  b.addBox(0, 0.03, 6, 0.95, 0.02, 2.2, 'hazard_stripes', { collide: false });

  // Outer perimeter containment cliffs and facility perimeter walls
  // North boundary wall (behind overlook & solar yard)
  b.addBox(0, 4.0, -32.5, 76, 8.0, 1.5, 'pale_concrete');
  b.addBox(-28, 6.5, -34.5, 24, 13.0, 4.0, 'sandstone_rock');
  b.addBox(28, 6.5, -34.5, 24, 13.0, 4.0, 'sandstone_rock');

  // South boundary canyon cliff wall
  b.addBox(0, 6.0, 32.5, 78, 12.0, 3.0, 'sandstone_rock');
  b.addBox(-22, 8.5, 34.0, 28, 17.0, 4.0, 'sandstone_rock');
  b.addBox(20, 9.0, 34.0, 30, 18.0, 4.0, 'sandstone_rock');

  // West boundary wall & sandstone buttresses
  b.addBox(-37.5, 4.5, 0, 1.5, 9.0, 66, 'pale_concrete');
  b.addBox(-39.0, 7.0, 18, 4.0, 14.0, 30, 'sandstone_rock');
  b.addBox(-39.0, 6.0, -20, 4.0, 12.0, 24, 'sandstone_rock');

  // East boundary wall & sandstone buttresses
  b.addBox(37.5, 4.5, 0, 1.5, 9.0, 66, 'pale_concrete');
  b.addBox(39.0, 7.0, 18, 4.0, 14.0, 30, 'sandstone_rock');
  b.addBox(39.0, 6.0, -20, 4.0, 12.0, 24, 'sandstone_rock');

  // ==========================================================================
  // 2. CENTRAL LANDMARK: DEEP-SPACE PARABOLIC DISH & RELAY TOWER
  // ==========================================================================
  // Octagonal-style stepped concrete & dark steel foundation pedestal at (0, floor, -2)
  b.addBox(0, 1.1, -2, 6.2, 2.2, 6.2, 'pale_concrete');
  b.addBox(0, 2.25, -2, 6.4, 0.14, 6.4, 'hazard_stripes', { collide: false });
  b.addBox(0, 3.4, -2, 3.8, 2.4, 3.8, 'steel_dark');

  // Corner structural buttress fins on pedestal
  b.addBox(-3.2, 1.0, -2, 0.6, 2.0, 3.2, 'steel_dark');
  b.addBox(3.2, 1.0, -2, 0.6, 2.0, 3.2, 'steel_dark');
  b.addBox(0, 1.0, -5.2, 3.2, 2.0, 0.6, 'steel_dark');
  b.addBox(0, 1.0, 1.2, 3.2, 2.0, 0.6, 'steel_dark');

  // Rotating Azimuth & Parabolic Dish Assembly (high above player heads)
  const dishPivot = new THREE.Group();
  dishPivot.position.set(0, 4.6, -2);
  b.rootGroup.add(dishPivot);

  // Yoke arms
  const yokeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.9, 1.2, 12),
    materials.get('steel_dark')
  );
  yokeBase.castShadow = true;
  dishPivot.add(yokeBase);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.4, 0.8), materials.get('steel_dark'));
  leftArm.position.set(-1.5, 2.0, 0);
  leftArm.castShadow = true;
  dishPivot.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.4, 0.8), materials.get('steel_dark'));
  rightArm.position.set(1.5, 2.0, 0);
  rightArm.castShadow = true;
  dishPivot.add(rightArm);

  // Tilted Dish Group
  const dishHead = new THREE.Group();
  dishHead.position.set(0, 3.4, 0);
  dishHead.rotation.x = -0.58; // Angled skyward
  dishPivot.add(dishHead);

  // Multi-ring parabolic dish reflector
  const innerDish = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 1.4, 1.2, 20),
    materials.get('pale_concrete')
  );
  innerDish.position.set(0, 0.8, 0);
  innerDish.castShadow = true;
  dishHead.add(innerDish);

  const outerDish = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 3.8, 1.6, 24, 1, true),
    materials.get('metal_galvanized')
  );
  outerDish.position.set(0, 1.9, 0);
  outerDish.castShadow = true;
  dishHead.add(outerDish);

  const dishRim = new THREE.Mesh(
    new THREE.CylinderGeometry(7.0, 6.8, 0.35, 24, 1, true),
    materials.get('steel_dark')
  );
  dishRim.position.set(0, 2.75, 0);
  dishHead.add(dishRim);

  // Feedhorn central spire & sub-reflector
  const feedSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.35, 5.2, 10),
    materials.get('steel_dark')
  );
  feedSpire.position.set(0, 3.4, 0);
  dishHead.add(feedSpire);

  const subReflector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.5, 0.45, 12),
    materials.get('hazard_stripes')
  );
  subReflector.position.set(0, 5.9, 0);
  dishHead.add(subReflector);

  const beaconTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    materials.get('emissive_red')
  );
  beaconTip.position.set(0, 6.3, 0);
  dishHead.add(beaconTip);

  b.animatedObjects.push((dt, elapsed) => {
    dishPivot.rotation.y += dt * 0.14;
    dishHead.rotation.x = -0.58 + Math.sin(elapsed * 0.35) * 0.06;
  });

  // ==========================================================================
  // 3. RELAY COURTYARD COVER & COOLING BANKS
  // ==========================================================================
  // Symmetrical cooling unit banks in courtyard quadrants
  const coolingCoords: Array<[number, number]> = [
    [-8.5, -8.5],
    [8.5, -8.5],
    [-8.5, 4.5],
    [8.5, 4.5],
  ];
  for (const [cx, cz] of coolingCoords) {
    b.addBox(cx, 1.05, cz, 3.2, 2.1, 1.8, 'metal_galvanized');
    b.addBox(cx, 2.16, cz, 3.3, 0.12, 1.9, 'steel_dark', { collide: false });
    b.addBox(cx, 0.5, cz + 0.94, 2.6, 0.7, 0.06, 'steel_dark', { collide: false });
    b.addBox(cx, 0.5, cz - 0.94, 2.6, 0.7, 0.06, 'steel_dark', { collide: false });
    // Rotating top fan blades
    const fanGroup = new THREE.Group();
    fanGroup.position.set(cx, 2.24, cz);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.22), materials.get('steel_dark'));
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 1.3), materials.get('steel_dark'));
    fanGroup.add(blade1, blade2);
    b.rootGroup.add(fanGroup);
    b.animatedObjects.push((dt) => {
      fanGroup.rotation.y += dt * 5.5;
    });
  }

  // Waist-high tactical cover blocks around the central dish & courtyard approaches
  b.addTacticalCoverBlock(-5.8, 0, -2.0, 1.2, 3.2, 'pale_concrete', true);
  b.addTacticalCoverBlock(5.8, 0, -2.0, 1.2, 3.2, 'pale_concrete', true);
  b.addTacticalCoverBlock(0, 0, -8.2, 3.4, 1.1, 'pale_concrete', true);
  b.addTacticalCoverBlock(0, 0, 4.4, 3.4, 1.1, 'pale_concrete', true);

  b.addTacticalCoverBlock(-12.2, 0, -2.0, 1.1, 2.8, 'concrete_wall', true);
  b.addTacticalCoverBlock(12.2, 0, -2.0, 1.1, 2.8, 'concrete_wall', true);
  b.addTacticalCoverBlock(-4.5, 0, 9.5, 2.6, 1.1, 'pale_concrete', false);
  b.addTacticalCoverBlock(4.5, 0, 9.5, 2.6, 1.1, 'pale_concrete', false);

  // ==========================================================================
  // 4. WEST & EAST SIGNAL PROCESSING BUILDINGS (INDOOR WINGS)
  // ==========================================================================
  const bldgH = 4.2;
  const wallT = 0.4;

  // --- WEST SIGNAL PROCESSING BUILDING (X: -28 to -16, Z: -11 to +9) ---
  // Interior floor tile
  b.addBox(-22, 0.02, -1, 11.8, 0.04, 19.8, 'interior_floor', { collide: false });
  // Roof slab + rooftop AC details
  b.addBox(-22, bldgH + 0.2, -1, 12.4, 0.4, 20.4, 'pale_concrete');
  b.addBox(-22, bldgH + 1.0, -4, 3.2, 1.2, 4.0, 'metal_galvanized');
  b.addPipeRun(-22, bldgH + 0.6, 2, 8.0, 'z', 0.18, 'metal_galvanized');
  // Register indoor zone for West Building
  b.addIndoorZone(-28, 0, -11, -16, bldgH, 9);

  // West building walls with doorways:
  // East wall (courtyard side, X = -16, length = 20): two doorways or central doorway
  b.addWallWithDoorway(-16, 0, -6, 10, bldgH, wallT, 'z', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');
  b.addWallWithDoorway(-16, 0, 4, 10, bldgH, wallT, 'z', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');
  // West wall (spawn side, X = -28, length = 20)
  b.addWallWithDoorway(-28, 0, -1, 20, bldgH, wallT, 'z', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');
  // North wall (Z = -11, length = 12)
  b.addWallWithDoorway(-22, 0, -11, 12, bldgH, wallT, 'x', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');
  // South wall (Z = +9, length = 12)
  b.addWallWithDoorway(-22, 0, 9, 12, bldgH, wallT, 'x', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');

  // West building interior server racks & consoles
  b.addBox(-22, 1.2, -5.5, 1.6, 2.4, 3.6, 'steel_dark');
  b.addBox(-21.18, 1.5, -5.5, 0.05, 1.4, 2.8, 'emissive_cyan', { collide: false });
  b.addBox(-22, 1.2, 3.5, 1.6, 2.4, 3.6, 'steel_dark');
  b.addBox(-21.18, 1.5, 3.5, 0.05, 1.4, 2.8, 'emissive_amber', { collide: false });
  b.addTacticalCoverBlock(-22, 0, -1.0, 2.4, 1.1, 'steel_dark', true);
  b.addWorkLight(-22, bldgH - 0.15, -5.5, 0xffaa44, 2.8, 14, true);
  b.addWorkLight(-22, bldgH - 0.15, 3.5, 0x66e0ff, 2.4, 14, false);

  // --- EAST COMMS OPERATIONS BUILDING (X: +16 to +28, Z: -11 to +9) ---
  b.addBox(22, 0.02, -1, 11.8, 0.04, 19.8, 'interior_floor', { collide: false });
  b.addBox(22, bldgH + 0.2, -1, 12.4, 0.4, 20.4, 'pale_concrete');
  b.addBox(22, bldgH + 1.0, 3, 3.2, 1.2, 4.0, 'metal_galvanized');
  b.addPipeRun(22, bldgH + 0.6, -3, 8.0, 'z', 0.18, 'metal_galvanized');
  b.addIndoorZone(16, 0, -11, 28, bldgH, 9);

  // West wall (courtyard side, X = +16, length = 20)
  b.addWallWithDoorway(16, 0, -6, 10, bldgH, wallT, 'z', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');
  b.addWallWithDoorway(16, 0, 4, 10, bldgH, wallT, 'z', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');
  // East wall (spawn side, X = +28, length = 20)
  b.addWallWithDoorway(28, 0, -1, 20, bldgH, wallT, 'z', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');
  // North wall (Z = -11, length = 12)
  b.addWallWithDoorway(22, 0, -11, 12, bldgH, wallT, 'x', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');
  // South wall (Z = +9, length = 12)
  b.addWallWithDoorway(22, 0, 9, 12, bldgH, wallT, 'x', 0, 2.4, 2.55, 'pale_concrete', 'steel_dark');

  // East building interior server racks & consoles
  b.addBox(22, 1.2, -5.5, 1.6, 2.4, 3.6, 'steel_dark');
  b.addBox(21.18, 1.5, -5.5, 0.05, 1.4, 2.8, 'emissive_cyan', { collide: false });
  b.addBox(22, 1.2, 3.5, 1.6, 2.4, 3.6, 'steel_dark');
  b.addBox(21.18, 1.5, 3.5, 0.05, 1.4, 2.8, 'emissive_amber', { collide: false });
  b.addTacticalCoverBlock(22, 0, -1.0, 2.4, 1.1, 'steel_dark', true);
  b.addWorkLight(22, bldgH - 0.15, -5.5, 0xffaa44, 2.8, 14, true);
  b.addWorkLight(22, bldgH - 0.15, 3.5, 0x66e0ff, 2.4, 14, false);

  // ==========================================================================
  // 5. NORTH RIDGE ELEVATED OVERLOOK (y = 3.0m) & DUAL STAIRCASES
  // ==========================================================================
  const platY = 3.0;
  // Main raised platform (X: -13 to +13, Z: -25 to -17)
  b.addBox(0, platY / 2, -21, 26, platY, 8.0, 'pale_concrete');
  b.addBox(0, platY - 0.06, -16.95, 26.1, 0.14, 0.18, 'hazard_stripes', { collide: false });

  // Two walkable staircases leading up to the North Overlook:
  // West Staircase: X from -19 to -13 (width 3.2m, length 6.0m, height 3.0m, dir +1 along X)
  b.addStaircase(-16.0, 0, -21.0, 3.2, 6.0, platY, 'x', 1, 'steel_dark');
  // East Staircase: X from +13 to +19 (width 3.2m, length 6.0m, height 3.0m, dir -1 along X)
  b.addStaircase(16.0, 0, -21.0, 3.2, 6.0, platY, 'x', -1, 'steel_dark');

  // Overlook cover blocks & sightline dividers (provides cover over courtyard, but flanked from sides)
  b.addTacticalCoverBlock(-7.5, platY, -17.5, 4.2, 0.9, 'pale_concrete', true);
  b.addTacticalCoverBlock(0, platY, -17.5, 3.8, 0.9, 'steel_dark', true);
  b.addTacticalCoverBlock(7.5, platY, -17.5, 4.2, 0.9, 'pale_concrete', true);

  // Overhead sun-canopy & telemetry mast on the North Overlook
  b.addBox(-10, platY + 1.6, -23.5, 0.45, 3.2, 0.45, 'steel_dark');
  b.addBox(0, platY + 1.6, -23.5, 0.45, 3.2, 0.45, 'steel_dark');
  b.addBox(10, platY + 1.6, -23.5, 0.45, 3.2, 0.45, 'steel_dark');
  b.addBox(0, platY + 3.3, -21.5, 22, 0.25, 5.2, 'steel_dark');
  // Telemetry antenna mast atop canopy
  b.addPipeRun(-6, platY + 6.5, -23.5, 6.2, 'y', 0.12, 'metal_galvanized');
  b.addPipeRun(6, platY + 5.8, -23.5, 4.8, 'y', 0.10, 'metal_galvanized');

  // Background Solar Array Panels behind the North Overlook (Z = -28.5)
  for (const sx of [-22, -14, -6, 6, 14, 22]) {
    b.addBox(sx, 1.2, -28.5, 0.35, 2.4, 0.35, 'steel_dark');
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.12, 2.8),
      materials.get('container_blue')
    );
    panel.position.set(sx, 2.4, -28.5);
    panel.rotation.x = 0.45;
    panel.castShadow = true;
    b.rootGroup.add(panel);
  }

  // ==========================================================================
  // 6. SOUTH ROCK-CUT CANYON FLANK (STEPPED SANDSTONE FORMATIONS)
  // ==========================================================================
  // Divides the south lane (Z: +12 to +31) from the central courtyard with natural canyon gaps
  // West Canyon Spire & Multi-Tiered Stepped Ledges
  b.addBox(-9.5, 1.4, 16.5, 8.2, 2.8, 5.2, 'sandstone_rock');
  b.addBox(-9.2, 3.4, 16.8, 6.4, 2.2, 4.0, 'sandstone_rock');
  b.addBox(-9.8, 5.1, 17.1, 4.2, 1.6, 2.8, 'sandstone_rock');
  b.addBox(-12.5, 1.1, 15.5, 3.4, 2.2, 3.0, 'sandstone_rock');
  b.addBox(-6.2, 0.85, 15.8, 2.4, 1.7, 2.6, 'sandstone_rock');

  // East Canyon Spire & Multi-Tiered Stepped Ledges
  b.addBox(9.5, 1.4, 16.5, 8.2, 2.8, 5.2, 'sandstone_rock');
  b.addBox(9.2, 3.4, 16.8, 6.4, 2.2, 4.0, 'sandstone_rock');
  b.addBox(9.8, 5.1, 17.1, 4.2, 1.6, 2.8, 'sandstone_rock');
  b.addBox(12.5, 1.1, 15.5, 3.4, 2.2, 3.0, 'sandstone_rock');
  b.addBox(6.2, 0.85, 15.8, 2.4, 1.7, 2.6, 'sandstone_rock');

  // Central Canyon Split Rock (creates two narrow canyon passages and cover pockets)
  b.addBox(0, 1.3, 23.5, 6.8, 2.6, 4.0, 'sandstone_rock');
  b.addBox(-0.6, 3.1, 23.8, 4.8, 1.6, 2.8, 'sandstone_rock');
  b.addBox(0.8, 4.3, 23.9, 2.8, 1.2, 1.8, 'sandstone_rock');

  // Stepped sandstone cliff terraces along the south canyon wall
  b.addBox(-18, 1.4, 29.2, 10.5, 2.8, 3.8, 'sandstone_rock');
  b.addBox(-19, 3.4, 30.2, 8.0, 2.2, 2.6, 'sandstone_rock');
  b.addBox(18, 1.4, 29.2, 10.5, 2.8, 3.8, 'sandstone_rock');
  b.addBox(19, 3.4, 30.2, 8.0, 2.2, 2.6, 'sandstone_rock');
  b.addBox(0, 1.8, 30.2, 14.0, 3.6, 2.8, 'sandstone_rock');
  b.addBox(0, 4.4, 31.0, 10.5, 2.4, 2.2, 'sandstone_rock');

  // Canyon tactical cover boulders, comms relay boxes & supply crates
  b.addTacticalCoverBlock(-5.2, 0, 22.0, 2.0, 1.4, 'sandstone_rock', false);
  b.addTacticalCoverBlock(5.2, 0, 22.0, 2.0, 1.4, 'sandstone_rock', false);
  b.addBox(-15.5, 0.65, 22.5, 1.5, 1.3, 1.5, 'wood_crate');
  b.addBox(15.5, 0.65, 22.5, 1.5, 1.3, 1.5, 'wood_crate');
  b.addBox(-2.2, 0.6, 21.2, 1.1, 1.2, 0.9, 'steel_dark');
  b.addBox(2.2, 0.6, 21.2, 1.1, 1.2, 0.9, 'steel_dark');

  // ==========================================================================
  // 7. SPAWN YARDS, UTILITY ROVER PROP, & DISTANT MESA SCENERY
  // ==========================================================================
  // West Spawn Yard (Aegis) cover & shipping container
  b.addShippingContainer(-32.5, 0, -12.0, 'z', 'container_ochre');
  b.addTacticalCoverBlock(-31.5, 0, 6.0, 1.4, 3.4, 'pale_concrete', true);
  b.addBox(-33.0, 0.7, 13.5, 1.6, 1.4, 1.6, 'wood_crate');

  // Desert Utility Rover / Comms Truck built from primitives at (-24, 0, -21)
  const rx = -25.0;
  const rz = -19.5;
  b.addBox(rx, 0.75, rz, 4.6, 0.9, 2.2, 'steel_dark'); // chassis
  b.addBox(rx + 1.1, 1.55, rz, 2.0, 1.1, 2.1, 'container_ochre'); // cab
  b.addBox(rx + 2.12, 1.6, rz, 0.08, 0.65, 1.8, 'tinted_glass', { collide: false }); // windshield
  b.addBox(rx - 1.2, 1.45, rz, 2.2, 0.8, 2.0, 'metal_galvanized'); // comms bed module
  // 4 Wheels
  b.addBox(rx + 1.4, 0.45, rz + 1.15, 0.9, 0.9, 0.35, 'steel_dark', { collide: false });
  b.addBox(rx + 1.4, 0.45, rz - 1.15, 0.9, 0.9, 0.35, 'steel_dark', { collide: false });
  b.addBox(rx - 1.4, 0.45, rz + 1.15, 0.9, 0.9, 0.35, 'steel_dark', { collide: false });
  b.addBox(rx - 1.4, 0.45, rz - 1.15, 0.9, 0.9, 0.35, 'steel_dark', { collide: false });

  // East Spawn Yard (Kestrel) cover & shipping container
  b.addShippingContainer(32.5, 0, 12.0, 'z', 'container_slate');
  b.addTacticalCoverBlock(31.5, 0, -6.0, 1.4, 3.4, 'pale_concrete', true);
  b.addBox(33.0, 0.7, -14.5, 1.6, 1.4, 1.6, 'wood_crate');

  // Mobile Generator Trailer in East Yard (25.0, 0, 19.5)
  b.addBox(25.0, 1.05, 19.5, 4.2, 1.7, 2.1, 'container_ochre');
  b.addBox(25.0, 2.0, 19.5, 3.8, 0.2, 1.9, 'steel_dark', { collide: false });
  b.addPipeRun(23.5, 2.4, 19.5, 1.2, 'y', 0.14, 'steel_dark');

  // Distant Sandstone Mesa Buttes outside the arena (visual horizon silhouettes)
  b.addBox(-62, 14, -45, 32, 28, 24, 'sandstone_rock', { collide: false, blocksBullets: false });
  b.addBox(-62, 29, -45, 22, 6, 16, 'sandstone_rock', { collide: false, blocksBullets: false });
  b.addBox(58, 16, -48, 36, 32, 26, 'sandstone_rock', { collide: false, blocksBullets: false });
  b.addBox(64, 15, 42, 30, 30, 28, 'sandstone_rock', { collide: false, blocksBullets: false });
  b.addBox(-56, 12, 46, 28, 24, 22, 'sandstone_rock', { collide: false, blocksBullets: false });

  // ==========================================================================
  // 8. SPAWN POINTS (16 Spawns: Aegis West, Kestrel East, & Multi-Zone FFA)
  // ==========================================================================
  // Team Aegis (West Sector)
  b.addSpawn('ms_sp_aegis_1', -33.5, 0, -2.0, 0, 'aegis', 'West Comms Yard');
  b.addSpawn('ms_sp_aegis_2', -34.0, 0, 4.0, 0, 'aegis', 'West Comms Yard');
  b.addSpawn('ms_sp_aegis_3', -31.0, 0, -21.0, 0.3, 'aegis', 'North-West Rover Pad');
  b.addSpawn('ms_sp_aegis_4', -30.5, 0, 19.0, -0.3, 'aegis', 'South-West Canyon Mouth');
  b.addSpawn('ms_sp_aegis_5', -25.0, 0, -1.0, 0, 'aegis', 'West Signal Building');
  b.addSpawn('ms_sp_aegis_6', -22.0, 0, -15.5, 0.5, 'aegis', 'West Overlook Approach');

  // Team Kestrel (East Sector)
  b.addSpawn('ms_sp_kestrel_1', 33.5, 0, -2.0, Math.PI, 'kestrel', 'East Operations Yard');
  b.addSpawn('ms_sp_kestrel_2', 34.0, 0, -10.0, Math.PI, 'kestrel', 'East Operations Yard');
  b.addSpawn('ms_sp_kestrel_3', 31.0, 0, -21.0, Math.PI - 0.3, 'kestrel', 'North-East Array Pad');
  b.addSpawn('ms_sp_kestrel_4', 30.5, 0, 24.0, -Math.PI + 0.3, 'kestrel', 'South-East Canyon Mouth');
  b.addSpawn('ms_sp_kestrel_5', 25.0, 0, -1.0, Math.PI, 'kestrel', 'East Comms Building');
  b.addSpawn('ms_sp_kestrel_6', 22.0, 0, -15.5, Math.PI - 0.5, 'kestrel', 'East Overlook Approach');

  // Neutral / FFA Distributed Spawns
  b.addSpawn('ms_sp_any_1', 0, 3.0, -21.0, Math.PI, 'any', 'North Overlook');
  b.addSpawn('ms_sp_any_2', -5.0, 0, 18.0, 0, 'any', 'South Canyon Pass');
  b.addSpawn('ms_sp_any_3', 5.0, 0, 18.0, Math.PI, 'any', 'South Canyon Pass');
  b.addSpawn('ms_sp_any_4', 0, 0, -13.0, 0, 'any', 'North Courtyard');

  // ==========================================================================
  // 9. NAVIGATION WAYPOINT GRAPH (28 Interconnected Nodes)
  // ==========================================================================
  // West Yard
  b.addWaypoint('ms_w_yard_n', -31, 0, -18, ['ms_w_yard_c', 'ms_n_stair_w', 'ms_w_bldg_n'], 'route', 'West Comms Yard');
  b.addWaypoint('ms_w_yard_c', -32, 0, -1, ['ms_w_yard_n', 'ms_w_yard_s', 'ms_w_bldg_c'], 'route', 'West Comms Yard');
  b.addWaypoint('ms_w_yard_s', -31, 0, 17, ['ms_w_yard_c', 'ms_w_bldg_s', 'ms_canyon_w'], 'route', 'West Comms Yard');

  // West Building Interior & Exits
  b.addWaypoint('ms_w_bldg_n', -22, 0, -13.5, ['ms_w_yard_n', 'ms_w_bldg_c', 'ms_n_stair_w', 'ms_court_nw'], 'route', 'West Signal Building');
  b.addWaypoint('ms_w_bldg_c', -22, 0, -1, ['ms_w_yard_c', 'ms_w_bldg_n', 'ms_w_bldg_s', 'ms_court_w1', 'ms_court_w2'], 'choke', 'West Signal Building');
  b.addWaypoint('ms_w_bldg_s', -22, 0, 12, ['ms_w_yard_s', 'ms_w_bldg_c', 'ms_canyon_w', 'ms_court_sw'], 'route', 'West Signal Building');

  // North Elevated Overlook & Stairs
  b.addWaypoint('ms_n_stair_w', -20, 0, -21, ['ms_w_yard_n', 'ms_w_bldg_n', 'ms_overlook_w'], 'choke', 'North Overlook Stairs');
  b.addWaypoint('ms_overlook_w', -8, 3.0, -20.5, ['ms_n_stair_w', 'ms_overlook_c'], 'overlook', 'North Overlook');
  b.addWaypoint('ms_overlook_c', 0, 3.0, -20.5, ['ms_overlook_w', 'ms_overlook_e'], 'overlook', 'North Overlook');
  b.addWaypoint('ms_overlook_e', 8, 3.0, -20.5, ['ms_overlook_c', 'ms_n_stair_e'], 'overlook', 'North Overlook');
  b.addWaypoint('ms_n_stair_e', 20, 0, -21, ['ms_overlook_e', 'ms_e_bldg_n', 'ms_e_yard_n'], 'choke', 'North Overlook Stairs');

  // Relay Courtyard (Central Dish Ring)
  b.addWaypoint('ms_court_nw', -12, 0, -12, ['ms_w_bldg_n', 'ms_court_w1', 'ms_court_n'], 'route', 'Relay Courtyard');
  b.addWaypoint('ms_court_w1', -13.5, 0, -6, ['ms_w_bldg_c', 'ms_court_nw', 'ms_court_w2', 'ms_dish_w'], 'cover', 'Relay Courtyard');
  b.addWaypoint('ms_court_w2', -13.5, 0, 4, ['ms_w_bldg_c', 'ms_court_w1', 'ms_court_sw', 'ms_dish_w'], 'cover', 'Relay Courtyard');
  b.addWaypoint('ms_court_sw', -12, 0, 10, ['ms_w_bldg_s', 'ms_court_w2', 'ms_court_s', 'ms_canyon_w'], 'route', 'Relay Courtyard');

  b.addWaypoint('ms_court_n', 0, 0, -12.5, ['ms_court_nw', 'ms_court_ne', 'ms_dish_n'], 'route', 'Relay Courtyard');
  b.addWaypoint('ms_dish_n', 0, 0, -6.5, ['ms_court_n', 'ms_dish_w', 'ms_dish_e'], 'objective', 'Central Relay Dish');
  b.addWaypoint('ms_dish_w', -4.5, 0, -2, ['ms_court_w1', 'ms_court_w2', 'ms_dish_n', 'ms_dish_s'], 'objective', 'Central Relay Dish');
  b.addWaypoint('ms_dish_e', 4.5, 0, -2, ['ms_court_e1', 'ms_court_e2', 'ms_dish_n', 'ms_dish_s'], 'objective', 'Central Relay Dish');
  b.addWaypoint('ms_dish_s', 0, 0, 2.8, ['ms_dish_w', 'ms_dish_e', 'ms_court_s'], 'objective', 'Central Relay Dish');
  b.addWaypoint('ms_court_s', 0, 0, 10.5, ['ms_dish_s', 'ms_court_sw', 'ms_court_se', 'ms_canyon_c'], 'route', 'Relay Courtyard');

  b.addWaypoint('ms_court_ne', 12, 0, -12, ['ms_e_bldg_n', 'ms_court_e1', 'ms_court_n'], 'route', 'Relay Courtyard');
  b.addWaypoint('ms_court_e1', 13.5, 0, -6, ['ms_e_bldg_c', 'ms_court_ne', 'ms_court_e2', 'ms_dish_e'], 'cover', 'Relay Courtyard');
  b.addWaypoint('ms_court_e2', 13.5, 0, 4, ['ms_e_bldg_c', 'ms_court_e1', 'ms_court_se', 'ms_dish_e'], 'cover', 'Relay Courtyard');
  b.addWaypoint('ms_court_se', 12, 0, 10, ['ms_e_bldg_s', 'ms_court_e2', 'ms_court_s', 'ms_canyon_e'], 'route', 'Relay Courtyard');

  // South Rock-Cut Canyon Flank
  b.addWaypoint('ms_canyon_w', -15, 0, 19, ['ms_w_yard_s', 'ms_w_bldg_s', 'ms_court_sw', 'ms_canyon_c'], 'choke', 'South Sandstone Canyon');
  b.addWaypoint('ms_canyon_c', 0, 0, 18.5, ['ms_canyon_w', 'ms_canyon_e', 'ms_court_s'], 'cover', 'South Sandstone Canyon');
  b.addWaypoint('ms_canyon_e', 15, 0, 19, ['ms_canyon_c', 'ms_court_se', 'ms_e_bldg_s', 'ms_e_yard_s'], 'choke', 'South Sandstone Canyon');

  // East Building Interior & Exits
  b.addWaypoint('ms_e_bldg_n', 22, 0, -13.5, ['ms_e_yard_n', 'ms_e_bldg_c', 'ms_n_stair_e', 'ms_court_ne'], 'route', 'East Comms Building');
  b.addWaypoint('ms_e_bldg_c', 22, 0, -1, ['ms_e_yard_c', 'ms_e_bldg_n', 'ms_e_bldg_s', 'ms_court_e1', 'ms_court_e2'], 'choke', 'East Comms Building');
  b.addWaypoint('ms_e_bldg_s', 22, 0, 12, ['ms_e_yard_s', 'ms_e_bldg_c', 'ms_canyon_e', 'ms_court_se'], 'route', 'East Comms Building');

  // East Yard
  b.addWaypoint('ms_e_yard_n', 31, 0, -18, ['ms_e_yard_c', 'ms_n_stair_e', 'ms_e_bldg_n'], 'route', 'East Operations Yard');
  b.addWaypoint('ms_e_yard_c', 32, 0, -1, ['ms_e_yard_n', 'ms_e_yard_s', 'ms_e_bldg_c'], 'route', 'East Operations Yard');
  b.addWaypoint('ms_e_yard_s', 31, 0, 17, ['ms_e_yard_c', 'ms_e_bldg_s', 'ms_canyon_e'], 'route', 'East Operations Yard');

  return {
    config,
    rootGroup: b.rootGroup,
    colliders: b.colliders,
    raycastMeshes: b.raycastMeshes,
    spawnPoints: b.spawnPoints,
    waypoints: b.waypoints,
    animatedObjects: b.animatedObjects,
    indoorZones: b.indoorZones,
    dispose: () => {
      b.rootGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    },
  };
}
