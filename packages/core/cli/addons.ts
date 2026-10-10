import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { parseJsonc } from "./jsonc.js";
import { CORE, CORE_PACKAGE, findRoot, launchPackages } from "./project.js";

/**
 * Add-ons `intentface-launch add` knows by a short name. Any other package
 * that declares an "intentface-launch" field in its package.json (a team's
 * brand, say) installs by its package name and plugs in the same way.
 */
export const ADDONS: Record<string, { package: string; about: string }> = {
  three: {
    package: "@intentface-launch/three",
    about: "3D stage: live UI on panels in space, real lens depth of field, soft light, in-camera motion blur.",
  },
};
const MANAGED = ".intentface-launch";
const ADDON_MARK = "<!-- add-ons: managed by `intentface-launch add`, one import per installed package -->";

/**
 * When the CLI runs from a checkout of the intentface-launch repo instead of
 * the registry, install from that checkout (link:), so product repos can use
 * unreleased packages. LAUNCH_SOURCE=/path/to/intentface-launch forces it.
 */
function sourceCheckout(): string | null {
  const forced = process.env.LAUNCH_SOURCE;
  if (forced) return resolve(forced);
  const repo = resolve(CORE, "../..");
  return existsSync(join(repo, "pnpm-workspace.yaml")) && existsSync(join(repo, "packages/core/package.json"))
    ? repo
    : null;
}

/** Our packages link to the checkout's copy when there is one; anything else comes from the registry. */
const spec = (pkg: string) => {
  const repo = sourceCheckout();
  const dir = repo && pkg.startsWith("@intentface-launch/") ? join(repo, "packages", pkg.split("/")[1]) : null;
  return dir && existsSync(join(dir, "package.json")) ? `link:${dir}` : pkg;
};

/** The product repo: the nearest folder with a package.json at or above `from`. */
function hostRoot(from: string) {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (dirname(dir) === dir) throw new Error("No package.json here or above: run this in your product repo.");
  }
}

function packageManager(host: string) {
  if (existsSync(join(host, "pnpm-lock.yaml")) || existsSync(join(host, "pnpm-workspace.yaml"))) return "pnpm";
  if (existsSync(join(host, "yarn.lock"))) return "yarn";
  if (existsSync(join(host, "bun.lock")) || existsSync(join(host, "bun.lockb"))) return "bun";
  return "npm";
}

function install(host: string, packages: string[]) {
  const pm = packageManager(host);
  const specs = packages.map(spec);
  const args = { pnpm: ["add", "-D"], yarn: ["add", "-D"], bun: ["add", "-d"], npm: ["install", "-D"] }[pm] ?? [];
  // A pnpm workspace root needs -w to add to itself.
  if (pm === "pnpm" && existsSync(join(host, "pnpm-workspace.yaml"))) args.push("-w");
  console.log(`  ${pm} ${[...args, ...specs].join(" ")}`);
  execFileSync(pm, [...args, ...specs], { cwd: host, stdio: "inherit" });
  installPeers(host, packages);
}

