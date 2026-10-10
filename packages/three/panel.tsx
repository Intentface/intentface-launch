import { waitFor } from "@intentface-launch/core";
import {
  type CaptureManifest,
  measureSnapshot,
  type Rect,
  Snapshot,
  type SnapshotApi,
  snapshotUrl,
} from "@intentface-launch/core/kit";
import { type ReactNode, type Ref, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  type BufferGeometry,
  Color,
  ExternalTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  type Object3D,
  Shape,
  ShapeGeometry,
  type Texture,
} from "three";
import type { Vec3 } from "./lens.js";
import { type Surface, surfaceMaterial, transmits } from "./materials.js";
import { StageContext, type StageItem, uploadElement } from "./stage.js";

/** Where a panel is at one frame. Rotation in degrees (X tilts back, Y turns, Z rolls). */
export type Pose = { position?: Vec3; rotation?: Vec3; scale?: number; opacity?: number };

export type PanelProps = {
  /** Part of the children to show, in their CSS pixels (a capture mark's rect). Default: `size` from the origin. */
  region?: Rect;
  /**
   * The snapshot the panel shows when it has no children, as for <Snapshot>:
   * `{ capture, name, animate }`. `select` measures in it.
   */
  snapshot?: { capture: CaptureManifest; name: string; animate?: (api: SnapshotApi, frame: number) => void };
  /**
   * The region as a CSS selector in `snapshot` ("aside ul > li:nth-child(6)"),
   * measured in the snapshot when it loads, in place of a mark: no marks step,
   * and it follows a recapture. `pose` gets the measured region.
   */
  select?: string;
  /** Panel size in CSS pixels, when not given by `region`. */
  size?: [number, number];
  /** Corner radius of the UI it carries, so geometry and pixels agree. */
  radius?: number;
  /** Slab thickness. 0 makes a flat layer with no edges, for UI parts that assemble onto a panel. */
  depth?: number;
  /** Width of the rounded lip around the face, where light catches the edge. */
  bevel?: number;
  /** Texture pixels per CSS pixel (times the render scale). Raise for close-ups. */
  resolution?: number;
  /** How much the light shades the UI, 0 (flat, exact colours) to 1 (fully lit surface). */
  lit?: number;
  /** Colour of the edges and back. */
  edge?: string;
  /**
   * What the slab is made of, instead of `edge`: `surfaces.frosted()` for the
   * translucent card in 3D (the UI floats on glass that blurs what is behind
   * it; set `surface={null}` or a translucent fill), `surfaces.aluminium()`,
   * `surfaces.gloss(colour)` and so on.
   */
  body?: Surface;
  /**
   * Opaque fill behind the UI on the face (the product's background). Product
   * surfaces are often translucent; without a fill you would see into the slab.
   * `null` keeps the UI's own transparency, for layers.
   */
  surface?: string | null;
  /**
   * What translucent UI is blended as if over. Browsers blend in sRGB, the
   * stage in linear light, where 5% white reads as 25% grey. The face's alpha
   * is corrected so the UI over this colour looks exactly as in the browser
   * (and close over anything near it). `null` blends physically.
   */
  over?: string | null;
  /** Where the panel is at a frame. `region` is the part of the UI it shows, for `centerOf(region, …)`. */
  pose?: (frame: number, region: Rect) => Pose;
  /** What the face shows. Default: `snapshot`. */
  children?: ReactNode;
};

// Selector regions measured on this page, so a panel mounting later starts with its region.
const measured = new Map<string, Rect>();

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.max(0.01, Math.min(r, w / 2, h / 2));
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Slab whose front face is exactly `w` × `h` (the UI, pixel for pixel), with
 * a rounded lip of `bevel` around it. Material groups: 0 face, 1 sides, 2 back.
 */
function slab(w: number, h: number, radius: number, depth: number, bevel: number) {
  const core = Math.max(0.01, depth - 2 * bevel);
  const geometry = new ExtrudeGeometry(roundedRect(w, h, radius), {
    depth: core,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -core / 2);
  // ExtrudeGeometry puts both lids in group 0, back lid first. Split them, and
  // map the front lid's UVs over the face (v = 0 at the top, as DOM textures are).
  const [lids, sides] = geometry.groups;
  const half = lids.count / 2;
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = lids.start; i < lids.start + lids.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (h / 2 - pos.getY(i)) / h);
  }
  uv.needsUpdate = true;
  geometry.clearGroups();
  geometry.addGroup(lids.start, half, 2);
  geometry.addGroup(lids.start + half, half, 0);
  geometry.addGroup(sides.start, sides.count, 1);
  return geometry;
}

/** Flat layer: just the face, UVs over it. */
function flat(w: number, h: number, radius: number) {
  const geometry = new ShapeGeometry(roundedRect(w, h, radius), 16);
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (h / 2 - pos.getY(i)) / h);
  geometry.clearGroups();
  geometry.addGroup(0, geometry.index ? geometry.index.count : pos.count, 0);
  return geometry;
}

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Make translucent texels composite like the browser does. The browser blends
 * sRGB values: out = a·c + (1 − a)·b. The stage blends linear light. For the
 * backdrop colour `over` this picks the alpha whose linear blend gives the
 * browser's result (by luminance), so a 5% white wash stays a 5% wash.
 */
