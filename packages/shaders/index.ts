// WebGPU effects add-on for @intentface-launch/core: the Shaders library
// (shaders.com) on the video's clock. A separate package, so videos that do
// not use it never load it.

export type { ComponentType } from "./definitions.js";
export {
  type CanvasPicture,
  clipTexture,
  picture,
  shift,
  type TextPicture,
  textPicture,
  usePictures,
} from "./image.js";
export { type ComponentConfig, Shaders, type ShadersProps } from "./layer.js";
export { LiquidMetal, type LiquidMetalProps, PaperShader, type PaperShaderProps } from "./paper.js";
export {
  type DrawSource,
  type PathSource,
  type Shape,
  type ShapeAt,
  type ShapeProps,
  type ShapeSource,
  shape,
  type TextSource,
  useShapes,
} from "./shape.js";
