import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { project } from "./project.js";

/** Values handed out this run, so whatever the capture saves can be scrubbed of them. */
const handedOut = new Set<string>();

/** One variable from a dotenv file: `NAME=value`, `export NAME="value"`, with a trailing comment on unquoted values. */
function fromEnvFile(path: string, name: string): string | undefined {
  const line = readFileSync(path, "utf8").match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, "m"))?.[1];
  if (line === undefined) return undefined;
  const quoted = line.match(/^(["'])(.*)\1/);
  return (quoted ? quoted[2] : line.replace(/\s+#.*$/, "")).trim() || undefined;
}

/**
 * A secret for capture scripts (an API key, a demo login): the environment
 * variable `name` if set, else the line in the env file `secrets.<name>` in
 * launch.config.ts points to. Never printed; snapshots and manifests the
 * capture writes have it replaced.
 */
export function readSecret(name: string): string {
  const env = process.env[name];
  const file = project().config.secrets?.[name];
  let value = env;
  if (!value && file) {
    const path = resolve(project().root, file);
    if (!existsSync(path)) throw new Error(`Secret ${name}: ${relative(process.cwd(), path)} does not exist`);
    value = fromEnvFile(path, name);
    if (!value) throw new Error(`Secret ${name}: not set in ${relative(process.cwd(), path)}`);
  }
  if (!value) {
    throw new Error(
      `Secret ${name} is not set. Export it, or add secrets: { ${name}: "<env file>" } to launch.config.ts.`,
    );
  }
  handedOut.add(value);
  return value;
}

/** `text` with every secret handed out this run replaced. */
export function redact(text: string): string {
  let out = text;
  for (const value of handedOut) out = out.replaceAll(value, "[secret]");
  return out;
}
