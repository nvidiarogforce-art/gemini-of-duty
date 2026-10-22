import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MapEnvironmentConfig, QualityPreset } from '../types/contracts';

/**
 * Physically Based Three.js Scene Renderer
 * Manages WebGLRenderer, ACESFilmicToneMapping, PMREM Image-Based Lighting,
 * directional sun/moon shadow maps, gradient sky dome, and quality presets.
 */
export class SceneRenderer {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;

  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private skyMesh: THREE.Mesh;
  private skyUniforms: {
    topColor: { value: THREE.Color };
    bottomColor: { value: THREE.Color };
  };
  private pmremGenerator: THREE.PMREMGenerator;
  private envTexture: THREE.Texture | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      85,
      window.innerWidth / window.innerHeight,
      0.08,
      260
    );
    this.scene.add(this.camera);

    // PMREM environment map for grounded metallic/roughness PBR reflections
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envTexture = this.pmremGenerator.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envTexture;
    roomEnv.dispose();

    // Hemisphere + Directional Shadow Light
    this.hemiLight = new THREE.HemisphereLight(0x88aacc, 0x222830, 1.0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sunLight.position.set(28, 42, 24);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    const sc = this.sunLight.shadow.camera;
    sc.near = 2;
    sc.far = 140;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    this.scene.add(this.sunLight);

    // Atmospheric Gradient Sky Dome
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x0f1e32) },
      bottomColor: { value: new THREE.Color(0x304a66) },
    };
    const skyGeo = new THREE.SphereGeometry(210, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = pow(max(h + 0.08, 0.0), 0.65);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    window.addEventListener('resize', () => this.onResize());
  }

  public applyMapAtmosphere(config: MapEnvironmentConfig): void {
    this.skyUniforms.topColor.value.setHex(config.skyTopColor);
    this.skyUniforms.bottomColor.value.setHex(config.skyHorizonColor);
    this.scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);

    this.sunLight.color.setHex(config.sunColor);
    this.sunLight.intensity = config.sunIntensity;
    this.sunLight.position.set(
      config.sunDirection[0],
      config.sunDirection[1],
      config.sunDirection[2]
    );

    this.hemiLight.color.setHex(config.hemiSkyColor);
    this.hemiLight.groundColor.setHex(config.hemiGroundColor);
    this.hemiLight.intensity = config.hemiIntensity;
    this.renderer.toneMappingExposure = config.exposure;
  }

  public applyQualityPreset(preset: QualityPreset): void {
    if (preset === 'low') {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else if (preset === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  public onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
