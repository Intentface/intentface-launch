// `node scripts/check-pack.mjs <tarball…>`: fails when a package tarball's
// package.json points an export or a bin at a file the tarball does not hold.
// The packages' own exports name their TypeScript source; publishConfig's
// exports (dist/) replace them only when pnpm packs, and `npm publish` on a
// folder skips that: 0.1.1 and 0.2.0 went out pointing at source that was not
// in the package. publish.yml runs this on what it is about to publish.
import { execFileSync } from "node:child_process";

const targets = (value) =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(targets) : [];

let failed = false;
for (const tarball of process.argv.slice(2)) {
  const files = new Set(execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean));
  const pkg = JSON.parse(execFileSync("tar", ["-xOzf", tarball, "package/package.json"], { encoding: "utf8" }));
  const missing = [...new Set([...targets(pkg.exports), ...targets(pkg.bin), ...targets(pkg.main)])]
    .map((path) => `package/${path.replace(/^\.\//, "")}`)
    .filter((path) => !files.has(path));
  if (missing.length) {
    failed = true;
    console.log(`  ${pkg.name}@${pkg.version}: not in the tarball: ${missing.map((m) => m.slice(8)).join(", ")}`);
  } else console.log(`  ${pkg.name}@${pkg.version}: every export and bin is in the tarball`);
}
process.exit(failed ? 1 : 0);
