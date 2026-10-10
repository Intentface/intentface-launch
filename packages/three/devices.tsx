import type { Rect } from "@intentface-launch/core/kit";
import { type ReactNode, useContext, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  CustomBlending,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  OneFactor,
  Path,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  SrcAlphaFactor,
  ZeroFactor,
} from "three";
import { type Surface, surfaceMaterial, surfaces } from "./materials.js";
import { applyPose, faceMaterial, LiveSource, liveTexture, type Pose } from "./panel.js";
import { StageContext, type StageItem } from "./stage.js";

/*
 * Generic devices, built procedurally: no models to download or license, and
 * no real product's likeness. Proportions are those of current hardware in
 * general (a 19.5:9 phone, a 4:3 tablet, a 16:10 laptop), corners are
 * continuous-curvature (superellipse) as on most modern devices, and every
 * screen shows live DOM, like a <Panel>, under its own glass.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const valueAt = (v: number | ((f: number) => number) | undefined, t: number) => (typeof v === "function" ? v(t) : v);

/** Corner radii, clockwise from the top left. */
type Radii = [number, number, number, number];

/**
 * A rectangle with superellipse corners, centred on (cx, cy). `smooth` 2 is a
 * circular corner; above it the curve meets the straight edge with no jump in
 * curvature, so highlights run round the corner without a kink.
 */
function contour<T extends Path>(path: T, w: number, h: number, radii: number | Radii, cx = 0, cy = 0, smooth = 3) {
  const r = (typeof radii === "number" ? [radii, radii, radii, radii] : radii).map((v) =>
    Math.max(0.5, Math.min(v, w / 2, h / 2)),
  );
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  // Corner centres (top left, top right, bottom right, bottom left) and the angle each quarter starts at.
  const corners: [number, number, number, number][] = [
    [x1 - r[1], y1 - r[1], r[1], 0],
    [x0 + r[0], y1 - r[0], r[0], Math.PI / 2],
    [x0 + r[3], y0 + r[3], r[3], Math.PI],
    [x1 - r[2], y0 + r[2], r[2], (3 * Math.PI) / 2],
  ];
  const steps = 16;
  const e = 2 / smooth;
  let first = true;
  for (const [ox, oy, cr, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * (Math.PI / 2);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const px = ox + cr * Math.sign(c) * Math.abs(c) ** e;
      const py = oy + cr * Math.sign(s) * Math.abs(s) ** e;
      if (first) path.moveTo(px, py);
      else path.lineTo(px, py);
      first = false;
    }
  }
  path.closePath();
  return path;
}

const outline = (w: number, h: number, radii: number | Radii, cx = 0, cy = 0) =>
  contour(new Shape(), w, h, radii, cx, cy);

/**
 * A solid whose front face is `shape`, `depth` thick, with a rounded lip:
 * the sides bulge `bevel` beyond the face over `edge` of depth at each end.
 * Material groups: 0 front, 1 sides and lip, 2 back.
 */
function solid(shape: Shape, depth: number, bevel = 0, edge = bevel) {
  const lip = bevel > 0 && edge > 0;
  const core = Math.max(0.01, depth - (lip ? 2 * edge : 0));
  const geometry = new ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: lip,
    bevelThickness: edge,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -core / 2);
  // Both lids come in group 0, back lid first.
  const [lids, sides] = geometry.groups;
  const half = lids.count / 2;
  geometry.clearGroups();
  geometry.addGroup(lids.start, half, 2);
  geometry.addGroup(lids.start + half, half, 0);
  geometry.addGroup(sides.start, sides.count, 1);
  return geometry;
}

/** A flat face with UVs over `w` × `h` (v = 0 at the top, as DOM textures are). */
function sheet(shape: Shape, w: number, h: number) {
  const geometry = new ShapeGeometry(shape, 4);
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (h / 2 - pos.getY(i)) / h);
  return geometry;
}

/** Black glass around the picture: deep and quiet, so the glass layer does the reflecting. */
const bezelMaterial = () =>
  new MeshPhysicalMaterial({ color: "#030304", roughness: 0.35, metalness: 0, specularIntensity: 0 });

/**
 * The cover glass: black, added on top of what is under it, so it contributes
 * only its reflections (of the stage's environment and soft boxes, stronger at
 * grazing angles, as Fresnel has it). `strength` scales them.
 */
