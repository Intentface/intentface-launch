import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type Alias, type InlineConfig, type Plugin, searchForWorkspaceRoot } from "vite";
import { studioApi } from "../studio/server.js";
import { clipFrames } from "./clips.js";
import { parseJsonc } from "./jsonc.js";
import { CODE, CORE, launchPackages, type Project } from "./project.js";

/** The studio's entry: source in a checkout, compiled when installed. */
const STUDIO = join(CODE, existsSync(join(CODE, "studio/main.tsx")) ? "studio/main.tsx" : "studio/main.js");

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".bin": "application/octet-stream",
  ".woff2": "font/woff2",
};

/** Serve linked products' public folders, so their code finds its assets at the usual URLs. */
function productAssets(project: Project): Plugin {
  const folders = project.products.filter((p) => p.public).map((p) => join(p.path, p.public as string));
  return {
    name: "launch-product-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? "").split("?")[0]);
        for (const folder of folders) {
          const file = join(folder, path);
          if (file.startsWith(folder) && existsSync(file) && statSync(file).isFile()) {
            res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
            res.end(readFileSync(file));
            return;
          }
        }
        next();
      });
    },
  };
}

/** The studio page lives in this package, not in the project: serve it at /. */
function studioPage(): Plugin {
  const html = readFileSync(join(CORE, "index.html"), "utf8").replace('src="/studio/main.tsx"', `src="/@fs${STUDIO}"`);
  return {
    name: "launch-studio-page",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "/").split("?")[0];
        if (path !== "/" && path !== "/index.html") return next();
        res.setHeader("Content-Type", "text/html");
        res.end(await server.transformIndexHtml(req.url ?? "/", html));
      });
    },
  };
}

/** A product's tsconfig `paths` ("@/*": ["./*"]) as Vite aliases, so its own imports resolve inside it. */
function productAliases(path: string): Alias[] {
  const file = join(path, "tsconfig.json");
  if (!existsSync(file)) return [];
  let options: { baseUrl?: string; paths?: Record<string, string[]> };
  try {
    options = (parseJsonc(readFileSync(file, "utf8")) as { compilerOptions?: typeof options }).compilerOptions ?? {};
  } catch {
    return [];
  }
  const base = resolve(path, options.baseUrl ?? ".");
  return Object.entries(options.paths ?? {}).flatMap(([key, [target]]): Alias[] => {
    if (!target) return [];
    if (key.endsWith("/*") && target.endsWith("/*")) {
      const prefix = key.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [{ find: new RegExp(`^${prefix}`), replacement: `${resolve(base, target.slice(0, -2))}/` }];
    }
    return [{ find: key, replacement: resolve(base, target) }];
  });
}

/**
 * Our packages are excluded from pre-bundling (they are TypeScript source and
 * must stay one copy), so Vite's startup scan does not see what they import.
 * Each declares its browser dependencies in package.json under
 * "intentface-launch".optimizeDeps; pre-bundle those up front, or Vite finds
 * them mid-render, re-optimises, and the page mixes chunks from two builds.
 */
function packageDeps(root: string) {
  const require = createRequire(join(root, "package.json"));
  const resolves = (id: string) => {
    try {
      require.resolve(id);
      return true;
    } catch {
      return false;
    }
  };
  return launchPackages(root)
    .flatMap((p) => (p.meta.optimizeDeps ?? []) as string[])
    .filter(resolves);
}

/** Vite for the studio and the renderer, rooted at the launch folder. */
export function viteConfig(project: Project, port = 0): InlineConfig {
  const self = project.products.find((p) => p.self);
  return {
    configFile: false,
    root: project.root,
    plugins: [react(), studioPage(), productAssets(project), clipFrames(project.root), studioApi(project.root)],
    // Videos read their captures and audio straight from their folders.
    publicDir: false,
    server: {
      port,
      strictPort: port !== 0,
      open: false,
      fs: {
        // Add-ons count too: linked from a checkout (`add` from source), they live outside the project.
        allow: [
          project.root,
          CORE,
          searchForWorkspaceRoot(project.root),
          ...project.products.map((p) => p.path),
          ...launchPackages(project.root).map((p) => p.dir),
        ],
      },
    },
    optimizeDeps: {
      // Crawl everything up front: a mid-session re-optimise reloads the page under the renderer.
      entries: [STUDIO, "videos/*/video.tsx"],
      // Shipped as TypeScript source; Vite transforms them like the project's own files.
      exclude: launchPackages(project.root).map((p) => p.name),
      include: packageDeps(project.root),
    },
    resolve: {
      // Products share the launch folder's React and Three.
      dedupe: ["react", "react-dom", "three"],
      alias: [
        ...(self ? productAliases(self.path) : []),
        ...project.products
          .filter((p) => !p.self)
          .map((p) => ({ find: new RegExp(`^@product/${p.name}/`), replacement: `${p.path}/` })),
      ],
    },
  };
}
