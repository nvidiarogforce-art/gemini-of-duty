import * as THREE from 'three';
import { SurfaceMaterialType } from '../types/contracts';

/**
 * Procedural PBR Material & Texture Generator
 * Generates high-detail normal maps, roughness maps, and albedo textures at runtime
 * with zero external file dependencies, ensuring 100% reliable loading and rich surface history.
 */
export class MaterialLibrary {
  private textures: THREE.Texture[] = [];
  private materials: Map<string, THREE.MeshStandardMaterial> = new Map();

  constructor() {
    this.initMaterials();
  }

  private createCanvasTexture(
    width: number,
    height: number,
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    isColor: boolean = true,
    repeatX: number = 2,
    repeatY: number = 2
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    drawFn(ctx, width, height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  private createNoiseNormalMap(size: number = 256, contrast: number = 14, repeat: number = 4): THREE.CanvasTexture {
    return this.createCanvasTexture(
      size,
      size,
      (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        const data = img.data;
        // Deterministic pseudo-random height field
        let seed = 1337;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        const heights = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          heights[i] = rand();
        }
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const left = heights[y * w + ((x - 1 + w) % w)];
            const right = heights[y * w + ((x + 1) % w)];
            const up = heights[((y - 1 + h) % h) * w + x];
            const down = heights[((y + 1) % h) * w + x];
            const dx = (left - right) * contrast;
            const dy = (up - down) * contrast;
            const idx = (y * w + x) * 4;
            data[idx] = Math.min(255, Math.max(0, Math.floor(128 + dx * 12)));
            data[idx + 1] = Math.min(255, Math.max(0, Math.floor(128 + dy * 12)));
            data[idx + 2] = 255;
            data[idx + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
      false,
      repeat,
      repeat
    );
  }

  private createCorrugatedNormalMap(repeatX: number = 4, repeatY: number = 2): THREE.CanvasTexture {
    return this.createCanvasTexture(
      256,
      256,
      (ctx, w, h) => {
        for (let x = 0; x < w; x++) {
          const wave = Math.cos((x / w) * Math.PI * 16);
          const nx = Math.floor(128 + wave * 75);
          ctx.fillStyle = `rgb(${nx}, 128, 255)`;
          ctx.fillRect(x, 0, 1, h);
        }
      },
      false,
      repeatX,
      repeatY
    );
  }

  private initMaterials(): void {
    const fineNormal = this.createNoiseNormalMap(256, 8, 6);
    const roughNormal = this.createNoiseNormalMap(256, 18, 4);
    const corrugatedNormal = this.createCorrugatedNormalMap(3, 1);

    // 1. Wet Asphalt / Concrete (Breakwater Ground — realistic dark wet dockside concrete without polka-dot blotches)
    const wetConcreteAlbedo = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#1d232b';
      ctx.fillRect(0, 0, w, h);
      // Subtle concrete slab joints
      ctx.strokeStyle = '#14181e';
      ctx.lineWidth = 2;
      for (let i = 0; i <= w; i += 128) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
      // Subtle low-contrast aggregate & tire wear streaks
      for (let i = 0; i < 180; i++) {
        const x = (i * 73) % w;
        const y = (i * 139) % h;
        const r = 18 + (i % 42);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(14, 18, 22, 0.14)' : 'rgba(38, 46, 56, 0.10)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }, true, 6, 6);

    const wetConcreteRough = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#626262'; // damp matte-satin asphalt base
      ctx.fillRect(0, 0, w, h);
      // Broad, soft, organic shallow water basins (subtle roughness transition, no polka dots)
      for (let i = 0; i < 6; i++) {
        const x = (i * 113 + 64) % w;
        const y = (i * 179 + 48) % h;
        const rx = 75 + (i % 45);
        const ry = 55 + ((i * 13) % 40);
        const grad = ctx.createRadialGradient(x, y, 10, x, y, Math.max(rx, ry));
        grad.addColorStop(0, '#2b2b2b');
        grad.addColorStop(0.65, '#454545');
        grad.addColorStop(1, 'rgba(98,98,98,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, i * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }, false, 6, 6);

    this.materials.set('wet_concrete', new THREE.MeshStandardMaterial({
      map: wetConcreteAlbedo,
      roughnessMap: wetConcreteRough,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.52,
      metalness: 0.08,
    }));

    // 2. Dry Industrial Concrete (Walls / Structures / Columns)
    const concreteWallAlbedo = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#525862';
      ctx.fillRect(0, 0, w, h);
      // Formwork tie holes & panel seams
      ctx.strokeStyle = '#3d424a';
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 128) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let x = 0; x < w; x += 256) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      // Subtle weathering bands
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(32,36,42,0.14)' : 'rgba(105,112,122,0.08)';
        ctx.fillRect((i * 53) % w, (i * 89) % h, 28, 18);
      }
    }, true, 4, 2);

