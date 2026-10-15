import { init } from "@plausible-analytics/tracker";

/**
 * Plausible: cookieless, no personal data, so no consent banner. Page views and
 * outbound link clicks only (add "Outbound Link: Click" as a goal in Plausible).
 * Events go to a same-origin path that next.config.ts rewrites to plausible.io,
 * so content blockers that match the plausible.io domain do not drop them.
 * Localhost is not counted.
 */
let started = false;

export function startAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  init({ domain: "launch.intentface.com", endpoint: "/p/event", outboundLinks: true, logging: false });
}