function coverGlass(strength: number, roughness: number) {
  const m = new MeshPhysicalMaterial({
    color: "#000000",
    roughness,
    metalness: 0,
    ior: 1.5,
    specularIntensity: 1,
    transparent: true,
    opacity: strength,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
  return m;
}

/** Everything a device screen takes, shared by Phone, Tablet and Laptop. */
export type ScreenProps = {
  /** Screen size in CSS pixels: the DOM is laid out at this size. Default per device. */
  screen?: [number, number];
  /** Part of the children to show (a capture mark's rect); sets the screen size. */
  region?: Rect;
  /** Texture pixels per CSS pixel. Raise for close-ups. */
  resolution?: number;
  /** Glow of the picture: 1 shows the UI's exact colours, above 1 a screen turned up (it blooms). */
  brightness?: number;
  /** How much the stage's lights shade the picture, 0 (an emissive screen) to 1. */
  lit?: number;
  /** Fill behind the UI. `null` keeps its transparency (over the black panel). */
  surface?: string | null;
  /** What translucent UI blends over, as in `Panel`. */
  over?: string | null;
  /** Strength of the cover glass's reflections, 0 (none) to 1 (bare glass). */
  reflection?: number;
  /** Roughness of the cover glass: 0.02 a mirror, 0.15 an anti-glare coating. */
  glare?: number;
  pose?: (frame: number) => Pose;
  children: ReactNode;
};

type Built = { group: Group; materials: Material[]; glass: Material[]; textures: { dispose(): void }[] };

/**
 * Registers a built device with the stage: its screen's DOM becomes a texture,
 * `update` poses it (and whatever else moves, like a hinge) at each sample.
 */
function useDevice(
  build: (screen: Material) => Built,
  deps: unknown[],
  screenProps: ScreenProps,
  move?: (t: number) => void,
) {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("Devices must be inside <Stage3D>");
  const source = useRef<HTMLDivElement>(null);
  const latest = useRef({ pose: screenProps.pose, move });
  latest.current = { pose: screenProps.pose, move };
  const { lit = 0, over = "#000000", brightness = 1, reflection = 0.25, glare = 0.06 } = screenProps;

  const parts = useMemo(() => {
    const live = liveTexture();
    const screen = faceMaterial(stage.live ? live.texture : null, { lit, over, specular: 0, brightness });
    const built = build(screen);
    for (const m of built.glass) {
      (m as MeshPhysicalMaterial).roughness = glare;
    }
    const materials = [...new Set([screen, ...built.materials])];
    for (const m of materials) m.transparent = true;
    const opacities = new Map<Material, number>([
      ...materials.map((m) => [m, m.opacity] as [Material, number]),
      ...built.glass.map((m) => [m, reflection] as [Material, number]),
    ]);
    return { ...built, live, materials, opacities };
    // `build` is new every render; its inputs are in `deps`.
  }, [stage.live, lit, over, brightness, reflection, glare, ...deps]);

  useLayoutEffect(() => {
    const item: StageItem = {
      object: parts.group,
      element: source.current,
      update(t) {
        const opacity = applyPose(parts.group, latest.current.pose?.(t) ?? {});
        latest.current.move?.(t);
        for (const m of parts.materials) {
          m.opacity = (parts.opacities.get(m) ?? 1) * opacity;
          m.depthWrite = opacity > 0.98;
        }
        for (const m of parts.glass) m.opacity = (parts.opacities.get(m) ?? 0) * opacity;
      },
      capture(gl) {
        parts.live.capture(gl, source.current);
      },
    };
    const remove = stage.add(item);
    return () => {
      remove();
      parts.group.traverse((o) => (o as Mesh).geometry?.dispose());
      for (const m of [...parts.materials, ...parts.glass]) m.dispose();
      for (const t of parts.textures) t.dispose();
    };
  }, [stage, parts]);

  return source;
}

const surfaceKey = (s: Surface | undefined) => (s ? JSON.stringify(s) : "");

/** A slab of glass and metal with a screen: the shape of a phone and of a tablet. */
type SlateProps = ScreenProps & {
  /** Frame and lip: `surfaces.anodised(…)`, `surfaces.aluminium()`, `surfaces.matte(…)`. */
  body?: Surface;
  /** The back panel. Default: the body's surface, or frosted dark glass with the default body. */
  back?: Surface;
  /** Black border between the picture and the frame, in CSS pixels. */
  bezel?: number;
  /** Corner radius of the picture; the body's follows it around the bezel. */
  radius?: number;
  /** Thickness, front to back. */
  depth?: number;
  /** Rear camera module (lenses in a raised island). */
  camera?: boolean;
  /** Front camera: a small dot over the top of the picture. */
  sensor?: boolean;
  /** Side buttons. */
  buttons?: boolean;
};

type SlateDefaults = {
  screen: [number, number];
  bezel: number;
  radius: number;
  depth: number;
  lip: [number, number];
  resolution: number;
  lenses: number;
  /** Where the buttons go: on the long sides (phone) or the top (tablet). */
  buttonsOn: "sides" | "top";
};

const DEFAULT_BODY = surfaces.anodised("#6e7076", 0.26);
const DEFAULT_BACK = surfaces.plastic("#34353b", 0.35);

function Slate({ defaults, ...props }: SlateProps & { defaults: SlateDefaults }) {
  const [sw, sh] = props.region ? [props.region.width, props.region.height] : (props.screen ?? defaults.screen);
  const bezel = props.bezel ?? defaults.bezel;
  const radius = props.radius ?? defaults.radius;
  const depth = props.depth ?? defaults.depth;
  const camera = props.camera ?? true;
  const sensor = props.sensor ?? true;
  const buttons = props.buttons ?? true;
  const body = props.body ?? DEFAULT_BODY;
  const back = props.back ?? (props.body ? props.body : DEFAULT_BACK);

  const source = useDevice(
    (screen) => {
      const group = new Group();
      const w = sw + 2 * bezel;
      const h = sh + 2 * bezel;
      const outer = radius + bezel;
      const [lipSize, lipEdge] = defaults.lip;
      const frame = surfaceMaterial(body);
      const rear = surfaceMaterial(back);
      const front = bezelMaterial();
      const shell = new Mesh(solid(outline(w, h, outer), depth, lipSize, lipEdge), [front, frame, rear]);
      shell.castShadow = true;
      group.add(shell);

      const top = depth / 2;
      const picture = new Mesh(sheet(outline(sw, sh, radius), sw, sh), screen);
      picture.position.z = top + 0.3;
      group.add(picture);
      const materials: Material[] = [frame, rear, front];
      if (sensor) {
        const dot = new Mesh(
          new ShapeGeometry(outline(sw * 0.03, sw * 0.03, sw * 0.015), 4),
          new MeshPhysicalMaterial({ color: "#000000", roughness: 0.3, specularIntensity: 0 }),
        );
        dot.position.set(0, sh / 2 - sw * 0.045, top + 0.45);
        group.add(dot);
        materials.push(dot.material);
      }
      const cover = coverGlass(0.5, 0.06);
      const glassLayer = new Mesh(new ShapeGeometry(outline(w, h, outer), 4), cover);
      glassLayer.position.z = top + 0.6;
      glassLayer.renderOrder = 1;
      group.add(glassLayer);
      const glass: Material[] = [cover];

      if (camera) {
        // A raised island in the top corner with lenses in metal rings.
        const n = defaults.lenses;
        const size = n > 1 ? w * 0.36 : w * 0.16;
        const island = new Mesh(solid(outline(size, size, size * 0.3), 6, 1.5, 1.5), [rear, frame, rear]);
        const ix = w / 2 - size / 2 - w * 0.06;
        const iy = h / 2 - size / 2 - w * 0.06;
        // Seen from behind, the phone's left is +x: the island sits top left from the back.
        island.position.set(ix, iy, -depth / 2 - 1.5);
        island.rotation.y = Math.PI;
        island.castShadow = true;
        group.add(island);
        const ring = surfaceMaterial(body);
        const lens = new MeshPhysicalMaterial({
          color: "#05060a",
          roughness: 0.05,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          iridescence: 0.6,
          iridescenceIOR: 1.6,
        });
        materials.push(ring, lens);
        const r = n > 1 ? size * 0.2 : size * 0.3;
        const spots: [number, number][] =
          n > 1
            ? ([
                [-size * 0.22, size * 0.22],
                [-size * 0.22, -size * 0.22],
                [size * 0.24, size * 0.22],
              ].slice(0, n) as [number, number][])
            : [[0, 0]];
        for (const [lx, ly] of spots) {
          const barrel = new Mesh(new CylinderGeometry(r, r, 5, 48), [ring, lens, ring]);
          barrel.rotation.x = -Math.PI / 2;
          // The island is turned to face −z, so its x runs the other way.
          barrel.position.set(ix - lx, iy + ly, -depth / 2 - 6.5);
          group.add(barrel);
        }
        if (n > 1) {
          const flash = new Mesh(
            new CylinderGeometry(size * 0.06, size * 0.06, 1, 24),
            new MeshPhysicalMaterial({ color: "#d9d2c0", roughness: 0.4, specularIntensity: 0.4 }),
          );
          flash.rotation.x = -Math.PI / 2;
          flash.position.set(ix - size * 0.24, iy - size * 0.22, -depth / 2 - 4);
          group.add(flash);
          materials.push(flash.material);
        }
      }

      if (buttons) {
        // Pills along the edge, standing just proud of the frame.
        const t = Math.min(depth * 0.32, 14);
        const pill = (length: number, along: number, side: 1 | -1, onTop: boolean) => {
          const g = solid(outline(t, length, t / 2), 6, 1, 1);
          const m = new Mesh(g, [frame, frame, frame]);
          m.castShadow = true;
          if (onTop) {
            m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
            m.position.set(along, h / 2 + lipSize - 1.5, 0);
          } else {
            m.rotation.y = (side * Math.PI) / 2;
            m.position.set(side * (w / 2 + lipSize - 1.5), along, 0);
          }
          group.add(m);
        };
        if (defaults.buttonsOn === "sides") {
          pill(h * 0.11, h * 0.16, 1, false);
          pill(h * 0.07, h * 0.22, -1, false);
          pill(h * 0.07, h * 0.13, -1, false);
        } else {
          pill(w * 0.08, w * 0.34, 1, true);
          pill(h * 0.05, h * 0.36, 1, false);
          pill(h * 0.05, h * 0.29, 1, false);
        }
      }
      return { group, materials, glass, textures: [] };
    },
    [sw, sh, bezel, radius, depth, camera, sensor, buttons, surfaceKey(body), surfaceKey(back)],
    props,
  );

  return (
    <LiveSource
      ref={source}
      width={sw}
      height={sh}
      region={props.region}
      surface={props.surface === undefined ? "#000000" : props.surface}
      resolution={props.resolution ?? defaults.resolution}
    >
      {props.children}
    </LiveSource>
  );
}

export type PhoneProps = SlateProps;

/**
 * A generic phone: a 390 × 844 CSS-pixel screen (a phone's layout width) in a
 * thin black bezel, an anodised frame with a rounded lip, side buttons, a
 * three-lens camera island on the back. The screen shows its children, live,
 * as a <Panel> does; the cover glass over it reflects the stage's soft boxes
 * and environment. Centred on the origin, screen facing +z.
 */
export function Phone(props: PhoneProps) {
  return (
    <Slate
      {...props}
      defaults={{
        screen: [390, 844],
        bezel: 13,
        radius: 52,
        depth: 44,
        lip: [3, 9],
        resolution: 3,
        lenses: 3,
        buttonsOn: "sides",
      }}
    />
  );
}

export type TabletProps = SlateProps;

/** A generic tablet: an 820 × 1180 screen, an even bezel, one rear lens, buttons on top. */
export function Tablet(props: TabletProps) {
  return (
    <Slate
      {...props}
      defaults={{
        screen: [820, 1180],
        bezel: 26,
        radius: 22,
        depth: 34,
        lip: [3, 7],
        resolution: 2.5,
        lenses: 1,
        buttonsOn: "top",
      }}
    />
  );
}

/** A dark keyboard in its well, drawn once: rounded keys on a 15-unit grid. */
function keyboardTexture(width: number, height: number) {
  const canvas = document.createElement("canvas");
  const scale = 2048 / width;
  canvas.width = 2048;
  canvas.height = Math.round(height * scale);
  const g = canvas.getContext("2d");
  if (!g) return new CanvasTexture(canvas);
  g.fillStyle = "#060607";
  g.fillRect(0, 0, canvas.width, canvas.height);
  const rows: [number, number[]][] = [
    [0.6, Array(14).fill(15 / 14)],
    [1, [...Array(13).fill(1), 2]],
    [1, [1.5, ...Array(12).fill(1), 1.5]],
    [1, [1.75, ...Array(11).fill(1), 2.25]],
    [1, [2.25, ...Array(10).fill(1), 2.75]],
    [1, [1, 1, 1, 1.25, 5.5, 1.25, 1, 1, 1, 1]],
  ];
  const pad = canvas.width * 0.012;
  const unit = (canvas.width - 2 * pad) / 15;
  const rowH = (canvas.height - 2 * pad) / rows.reduce((s, [r]) => s + r, 0);
  const gap = unit * 0.1;
  let y = pad;
  for (const [rh, keys] of rows) {
    let x = pad;
    for (const k of keys) {
      const kw = k * unit - gap;
      const kh = rh * rowH - gap;
      const grad = g.createLinearGradient(0, y, 0, y + kh);
      grad.addColorStop(0, "#232428");
      grad.addColorStop(1, "#1a1b1e");
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x + gap / 2, y + gap / 2, kw, kh, unit * 0.12);
      g.fill();
      x += k * unit;
    }
    y += rh * rowH;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

export type LaptopProps = ScreenProps & {
  /** How far the lid is open, 0 (closed) to 1 (`maxAngle`). A function of the frame to animate it. */
  open?: number | ((frame: number) => number);
  /** The lid's angle in degrees from closed, instead of `open`. */
  angle?: number | ((frame: number) => number);
  /** The angle `open: 1` stands for. */
  maxAngle?: number;
  /** Lid, base and trackpad. Default bead-blasted silver aluminium. */
  body?: Surface;
  /** Bezel around the picture: [sides, top, bottom], in CSS pixels. */
  bezel?: [number, number, number];
  /** Corner radius of the picture. */
  radius?: number;
  /** Base thickness. */
  thickness?: number;
  /** Lid thickness. */
  lid?: number;
};

const DEFAULT_LAPTOP = surfaces.aluminium({ color: "#c3c6cc", brushed: 0.15, roughness: 0.36 });

/**
 * A generic laptop: a base with a keyboard sunk into its well and a flush
 * trackpad, and a lid on a hinge at the base's back edge. `open` (or `angle`)
 * rotates the lid and may be a function of the frame. The screen (1440 × 900
 * CSS pixels by default) shows its children live, under cover glass.
 *
 * The origin is the middle of the base's underside: pose it with `position`
 * at the floor's height to stand it on a <Floor>. Opened, the screen faces +z.
 */
export function Laptop({
  open = 1,
  angle,
  maxAngle = 110,
  body = DEFAULT_LAPTOP,
  bezel = [22, 28, 46],
  radius = 12,
  thickness = 30,
  lid = 14,
  ...screenProps
}: LaptopProps) {
  const [sw, sh] = screenProps.region
    ? [screenProps.region.width, screenProps.region.height]
    : (screenProps.screen ?? [1440, 900]);
  const [side, topBezel, chin] = bezel;
  const lidW = sw + 2 * side;
  const lidH = sh + topBezel + chin;
  const gap = 1.5;
  const depthD = lidH + lid / 2 + 2;
  const hingeZ = -depthD / 2 + lid / 2;
  const hingeY = thickness + lid / 2 + gap;
  const pivot = useRef<Group | null>(null);

  const source = useDevice(
    (screen) => {
      const group = new Group();
      const metal = surfaceMaterial(body);
      const pad = surfaceMaterial(body);
      (pad as MeshPhysicalMaterial).roughness *= 0.85;
      (pad as MeshPhysicalMaterial).anisotropy = 0;
      const dark = new MeshPhysicalMaterial({ color: "#0a0a0b", roughness: 0.6, specularIntensity: 0.3 });
      const hingeMetal = new MeshPhysicalMaterial({ color: "#2a2b2f", metalness: 1, roughness: 0.4 });
      const keys = keyboardTexture(lidW * 0.8, depthD * 0.4);
      const keyboard = new MeshPhysicalMaterial({ map: keys, roughness: 0.55, specularIntensity: 0.25 });

      // Base, built as a slab facing +z and laid flat: shape y runs to the back (−z).
      const base = new Group();
      base.rotation.x = -Math.PI / 2;
      base.position.y = thickness / 2;
      group.add(base);
      const corner = Math.min(lidW, depthD) * 0.045;
      const lipSize = 3;
      const kb: [number, number, number, number] = [lidW * 0.8, depthD * 0.4, 0, depthD / 2 - depthD * 0.09];
      kb[3] -= kb[1] / 2;
      const tp: [number, number, number, number] = [lidW * 0.42, depthD * 0.36, 0, -depthD / 2 + depthD * 0.05];
      tp[3] += tp[1] / 2;
      const deck = outline(lidW, depthD, corner);
      deck.holes.push(contour(new Path(), kb[0], kb[1], corner * 0.35, kb[2], kb[3]));
      deck.holes.push(contour(new Path(), tp[0], tp[1], corner * 0.45, tp[2], tp[3]));
      const shell = new Mesh(solid(deck, thickness, lipSize, lipSize), [metal, metal, metal]);
      shell.castShadow = true;
      base.add(shell);
      // Plates that fill the holes: the keyboard sunk a little, the trackpad flush.
      const fill = (
        [w, h, x, y]: [number, number, number, number],
        r: number,
        sink: number,
        face: Material,
        edge: Material,
      ) => {
        const shrink = 2 * lipSize + 1;
        const plateDepth = thickness - sink - 1;
        const g = solid(outline(w - shrink, h - shrink, Math.max(1, r - shrink / 2)), plateDepth);
        const plate = new Mesh(g, [face, edge, edge]);
        plate.position.set(x, y, thickness / 2 - sink - plateDepth / 2);
        if (face === keyboard) {
          // Map the key grid over the plate's face.
          const pos = g.getAttribute("position");
          const uv = g.getAttribute("uv");
          for (let i = 0; i < pos.count; i++) {
            uv.setXY(
              i,
              (pos.getX(i) + (w - shrink) / 2) / (w - shrink),
              (pos.getY(i) + (h - shrink) / 2) / (h - shrink),
            );
          }
        }
        base.add(plate);
      };
      fill(kb, corner * 0.35, 1.6, keyboard, dark);
      fill(tp, corner * 0.45, 0.4, pad, dark);
      // The underside, closed over the holes the wells leave in the slab (it shows in floor reflections).
      const underside = new Mesh(new ShapeGeometry(outline(lidW, depthD, corner), 4), metal);
      underside.rotation.y = Math.PI;
      underside.position.z = -thickness / 2 - 0.3;
      base.add(underside);

      // The hinge barrel along the back edge.
      const barrel = new Mesh(
        new CylinderGeometry(lid / 2 + gap, lid / 2 + gap, lidW - 2 * corner - 40, 48),
        hingeMetal,
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0, hingeY, hingeZ);
      group.add(barrel);

      // The lid, upright in the pivot's frame (open 90°): its bottom edge on the hinge axis, screen facing +z.
      const hinge = new Group();
      hinge.position.set(0, hingeY, hingeZ);
      group.add(hinge);
      pivot.current = hinge;
      const lidRadii: Radii = [corner, corner, 4, 4];
      const front = bezelMaterial();
      const lidShell = new Mesh(solid(outline(lidW, lidH, lidRadii), lid, 2, 2), [front, metal, metal]);
      lidShell.position.y = lidH / 2 + 2;
      lidShell.castShadow = true;
      hinge.add(lidShell);
      const picture = new Mesh(sheet(outline(sw, sh, radius), sw, sh), screen);
      picture.position.set(0, 2 + chin + sh / 2, lid / 2 + 0.3);
      hinge.add(picture);
      const cover = coverGlass(0.5, 0.06);
      const glassLayer = new Mesh(new ShapeGeometry(outline(lidW, lidH, lidRadii), 4), cover);
      glassLayer.position.set(0, lidH / 2 + 2, lid / 2 + 0.6);
      glassLayer.renderOrder = 1;
      hinge.add(glassLayer);

      return {
        group,
        materials: [metal, pad, dark, hingeMetal, keyboard, front],
        glass: [cover],
        textures: [keys],
      };
    },
    [sw, sh, side, topBezel, chin, radius, thickness, lid, surfaceKey(body)],
    screenProps,
    (t) => {
      const degrees = angle !== undefined ? (valueAt(angle, t) ?? 0) : (valueAt(open, t) ?? 1) * maxAngle;
      // Upright is 90° open; closed folds the screen face down onto the keyboard.
      if (pivot.current) pivot.current.rotation.x = rad(90 - degrees);
    },
  );

  return (
    <LiveSource
      ref={source}
      width={sw}
      height={sh}
      region={screenProps.region}
      surface={screenProps.surface === undefined ? "#000000" : screenProps.surface}
      resolution={screenProps.resolution ?? 2}
    >
      {screenProps.children}
    </LiveSource>
  );
}
