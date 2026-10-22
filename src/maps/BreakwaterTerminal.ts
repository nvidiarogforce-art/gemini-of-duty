import * as THREE from 'three';
import {
  BuiltMapData,
  MapEnvironmentConfig,
} from '../types/contracts';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { MapBuilder } from './MapBuilder';

export const BREAKWATER_CONFIG: MapEnvironmentConfig = {
  id: 'breakwater',
  name: 'BREAKWATER TERMINAL',
  subtitle: 'SECTOR 04 // ATLANTIC FREIGHT INTERDICTION',
  locationLabel: 'Port of Vespera, North Atlantic Dockyards',
  timeOfDayLabel: '05:42 HRS // POST-SQUALL BLUE HOUR',
  tacticalBrief:
    'Three-lane coastal container terminal after heavy rain. Contest the Central Gantry Yard, flank along the South Waterfront Container Route, or push close-quarters through the North Maintenance Warehouse and Elevated Service Catwalk.',
  ambientAudioType: 'rain_harbor',
  skyTopColor: 0x102238,
  skyHorizonColor: 0x385c82,
  groundColor: 0x18222c,
  fogColor: 0x243a50,
  fogDensity: 0.0075,
  sunColor: 0x9ec6eb,
  sunIntensity: 1.85,
  sunDirection: [-45, 38, -28],
  hemiSkyColor: 0x4c7096,
  hemiGroundColor: 0x1e2834,
  hemiIntensity: 0.95,
  exposure: 1.16,
  previewAccentColor: '#38bdf8',
};

/**
 * Helper to build a detailed industrial forklift from primitives
 */
function buildForklift(
  b: MapBuilder,
  x: number,
  floorY: number,
  z: number,
  facingAxis: 'x' | 'z',
  dir: 1 | -1
): void {
  const isX = facingAxis === 'x';
  const bodyW = isX ? 2.3 : 1.35;
  const bodyD = isX ? 1.35 : 2.3;

  // Main chassis & counterweight (solid cover block)
  b.addBox(x, floorY + 0.65, z, bodyW, 1.1, bodyD, 'container_ochre');
  b.addBox(x, floorY + 0.18, z, bodyW + 0.04, 0.16, bodyD + 0.04, 'hazard_stripes', {
    collide: false,
  });
  b.addBox(
    x - (isX ? dir * 0.65 : 0),
    floorY + 0.78,
    z - (isX ? 0 : dir * 0.65),
    isX ? 0.9 : 1.28,
    1.18,
    isX ? 1.28 : 0.9,
    'steel_dark'
  );

  // Roll cage pillars & roof
  const cageH = 1.05;
  const cabY = floorY + 1.15 + cageH / 2;
  b.addBox(x, floorY + 1.15 + cageH, z, bodyW * 0.78, 0.08, bodyD * 0.85, 'steel_dark', {
    collide: false,
  });
  const ox = (bodyW * 0.35);
  const oz = (bodyD * 0.38);
  b.addBox(x - ox, cabY, z - oz, 0.08, cageH, 0.08, 'steel_dark', { collide: false });
  b.addBox(x + ox, cabY, z - oz, 0.08, cageH, 0.08, 'steel_dark', { collide: false });
  b.addBox(x - ox, cabY, z + oz, 0.08, cageH, 0.08, 'steel_dark', { collide: false });
  b.addBox(x + ox, cabY, z + oz, 0.08, cageH, 0.08, 'steel_dark', { collide: false });

  // Amber beacon on roof
  b.addBox(x, floorY + 2.32, z, 0.18, 0.16, 0.18, 'emissive_amber', {
    collide: false,
    castShadow: false,
  });

  // Mast & forks
  const mastX = x + (isX ? dir * 1.25 : 0);
  const mastZ = z + (isX ? 0 : dir * 1.25);
  b.addBox(
    mastX,
    floorY + 1.35,
    mastZ,
    isX ? 0.16 : 0.95,
    2.6,
    isX ? 0.95 : 0.16,
    'steel_dark'
  );

  // Forks resting low with a wooden pallet
  const forkX = x + (isX ? dir * 1.85 : 0);
  const forkZ = z + (isX ? 0 : dir * 1.85);
  b.addBox(
    forkX,
    floorY + 0.1,
    forkZ,
    isX ? 1.1 : 0.85,
    0.08,
    isX ? 0.85 : 1.1,
    'steel_dark',
    { collide: false }
  );
  b.addBox(
    forkX,
    floorY + 0.58,
    forkZ,
    isX ? 1.05 : 1.05,
    0.88,
    isX ? 1.05 : 1.05,
    'wood_crate'
  );
}

/**
 * Helper to build electrical cabinet with status LEDs and conduit pipes
 */
function buildElectricalCabinet(
  b: MapBuilder,
  x: number,
  floorY: number,
  z: number,
  w: number,
  h: number,
  d: number,
  ledSide: 'north' | 'south' | 'east' | 'west'
): void {
  b.addBox(x, floorY + h / 2, z, w, h, d, 'steel_dark');
  let lx = x;
  let lz = z;
  if (ledSide === 'north') lz -= d / 2 + 0.02;
  if (ledSide === 'south') lz += d / 2 + 0.02;
  if (ledSide === 'east') lx += w / 2 + 0.02;
  if (ledSide === 'west') lx -= w / 2 + 0.02;

  b.addBox(lx, floorY + h * 0.72, lz, 0.14, 0.08, 0.04, 'emissive_cyan', {
    collide: false,
    castShadow: false,
  });
  b.addBox(lx, floorY + h * 0.58, lz, 0.14, 0.08, 0.04, 'emissive_amber', {
    collide: false,
    castShadow: false,
  });
}