function browserBlending(material: MeshPhysicalMaterial, over: string) {
  const b = new Color(over); // three stores colours linear
  material.onBeforeCompile = (shader) => {
    shader.uniforms.overLinear = { value: b };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec3 overLinear;
vec3 launchToSrgb(vec3 c) { return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 launchToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
#ifdef USE_MAP
{
  float a = sampledDiffuseColor.a;
  if (a > 0.0 && a < 1.0) {
    vec3 lum = vec3(0.2126, 0.7152, 0.0722);
    vec3 target = launchToLinear(a * launchToSrgb(sampledDiffuseColor.rgb) + (1.0 - a) * launchToSrgb(overLinear));
    float span = dot(sampledDiffuseColor.rgb - overLinear, lum);
    float fixedA = abs(span) > 1e-4 ? clamp(dot(target - overLinear, lum) / span, 0.0, 1.0) : a;
    diffuseColor.a *= fixedA / a;
  }
}
#endif`,
      );
  };
  material.customProgramCacheKey = () => `launch-blend-${over}`;
}

/**
 * UI in 3D: a thin slab whose face is its children, live. Put a <Snapshot>,
 * a <BrowserWindow> or any DOM inside; it is laid out at CSS size, drawn into
 * a mipmapped texture every frame it changes, and posed by `pose(frame)`.
 * With `region`, only that part of the children is shown, so one snapshot
 * can be split into layers that assemble in space.
 */
export function Panel({
  region: given,
  snapshot,
  select,
  size,
  radius = 16,
  depth = 8,
  bevel = 2,
  resolution = 2,
  lit = 0.3,
  edge = "#232329",
  body,
  surface = "#18181c",
  over = "#000000",
  pose,
  children,
}: PanelProps) {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("<Panel> must be inside <Stage3D>");
  if (select && !snapshot) throw new Error(`<Panel select="${select}"> needs \`snapshot\` to measure in`);
  const key = select && snapshot ? `${snapshotUrl(snapshot.capture, snapshot.name)} ${select}` : "";
  const [found, setFound] = useState(() => (key ? measured.get(key) : undefined));
  const region = (key ? (found ?? measured.get(key)) : undefined) ?? given;
  const w = region?.width ?? size?.[0] ?? 0;
  const h = region?.height ?? size?.[1] ?? 0;
  const source = useRef<HTMLDivElement>(null);
  const latestPose = useRef(pose);
  latestPose.current = pose;
  const shown = useRef<Rect>({ x: 0, y: 0, width: w, height: h });
  shown.current = region ?? { x: 0, y: 0, width: w, height: h };

  // Measure the selector in the snapshot before the frame is let go, then
  // draw the stage again with the panel in it, synchronously.
  useLayoutEffect(() => {
    if (!key || !snapshot || !select || measured.has(key)) return;
    let live = true;
    waitFor(
      measureSnapshot(snapshot.capture, snapshot.name, select).then((rect) => {
        measured.set(key, rect);
        if (!live) return;
        flushSync(() => {
          setFound(rect);
          stage.refresh();
        });
      }),
      `Panel ${select}`,
    );
    return () => {
      live = false;
    };
  }, [key]);

  const bodyKey = body ? JSON.stringify(body) : "";
  const parts = useMemo(() => {
    // A selector region not measured yet: nothing to build.
    if (w <= 0 || h <= 0) return null;
    const live = liveTexture();
    const glass = !!body && transmits(body);
    const face = faceMaterial(stage.live ? live.texture : null, { lit, over, specular: glass ? 0 : 0.18 });
    const rim = body
      ? surfaceMaterial(body)
      : new MeshPhysicalMaterial({
          color: edge,
          roughness: 0.3,
          metalness: 0.1,
          clearcoat: 1,
          clearcoatRoughness: 0.15,
        });
    const back = body ? rim : new MeshPhysicalMaterial({ color: edge, roughness: 0.8 });
    rim.transparent = back.transparent = true;
    const geometry: BufferGeometry = depth > 0 ? slab(w, h, radius, depth, bevel) : flat(w, h, radius);
    const group = new Group();
    let mesh: Mesh;
    if (glass && depth > 0) {
      // A glass slab, and the UI as its own layer just in front of the glass face.
      mesh = new Mesh(geometry, [rim, rim, rim]);
      const layer = new Mesh(flat(w, h, radius), face);
      layer.position.z = depth / 2 + 0.25;
      group.add(mesh, layer);
    } else {
      mesh = new Mesh(geometry, [face, rim, back]);
      group.add(mesh);
    }
    mesh.castShadow = true;
    const materials = [...new Set([face, rim, back])];
    const opacities = new Map(materials.map((m) => [m, m.opacity]));
    return { live, mesh, group, materials, opacities, glass };
    // `body` is compared by value (callers build it inline every frame).
  }, [stage.live, w, h, radius, depth, bevel, lit, edge, bodyKey, over]);

  useLayoutEffect(() => {
    if (!parts) return;
    const item: StageItem = {
      object: parts.group,
      element: source.current,
      update(t) {
        const opacity = applyPose(parts.group, latestPose.current?.(t, shown.current) ?? {});
        for (const m of parts.materials) {
          m.opacity = (parts.opacities.get(m) ?? 1) * opacity;
          // Opaque panels write depth so the lip and face sort cleanly.
          m.depthWrite = opacity > 0.98;
        }
      },
      capture(gl) {
        parts.live.capture(gl, source.current);
      },
    };
    const remove = stage.add(item);
    return () => {
      remove();
      parts.group.traverse((o) => (o as Mesh).geometry?.dispose());
      for (const m of parts.materials) m.dispose();
    };
  }, [stage, parts]);

  return (
    <LiveSource
      ref={source}
      width={w}
      height={h}
      region={region}
      radius={radius}
      surface={surface}
      resolution={resolution}
    >
      {children ??
        (snapshot && <Snapshot capture={snapshot.capture} name={snapshot.name} animate={snapshot.animate} />)}
    </LiveSource>
  );
}

