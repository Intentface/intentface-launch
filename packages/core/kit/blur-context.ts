import { createContext } from "react";

/** True inside a <MotionBlur> sample, so nested blurs do not multiply. */
export const BlurContext = createContext(false);
