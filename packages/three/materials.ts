import { Color, DoubleSide, MeshPhysicalMaterial, type MeshPhysicalMaterialParameters } from "three";

/**
 * Physical surfaces for panel bodies, edges and anything else on a stage.
 * Units are CSS pixels, so `thickness` is in pixels too.
 *
 * Glass (`glass`, `frosted`) refracts what is behind it: a `backdrop` or
 * `background` on the Stage3D, and opaque panels. Without one there is
 * nothing to see through and glass reads as grey.
 */
export type Surface =
  | { kind: "glass"; tint?: string; roughness?: number; thickness?: number; ior?: number }
  | { kind: "frosted"; tint?: string; roughness?: number; thickness?: number; sheen?: number }
  | { kind: "aluminium"; color?: string; brushed?: number; roughness?: number }
  | { kind: "anodised"; color: string; roughness?: number }
  | { kind: "matte"; color: string }
  | { kind: "plastic"; color: string; gloss?: number }
  | { kind: "gloss"; color: string };

export const surfaces = {
  /** Clear glass: sharp refraction, a bright rim where light enters edge-on. */
  glass: (o: Omit<Extract<Surface, { kind: "glass" }>, "kind"> = {}): Surface => ({ kind: "glass", ...o }),
  /** Frosted glass: what is behind blurs by `roughness` (0.2 soft to 0.6 milky). The brand's translucent card in 3D. */
  frosted: (o: Omit<Extract<Surface, { kind: "frosted" }>, "kind"> = {}): Surface => ({ kind: "frosted", ...o }),
  /** Brushed aluminium: anisotropic highlights stretched along the grain. */
  aluminium: (o: Omit<Extract<Surface, { kind: "aluminium" }>, "kind"> = {}): Surface => ({ kind: "aluminium", ...o }),
  /** Anodised metal in a colour: metallic, a touch softer than bare aluminium. */
  anodised: (color: string, roughness?: number): Surface => ({ kind: "anodised", color, roughness }),
  /** Matte plastic or paint: no highlight to speak of. */
  matte: (color: string): Surface => ({ kind: "matte", color }),
  /** Moulded plastic with a soft sheen. */
  plastic: (color: string, gloss?: number): Surface => ({ kind: "plastic", color, gloss }),
  /** Lacquer: a clear coat over colour, mirror-like reflections of the soft boxes. */
  gloss: (color: string): Surface => ({ kind: "gloss", color }),
};

/** True for surfaces that need the transmission pass. */
export const transmits = (s: Surface) => s.kind === "glass" || s.kind === "frosted";

export function surfaceParameters(s: Surface): MeshPhysicalMaterialParameters {
  switch (s.kind) {
    case "glass":
      return {
        color: new Color(s.tint ?? "#ffffff"),
        metalness: 0,
        roughness: s.roughness ?? 0.03,
        transmission: 1,
        thickness: s.thickness ?? 24,
        ior: s.ior ?? 1.5,
        specularIntensity: 1,
        side: DoubleSide,
      };
    case "frosted":
      return {
        color: new Color(s.tint ?? "#ffffff"),
        metalness: 0,
        roughness: s.roughness ?? 0.4,
        transmission: 1,
        thickness: s.thickness ?? 16,
        ior: 1.45,
        // Rough glass spreads a big soft box into a grey veil: keep the sheen low on dark UI.
        specularIntensity: s.sheen ?? 0.2,
        side: DoubleSide,
      };
    case "aluminium":
      return {
        color: new Color(s.color ?? "#c8cbd0"),
        metalness: 1,
        roughness: s.roughness ?? 0.32,
        anisotropy: s.brushed ?? 0.8,
      };
    case "anodised":
      return {
        color: new Color(s.color),
        metalness: 1,
        roughness: s.roughness ?? 0.38,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
      };
    case "matte":
      return { color: new Color(s.color), metalness: 0, roughness: 0.9, specularIntensity: 0.3 };
    case "plastic":
      return {
        color: new Color(s.color),
        metalness: 0,
        roughness: 1 - (s.gloss ?? 0.55),
        clearcoat: 0.4,
        clearcoatRoughness: 0.4,
      };
    case "gloss":
      return { color: new Color(s.color), metalness: 0, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.04 };
  }
}

export const surfaceMaterial = (s: Surface) => new MeshPhysicalMaterial(surfaceParameters(s));