/**
 * Live DOM as a texture: `capture` uploads a canvas child's paint into
 * `texture` (called from a StageItem's `capture`). Shared by Panel and the
 * devices' screens.
 */
export function liveTexture() {
  const texture = new ExternalTexture(null);
  let handle: WebGLTexture | null = null;
  return {
    texture,
    capture(gl: WebGL2RenderingContext, el: Element | null) {
      if (!el) return;
      handle ??= gl.createTexture();
      texture.sourceTexture = handle;
      if (handle) uploadElement(gl, handle, el);
    },
  };
}

/**
 * The material that shows UI: `map` (a live texture, or null where DOM
 * textures are unavailable) as both colour and glow. `lit` is how much the
 * lights shade it (0 shows the UI's exact colours), `brightness` scales the
 * glow (above 1, a screen turned up), `specular` its own sheen.
 */
export function faceMaterial(
  map: Texture | null,
  {
    lit = 0.3,
    over = "#000000",
    specular = 0.18,
    brightness = 1,
  }: { lit?: number; over?: string | null; specular?: number; brightness?: number } = {},
) {
  const face = new MeshPhysicalMaterial({
    color: new Color(1, 1, 1).multiplyScalar(lit),
    emissive: new Color(1, 1, 1).multiplyScalar(1 - lit),
    emissiveIntensity: brightness,
    ...(map ? { map, emissiveMap: map } : { color: "#1d1d22", emissive: "#000000" }),
    // Glossy but anti-reflective, like a display: soft boxes read as a faint
    // sheen. Full dielectric reflectance veils the UI grey at grazing angles.
    roughness: 0.22,
    metalness: 0,
    specularIntensity: specular,
    transparent: true,
  });
  if (map && over) browserBlending(face, over);
  return face;
}

/** Sets `object`'s transform from a pose and hides it when faded out. Returns the pose's opacity. */
export function applyPose(object: Object3D, p: Pose) {
  object.position.set(...(p.position ?? [0, 0, 0]));
  const [x, y, z] = p.rotation ?? [0, 0, 0];
  object.rotation.set(rad(x), rad(y), rad(z));
  object.scale.setScalar(p.scale ?? 1);
  const opacity = p.opacity ?? 1;
  object.visible = opacity > 0.001;
  return opacity;
}

/**
 * The DOM a live texture is made from: laid out (unpainted) inside the
 * stage's canvas at `width` × `height` CSS pixels, showing `region` of its
 * children, re-laid out at `resolution` times the size for a sharp texture.
 */
export function LiveSource({
  ref,
  width,
  height,
  region,
  radius = 0,
  surface,
  resolution = 2,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  width: number;
  height: number;
  region?: Rect;
  radius?: number;
  surface?: string | null;
  resolution?: number;
  children: ReactNode;
}) {
  const x = region?.x ?? 0;
  const y = region?.y ?? 0;
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        overflow: "hidden",
        borderRadius: radius,
        background: surface ?? undefined,
        // Zoom re-lays out at a larger scale: a sharper texture, not an upscaled one.
        zoom: resolution,
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "absolute", left: -x, top: -y }}>{children}</div>
    </div>
  );
}

/**
 * Centre of `rect` in stage units, for a content area of `width` × `height`
 * centred on the origin (y up). Places a region panel where it sits in the UI.
 */
export const centerOf = (rect: Rect, width: number, height: number, z = 0): Vec3 => [
  rect.x + rect.width / 2 - width / 2,
  height / 2 - (rect.y + rect.height / 2),
  z,
];

/** Camera distance at which something `height` tall fills the frame, for a lens of `fov` degrees. */
export const fillDistance = (height: number, fov = 30) => height / 2 / Math.tan((fov * Math.PI) / 360);
