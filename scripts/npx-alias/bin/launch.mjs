#!/usr/bin/env node
// `npx intentface-launch …` outside a launch folder lands here: run core's CLI
// with the same arguments, so it does what `npx @intentface-launch/core …` does.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const core = createRequire(import.meta.url).resolve("@intentface-launch/core/package.json");
const { status, signal } = spawnSync(
  process.execPath,
  [join(dirname(core), "bin/launch.mjs"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
  },
);
process.exit(signal ? 1 : (status ?? 1));
