import { useContext, useLayoutEffect } from "react";
import { type FloorConfig, StageContext } from "./stage.js";

/**
 * A ground plane that shows only what it does to the scene: a glossy
 * reflection (`reflect`, blurred by `roughness`) and soft shadows (`shadow`,
 * as soft as the lights are large). Over a backdrop or a transparent stage the
 * floor itself stays invisible, so panels stand on a polished nothing.
 */
export function Floor(props: FloorConfig) {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("<Floor> must be inside <Stage3D>");
  const key = JSON.stringify(props);
  useLayoutEffect(() => {
    stage.setFloor(JSON.parse(key) as FloorConfig);
    return () => stage.setFloor(null);
  }, [stage, key]);
  return null;
}