    this.materials.set('concrete_wall', new THREE.MeshStandardMaterial({
      map: concreteWallAlbedo,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.80,
      metalness: 0.05,
    }));

    // 3. Pale Concrete (Mesa & Northstar Architectural Concrete)
    const paleConcreteAlbedo = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#9e978f';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#7d766e';
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 128) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let x = 0; x < w; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = 'rgba(75, 70, 65, 0.10)';
        ctx.fillRect((i * 67) % w, (i * 103) % h, 32, 14);
      }
    }, true, 4, 2);

    this.materials.set('pale_concrete', new THREE.MeshStandardMaterial({
      map: paleConcreteAlbedo,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.82,
      metalness: 0.04,
    }));

    // 4. Shipping Container Navy Blue / Rust Red / Olive / Industrial Amber
    const containerColors: Array<[string, string, string]> = [
      ['container_blue', '#1e3f5a', '#13293b'],
      ['container_red', '#6e2b25', '#4a1b17'],
      ['container_teal', '#1f4e4b', '#143331'],
      ['container_ochre', '#8c6227', '#5c3f16'],
      ['container_slate', '#38414a', '#242a30'],
    ];

    for (const [key, baseHex, darkHex] of containerColors) {
      const tex = this.createCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, w, h);
        // Edge wear and rust streaks
        ctx.fillStyle = darkHex;
        ctx.fillRect(0, 0, w, 14);
        ctx.fillRect(0, h - 18, w, 18);
        ctx.fillStyle = 'rgba(210, 218, 224, 0.12)';
        ctx.fillRect(18, 28, 60, 12);
      }, true, 2, 1);

      this.materials.set(key, new THREE.MeshStandardMaterial({
        map: tex,
        normalMap: corrugatedNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughness: 0.58,
        metalness: 0.45,
      }));
    }

    // 5. Dark Structural Steel / Catwalks / Gantry
    this.materials.set('steel_dark', new THREE.MeshStandardMaterial({
      color: 0x262c34,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.44,
      metalness: 0.75,
    }));

    // 6. Brushed / Galvanized Metal (Pipes, Ducts, Railings)
    this.materials.set('metal_galvanized', new THREE.MeshStandardMaterial({
      color: 0x7b848d,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.38,
      metalness: 0.80,
    }));

    // 7. Industrial Safety Trim (Subtle weathered amber with wide dark chevrons — zero moiré)
    const hazardTex = this.createCanvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#c88d1e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#22262c';
      for (let x = -h; x < w + h; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 28, 0);
        ctx.lineTo(x - 4, h);
        ctx.lineTo(x - 32, h);
        ctx.closePath();
        ctx.fill();
      }
    }, true, 2, 1);

    this.materials.set('hazard_stripes', new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.58,
      metalness: 0.28,
    }));

    // 8. Sandstone Rock (Mesa Relay Cliffs & Boulders — organic geological strata & fractures)
    const sandstoneAlbedo = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#a8643e';
      ctx.fillRect(0, 0, w, h);
      const strataColors = ['#8f4f2d', '#ba744c', '#7a4124', '#c4835b', '#995835'];
      for (let y = 0; y < h; y += 22) {
        ctx.fillStyle = strataColors[Math.floor(y / 22) % strataColors.length];
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) {
          const wave = Math.sin(x * 0.025 + y * 0.1) * 8;
          ctx.lineTo(x, y + wave);
        }
        ctx.lineTo(w, y + 26);
        ctx.lineTo(0, y + 26);
        ctx.closePath();
        ctx.fill();
      }
      // Vertical rock fractures and weathering blotches
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#4f2915';
      for (let i = 0; i < 45; i++) {
        ctx.fillRect((i * 89) % w, (i * 61) % h, 4 + (i % 6), 40 + (i % 70));
      }
      ctx.globalAlpha = 1.0;
    }, true, 2, 2);

    this.materials.set('sandstone_rock', new THREE.MeshStandardMaterial({
      map: sandstoneAlbedo,
      normalMap: roughNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.90,
      metalness: 0.02,
    }));

    // 9. Arid Desert Sand / Packed Dirt Ground (Mesa Relay)
    const desertGroundAlbedo = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#bf895e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(155, 102, 65, 0.16)' : 'rgba(212, 168, 125, 0.14)';
        ctx.beginPath();
        ctx.arc((i * 83) % w, (i * 127) % h, 20 + (i % 34), 0, Math.PI * 2);
        ctx.fill();
      }
    }, true, 10, 10);

    this.materials.set('desert_ground', new THREE.MeshStandardMaterial({
      map: desertGroundAlbedo,
      normalMap: roughNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.92,
      metalness: 0.0,
    }));

    // 10. Snow Ground & Frosted Surfaces (Northstar Facility)
    const snowAlbedo = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#d4e0ee';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 150; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(182, 198, 218, 0.22)' : 'rgba(242, 248, 255, 0.25)';
        ctx.beginPath();
        ctx.arc((i * 71) % w, (i * 113) % h, 22 + (i % 32), 0, Math.PI * 2);
        ctx.fill();
      }
    }, true, 8, 8);

    this.materials.set('snow_ground', new THREE.MeshStandardMaterial({
      map: snowAlbedo,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.30, 0.30),
      roughness: 0.78,
      metalness: 0.04,
    }));

    // 11. Cleared Frosty Concrete Deck / Facility Roadway (Northstar — crisp slab joints, no diagonal dots)
    const frostedAsphalt = this.createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2b333d';
      ctx.fillRect(0, 0, w, h);
      // Heavy industrial deck slab grid
      ctx.strokeStyle = '#1e242b';
      ctx.lineWidth = 3;
      for (let i = 0; i <= w; i += 128) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
      // Subtle frost accumulation near slab edges
      ctx.strokeStyle = 'rgba(200, 218, 236, 0.14)';
      ctx.lineWidth = 8;
      for (let i = 0; i <= w; i += 128) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
    }, true, 8, 8);

    this.materials.set('frosted_asphalt', new THREE.MeshStandardMaterial({
      map: frostedAsphalt,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.64,
      metalness: 0.12,
    }));

    // 12. Interior Lab / Operations Floor Tile
    const labFloor = this.createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#3a424c';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#262c33';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }, true, 10, 10);

    this.materials.set('interior_floor', new THREE.MeshStandardMaterial({
      map: labFloor,
      roughness: 0.48,
      metalness: 0.18,
    }));

    // 13. Wooden Crates / Pallets
    const woodAlbedo = this.createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#825d3a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#573c22';
      ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }, true, 2, 2);

    this.materials.set('wood_crate', new THREE.MeshStandardMaterial({
      map: woodAlbedo,
      normalMap: fineNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.82,
      metalness: 0.02,
    }));

    // 14. Emissive Warm Industrial Light & Cool Cyan Tech Accent
    this.materials.set('emissive_amber', new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff9922,
      emissiveIntensity: 2.8,
      roughness: 0.2,
    }));

    this.materials.set('emissive_cyan', new THREE.MeshStandardMaterial({
      color: 0x66e0ff,
      emissive: 0x00b8ff,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }));

    this.materials.set('emissive_red', new THREE.MeshStandardMaterial({
      color: 0xff4433,
      emissive: 0xff2211,
      emissiveIntensity: 2.4,
      roughness: 0.2,
    }));

    // 15. Glass / Tinted Observation Window
    this.materials.set('tinted_glass', new THREE.MeshStandardMaterial({
      color: 0x78a8c8,
      roughness: 0.12,
      metalness: 0.65,
      transparent: true,
      opacity: 0.42,
    }));
  }

  public get(name: string): THREE.MeshStandardMaterial {
    return this.materials.get(name) || this.materials.get('concrete_wall')!;
  }

  public getSurfaceTypeForMaterial(matName: string): SurfaceMaterialType {
    if (matName.includes('snow')) return 'snow';
    if (matName.includes('sandstone') || matName.includes('desert')) return 'sandstone';
    if (matName.includes('container') || matName.includes('steel') || matName.includes('metal') || matName.includes('hazard')) return 'metal';
    if (matName.includes('wood')) return 'wood';
    if (matName.includes('glass')) return 'glass';
    return 'concrete';
  }

  public dispose(): void {
    for (const tex of this.textures) tex.dispose();
    for (const mat of this.materials.values()) mat.dispose();
  }
}
