// 3D add-on for @intentface-launch/core. A separate package, so videos that
// do not use it never load three.js.

export { Cone, type ConePose } from "./cone.js";
export {
  Laptop,
  type LaptopProps,
  Phone,
  type PhoneProps,
  type ScreenProps,
  Tablet,
  type TabletProps,
} from "./devices.js";
export type { Environment, EnvironmentPreset } from "./environment.js";
export { Floor } from "./floor.js";
export { exploded, fan, grid, mixPose, offsetPose, stack } from "./layouts.js";
export {
  apertureFor,
  cocPx,
  diskSample,
  distanceTo,
  type Lens,
  orbit,
  type Projected,
  pixelsPerUnit,
  project,
  type Vec3,
} from "./lens.js";
export {
  ADDITIVE,
  Beam,
  type BeamPose,
  Glow,
  type GlowPose,
  type LightColour,
  type LightGradient,
  Ring,
  type RingPose,
  useStageItem,
  Wave,
  type WavePose,
} from "./light.js";
export { Light, type PoseOf } from "./light-components.js";
export { keyLight, rimLight, type SoftBox, sweep, threePoint } from "./lights.js";
export { type Surface, surfaces } from "./materials.js";
export { Overlay3D, type Overlay3DProps } from "./overlay.js";
export { centerOf, fillDistance, Panel, type PanelProps, type Pose } from "./panel.js";
export { type Grade, type GradeName, grades, type Post } from "./post.js";
export { Prism, type PrismPose, type PrismTrace } from "./prism.js";
export {
  dollyThrough,
  type Framing,
  follow,
  frame,
  framingAt,
  type Handheld,
  handheld,
  type LensFn,
  macroSlide,
  orbitMove,
  pullBack,
  pushIn,
  type RigKey,
  rig,
  sequence,
  topDown,
  turntable,
} from "./rigs.js";
export {
  type Glass,
  type GlassName,
  glasses,
  refractiveIndex,
  type SpectrumBand,
  spectrumBands,
  wavelengthToLinear,
} from "./spectrum.js";
export {
  type FloorConfig,
  htmlInCanvas,
  Stage3D,
  type Stage3DProps,
  StageContext,
  type StageItem,
} from "./stage.js";
export { Smear, type SmearPose, type SmearSpot } from "./surface-light.js";
