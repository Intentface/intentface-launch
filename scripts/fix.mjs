// `pnpm fix [file…]`: biome --write (format, safe lint fixes, import order) on
// the files given, or on every file git sees as changed: staged, unstaged and
// untracked. Never the whole repo, so another session's work in progress is
// left alone.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
const given = process.argv.slice(2);
const files = given.length
  ? given
  : [
      ...new Set([
        ...git("diff", "--name-only", "--diff-filter=d", "HEAD"),
        ...git("ls-files", "--others", "--exclude-standard"),
      ]),
    ];
const list = files.filter((f) => existsSync(f));
if (!list.length) {
  console.log("  nothing changed");
  process.exit(0);
}
console.log(`  biome --write on ${list.length} changed file(s)`);
const run = spawnSync(
  "biome",
  ["check", "--write", "--no-errors-on-unmatched", "--files-ignore-unknown=true", ...list],
  { stdio: "inherit" },
);
process.exit(run.status ?? 1);
