import {
  BackSide,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  type Texture,
  type WebGLRenderer,
} from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/**
 * What glossy faces and edges reflect. The presets are studios built from
 * soft boxes, as in product photography (made here, so there is nothing to
 * license and they render identically everywhere). `url` takes an
 * equirectangular .hdr or .exr instead, such as a Poly Haven studio (CC0),
 * dropped into the launch folder and served from `/videos/<id>/…`.
 */
export type Environment = {
  preset?: EnvironmentPreset;
  url?: string;
  /** Strength of the reflections. */
  intensity?: number;
  /** Degrees around the vertical axis. Animate it to run the reflections across the product. */
  rotation?: number;
};

export type EnvironmentPreset = "dark" | "softbox" | "seamless";

function box(scene: Scene, w: number, h: number, at: [number, number, number], strength: number, tint?: string) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ side: DoubleSide }));
  m.material.color.set(tint ?? "#ffffff").multiplyScalar(strength);
  m.position.set(...at);
  m.lookAt(0, 0, 0);
  scene.add(m);
}

/** A room whose walls fade from `top` to `bottom`, for bright seamless sets. */
function sweepRoom(scene: Scene, top: number, bottom: number) {
  const geometry = new SphereGeometry(20, 32, 16);
  const colors: number[] = [];
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 20 + 1) / 2;
    const v = bottom + (top - bottom) * t;
    colors.push(v, v, v);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  scene.add(new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
}

function studio(preset: EnvironmentPreset) {
  const scene = new Scene();
  switch (preset) {
    case "dark":
      // A black room with a few soft boxes. A bright room would veil the UI at grazing angles.
      scene.background = new Color(0.004, 0.004, 0.005);
      box(scene, 8, 2.5, [-2, 6, 4], 3); // overhead key strip
      box(scene, 2, 6, [-7, 1, 1], 0.8); // left fill
      box(scene, 10, 1, [2, -1, -7], 0.5); // rim from behind
      break;
    case "softbox":
      // One huge overhead box and two tall strips: long, clean highlights on every edge.
      scene.background = new Color(0.01, 0.01, 0.012);
      box(scene, 10, 6, [0, 7, 2], 4);
      box(scene, 1.2, 8, [-6, 1, 3], 1.6);
      box(scene, 1.2, 8, [6, 1, 3], 1.6);
      box(scene, 12, 3, [0, -6, 0], 0.06); // floor bounce
      break;
    case "seamless":
      // A white cyclorama: bright, even, for light-mode products.
      sweepRoom(scene, 1.4, 0.45);
      box(scene, 10, 6, [0, 7, 2], 3);
      break;
  }
  return scene;
}

/** Builds and caches prefiltered environments for one renderer. */
export class Environments {
  private cache = new Map<string, Texture>();
  private pending = new Map<string, Promise<Texture>>();
  constructor(private renderer: WebGLRenderer) {}

  /** The environment for `env`, or null while a file is still loading (`load` returns its promise). */
  get(env: Environment): Texture | null {
    const key = env.url ?? `preset:${env.preset ?? "dark"}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (env.url) return null;
    const pmrem = new PMREMGenerator(this.renderer);
    const texture = pmrem.fromScene(studio(env.preset ?? "dark"), 0.04).texture;
    pmrem.dispose();
    this.cache.set(key, texture);
    return texture;
  }

  load(url: string): Promise<Texture> {
    const hit = this.cache.get(url);
    if (hit) return Promise.resolve(hit);
    const running = this.pending.get(url);
    if (running) return running;
    const loader = /\.exr$/i.test(url) ? new EXRLoader() : new HDRLoader();
    const work = loader.loadAsync(url).then((equirect) => {
      equirect.mapping = EquirectangularReflectionMapping;
      const pmrem = new PMREMGenerator(this.renderer);
      const texture = pmrem.fromEquirectangular(equirect).texture;
      pmrem.dispose();
      equirect.dispose();
      this.cache.set(url, texture);
      return texture;
    });
    this.pending.set(url, work);
    return work;
  }

  dispose() {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
  }
}
