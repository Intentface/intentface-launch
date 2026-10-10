import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LaunchConfig, ProductLink } from "./config.js";

/**
 * The folder holding core's code: the package itself when it runs from source
 * (this repo, a linked checkout), its dist/ when installed from the registry.
 * Its real path, through pnpm's links.
 */
export const CODE = realpathSync(fileURLToPath(new URL("..", import.meta.url)));

/** Where @intentface-launch/core is installed: its package.json, skills, tools and guide. */
export const CORE = existsSync(join(CODE, "package.json")) ? CODE : dirname(CODE);

export type Project = {
  /** The launch folder: holds launch.config.ts and videos/. */
  root: string;
  config: LaunchConfig;
  /** Linked products, resolved to absolute paths, including the host product as "self". */
  products: { name: string; path: string; public?: string; self: boolean }[];
};

const CONFIG = "launch.config.ts";

/** The nearest launch folder at or above `from`, or its `launch/` child (so commands work from a product's root). */
export function findRoot(from = process.cwd()): string | null {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, CONFIG))) return dir;
    if (existsSync(join(dir, "launch", CONFIG))) return join(dir, "launch");
    if (dirname(dir) === dir) return null;
  }
}

let current: Project | null = null;

export async function loadProject(from = process.cwd()): Promise<Project> {
  const root = findRoot(from);
  if (!root) throw new Error(`No ${CONFIG} here or above. Run \`intentface-launch init\` in your product repo first.`);
  const config: LaunchConfig = (await import(pathToFileURL(join(root, CONFIG)).href)).default ?? {};
  const link = (name: string, p: ProductLink, self: boolean) => ({
    name,
    path: resolve(root, process.env[`LAUNCH_PRODUCT_${name.toUpperCase()}`] ?? p.path),
    public: p.public,
    self,
  });
  const products = [
    ...(config.product ? [link("self", config.product, true)] : []),
    ...Object.entries(config.products ?? {}).map(([name, p]) => link(name, p, false)),
  ].filter((p) => existsSync(p.path));
  current = { root, config, products };
  return current;
}

/** The loaded project, loading it from the working directory the first time. */
export async function ensureProject(): Promise<Project> {
  return current ?? loadProject();
}

/** The project the CLI is running in. */
export function project(): Project {
  if (!current) throw new Error("loadProject() has not run");
  return current;
}

export const CORE_PACKAGE = "@intentface-launch/core";

export type LaunchPackage = { name: string; dir: string; meta: Record<string, unknown> };

/** Dependencies declared in every package.json from `root` up to the repo's top. */
function dependencyNames(root: string) {
  const names = new Set<string>();
  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, "utf8"));
      for (const field of ["dependencies", "devDependencies", "optionalDependencies"])
        for (const name of Object.keys(pkg[field] ?? {})) names.add(name);
    }
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) break;
  }
  return names;
}

/**
 * Core and every add-on the project has installed: any dependency whose
 * package.json has an "intentface-launch" field, where it declares what the
 * CLI needs from it (optimizeDeps, checks). Add-ons from anyone, a team's
 * brand included, plug in this way; core does not need to know their names.
 */
export function launchPackages(root: string): LaunchPackage[] {
  const require = createRequire(join(root, "package.json"));
  const found: LaunchPackage[] = [];
  for (const name of [CORE_PACKAGE, ...dependencyNames(root)]) {
    if (found.some((p) => p.name === name)) continue;
    let file: string;
    try {
      file = require.resolve(`${name}/package.json`);
    } catch {
      continue;
    }
    const meta = JSON.parse(readFileSync(file, "utf8"))["intentface-launch"];
    if (meta) found.push({ name, dir: dirname(file), meta });
  }
  return found;
}
