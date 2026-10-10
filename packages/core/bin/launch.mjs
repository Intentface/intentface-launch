#!/usr/bin/env node
// tsx loads the project's own TypeScript (launch.config.ts, capture scripts,
// add-ons that ship source). Core runs from source in a checkout of the repo,
// and from dist/ when installed from the registry, which ships no source.
import { existsSync } from "node:fs";
import { register } from "tsx/esm/api";

register();
const source = new URL("../cli/launch.ts", import.meta.url);
await import(existsSync(source) ? source.href : new URL("../dist/cli/launch.js", import.meta.url).href);
