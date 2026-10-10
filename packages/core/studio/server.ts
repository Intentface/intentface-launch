import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import type { Info } from "../cli/browser.js";
import { mixAudio } from "../cli/mix.js";
import { CORE } from "../cli/project.js";

/** A review note on one shot, kept in videos/<id>/comments.json and committed with the video. */
export type Comment = {
  id: string;
  shot: string;
  frame?: number;
  author: string;
  text: string;
  at: string;
  resolved?: boolean;
  /** Claude's (or anyone's) answer. */
  reply?: string;
};

const body = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });

function author(root: string) {
  try {
    return execFileSync("git", ["config", "user.name"], { cwd: root, encoding: "utf8" }).trim() || "Someone";
  } catch {
    return "Someone";
  }
}

/** Studio API: per-shot comments stored in the repo, and rebuilding the board. */
export function studioApi(root: string): Plugin {
  const building = new Set<string>();
  return {
    name: "launch-studio-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://x");
        if (!url.pathname.startsWith("/__launch/")) return next();
        const id = url.searchParams.get("v") ?? "";
        if (!/^[a-z0-9_][a-z0-9-_]*$/.test(id) || !existsSync(join(root, "videos", id))) {
          res.statusCode = 404;
          return res.end("unknown video");
        }
        const file = join(root, "videos", id, "comments.json");
        const read = (): Comment[] => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []);
        const write = (list: Comment[]) => writeFileSync(file, `${JSON.stringify(list, null, 2)}\n`);
        res.setHeader("Content-Type", "application/json");

        if (url.pathname === "/__launch/comments" && req.method === "GET") return res.end(JSON.stringify(read()));
        if (url.pathname === "/__launch/comments" && req.method === "POST") {
          const b = await body(req);
          const list = read();
          list.push({
            id: Math.random().toString(36).slice(2, 10),
            shot: String(b.shot),
            frame: typeof b.frame === "number" ? b.frame : undefined,
            author: author(root),
            text: String(b.text ?? "").slice(0, 4000),
            at: new Date().toISOString(),
          });
          write(list);
          return res.end(JSON.stringify(list));
        }
        if (url.pathname === "/__launch/comments/resolve" && req.method === "POST") {
          const b = await body(req);
          const list = read().map((c) => (c.id === b.id ? { ...c, resolved: Boolean(b.resolved) } : c));
          write(list);
          return res.end(JSON.stringify(list));
        }
        if (url.pathname === "/__launch/mix" && req.method === "POST") {
          const b = (await body(req)) as unknown as Info;
          try {
            const mixed = await mixAudio(id, b);
            return res.end(
              JSON.stringify({
                src: mixed && `/videos/${id}/out/mix.wav?k=${Math.round(statSync(mixed.file).mtimeMs)}`,
              }),
            );
          } catch (error) {
            return res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        }
        if (url.pathname === "/__launch/board" && req.method === "POST") {
          if (building.has(id)) return res.end(JSON.stringify({ ok: false, busy: true }));
          building.add(id);
          const bin = join(CORE, "bin/launch.mjs");
          const child = spawn(process.execPath, [bin, "board", id], { cwd: root, stdio: "inherit" });
          child.on("close", (code) => {
            building.delete(id);
            res.end(JSON.stringify({ ok: code === 0 }));
          });
          return;
        }
        res.statusCode = 404;
        res.end("{}");
      });
    },
  };
}
