// The examples library's one look (videos/example-*), in two themes. Every
// example reads `look` while it renders; it is the light theme unless a parent
// wraps the example in <ExampleTheme value={DARK}> (a reel on a dark film plays
// them that way, so light UI is never dropped onto black). Not a video: the
// studio lists only videos/*/video.tsx.
import * as React from "react";
import { createContext, type ReactNode, use } from "react";

export type ExampleLook = {
  ground: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  /** A firmer edge: an input's border. */
  lineStrong: string;
  accent: string;
  accentSoft: string;
  /** Selected text. */
  selection: string;
  /** The first action of a menu, at rest. */
  chip: string;
  done: string;
  doneSoft: string;
  /** A neutral fill for controls and avatars at rest. */
  quiet: string;
  /** A pill's fill in its neutral state. */
  pill: string;
  /** Window chrome: the traffic-light dots. */
  dots: string;
  /** An empty slot waiting for content, and its dashed edge. */
  slot: string;
  slotLine: string;
  /** Cards' tints (a catalogue), and a warm avatar's fill and initials. */
  swatches: string[];
  warm: [string, string];
  /** The other ground, for a card that alternates with the usual one, and its ink. */
  altGround: string;
  altInk: string;
  font: string;
  mono: string;
  radius: number;
  control: number;
  shadow: string;
  /** A surface lifted above the page (a menu, a toast, a hero card). */
  raised: string;
  /** A toast's fill: dark in either theme, under white text. */
  toast: string;
};

const shared = {
  font: '"Studio Sans", system-ui, sans-serif',
  mono: '"Studio Mono", ui-monospace, Menlo, monospace',
  radius: 14,
  control: 10,
};

export const LIGHT: ExampleLook = {
  ...shared,
  ground: "#f4f3f0",
  surface: "#ffffff",
  ink: "#16161a",
  muted: "#6b6b76",
  line: "rgb(22 22 26 / 0.08)",
  lineStrong: "rgb(22 22 26 / 0.14)",
  accent: "#4f5bff",
  accentSoft: "rgb(79 91 255 / 0.12)",
  selection: "rgb(79 91 255 / 0.2)",
  chip: "#eef0ff",
  done: "#1f9d6b",
  doneSoft: "rgb(31 157 107 / 0.14)",
  quiet: "#ebeae6",
  pill: "#dfe0e8",
  dots: "rgb(22 22 26 / 0.12)",
  slot: "rgb(255 255 255 / 0.7)",
  slotLine: "rgb(22 22 26 / 0.2)",
  swatches: ["#dfe2ff", "#d7efe5", "#f1e6d8", "#e6e5e1", "#e9ddf3", "#dcecf3"],
  warm: ["#f1e6d8", "#8a5a1f"],
  altGround: "#0f1013",
  altInk: "#f3f2ef",
  shadow: "0 1px 2px rgb(22 22 26 / 0.06), 0 12px 32px rgb(22 22 26 / 0.07)",
  raised: "0 2px 4px rgb(22 22 26 / 0.06), 0 16px 48px rgb(22 22 26 / 0.12)",
  toast: "#16161a",
};

/** Surfaces a step lighter than the ground, separated by tone; the accent lifted to read on dark. */
export const DARK: ExampleLook = {
  ...shared,
  ground: "#0b0b0d",
  surface: "#17171b",
  ink: "#f3f2ef",
  muted: "#9a9aa6",
  line: "rgb(255 255 255 / 0.08)",
  lineStrong: "rgb(255 255 255 / 0.16)",
  accent: "#6f7aff",
  accentSoft: "rgb(111 122 255 / 0.2)",
  selection: "rgb(111 122 255 / 0.32)",
  chip: "#242640",
  done: "#2bb57f",
  doneSoft: "rgb(43 181 127 / 0.2)",
  quiet: "#232328",
  pill: "#2a2a31",
  dots: "rgb(255 255 255 / 0.14)",
  slot: "rgb(255 255 255 / 0.04)",
  slotLine: "rgb(255 255 255 / 0.14)",
  swatches: ["#2b2f5c", "#1f4136", "#4a3a26", "#2d2d31", "#3d2f4f", "#203f4c"],
  warm: ["#4a3a26", "#f1c98a"],
  altGround: "#f3f2ef",
  altInk: "#16161a",
  shadow: "0 1px 2px rgb(0 0 0 / 0.4), 0 12px 32px rgb(0 0 0 / 0.45)",
  raised: "0 2px 4px rgb(0 0 0 / 0.4), 0 16px 48px rgb(0 0 0 / 0.55)",
  toast: "#2c2c33",
};

const Theme = createContext<ExampleLook>(LIGHT);

/** Plays the examples inside it in `value` (LIGHT, DARK, or either with changes). */
export function ExampleTheme({ value, children }: { value: ExampleLook; children: ReactNode }) {
  return <Theme value={value}>{children}</Theme>;
}

/**
 * The theme in effect. During a render, the nearest <ExampleTheme> (context may
 * be read conditionally with `use`); outside one (a module loading, React
 * Refresh inspecting the exports), light. Checked through React's current
 * dispatcher, since `use` outside a render logs an error before it throws.
 */
function current(): ExampleLook {
  const internals = (React as unknown as Record<string, { H?: unknown } | undefined>)
    .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  return internals?.H ? use(Theme) : LIGHT;
}

/**
 * The look, as the examples read it: `look.accent` in any render gives the
 * theme in effect there. Read it while rendering, never into a module-level
 * constant (that would fix the light theme for good): make such values
 * functions (`const fill = () => ({ background: look.ground })`).
 */
export const look: ExampleLook = new Proxy({} as ExampleLook, {
  get: (_, key) => current()[key as keyof ExampleLook],
});
