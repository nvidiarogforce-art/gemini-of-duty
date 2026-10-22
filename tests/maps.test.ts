import { beforeAll, describe, expect, it } from 'vitest';
import { MaterialLibrary } from '../src/rendering/MaterialLibrary';
import { buildMapById, MAP_IDS } from '../src/maps/MapRegistry';

beforeAll(() => {
  // Minimal Canvas 2D mock for Node/Vitest environment so MaterialLibrary procedural textures execute cleanly
  const noop = () => {};
  const fakeGrad = { addColorStop: noop };
  const fakeCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    ellipse: noop,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop,
    createRadialGradient: () => fakeGrad,
    createLinearGradient: () => fakeGrad,
  };

  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => fakeCtx,
        };
      }
      return {};
    },
  };
});

describe('Map System Validation (Breakwater Terminal, Mesa Relay, Northstar Facility)', () => {
  for (const mapId of MAP_IDS) {
    it(`validates ${mapId} geometry, colliders, spawns, indoor zones, and navigation graph`, () => {
      const materials = new MaterialLibrary();
      const map = buildMapById(mapId, materials);

      expect(map.config.id).toBe(mapId);
      expect(map.colliders.length).toBeGreaterThan(35);
      expect(map.raycastMeshes.length).toBeGreaterThan(30);
      expect(map.spawnPoints.length).toBeGreaterThanOrEqual(14);
      expect(map.indoorZones.length).toBeGreaterThanOrEqual(1);
      expect(map.waypoints.size).toBeGreaterThanOrEqual(26);

      // Verify at least 2 staircases (ramps) exist for elevated counterplay
      const ramps = map.colliders.filter((c) => c.isRamp);
      expect(ramps.length).toBeGreaterThanOrEqual(2);

      // Verify every waypoint has valid connections and all referenced neighbor IDs exist
      for (const [wpId, wp] of map.waypoints.entries()) {
        expect(wp.connections.length).toBeGreaterThan(0);
        for (const connId of wp.connections) {
          expect(map.waypoints.has(connId)).toBe(true);
        }
      }

      // Verify spawn points are not buried inside solid movement-blocking boxes
      for (const sp of map.spawnPoints) {
        for (const col of map.colliders) {
          if (!col.blocksMovement || col.isRamp) continue;
          const insideXZ =
            sp.position.x > col.box.min.x + 0.30 &&
            sp.position.x < col.box.max.x - 0.30 &&
            sp.position.z > col.box.min.z + 0.30 &&
            sp.position.z < col.box.max.z - 0.30;
          const insideY =
            sp.position.y + 0.9 > col.box.min.y &&
            sp.position.y + 0.9 < col.box.max.y;
          expect(insideXZ && insideY).toBe(false);
        }
      }

      map.dispose();
      materials.dispose();
    });
  }
});