/**
 * Helper to add recessed concrete drainage grate strip
 */
function addDrainageChannel(
  b: MapBuilder,
  x: number,
  z: number,
  length: number,
  axis: 'x' | 'z'
): void {
  const w = axis === 'x' ? length : 0.55;
  const d = axis === 'x' ? 0.55 : length;
  b.addBox(x, 0.01, z, w, 0.02, d, 'steel_dark', {
    collide: false,
    castShadow: false,
  });
  const count = Math.floor(length / 1.5);
  for (let i = 0; i < count; i++) {
    const offset = -length / 2 + (i + 0.5) * (length / count);
    b.addBox(
      axis === 'x' ? x + offset : x,
      0.02,
      axis === 'z' ? z + offset : z,
      axis === 'x' ? 0.9 : 0.36,
      0.02,
      axis === 'z' ? 0.9 : 0.36,
      'metal_galvanized',
      { collide: false, castShadow: false }
    );
  }
}

export function buildBreakwaterTerminal(materials: MaterialLibrary): BuiltMapData {
  const b = new MapBuilder(materials);

  // ============================================================================
  // 1. GROUND SLAB, SEA WALL, & HARBOR WATER (PLAYABLE AREA: 76m x 64m)
  // ============================================================================
  // Main concrete dock slab: x in [-38, 38], z in [-32, 32]
  b.addBox(0, -0.5, 0, 76, 1.0, 64, 'wet_concrete', {
    castShadow: false,
    receiveShadow: true,
    collide: true,
    blocksBullets: true,
    blocksSight: true,
  });

  // Dockside concrete coping strip along the south waterfront edge
  b.addBox(0, 0.08, 31.4, 76, 0.16, 1.2, 'concrete_wall', {
    collide: false,
  });
  b.addBox(0, 0.18, 31.85, 76, 0.08, 0.3, 'hazard_stripes', {
    collide: false,
  });

  // Heavy sea wall parapet along South edge (z = 32): 1.22m physical wall + invisible upper boundary
  // so players can see out over the harbor & distant ships while staying inside the arena
  b.addBox(0, 0.61, 32.0, 76, 1.22, 0.65, 'concrete_wall');
  const southClip = b.addBox(0, 3.2, 32.1, 76, 4.0, 0.5, 'tinted_glass', {
    collide: true,
    blocksBullets: false,
    blocksSight: false,
    castShadow: false,
    receiveShadow: false,
  });
  southClip.visible = false;

  // Dockside mooring bollards along the waterfront
  for (let bx = -33; bx <= 33; bx += 6) {
    b.addBox(bx, 0.35, 31.1, 0.48, 0.7, 0.48, 'steel_dark');
    b.addBox(bx, 0.72, 31.1, 0.62, 0.12, 0.42, 'steel_dark', { collide: false });
  }

  // Drainage channels across the wet concrete yard
  addDrainageChannel(b, 0, 13.5, 64, 'x');
  addDrainageChannel(b, 0, -8.5, 60, 'x');
  addDrainageChannel(b, -18.5, 4.0, 44, 'z');
  addDrainageChannel(b, 21.5, 4.0, 44, 'z');

  // ============================================================================
  // 2. PERIMETER WALLS & TEAM STAGING ZONES (WEST: AEGIS, EAST: KESTREL)
  // ============================================================================
  // North perimeter boundary wall (z = -32)
  b.addBox(0, 3.2, -32.0, 76, 6.4, 0.8, 'concrete_wall');
  // West perimeter boundary wall (x = -38)
  b.addBox(-38.0, 3.2, 0, 0.8, 6.4, 64, 'concrete_wall');
  // East perimeter boundary wall (x = +38)
  b.addBox(38.0, 3.2, 0, 0.8, 6.4, 64, 'concrete_wall');

  // --- WEST STAGING ZONE (AEGIS DISPATCH APRON: x = -37 to -22) ---
  // Dispatch security shelter canopy on West side
  b.addBox(-33.5, 3.8, -18.0, 7.5, 0.35, 11.0, 'steel_dark');
  b.addBox(-30.0, 1.9, -23.0, 0.45, 3.8, 0.45, 'steel_dark');
  b.addBox(-30.0, 1.9, -13.0, 0.45, 3.8, 0.45, 'steel_dark');
  b.addWorkLight(-33.0, 3.55, -18.0, 0x66e0ff, 3.0, 18, true);

  // West spawn screen wall & container stack breaking direct spawn-to-spawn sightlines
  b.addShippingContainer(-27.5, 0, -5.0, 'z', 'container_blue');
  b.addShippingContainer(-27.5, 2.59, -5.0, 'z', 'container_slate');
  b.addShippingContainer(-31.5, 0, 8.5, 'x', 'container_teal');
  b.addTacticalCoverBlock(-24.0, 0, -14.5, 1.2, 3.2, 'concrete_wall', true);
  b.addTacticalCoverBlock(-24.5, 0, 2.5, 1.2, 3.0, 'concrete_wall', true);
  b.addTacticalCoverBlock(-31.5, 0, 19.5, 3.2, 1.2, 'concrete_wall', true);
  buildElectricalCabinet(b, -37.1, 0, -18.0, 0.9, 2.1, 1.8, 'east');

  // --- EAST STAGING ZONE (KESTREL FREIGHT GATE: x = +22 to +37) ---
  // East freight dispatch canopy
  b.addBox(33.5, 3.8, -16.0, 7.5, 0.35, 12.0, 'steel_dark');
  b.addBox(30.0, 1.9, -21.5, 0.45, 3.8, 0.45, 'steel_dark');
  b.addBox(30.0, 1.9, -10.5, 0.45, 3.8, 0.45, 'steel_dark');
  b.addWorkLight(33.0, 3.55, -16.0, 0xffaa44, 3.0, 18, true);

  // East spawn protective containers & cover blocks
  b.addShippingContainer(28.5, 0, -2.5, 'z', 'container_red');
  b.addShippingContainer(28.5, 2.59, -2.5, 'z', 'container_ochre');
  b.addShippingContainer(31.0, 0, 10.5, 'x', 'container_slate');
  b.addTacticalCoverBlock(25.0, 0, -13.0, 1.2, 3.2, 'concrete_wall', true);
  b.addTacticalCoverBlock(24.5, 0, 4.5, 1.2, 3.0, 'concrete_wall', true);
  b.addTacticalCoverBlock(30.5, 0, 20.5, 3.2, 1.2, 'concrete_wall', true);
  buildElectricalCabinet(b, 37.1, 0, -16.0, 0.9, 2.1, 1.8, 'west');

  // ============================================================================
  // 3. ROUTE FAMILY 1: SOUTH WATERFRONT CARGO ROUTE (z = +14 to +31)
  // ============================================================================
  // Staggered container labyrinth creating medium-range angles and flank pockets
  b.addShippingContainer(-21.5, 0, 22.0, 'x', 'container_ochre');
  b.addShippingContainer(-11.0, 0, 26.5, 'x', 'container_blue');
  b.addShippingContainer(-11.0, 2.59, 26.5, 'x', 'container_red');
  b.addShippingContainer(-1.5, 0, 19.5, 'z', 'container_teal');
  b.addShippingContainer(9.5, 0, 26.0, 'x', 'container_slate');
  b.addShippingContainer(9.5, 2.59, 26.0, 'x', 'container_blue');
  b.addShippingContainer(20.5, 0, 21.5, 'x', 'container_red');

  // Waist-high tactical cover blocks & cargo pallets along the dockside lane
  b.addTacticalCoverBlock(-16.5, 0, 17.5, 2.8, 1.1, 'concrete_wall', true);
  b.addTacticalCoverBlock(-6.0, 0, 22.5, 1.2, 2.6, 'concrete_wall', true);
  b.addTacticalCoverBlock(4.0, 0, 23.0, 2.8, 1.1, 'concrete_wall', true);
  b.addTacticalCoverBlock(15.0, 0, 17.5, 2.8, 1.1, 'concrete_wall', true);
  b.addBox(-15.5, 0.55, 28.2, 1.6, 1.1, 1.6, 'wood_crate');
  b.addBox(15.8, 0.55, 28.2, 1.6, 1.1, 1.6, 'wood_crate');

  // Tall dockside light masts illuminating the South Route
  for (const lx of [-22, 0, 22]) {
    b.addBox(lx, 4.5, 31.2, 0.35, 9.0, 0.35, 'steel_dark');
    b.addBox(lx, 8.9, 30.4, 1.4, 0.22, 1.8, 'steel_dark', { collide: false });
    b.addWorkLight(lx, 8.75, 29.8, 0xffaa44, 3.8, 24, true);
  }

  // ============================================================================
  // 4. ROUTE FAMILY 2: CENTRAL LOADING YARD & GIANT OVERHEAD GANTRY CRANE
  // ============================================================================
  // Hazard boundary markings framing the Central Gantry Crane zone
  b.addBox(0, 0.02, 3.0, 25.0, 0.04, 0.35, 'hazard_stripes', { collide: false });
  b.addBox(0, 0.02, 12.5, 25.0, 0.04, 0.35, 'hazard_stripes', { collide: false });

  // Giant Orange/Steel Industrial Gantry Crane straddling the yard (x = -11.5 & +11.5, z = -4.5 & +11.5, height 14.2m)
  const legPositions: Array<[number, number]> = [
    [-11.5, -4.5],
    [11.5, -4.5],
    [-11.5, 11.5],
    [11.5, 11.5],
  ];
  for (const [lx, lz] of legPositions) {
    // Heavy protective dark steel base with thin hazard bumper band
    b.addBox(lx, 0.65, lz, 1.65, 1.3, 1.65, 'steel_dark');
    b.addBox(lx, 0.22, lz, 1.72, 0.18, 1.72, 'hazard_stripes', { collide: false });
    // Main vertical steel column up to y = 14.0m
    b.addBox(lx, 7.2, lz, 0.95, 14.0, 0.95, 'container_ochre');
    // Structural dark steel corner flanges
    b.addBox(lx, 7.2, lz, 1.05, 13.8, 0.35, 'steel_dark', { collide: false });
  }

  // Cross-beams connecting North-South leg pairs on West (x = -11.5) and East (x = +11.5)
  b.addBox(-11.5, 7.8, 3.5, 0.75, 0.85, 16.8, 'steel_dark', { collide: false });
  b.addBox(11.5, 7.8, 3.5, 0.75, 0.85, 16.8, 'steel_dark', { collide: false });
  b.addBox(-11.5, 13.8, 3.5, 1.1, 1.2, 20.0, 'container_ochre', { collide: false });
  b.addBox(11.5, 13.8, 3.5, 1.1, 1.2, 20.0, 'container_ochre', { collide: false });

  // Twin Main Overhead Bridge Girders spanning West-East (x = -15.5 to +15.5) at y = 14.2m
  b.addBox(0, 14.3, -4.5, 31.0, 1.35, 1.1, 'container_ochre', { collide: false });
  b.addBox(0, 14.3, 11.5, 31.0, 1.35, 1.1, 'container_ochre', { collide: false });
  // Upper maintenance walkway along the crane bridge
  b.addBox(0, 15.1, -3.4, 29.0, 0.15, 0.9, 'steel_dark', { collide: false });
  b.addBox(0, 15.6, -2.95, 29.0, 0.85, 0.08, 'metal_galvanized', { collide: false });

  // Overhead Trolley Carriage & Suspended Cargo Spreader Assembly over the yard center (x = 1.5, z = 3.5)
  b.addBox(1.5, 13.6, 3.5, 4.4, 0.75, 17.2, 'steel_dark', { collide: false });
  // Four hoist steel cables descending from trolley (y = 13.4 down to y = 7.2)
  for (const [cx, cz] of [
    [-0.8, 1.0],
    [3.8, 1.0],
    [-0.8, 6.0],
    [3.8, 6.0],
  ]) {
    b.addPipeRun(cx, 10.3, cz, 6.2, 'y', 0.05, 'metal_galvanized');
  }
  // Spreader frame at y = 7.1m & suspended container hovering at y = 5.4m (well above head height for clear sightlines beneath, while unmistakable above!)
  b.addBox(1.5, 7.1, 3.5, 3.0, 0.45, 6.4, 'steel_dark', { collide: false });
  b.addShippingContainer(1.5, 4.2, 3.5, 'z', 'container_red', 6.06, 2.44, 2.59);

  // Under-crane floodlights illuminating the Central Loading Yard
  b.addWorkLight(-5.5, 13.4, -4.5, 0xffaa44, 4.2, 26, true);
  b.addWorkLight(6.5, 13.4, 11.5, 0xffaa44, 4.2, 26, true);

  // Ground-level Central Yard cover geometry (containers, forklift, cargo blocks, concrete dividers)
  b.addShippingContainer(-5.5, 0, 7.8, 'x', 'container_teal');
  b.addShippingContainer(7.2, 0, 0.5, 'z', 'container_blue');
  buildForklift(b, -6.5, 0, 1.2, 'x', 1);

  // Central yard tactical cover blocks & cargo securing blocks
  b.addTacticalCoverBlock(0.5, 0, 3.5, 2.6, 2.2, 'concrete_wall', true);
  b.addTacticalCoverBlock(-2.5, 0, -1.8, 3.0, 1.1, 'concrete_wall', true);
  b.addTacticalCoverBlock(5.5, 0, 8.2, 3.0, 1.1, 'concrete_wall', true);
  b.addTacticalCoverBlock(-14.5, 0, 3.5, 1.2, 3.4, 'concrete_wall', true);
  b.addTacticalCoverBlock(15.5, 0, 3.5, 1.2, 3.4, 'concrete_wall', true);

  // ============================================================================
  // 5. ROUTE FAMILY 3: NORTH MAINTENANCE WAREHOUSE (x = -16 to +20, z = -30 to -10)
  // ============================================================================
  // Register indoor zone so outdoor rain particles are excluded inside the building
  b.addIndoorZone(-16.0, 0, -30.0, 20.0, 7.2, -10.0);

  // Interior floor tile overlay (non-colliding visual surface on top of main slab)
  b.addBox(2.0, 0.02, -20.0, 35.6, 0.04, 19.6, 'interior_floor', {
    collide: false,
    receiveShadow: true,
    castShadow: false,
  });

  // Warehouse Roof Slab & Structural Ceiling Beams (y = 7.0m)
  b.addBox(2.0, 7.1, -20.0, 36.4, 0.4, 20.4, 'concrete_wall');
  for (let bx = -12; bx <= 16; bx += 7) {
    b.addBox(bx, 6.7, -20.0, 0.45, 0.45, 19.6, 'steel_dark', { collide: false });
  }

  // Warehouse North Wall (z = -30.0, x = -16 to +20)
  b.addBox(2.0, 3.5, -30.0, 36.0, 7.0, 0.45, 'concrete_wall');

  // Warehouse West Wall (x = -16.0, z = -30 to -10) with two clean doorways at z = -24.5 and z = -14.5
  b.addWallWithDoorway(-16.0, 0, -25.0, 10.0, 7.0, 0.45, 'z', 0.5, 2.6, 2.7, 'concrete_wall', 'steel_dark');
  b.addWallWithDoorway(-16.0, 0, -15.0, 10.0, 7.0, 0.45, 'z', 0.5, 2.6, 2.7, 'concrete_wall', 'steel_dark');

  // Warehouse East Wall (x = +20.0, z = -30 to -10) with two clean doorways at z = -24.5 and z = -15.5
  b.addWallWithDoorway(20.0, 0, -25.0, 10.0, 7.0, 0.45, 'z', 0.5, 2.6, 2.7, 'concrete_wall', 'steel_dark');
  b.addWallWithDoorway(20.0, 0, -15.0, 10.0, 7.0, 0.45, 'z', -0.5, 2.6, 2.7, 'concrete_wall', 'steel_dark');

  // Warehouse South Wall (z = -10.0, x = -16 to +20):
  // Split into lower wall (y = 0 to 3.2m) with two ground doorways (at x = -9.5 and x = +8.5),
  // and upper wall (y = 3.2m to 7.0m) with a wide central doorway at x = +2.0 connecting the interior mezzanine to the exterior overlook catwalk!
  b.addWallWithDoorway(-7.0, 0, -10.0, 18.0, 3.2, 0.45, 'x', -2.5, 2.6, 2.65, 'concrete_wall', 'steel_dark');
  b.addWallWithDoorway(11.0, 0, -10.0, 18.0, 3.2, 0.45, 'x', -2.5, 2.6, 2.65, 'concrete_wall', 'steel_dark');
  b.addWallWithDoorway(2.0, 3.2, -10.0, 36.0, 3.8, 0.45, 'x', 0.0, 3.6, 2.75, 'concrete_wall', 'steel_dark');

  // Warehouse Interior Cover: Industrial shelving racks, electrical banks, workbenches, and partition walls
  // Central interior partition wall (x = 2.0, z = -28 to -17, length 11.0m along z, thickness 0.4m) with doorway
  b.addWallWithDoorway(2.0, 0, -22.5, 11.0, 3.8, 0.4, 'z', 1.5, 2.6, 2.7, 'concrete_wall', 'steel_dark');

  // Maintenance signage panels & illuminated diagnostic boards on warehouse walls
  b.addBox(-5.5, 2.2, -29.7, 2.4, 0.9, 0.06, 'steel_dark', { collide: false });
  b.addBox(-5.5, 2.2, -29.66, 2.1, 0.65, 0.04, 'emissive_cyan', { collide: false });
  b.addBox(11.5, 2.2, -29.7, 2.4, 0.9, 0.06, 'container_blue', { collide: false });
  b.addBox(1.75, 2.1, -18.5, 0.08, 1.1, 1.8, 'steel_dark', { collide: false });
  b.addBox(1.71, 2.1, -18.5, 0.04, 0.85, 1.5, 'emissive_amber', { collide: false });
  // Coiled industrial hoses mounted on brackets
  for (const [hx, hz] of [
    [-15.65, -18.2],
    [19.65, -20.2],
    [-11.5, -3.55],
  ]) {
    b.addPipeRun(hx, 1.15, hz, 0.55, 'y', 0.22, 'container_red');
    b.addBox(hx, 1.35, hz, 0.16, 0.25, 0.16, 'metal_galvanized', { collide: false });
  }

  // West Bay multi-tier industrial shelving racks, crates & workbenches
  b.addBox(-8.5, 1.35, -24.5, 4.2, 2.7, 1.3, 'steel_dark');
  b.addBox(-8.5, 0.9, -24.5, 4.0, 0.55, 1.15, 'wood_crate', { collide: false });
  b.addBox(-8.5, 2.1, -24.5, 3.8, 0.5, 1.1, 'container_ochre', { collide: false });
  b.addBox(-3.5, 0.65, -24.2, 1.4, 1.3, 1.4, 'wood_crate');
  b.addTacticalCoverBlock(-6.0, 0, -17.5, 2.8, 1.1, 'concrete_wall', true);
  b.addTacticalCoverBlock(-11.5, 0, -18.5, 1.1, 2.8, 'concrete_wall', true);

  // East Bay shelving & maintenance bays
  b.addBox(10.5, 1.35, -25.0, 4.6, 2.7, 1.3, 'steel_dark');
  b.addBox(10.5, 0.9, -25.0, 4.4, 0.55, 1.15, 'container_ochre', { collide: false });
  b.addBox(10.5, 2.1, -25.0, 4.2, 0.5, 1.1, 'wood_crate', { collide: false });
  b.addTacticalCoverBlock(8.0, 0, -18.0, 2.8, 1.1, 'concrete_wall', true);
  b.addBox(15.0, 0.65, -21.0, 1.8, 1.3, 1.8, 'wood_crate');

  // Electrical cabinets & pipe runs along North interior wall
  buildElectricalCabinet(b, -12.5, 0, -29.2, 1.8, 2.3, 0.9, 'south');
  buildElectricalCabinet(b, -2.5, 0, -29.2, 2.2, 2.3, 0.9, 'south');
  buildElectricalCabinet(b, 6.5, 0, -29.2, 2.2, 2.3, 0.9, 'south');
  buildElectricalCabinet(b, 16.0, 0, -29.2, 1.8, 2.3, 0.9, 'south');
  b.addPipeRun(2.0, 5.6, -29.55, 34.0, 'x', 0.14, 'metal_galvanized');
  b.addPipeRun(2.0, 5.1, -29.55, 34.0, 'x', 0.10, 'container_ochre');

  // Warm interior work lights inside Warehouse
  b.addWorkLight(-9.0, 6.3, -24.0, 0xffaa44, 4.0, 18, true);
  b.addWorkLight(-1.5, 3.5, -20.0, 0xffaa44, 3.6, 16, true);
  b.addWorkLight(10.0, 6.3, -24.0, 0xffaa44, 4.0, 18, true);
  b.addWorkLight(-4.0, 6.3, -15.0, 0x66e0ff, 3.2, 16, true);
  b.addWorkLight(8.0, 6.3, -15.0, 0xffaa44, 3.6, 16, true);

  // ============================================================================
  // 6. ELEVATED SERVICE CATWALK CONNECTION (y = 3.2m) + TWO STAIRCASES
  // ============================================================================
  const catwalkY = 3.2;
  const deckThickness = 0.24;

  // A) Interior Warehouse Mezzanine Deck: x from -6.0 to +10.5 (16.5m), z from -13.6 to -10.0 (3.6m)
  b.addBox(2.25, catwalkY - deckThickness / 2, -11.8, 16.5, deckThickness, 3.6, 'steel_dark');
  // North safety railing & tactical crouch plates along interior mezzanine edge (z = -13.5)
  b.addBox(-2.8, catwalkY + 0.56, -13.5, 5.2, 1.12, 0.16, 'steel_dark');
  b.addBox(7.0, catwalkY + 0.56, -13.5, 5.2, 1.12, 0.16, 'steel_dark');

  // B) Exterior Central Yard Overlook Catwalk: x from -6.0 to +10.5 (16.5m), z from -10.0 to -6.4 (3.6m)
  b.addBox(2.25, catwalkY - deckThickness / 2, -8.2, 16.5, deckThickness, 3.6, 'steel_dark');
  // Support columns under the catwalk
  for (const cx of [-5.5, 2.0, 10.0]) {
    b.addBox(cx, catwalkY / 2, -6.6, 0.36, catwalkY, 0.36, 'steel_dark');
  }
  // Segmented waist-high steel ballistic plates & hazard rails along South edge of Overlook (z = -6.5)
  b.addTacticalCoverBlock(-2.8, catwalkY, -6.55, 4.4, 0.24, 'steel_dark', true);
  b.addTacticalCoverBlock(6.8, catwalkY, -6.55, 4.4, 0.24, 'steel_dark', true);
  // Open gap rail in center (x = +2.0) with thin handrail
  b.addBox(2.0, catwalkY + 0.95, -6.55, 4.4, 0.08, 0.08, 'metal_galvanized', { collide: false });

  // C) STAIRCASE 1 (West Exterior Staircase):
  // Climbs along +X from x = -12.4 (y = 0) up to x = -6.0 (y = 3.2) at z = -8.2 (width 2.4m, length 6.4m)
  b.addStaircase(-9.2, 0, -8.2, 2.4, 6.4, catwalkY, 'x', 1, 'steel_dark');
  // Outer staircase guardrail (south side of west stair)
  b.addBox(-9.2, 1.8, -6.9, 6.4, 0.12, 0.1, 'metal_galvanized', { collide: false });

  // D) STAIRCASE 2 (East Warehouse Interior/Bay Staircase):
  // Climbs along -X from x = +16.9 (y = 0) up to x = +10.5 (y = 3.2) at z = -11.8 (width 2.4m, length 6.4m)
  b.addStaircase(13.7, 0, -11.8, 2.4, 6.4, catwalkY, 'x', -1, 'steel_dark');
  // Guardrail along north side of east stair
  b.addBox(13.7, 1.8, -13.1, 6.4, 0.12, 0.1, 'metal_galvanized', { collide: false });

  // ============================================================================
  // 7. DISTANT HARBOR SILHOUETTES & ANIMATED ELEMENTS (OUTSIDE ARENA)
  // ============================================================================
  // Dark reflective Atlantic Harbor Water plane South & West of the breakwater
  const waterMesh = b.addBox(0, -1.6, 95, 340, 0.5, 130, 'wet_concrete', {
    collide: false,
    blocksBullets: false,
    blocksSight: false,
    castShadow: false,
  });

  // Distant container ship hull & superstructure moored at z = +78
  b.addBox(-12, 2.5, 78, 92, 8.5, 18, 'container_slate', {
    collide: false,
    blocksBullets: false,
    blocksSight: false,
  });
  b.addBox(-42, 12.0, 78, 14, 11.0, 16, 'concrete_wall', {
    collide: false,
    blocksBullets: false,
    blocksSight: false,
  });
  b.addBox(-42, 18.5, 78, 16, 2.2, 18, 'steel_dark', {
    collide: false,
    blocksBullets: false,
    blocksSight: false,
  });
  // Stacked container silhouettes on the cargo ship
  b.addBox(-18, 8.5, 78, 24, 5.2, 14, 'container_blue', {
    collide: false,
    blocksBullets: false,
    blocksSight: false,
  });
  b.addBox(10, 8.5, 78, 24, 5.2, 14, 'container_red', {
    collide: false,
    blocksBullets: false,
    blocksSight: false,
  });

  // Two towering distant port cranes on the outer pier (z = +58)
  for (const dcx of [-56, 56]) {
    b.addBox(dcx - 6, 14, 55, 1.8, 28, 1.8, 'steel_dark', { collide: false, blocksBullets: false });
    b.addBox(dcx + 6, 14, 55, 1.8, 28, 1.8, 'steel_dark', { collide: false, blocksBullets: false });
    b.addBox(dcx, 27, 62, 16, 2.2, 38, 'container_ochre', { collide: false, blocksBullets: false });
    const beacon = b.addBox(dcx, 29.2, 45, 0.8, 0.8, 0.8, 'emissive_red', {
      collide: false,
      blocksBullets: false,
      castShadow: false,
    });
    b.animatedObjects.push((_dt, elapsed) => {
      beacon.visible = Math.sin(elapsed * 3.2 + dcx) > -0.2;
      waterMesh.position.y = -1.6 + Math.sin(elapsed * 1.1) * 0.08;
    });
  }

  // ============================================================================
  // 8. VALIDATED SPAWN POINTS (16 SPAWNS: AEGIS, KESTREL, & FFA)
  // ============================================================================
  // Aegis Team Spawns (West Dock & Dispatch Apron)
  b.addSpawn('sp_aegis_1', -34.0, 0, -18.0, 0.0, 'aegis', 'Aegis Dispatch Canopy');
  b.addSpawn('sp_aegis_2', -33.5, 0, -9.0, 0.2, 'aegis', 'West Container Stack');
  b.addSpawn('sp_aegis_3', -33.5, 0, 1.5, 0.0, 'aegis', 'West Loading Apron');
  b.addSpawn('sp_aegis_4', -34.0, 0, 14.5, -0.25, 'aegis', 'Southwest Quay');
  b.addSpawn('sp_aegis_5', -26.5, 0, -24.5, 0.15, 'aegis', 'Northwest Approach');

  // Kestrel Team Spawns (East Freight Gate & Apron)
  b.addSpawn('sp_kestrel_1', 34.0, 0, -16.0, Math.PI, 'kestrel', 'Kestrel Freight Canopy');
  b.addSpawn('sp_kestrel_2', 33.5, 0, -7.5, Math.PI - 0.2, 'kestrel', 'East Container Stack');
  b.addSpawn('sp_kestrel_3', 33.5, 0, 3.5, Math.PI, 'kestrel', 'East Loading Apron');
  b.addSpawn('sp_kestrel_4', 34.0, 0, 16.0, Math.PI + 0.25, 'kestrel', 'Southeast Quay');
  b.addSpawn('sp_kestrel_5', 26.5, 0, -24.5, Math.PI - 0.15, 'kestrel', 'Northeast Approach');

  // Free-For-All / Rotational Tactical Spawns (Protected interior & lane pockets)
  b.addSpawn('sp_ffa_1', -12.5, 0, -26.5, 0.4, 'any', 'Warehouse West Bay');
  b.addSpawn('sp_ffa_2', 14.5, 0, -26.5, -0.5, 'any', 'Warehouse East Bay');
  b.addSpawn('sp_ffa_3', -23.0, 0, 27.5, 0.1, 'any', 'South Dock West');
  b.addSpawn('sp_ffa_4', 24.0, 0, 27.5, -0.2, 'any', 'South Dock East');
  b.addSpawn('sp_ffa_5', -0.5, 0, 28.5, 0.0, 'any', 'Waterfront Sea Wall');
  b.addSpawn('sp_ffa_6', 3.0, 3.2, -11.8, 0.0, 'any', 'Warehouse Upper Mezzanine');

  // ============================================================================
  // 9. BIDIRECTIONAL BOT NAVIGATION GRAPH (30 WAYPOINTS ACROSS ALL LANES & CATWALK)
  // ============================================================================
  // West Staging (Aegis)
  b.addWaypoint('wp_w_north', -25.0, 0, -24.5, ['wp_w_mid', 'wp_wh_w_out', 'wp_yard_nw'], 'route', 'West Staging');
  b.addWaypoint('wp_w_mid', -32.0, 0, -9.0, ['wp_w_north', 'wp_w_south', 'wp_yard_w'], 'route', 'West Staging');
  b.addWaypoint('wp_w_south', -32.0, 0, 14.5, ['wp_w_mid', 'wp_dock_sw', 'wp_yard_sw'], 'route', 'West Staging');

  // East Staging (Kestrel)
  b.addWaypoint('wp_e_north', 25.5, 0, -24.5, ['wp_e_mid', 'wp_wh_e_out', 'wp_yard_ne'], 'route', 'East Staging');
  b.addWaypoint('wp_e_mid', 33.0, 0, -6.5, ['wp_e_north', 'wp_e_south', 'wp_yard_e'], 'route', 'East Staging');
  b.addWaypoint('wp_e_south', 33.0, 0, 16.0, ['wp_e_mid', 'wp_dock_se', 'wp_yard_se'], 'route', 'East Staging');

  // South Waterfront Cargo Route (Route 1)
  b.addWaypoint('wp_dock_sw', -21.5, 0, 27.5, ['wp_w_south', 'wp_dock_w_mid', 'wp_yard_sw'], 'cover', 'South Waterfront');
  b.addWaypoint('wp_dock_w_mid', -11.0, 0, 21.0, ['wp_dock_sw', 'wp_dock_center', 'wp_yard_s'], 'route', 'South Waterfront');
  b.addWaypoint('wp_dock_center', -0.5, 0, 27.5, ['wp_dock_w_mid', 'wp_dock_e_mid'], 'cover', 'South Waterfront');
  b.addWaypoint('wp_dock_e_mid', 9.5, 0, 20.5, ['wp_dock_center', 'wp_dock_se', 'wp_yard_s'], 'route', 'South Waterfront');
  b.addWaypoint('wp_dock_se', 21.0, 0, 27.5, ['wp_dock_e_mid', 'wp_e_south', 'wp_yard_se'], 'cover', 'South Waterfront');

  // Central Loading Yard & Gantry Crane (Route 2)
  b.addWaypoint('wp_yard_nw', -16.5, 0, -8.2, ['wp_w_north', 'wp_yard_w', 'wp_wh_s_w', 'wp_stair_w_bot'], 'choke', 'Central Yard');
  b.addWaypoint('wp_yard_w', -18.5, 0, 3.5, ['wp_w_mid', 'wp_yard_nw', 'wp_yard_sw', 'wp_yard_center_w'], 'route', 'Central Yard');
  b.addWaypoint('wp_yard_sw', -16.5, 0, 14.0, ['wp_w_south', 'wp_dock_sw', 'wp_yard_w', 'wp_yard_s'], 'route', 'Central Yard');
  b.addWaypoint('wp_yard_center_w', -3.0, 0, 4.0, ['wp_yard_w', 'wp_yard_center_e', 'wp_yard_n', 'wp_yard_s'], 'objective', 'Gantry Crane Yard');
  b.addWaypoint('wp_yard_center_e', 4.0, 0, 4.0, ['wp_yard_center_w', 'wp_yard_e', 'wp_yard_n', 'wp_yard_s'], 'objective', 'Gantry Crane Yard');
  b.addWaypoint('wp_yard_n', 1.5, 0, -3.5, ['wp_yard_center_w', 'wp_yard_center_e', 'wp_wh_s_w', 'wp_wh_s_e'], 'cover', 'Central Yard');
  b.addWaypoint('wp_yard_s', 0.5, 0, 13.5, ['wp_yard_sw', 'wp_yard_se', 'wp_yard_center_w', 'wp_yard_center_e', 'wp_dock_w_mid', 'wp_dock_e_mid'], 'route', 'Central Yard');
  b.addWaypoint('wp_yard_ne', 16.5, 0, -8.0, ['wp_e_north', 'wp_yard_e', 'wp_wh_s_e'], 'choke', 'Central Yard');
  b.addWaypoint('wp_yard_e', 19.5, 0, 3.5, ['wp_e_mid', 'wp_yard_ne', 'wp_yard_se', 'wp_yard_center_e'], 'route', 'Central Yard');
  b.addWaypoint('wp_yard_se', 16.5, 0, 14.0, ['wp_e_south', 'wp_dock_se', 'wp_yard_e', 'wp_yard_s'], 'route', 'Central Yard');

  // North Maintenance Warehouse Ground Level (Route 3)
  b.addWaypoint('wp_wh_w_out', -19.0, 0, -14.5, ['wp_w_north', 'wp_wh_w_in'], 'choke', 'Warehouse Exterior');
  b.addWaypoint('wp_wh_w_in', -13.0, 0, -14.5, ['wp_wh_w_out', 'wp_wh_nw', 'wp_wh_s_w'], 'route', 'Maintenance Warehouse');
  b.addWaypoint('wp_wh_nw', -4.0, 0, -21.0, ['wp_wh_w_in', 'wp_wh_ne', 'wp_wh_s_w'], 'cover', 'Maintenance Warehouse');
  b.addWaypoint('wp_wh_ne', 6.0, 0, -21.0, ['wp_wh_nw', 'wp_wh_e_in', 'wp_wh_s_e'], 'cover', 'Maintenance Warehouse');
  b.addWaypoint('wp_wh_e_in', 18.6, 0, -15.5, ['wp_wh_ne', 'wp_wh_e_out', 'wp_stair_e_bot'], 'route', 'Maintenance Warehouse');
  b.addWaypoint('wp_wh_e_out', 23.0, 0, -15.5, ['wp_wh_e_in', 'wp_e_north'], 'choke', 'Warehouse Exterior');
  b.addWaypoint('wp_wh_s_w', -9.5, 0, -10.0, ['wp_wh_w_in', 'wp_wh_nw', 'wp_yard_nw', 'wp_yard_n'], 'choke', 'Warehouse South Doors');
  b.addWaypoint('wp_wh_s_e', 8.5, 0, -10.0, ['wp_wh_ne', 'wp_yard_n', 'wp_yard_ne', 'wp_stair_e_bot'], 'choke', 'Warehouse South Doors');

  // Elevated Service Catwalk & Staircases (y = 0 to y = 3.2m)
  b.addWaypoint('wp_stair_w_bot', -13.2, 0, -8.2, ['wp_yard_nw', 'wp_cat_w'], 'route', 'West Catwalk Stairs');
  b.addWaypoint('wp_cat_w', -4.5, 3.2, -8.2, ['wp_stair_w_bot', 'wp_cat_overlook'], 'overlook', 'Elevated Catwalk');
  b.addWaypoint('wp_cat_overlook', 2.0, 3.2, -8.2, ['wp_cat_w', 'wp_cat_mezz'], 'overlook', 'Elevated Catwalk');
  b.addWaypoint('wp_cat_mezz', 2.0, 3.2, -11.8, ['wp_cat_overlook', 'wp_cat_e'], 'overlook', 'Warehouse Mezzanine');
  b.addWaypoint('wp_cat_e', 9.5, 3.2, -11.8, ['wp_cat_mezz', 'wp_stair_e_bot'], 'overlook', 'Warehouse Mezzanine');
  b.addWaypoint('wp_stair_e_bot', 17.8, 0, -11.8, ['wp_cat_e', 'wp_wh_e_in', 'wp_wh_s_e'], 'route', 'East Mezzanine Stairs');

  return {
    config: BREAKWATER_CONFIG,
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
