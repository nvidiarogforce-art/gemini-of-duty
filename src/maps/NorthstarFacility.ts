import * as THREE from 'three';
import { BuiltMapData, MapEnvironmentConfig } from '../types/contracts';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { MapBuilder } from './MapBuilder';

/**
 * MAP 3: NORTHSTAR FACILITY ("northstar")
 * Cold-weather Arctic cryo-research and meteorological radar complex with snow-covered
 * exterior yards, warm occupied laboratory interiors, and an elevated skybridge.
 * Dimensions: ~76m (X: -38 to +38) x 66m (Z: -33 to +33)
 */
export function buildNorthstarFacility(materials: MaterialLibrary): BuiltMapData {
  const b = new MapBuilder(materials);

  const config: MapEnvironmentConfig = {
    id: 'northstar',
    name: 'NORTHSTAR FACILITY',
    subtitle: 'Arctic Cryo-Research & Radar Complex',
    locationLabel: 'SECTOR 14 // SVALBARD HIGHLANDS',
    timeOfDayLabel: '09:15 LOCAL // POLAR TWILIGHT',
    tacticalBrief:
      'Sub-zero research compound contrasting a windswept snow service yard with warm, illuminated laboratories and an elevated heated skybridge around the central Cryo-Radar Core.',
    ambientAudioType: 'arctic_facility',
    skyTopColor: 0x1e354d,
    skyHorizonColor: 0x9ab8d4,
    groundColor: 0xc8d8e8,
    fogColor: 0xa8c2dc,
    fogDensity: 0.0085,
    sunColor: 0xd8ecff,
    sunIntensity: 2.5,
    sunDirection: [-32, 28, -36],
    hemiSkyColor: 0xa6c8e8,
    hemiGroundColor: 0x5c728a,
    hemiIntensity: 0.9,
    exposure: 1.02,
    previewAccentColor: '#58b8ff',
  };

  // ==========================================================================
  // 1. SNOW GROUND, CLEARED FROSTY ASPHALT PATHS, & PERIMETER (~76m x 66m)
  // ==========================================================================
  // Base snow ground
  b.addBox(0, -0.5, 0, 90, 1.0, 80, 'snow_ground', {
    castShadow: false,
    receiveShadow: true,
    collide: true,
    blocksBullets: true,
    blocksSight: true,
  });

  // Cleared frosted asphalt service roads & central plaza pad (flush at y = 0.02m)
  b.addBox(0, -0.08, 2, 34, 0.2, 26, 'frosted_asphalt', {
    castShadow: false,
    receiveShadow: true,
    collide: false,
    blocksBullets: true,
  });
  // East-West cleared asphalt logistics road in South Service Yard
  b.addBox(0, -0.08, 17, 68, 0.2, 11, 'frosted_asphalt', {
    castShadow: false,
    receiveShadow: true,
    collide: false,
    blocksBullets: true,
  });
  // West & East approach asphalt pads
  b.addBox(-28, -0.08, 0, 16, 0.2, 32, 'frosted_asphalt', {
    castShadow: false,
    receiveShadow: true,
    collide: false,
    blocksBullets: true,
  });
  b.addBox(28, -0.08, 0, 16, 0.2, 32, 'frosted_asphalt', {
    castShadow: false,
    receiveShadow: true,
    collide: false,
    blocksBullets: true,
  });

  // Plausible snow accumulation drifts bordering cleared asphalt roads
  b.addBox(-19, 0.35, 11.5, 6.0, 0.7, 2.8, 'snow_ground');
  b.addBox(19, 0.35, 11.5, 6.0, 0.7, 2.8, 'snow_ground');
  b.addBox(-14, 0.45, 23.5, 7.5, 0.9, 3.2, 'snow_ground');
  b.addBox(14, 0.45, 23.5, 7.5, 0.9, 3.2, 'snow_ground');
  b.addBox(-34, 0.5, -18, 5.0, 1.0, 6.5, 'snow_ground');
  b.addBox(34, 0.5, -18, 5.0, 1.0, 6.5, 'snow_ground');

  // Outer perimeter containment walls & Arctic blast barriers (industrial dark concrete + steel ribs)
  b.addBox(0, 4.5, -33.5, 78, 9.0, 1.5, 'concrete_wall');
  b.addBox(0, 4.5, 33.5, 78, 9.0, 1.5, 'concrete_wall');
  b.addBox(-38.5, 4.5, 0, 1.5, 9.0, 68, 'concrete_wall');
  b.addBox(38.5, 4.5, 0, 1.5, 9.0, 68, 'concrete_wall');

  // Structural dark steel buttress ribs along the perimeter blast walls
  for (let px = -30; px <= 30; px += 12) {
    b.addBox(px, 4.5, -32.6, 0.8, 9.0, 0.6, 'steel_dark', { collide: false });
    b.addBox(px, 4.5, 32.6, 0.8, 9.0, 0.6, 'steel_dark', { collide: false });
  }
  for (let pz = -24; pz <= 24; pz += 12) {
    b.addBox(-37.6, 4.5, pz, 0.6, 9.0, 0.8, 'steel_dark', { collide: false });
    b.addBox(37.6, 4.5, pz, 0.6, 9.0, 0.8, 'steel_dark', { collide: false });
  }

  // Low ground-level snow embankments along outer walls (kept low so vertical walls read as concrete/steel)
  b.addBox(-24, 0.45, 31.8, 22, 0.9, 2.4, 'snow_ground');
  b.addBox(24, 0.45, 31.8, 22, 0.9, 2.4, 'snow_ground');
  b.addBox(-28, 0.4, -31.8, 18, 0.8, 2.2, 'snow_ground');
  b.addBox(28, 0.4, -31.8, 18, 0.8, 2.2, 'snow_ground');

  // ==========================================================================
  // 2. CENTRAL LANDMARK: CRYO-RESEARCH CORE DOME & METEOROLOGICAL RADAR TOWER
  // ==========================================================================
  // Located in central courtyard at (0, floor, 3.5)
  const coreZ = 3.5;
  // Reinforced base containment ring
  b.addBox(0, 1.15, coreZ, 6.0, 2.3, 6.0, 'pale_concrete');
  b.addBox(0, 2.35, coreZ, 6.2, 0.14, 6.2, 'hazard_stripes', { collide: false });
  b.addBox(0, 3.8, coreZ, 4.2, 2.8, 4.2, 'steel_dark');

  // Glowing Cryogenic Coolant Rings around Core Tower
  b.addBox(0, 3.1, coreZ, 4.45, 0.24, 4.45, 'emissive_cyan', { collide: false });
  b.addBox(0, 4.4, coreZ, 4.45, 0.24, 4.45, 'emissive_cyan', { collide: false });

  // Upper Radome & Rotating Meteorological Radar Array
  const radomeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 16),
    materials.get('pale_concrete')
  );
  radomeMesh.position.set(0, 6.6, coreZ);
  radomeMesh.castShadow = true;
  b.rootGroup.add(radomeMesh);

  const radarSpinner = new THREE.Group();
  radarSpinner.position.set(0, 9.5, coreZ);
  b.rootGroup.add(radarSpinner);

  const radarMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 1.6, 10),
    materials.get('steel_dark')
  );
  radarSpinner.add(radarMast);

  const radarBar = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.32, 0.55),
    materials.get('hazard_stripes')
  );
  radarBar.position.set(0, 0.7, 0);
  radarBar.castShadow = true;
  radarSpinner.add(radarBar);

  const radarTipL = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    materials.get('emissive_cyan')
  );
  radarTipL.position.set(-2.7, 0.9, 0);
  const radarTipR = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    materials.get('emissive_red')
  );
  radarTipR.position.set(2.7, 0.9, 0);
  radarSpinner.add(radarTipL, radarTipR);

  b.animatedObjects.push((dt) => {
    radarSpinner.rotation.y += dt * 1.35;
  });

  // Waist-high tactical cover blocks surrounding the Cryo-Research Core
  b.addTacticalCoverBlock(-6.2, 0, coreZ, 1.2, 3.4, 'pale_concrete', true);
  b.addTacticalCoverBlock(6.2, 0, coreZ, 1.2, 3.4, 'pale_concrete', true);
  b.addTacticalCoverBlock(0, 0, coreZ + 5.8, 3.6, 1.2, 'pale_concrete', true);
  b.addTacticalCoverBlock(-10.5, 0, -1.0, 2.6, 1.1, 'steel_dark', true);
  b.addTacticalCoverBlock(10.5, 0, -1.0, 2.6, 1.1, 'steel_dark', true);

  // ==========================================================================
  // 3. RAISED HEATED SKYBRIDGE (y = 3.2m) & DUAL STAIRCASES
  // ==========================================================================
  const bridgeY = 3.2;
  const bridgeZ = -4.2;
  // Main skybridge deck spanning X: -14 to +14 at Z = -4.2
  b.addBox(0, bridgeY - 0.18, bridgeZ, 28.0, 0.36, 4.4, 'steel_dark');
  // Support columns under skybridge (clear for walking underneath)
  b.addBox(-9.5, bridgeY / 2, bridgeZ, 0.7, bridgeY, 0.7, 'steel_dark');
  b.addBox(9.5, bridgeY / 2, bridgeZ, 0.7, bridgeY, 0.7, 'steel_dark');

  // Dual staircases climbing up to the Skybridge:
  // West Staircase: X from -20.4 to -14.0 (length 6.4, width 3.2, height 3.2, dir +1 along X)
  b.addStaircase(-17.2, 0, bridgeZ, 3.2, 6.4, bridgeY, 'x', 1, 'steel_dark');
  // East Staircase: X from +14.0 to +20.4 (length 6.4, width 3.2, height 3.2, dir -1 along X)
  b.addStaircase(17.2, 0, bridgeZ, 3.2, 6.4, bridgeY, 'x', -1, 'steel_dark');

  // Skybridge waist-high guardrails & sightline baffles (prevents total map dominance)
  b.addTacticalCoverBlock(-8.5, bridgeY, bridgeZ + 1.9, 5.2, 0.35, 'steel_dark', true);
  b.addTacticalCoverBlock(0, bridgeY, bridgeZ + 1.9, 4.4, 0.35, 'pale_concrete', true);
  b.addTacticalCoverBlock(8.5, bridgeY, bridgeZ + 1.9, 5.2, 0.35, 'steel_dark', true);

  b.addTacticalCoverBlock(-8.5, bridgeY, bridgeZ - 1.9, 5.2, 0.35, 'steel_dark', false);
  b.addTacticalCoverBlock(8.5, bridgeY, bridgeZ - 1.9, 5.2, 0.35, 'steel_dark', false);

  // Tinted glass windbreaks & overhead heated canopy segments on center of Skybridge
  b.addBox(-3.8, bridgeY + 1.15, bridgeZ + 1.9, 2.2, 2.3, 0.14, 'tinted_glass');
  b.addBox(3.8, bridgeY + 1.15, bridgeZ + 1.9, 2.2, 2.3, 0.14, 'tinted_glass');
  b.addBox(0, bridgeY + 2.85, bridgeZ, 11.0, 0.25, 4.6, 'steel_dark');
  b.addWorkLight(0, bridgeY + 2.65, bridgeZ, 0xffaa44, 2.6, 12, true);

  // ==========================================================================
  // 4. RESEARCH & OPERATIONS BUILDING (NORTH WARM INDOOR LAB COMPLEX)
  // ==========================================================================
  // Spans X: -24 to +24, Z: -27 to -11 (16m deep, 48m wide, split into West Lab, Central Cryo Hall, East Ops)
  const labH = 4.3;
  const wallT = 0.4;

  // Interior floor tile across the entire Research & Operations Building
  b.addBox(0, 0.02, -19, 47.6, 0.04, 15.6, 'interior_floor', { collide: false });
  // Roof slab
  b.addBox(0, labH + 0.2, -19, 48.4, 0.4, 16.4, 'pale_concrete');
  // Register indoor zone so snow particles never enter the laboratory
  b.addIndoorZone(-24, 0, -27, 24, labH, -11);

  // North Exterior Wall (Z = -27, length 48m) with two doorways to North Maintenance Walk
  b.addWallWithDoorway(-16, 0, -27, 16, labH, wallT, 'x', 0, 2.5, 2.55, 'pale_concrete', 'steel_dark');
  b.addBox(0, labH / 2, -27, 16, labH, wallT, 'pale_concrete');
  b.addWallWithDoorway(16, 0, -27, 16, labH, wallT, 'x', 0, 2.5, 2.55, 'pale_concrete', 'steel_dark');

  // West Exterior Wall (X = -24, length 16m) with doorway
  b.addWallWithDoorway(-24, 0, -19, 16, labH, wallT, 'z', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');

  // East Exterior Wall (X = +24, length 16m) with doorway
  b.addWallWithDoorway(24, 0, -19, 16, labH, wallT, 'z', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');

  // South Facade (Z = -11, facing Skybridge & Courtyard):
  // West doorway section (X: -24 to -10)
  b.addWallWithDoorway(-17, 0, -11, 14, labH, wallT, 'x', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');
  // Central Observation Window bay (X: -10 to +10) with waist-high sill, tinted glass window, and central doorway
  b.addWallWithDoorway(0, 0, -11, 8.0, labH, wallT, 'x', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');
  // West observation window (X: -10 to -4)
  b.addBox(-7.0, 0.55, -11, 6.0, 1.1, wallT, 'pale_concrete');
  b.addBox(-7.0, 2.1, -11, 5.8, 2.0, 0.14, 'tinted_glass');
  b.addBox(-7.0, 3.7, -11, 6.0, 1.2, wallT, 'pale_concrete');
  // East observation window (X: +4 to +10)
  b.addBox(7.0, 0.55, -11, 6.0, 1.1, wallT, 'pale_concrete');
  b.addBox(7.0, 2.1, -11, 5.8, 2.0, 0.14, 'tinted_glass');
  b.addBox(7.0, 3.7, -11, 6.0, 1.2, wallT, 'pale_concrete');
  // East doorway section (X: +10 to +24)
  b.addWallWithDoorway(17, 0, -11, 14, labH, wallT, 'x', 0, 2.6, 2.55, 'pale_concrete', 'steel_dark');

  // Architectural dark steel cornice, pilasters, and rooftop penthouse on the Research Building
  b.addBox(0, labH + 0.45, -10.85, 48.6, 0.35, 0.5, 'steel_dark', { collide: false });
  for (const px of [-23.8, -10.2, -3.8, 3.8, 10.2, 23.8]) {
    b.addBox(px, labH / 2, -10.78, 0.45, labH, 0.25, 'steel_dark', { collide: false });
  }
  b.addBox(-14, labH + 1.1, -19, 8.0, 1.6, 6.0, 'steel_dark', { collide: false });
  b.addBox(14, labH + 1.1, -19, 8.0, 1.6, 6.0, 'steel_dark', { collide: false });

  // Interior Partition Walls separating West Lab, Central Cryo Hall, and East Ops (X = -9.5 and X = +9.5)
  b.addWallWithDoorway(-9.5, 0, -19, 16, labH, 0.35, 'z', -2.5, 2.6, 2.55, 'pale_concrete', 'steel_dark');
  b.addWallWithDoorway(9.5, 0, -19, 16, labH, 0.35, 'z', -2.5, 2.6, 2.55, 'pale_concrete', 'steel_dark');

  // Interior Props: Glowing Cyan Cryo-Specimen Tanks, Lab Workstations, & Warm Work Lights
  for (const tx of [-4.2, 4.2]) {
    b.addBox(tx, 0.35, -22.5, 1.8, 0.7, 1.8, 'steel_dark');
    b.addBox(tx, 1.85, -22.5, 1.3, 2.3, 1.3, 'tinted_glass');
    b.addBox(tx, 1.85, -22.5, 0.55, 1.9, 0.55, 'emissive_cyan', { collide: false });
    b.addBox(tx, 3.25, -22.5, 1.8, 0.5, 1.8, 'steel_dark');
  }
  // Lab benches (waist-high cover inside the building)
  b.addTacticalCoverBlock(0, 0, -17.0, 3.8, 1.1, 'steel_dark', false);
  b.addTacticalCoverBlock(-16.5, 0, -18.5, 1.2, 3.8, 'steel_dark', false);
  b.addTacticalCoverBlock(16.5, 0, -18.5, 1.2, 3.8, 'steel_dark', false);

  // Server & telemetry racks along north interior wall
  b.addBox(-19.5, 1.25, -25.8, 3.2, 2.5, 1.2, 'steel_dark');
  b.addBox(-19.5, 1.5, -25.18, 2.6, 0.8, 0.05, 'emissive_amber', { collide: false });
  b.addBox(19.5, 1.25, -25.8, 3.2, 2.5, 1.2, 'steel_dark');
  b.addBox(19.5, 1.5, -25.18, 2.6, 0.8, 0.05, 'emissive_cyan', { collide: false });

  // Warm interior work lights + emergency red light accent
  b.addWorkLight(-16.5, labH - 0.15, -19, 0xffaa44, 3.8, 18, true);
  b.addWorkLight(0, labH - 0.15, -18, 0xffaa44, 4.2, 20, true);
  b.addWorkLight(16.5, labH - 0.15, -19, 0xffaa44, 3.8, 18, true);
  b.addWorkLight(0, labH - 0.15, -25.5, 0xff4433, 2.2, 12, false);

  // ==========================================================================
  // 5. EXTERIOR SERVICE YARD, CONTAINERS, & SNOW-CLEARING VEHICLE PROP
  // ==========================================================================
  // Insulated overhead steam pipe runs crossing between Service Yard & Research Building
  b.addPipeRun(-18, 4.1, -3, 16, 'z', 0.22, 'metal_galvanized');
  b.addPipeRun(-17.4, 4.1, -3, 16, 'z', 0.16, 'metal_galvanized');
  b.addPipeRun(18, 4.1, -3, 16, 'z', 0.22, 'metal_galvanized');
  b.addPipeRun(17.4, 4.1, -3, 16, 'z', 0.16, 'metal_galvanized');

  // Shipping containers in Service Yard & Spawn Approaches (`container_teal`, `container_slate`)
  b.addShippingContainer(-15.5, 0, 15.5, 'x', 'container_teal');
  b.addShippingContainer(15.5, 0, 15.5, 'x', 'container_slate');
  b.addShippingContainer(-29.5, 0, -4.0, 'z', 'container_slate');
  b.addShippingContainer(29.5, 0, -4.0, 'z', 'container_teal');

  // Tracked Arctic Snow-Clearing Vehicle Prop built from primitives at (0, 0, 16.5)
  const px = -1.5;
  const pz = 16.5;
  // Heavy caterpillar tracks
  b.addBox(px, 0.55, pz - 1.15, 4.4, 1.1, 0.65, 'steel_dark');
  b.addBox(px, 0.55, pz + 1.15, 4.4, 1.1, 0.65, 'steel_dark');
  // Main armored chassis & engine hood
  b.addBox(px, 1.15, pz, 4.6, 0.9, 2.1, 'container_teal');
  // Heated operator cab
  b.addBox(px - 0.4, 2.05, pz, 2.2, 1.1, 1.9, 'container_slate');
  b.addBox(px + 0.72, 2.05, pz, 0.08, 0.75, 1.65, 'tinted_glass', { collide: false });
  b.addBox(px - 0.4, 2.68, pz, 0.45, 0.16, 0.8, 'emissive_amber', { collide: false });
  // Angled heavy steel snowplow blade on front (+X side)
  b.addBox(px + 2.8, 0.75, pz, 0.65, 1.35, 3.6, 'steel_dark');
  b.addBox(px + 3.14, 1.32, pz, 0.08, 0.18, 3.62, 'hazard_stripes', { collide: false });

  // Exterior yard waist-high cover & supply crates
  b.addTacticalCoverBlock(-8.0, 0, 15.0, 1.2, 3.0, 'concrete_wall', true);
  b.addTacticalCoverBlock(8.0, 0, 15.0, 1.2, 3.0, 'concrete_wall', true);
  b.addBox(-23.5, 0.65, 17.5, 1.5, 1.3, 1.5, 'wood_crate');
  b.addBox(23.5, 0.65, 17.5, 1.5, 1.3, 1.5, 'wood_crate');

  // ==========================================================================
  // 6. SOUTH MAINTENANCE PASSAGE (HVAC, GENERATORS, & STEAM PIPES)
  // ==========================================================================
  // Enclosed/semi-covered industrial flank along Z: +22 to +31, X: -11 to +11
  b.addBox(0, 1.8, 22.2, 18.0, 3.6, 0.45, 'concrete_wall');
  b.addBox(0, 3.7, 26.8, 20.0, 0.35, 9.6, 'steel_dark'); // overhead utility roof
  b.addIndoorZone(-10, 0, 22.2, 10, 3.7, 31.5);

  // HVAC Units & Backup Diesel Generators inside Maintenance Passage
  b.addBox(-4.8, 1.15, 25.2, 3.2, 2.3, 1.8, 'metal_galvanized');
  b.addBox(4.8, 1.15, 25.2, 3.2, 2.3, 1.8, 'metal_galvanized');
  b.addTacticalCoverBlock(0, 0, 27.5, 2.8, 1.1, 'steel_dark', true);

  // Overhead insulated steam pipes & warm maintenance lighting along passage
  b.addPipeRun(0, 3.25, 24.0, 22.0, 'x', 0.2, 'metal_galvanized');
  b.addPipeRun(0, 3.25, 29.5, 22.0, 'x', 0.16, 'steel_dark');
  b.addWorkLight(-5.0, 3.45, 27.0, 0xffaa44, 2.6, 12, true);
  b.addWorkLight(5.0, 3.45, 27.0, 0x66e0ff, 2.4, 12, false);

  // ==========================================================================
  // 7. DISTANT ARCTIC MOUNTAINS OUTSIDE PERIMETER
  // ==========================================================================
  const mountainSpecs: Array<[number, number, number, number, number]> = [
    [-64, -50, 38, 34, 28],
    [0, -58, 46, 42, 30],
    [64, -50, 38, 36, 28],
    [-66, 46, 36, 30, 26],
    [66, 46, 40, 32, 28],
    [0, 56, 44, 34, 26],
  ];
  for (const [mx, mz, mw, mh, md] of mountainSpecs) {
    // Dark granite cliff base
    b.addBox(mx, mh * 0.35 - 2, mz, mw, mh * 0.7, md, 'concrete_wall', {
      collide: false,
      blocksBullets: false,
      castShadow: false,
    });
    // Snow-capped upper peak
    b.addBox(mx + 2, mh * 0.72, mz - 1, mw * 0.65, mh * 0.45, md * 0.65, 'snow_ground', {
      collide: false,
      blocksBullets: false,
      castShadow: false,
    });
  }

  // ==========================================================================
  // 8. SPAWN POINTS (16 Spawns: Aegis West, Kestrel East, & Multi-Zone FFA)
  // ==========================================================================
  // Team Aegis (West Logistics Sector)
  b.addSpawn('ns_sp_aegis_1', -33.5, 0, 2.0, 0, 'aegis', 'West Helipad Yard');
  b.addSpawn('ns_sp_aegis_2', -33.5, 0, -10.0, 0, 'aegis', 'West Helipad Yard');
  b.addSpawn('ns_sp_aegis_3', -31.5, 0, 17.0, 0.2, 'aegis', 'South-West Service Road');
  b.addSpawn('ns_sp_aegis_4', -29.0, 0, -21.0, 0.3, 'aegis', 'North-West Lab Entrance');
  b.addSpawn('ns_sp_aegis_5', -24.5, 0, 9.0, 0, 'aegis', 'West Container Bay');
  b.addSpawn('ns_sp_aegis_6', -17.0, 0, -22.5, 0, 'aegis', 'West Research Wing');

  // Team Kestrel (East Logistics Sector)
  b.addSpawn('ns_sp_kestrel_1', 33.5, 0, 2.0, Math.PI, 'kestrel', 'East Cryo Staging');
  b.addSpawn('ns_sp_kestrel_2', 33.5, 0, -10.0, Math.PI, 'kestrel', 'East Cryo Staging');
  b.addSpawn('ns_sp_kestrel_3', 31.5, 0, 17.0, Math.PI - 0.2, 'kestrel', 'South-East Service Road');
  b.addSpawn('ns_sp_kestrel_4', 29.0, 0, -21.0, Math.PI - 0.3, 'kestrel', 'North-East Lab Entrance');
  b.addSpawn('ns_sp_kestrel_5', 24.5, 0, 9.0, Math.PI, 'kestrel', 'East Container Bay');
  b.addSpawn('ns_sp_kestrel_6', 17.0, 0, -22.5, Math.PI, 'kestrel', 'East Operations Wing');

  // Neutral / FFA Distributed Spawns
  b.addSpawn('ns_sp_any_1', 0, 3.2, -4.2, Math.PI, 'any', 'Heated Skybridge');
  b.addSpawn('ns_sp_any_2', 0, 0, -14.5, 0, 'any', 'Central Cryo Laboratory');
  b.addSpawn('ns_sp_any_3', 0, 0, 28.5, 0, 'any', 'South Maintenance Passage');
  b.addSpawn('ns_sp_any_4', 4.5, 0, 16.5, Math.PI, 'any', 'Service Yard Snowplow');

  // ==========================================================================
  // 9. NAVIGATION WAYPOINT GRAPH (30 Interconnected Nodes)
  // ==========================================================================
  // West Logistics Yard
  b.addWaypoint('ns_w_yard_n', -29, 0, -19, ['ns_w_yard_c', 'ns_lab_w', 'ns_north_walk_w'], 'route', 'West Helipad Yard');
  b.addWaypoint('ns_w_yard_c', -33, 0, 2, ['ns_w_yard_n', 'ns_w_yard_s', 'ns_stair_w', 'ns_core_w'], 'route', 'West Helipad Yard');
  b.addWaypoint('ns_w_yard_s', -29, 0, 17, ['ns_w_yard_c', 'ns_yard_sw', 'ns_maint_w'], 'route', 'West Helipad Yard');

  // North Perimeter Walk
  b.addWaypoint('ns_north_walk_w', -16, 0, -29.5, ['ns_w_yard_n', 'ns_lab_w', 'ns_north_walk_e'], 'route', 'North Perimeter');
  b.addWaypoint('ns_north_walk_e', 16, 0, -29.5, ['ns_north_walk_w', 'ns_lab_e', 'ns_e_yard_n'], 'route', 'North Perimeter');

  // Research & Operations Building (Indoor Lab)
  b.addWaypoint('ns_lab_w', -16.5, 0, -21.5, ['ns_w_yard_n', 'ns_north_walk_w', 'ns_lab_c', 'ns_plaza_nw'], 'choke', 'West Research Wing');
  b.addWaypoint('ns_lab_c', 0, 0, -21.5, ['ns_lab_w', 'ns_lab_e', 'ns_lab_door_s'], 'objective', 'Central Cryo Laboratory');
  b.addWaypoint('ns_lab_door_s', 0, 0, -13.5, ['ns_lab_c', 'ns_plaza_n'], 'choke', 'Central Cryo Laboratory');
  b.addWaypoint('ns_lab_e', 16.5, 0, -21.5, ['ns_e_yard_n', 'ns_north_walk_e', 'ns_lab_c', 'ns_plaza_ne'], 'choke', 'East Operations Wing');

  // Heated Skybridge (y = 3.2m) & Stairs
  b.addWaypoint('ns_stair_w', -22, 0, -4.2, ['ns_w_yard_c', 'ns_plaza_nw', 'ns_bridge_w'], 'choke', 'West Skybridge Stairs');
  b.addWaypoint('ns_bridge_w', -10, 3.2, -4.2, ['ns_stair_w', 'ns_bridge_c'], 'overlook', 'Heated Skybridge');
  b.addWaypoint('ns_bridge_c', 0, 3.2, -4.2, ['ns_bridge_w', 'ns_bridge_e'], 'overlook', 'Heated Skybridge');
  b.addWaypoint('ns_bridge_e', 10, 3.2, -4.2, ['ns_bridge_c', 'ns_stair_e'], 'overlook', 'Heated Skybridge');
  b.addWaypoint('ns_stair_e', 22, 0, -4.2, ['ns_bridge_e', 'ns_plaza_ne', 'ns_e_yard_c'], 'choke', 'East Skybridge Stairs');

  // Central Radar Core Courtyard
  b.addWaypoint('ns_plaza_nw', -16.5, 0, -8.5, ['ns_lab_w', 'ns_stair_w', 'ns_plaza_n', 'ns_core_w'], 'route', 'Core Plaza');
  b.addWaypoint('ns_plaza_n', 0, 0, -8.5, ['ns_lab_door_s', 'ns_plaza_nw', 'ns_plaza_ne', 'ns_core_n'], 'route', 'Core Plaza');
  b.addWaypoint('ns_plaza_ne', 16.5, 0, -8.5, ['ns_lab_e', 'ns_stair_e', 'ns_plaza_n', 'ns_core_e'], 'route', 'Core Plaza');

  b.addWaypoint('ns_core_n', 0, 0, -1.0, ['ns_plaza_n', 'ns_core_w', 'ns_core_e'], 'objective', 'Cryo-Radar Core');
  b.addWaypoint('ns_core_w', -8.5, 0, 3.5, ['ns_w_yard_c', 'ns_plaza_nw', 'ns_core_n', 'ns_core_s', 'ns_yard_sw'], 'cover', 'Cryo-Radar Core');
  b.addWaypoint('ns_core_e', 8.5, 0, 3.5, ['ns_e_yard_c', 'ns_plaza_ne', 'ns_core_n', 'ns_core_s', 'ns_yard_se'], 'cover', 'Cryo-Radar Core');
  b.addWaypoint('ns_core_s', 0, 0, 8.0, ['ns_core_w', 'ns_core_e', 'ns_yard_c'], 'objective', 'Cryo-Radar Core');

  // Exterior Service Yard (South)
  b.addWaypoint('ns_yard_sw', -11, 0, 16.5, ['ns_w_yard_s', 'ns_core_w', 'ns_yard_c', 'ns_maint_w'], 'cover', 'Service Yard');
  b.addWaypoint('ns_yard_c', 4.5, 0, 16.5, ['ns_core_s', 'ns_yard_sw', 'ns_yard_se'], 'route', 'Service Yard');
  b.addWaypoint('ns_yard_se', 11, 0, 16.5, ['ns_e_yard_s', 'ns_core_e', 'ns_yard_c', 'ns_maint_e'], 'cover', 'Service Yard');

  // South Maintenance Passage
  b.addWaypoint('ns_maint_w', -13, 0, 27.5, ['ns_w_yard_s', 'ns_yard_sw', 'ns_maint_c'], 'choke', 'Maintenance Passage');
  b.addWaypoint('ns_maint_c', 0, 0, 29.0, ['ns_maint_w', 'ns_maint_e'], 'cover', 'Maintenance Passage');
  b.addWaypoint('ns_maint_e', 13, 0, 27.5, ['ns_maint_c', 'ns_yard_se', 'ns_e_yard_s'], 'choke', 'Maintenance Passage');

  // East Logistics Yard
  b.addWaypoint('ns_e_yard_n', 29, 0, -19, ['ns_e_yard_c', 'ns_lab_e', 'ns_north_walk_e'], 'route', 'East Cryo Staging');
  b.addWaypoint('ns_e_yard_c', 33, 0, 2, ['ns_e_yard_n', 'ns_e_yard_s', 'ns_stair_e', 'ns_core_e'], 'route', 'East Cryo Staging');
  b.addWaypoint('ns_e_yard_s', 29, 0, 17, ['ns_e_yard_c', 'ns_yard_se', 'ns_maint_e'], 'route', 'East Cryo Staging');

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