/** Peers of `packages` (React, Three) the product does not have yet: not every install brings them. */
function installPeers(host: string, packages: string[]) {
  const pm = packageManager(host);
  const args = { pnpm: ["add", "-D"], yarn: ["add", "-D"], bun: ["add", "-d"], npm: ["install", "-D"] }[pm] ?? [];
  if (pm === "pnpm" && existsSync(join(host, "pnpm-workspace.yaml"))) args.push("-w");
  const require = createRequire(join(host, "package.json"));
  const missing = new Set<string>();
  for (const pkg of packages) {
    let peers: Record<string, string> = {};
    try {
      peers = readJson(require.resolve(`${pkg}/package.json`)).peerDependencies ?? {};
    } catch {}
    for (const [name, range] of Object.entries(peers)) {
      if (packages.includes(name) || name === CORE_PACKAGE) continue;
      try {
        require.resolve(`${name}/package.json`);
      } catch {
        missing.add(`${name}@${range}`);
      }
    }
  }
  if (missing.size) {
    console.log(`  ${pm} ${[...args, ...missing].join(" ")}`);
    execFileSync(pm, [...args, ...missing], { cwd: host, stdio: "inherit" });
  }
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

/**
 * Where a package is installed, as the project sees it: through node_modules
 * (a stable path across upgrades), not the real path in pnpm's store or a checkout.
 */
function installed(host: string, pkg: string): string | null {
  const linked = join(host, "node_modules", pkg);
  if (existsSync(join(linked, "package.json"))) return linked;
  try {
    return dirname(createRequire(join(host, "package.json")).resolve(`${pkg}/package.json`));
  } catch {
    return null;
  }
}

/** Copy a package's skills into the product's .claude/skills, marked as ours so updates may replace them. */
function copySkills(host: string, dir: string) {
  const from = join(dir, "skills");
  if (!existsSync(from)) return [];
  const names = readdirSync(from).filter((n) => existsSync(join(from, n, "SKILL.md")));
  for (const name of names) {
    const target = join(host, ".claude/skills", name);
    if (existsSync(target) && !existsSync(join(target, MANAGED))) {
      console.log(`  skip .claude/skills/${name}: exists and was not installed by intentface-launch`);
      continue;
    }
    mkdirSync(target, { recursive: true });
    cpSync(join(from, name), target, { recursive: true });
    writeFileSync(join(target, MANAGED), "Installed by intentface-launch; `intentface-launch update` replaces it.\n");
  }
  return names;
}

/** Point the launch folder's CLAUDE.md at each installed package's LAUNCH.md. */
function linkDocs(host: string, launch: string) {
  const file = join(launch, "CLAUDE.md");
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  const head = text.includes(ADDON_MARK) ? text.slice(0, text.indexOf(ADDON_MARK)) : `${text.trimEnd()}\n\n`;
  const lines = launchPackages(host)
    .map((p) => installed(host, p.name))
    .filter((dir): dir is string => !!dir && existsSync(join(dir, "LAUNCH.md")))
    .map((dir) => `@${relative(launch, join(dir, "LAUNCH.md"))}`);
  writeFileSync(file, `${head}${ADDON_MARK}\n${lines.join("\n")}\n`);
}

const CONFIG = (publicDir: boolean) => `import { defineConfig } from "@intentface-launch/core/config";

export default defineConfig({
  // The product this folder lives in: videos can import its components and data
  // with the product's own paths ("@/…"), and its public folder is served.
  product: { path: ".."${publicDir ? ', public: "public"' : ""} },
});
`;

const CLAUDE = `# Launch videos

Product launch videos for this repo, written as code with @intentface-launch.
Run commands from the repo root as \`pnpm launch <command>\` (\`pnpm launch\` lists them).
Videos live in \`launch/videos/<id>/\`; paths below are relative to \`launch/\`.

Install more capabilities with \`pnpm launch add <name>\` (\`pnpm launch addons\` lists them);
each one adds its guide below.

The skills in \`.claude/skills/\` come from the packages, and \`pnpm launch update\` replaces them,
so do not edit them here. When a video shows a skill is wrong or missing something, tell the person
what you learned and which skill it belongs in, so it can be revised in @intentface-launch.

`;

function tsconfig(host: string) {
  const paths: Record<string, string[]> = {};
  try {
    const json = parseJsonc(readFileSync(join(host, "tsconfig.json"), "utf8")) as {
      compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
    };
    const options = json.compilerOptions ?? {};
    const base = options.baseUrl ?? ".";
    for (const [key, targets] of Object.entries<string[]>(options.paths ?? {}))
      paths[key] = targets.map((t) => `../${join(base, t)}`);
  } catch {}
  return {
    compilerOptions: {
      target: "ES2023",
      lib: ["ES2023", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      types: [],
      ...(Object.keys(paths).length ? { paths } : {}),
    },
    include: ["**/*", "../node_modules/@intentface-launch/core/client.d.ts"],
    exclude: ["**/out"],
  };
}

/** Keep the product's own type check and build out of the launch folder. */
function excludeFromHost(host: string, folder: string) {
  const file = join(host, "tsconfig.json");
  if (!existsSync(file)) return;
  try {
    const json = readJson(file);
    const exclude: string[] = json.exclude ?? [];
    if (!exclude.includes(folder)) {
      json.exclude = [...exclude, folder];
      writeJson(file, json);
      console.log(`  tsconfig.json: excluded ${folder}/ from the product's type check`);
    }
  } catch {
    console.log(`  tsconfig.json has comments: add "${folder}" to its "exclude" yourself`);
  }
}

/** Set up a launch folder in the product repo at `cwd`. */
export function init(cwd: string, folder = "launch") {
  const host = hostRoot(cwd);
  const launch = join(host, folder);
  if (findRoot(host) && existsSync(join(launch, "launch.config.ts"))) {
    console.log(`  ${folder}/ already set up; run \`intentface-launch update\` to refresh skills and docs`);
    return;
  }
  const pkg = readJson(join(host, "package.json"));
  const has = (name: string) => !!(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
  if (!has(CORE_PACKAGE)) install(host, [CORE_PACKAGE]);
  else installPeers(host, [CORE_PACKAGE]);

  mkdirSync(join(launch, "videos"), { recursive: true });
  writeFileSync(join(launch, "videos/.gitkeep"), "");
  writeFileSync(join(launch, "launch.config.ts"), CONFIG(existsSync(join(host, "public"))));
  writeFileSync(
    join(launch, ".gitignore"),
    "# Regenerated: renders, stills, boards, and capture frames.\nout/\nvideos/*/captures/*/\n",
  );
  writeJson(join(launch, "tsconfig.json"), tsconfig(host));
  writeFileSync(join(launch, "CLAUDE.md"), CLAUDE);
  excludeFromHost(host, folder);

  const fresh = readJson(join(host, "package.json"));
  fresh.scripts ??= {};
  if (!fresh.scripts.launch) {
    fresh.scripts.launch = "intentface-launch";
    writeJson(join(host, "package.json"), fresh);
  }
  update(host);
  console.log(`
  ${folder}/ is ready.
    pnpm launch setup              browser for rendering (once per machine; also needs ffmpeg)
    pnpm launch addons             what else can be installed
    pnpm launch new <id>           first video, then pnpm launch dev
`);
}

/** Install add-ons by short name (`three`) or by package name (`@acme/launch-brand`). */
export function add(cwd: string, names: string[]) {
  if (names.length === 0)
    throw new Error(`Usage: intentface-launch add <${Object.keys(ADDONS).join("|")}|package name>`);
  const host = hostRoot(cwd);
  const packages = names.map((n) => {
    const known = ADDONS[n] ?? Object.values(ADDONS).find((a) => a.package === n);
    if (known) return known.package;
    if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(n) && (n.includes("/") || n.includes("-")))
      return n;
    throw new Error(`Unknown add-on "${n}". Known: ${Object.keys(ADDONS).join(", ")}, or any package name`);
  });
  install(host, packages);
  for (const name of packages) {
    if (!launchPackages(host).some((p) => p.name === name))
      console.log(`  ${name} has no "intentface-launch" field in its package.json: installed, but not an add-on`);
  }
  update(host);
}

/** Refresh skills and CLAUDE.md imports from what is installed. */
export function update(cwd: string) {
  const host = hostRoot(cwd);
  const launch = findRoot(host);
  const skills: string[] = [];
  for (const p of launchPackages(host)) {
    const dir = installed(host, p.name);
    if (dir) skills.push(...copySkills(host, dir));
  }
  if (skills.length) pruneSkills(host, skills);
  if (launch) linkDocs(host, launch);
  if (skills.length) console.log(`  skills: ${skills.join(", ")} → .claude/skills/`);
}

/** Remove skills we installed that no package ships any more (renamed or merged). */
function pruneSkills(host: string, keep: string[]) {
  const dir = join(host, ".claude/skills");
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (keep.includes(name) || !existsSync(join(dir, name, MANAGED))) continue;
    rmSync(join(dir, name), { recursive: true, force: true });
    console.log(`  removed .claude/skills/${name}: no longer shipped`);
  }
}

export function listAddons(cwd: string) {
  const host = hostRoot(cwd);
  const present = launchPackages(host).filter((p) => p.name !== CORE_PACKAGE);
  for (const [name, a] of Object.entries(ADDONS)) {
    const mark = present.some((p) => p.name === a.package) ? "installed" : `pnpm launch add ${name}`;
    console.log(`  ${name.padEnd(18)} ${a.about}\n  ${"".padEnd(18)} ${mark}\n`);
  }
  for (const p of present.filter((p) => !Object.values(ADDONS).some((a) => a.package === p.name)))
    console.log(`  ${p.name}\n  ${"".padEnd(18)} installed\n`);
  console.log(
    '  Any package with an "intentface-launch" field in its package.json is an add-on: pnpm launch add <name>',
  );
}
