import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { formatSuffix } from "./browser.js";
import type { Problem, Rules } from "./inspect.js";
import { launchCommand } from "./project.js";
import { loadRules } from "./rules.js";
import { outDir, root } from "./util.js";

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === "out" || name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Rules over the source files, and captures whose frames are missing. */
function checkSource(dir: string, rules: Rules): Problem[] {
  const problems: Problem[] = [];
  const sourceRules = rules.rules.filter((r) => r.in.includes("source"));
  for (const file of walk(dir)) {
    const rel = relative(root(), file);
    if (/\.(tsx?|md)$/.test(file)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const rule of sourceRules) {
            if (rule.pattern.test(line))
              problems.push({ check: "source", severity: "error", message: `${rel}:${i + 1} ${rule.message}` });
          }
        });
    }
    // A manifest without its frames means the capture has to be re-run on this machine.
    if (file.endsWith(".json") && /\/captures\/[^/]+\.json$/.test(file) && !existsSync(file.replace(/\.json$/, ""))) {
      const [, video] = rel.split("/");
      const name = rel.split("/").pop()?.replace(".json", "");
      problems.push({
        check: "source",
        severity: "error",
        message: `${rel}: frames missing, run ${launchCommand(root())} capture ${video} ${name}`,
      });
    }
  }
  return problems;
}

function line(p: Problem) {
  const where = [p.shot, p.frame !== undefined ? `f${p.frame}` : ""].filter(Boolean).join(" ");
  const text = p.text ? ` "${p.text.length > 40 ? `${p.text.slice(0, 39)}…` : p.text}"` : "";
  return `  ${p.severity === "error" ? "error" : "warn "}  ${p.check.padEnd(8)} ${where ? `${where}  ` : ""}${p.message}${text}`;
}

/** "reading 21, size 2" for one severity, most frequent first. */
function counts(problems: Problem[], severity: Problem["severity"]) {
  const n = new Map<string, number>();
  for (const p of problems) if (p.severity === severity) n.set(p.check, (n.get(p.check) ?? 0) + 1);
  return [...n]
    .sort((a, b) => b[1] - a[1])
    .map(([check, count]) => `${check} ${count}`)
    .join(", ");
}

/**
 * Problems in order, with long runs of the same check in one shot folded to
 * the first two, after a count per check: many errors of one rule are usually
 * one decision, not many fixes.
 */
function print(problems: Problem[]) {
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  const summary = [
    errors ? `errors: ${counts(problems, "error")}` : "",
    warnings ? `warnings: ${counts(problems, "warn")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (summary) console.log(`  ${summary}\n`);
  const groups = new Map<string, Problem[]>();
  for (const p of problems) {
    const key = `${p.severity} ${p.check} ${p.shot ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const group of groups.values()) {
    for (const p of group.slice(0, group.length > 3 ? 2 : 3)) console.log(line(p));
    if (group.length > 3)
      console.log(`         … ${group.length - 2} more ${group[0].check} in ${group[0].shot ?? "videos/"}`);
  }
  console.log(problems.length ? `\n  ${errors} error(s), ${warnings} warning(s)` : "  ok");
}

/**
 * Without an id: source checks over every video. With one: also render-side
 * checks on that video (text, motion, cuts, loudness), written to out/check.json.
 * Fails on errors; warnings are for judgement.
 */
export async function check(
  videoId?: string,
  { every, samples }: { every?: number; samples?: number } = {},
): Promise<boolean> {
  const rules = await loadRules();
  const dir = join(root(), "videos", ...(videoId ? [videoId] : []));
  if (!existsSync(dir)) throw new Error(`No ${relative(root(), dir)}/`);
  const problems = checkSource(dir, rules);
  if (videoId) {
    const { inspect } = await import("./inspect.js");
    const { info, ...result } = await inspect(videoId, rules, { every, samples });
    problems.push(...result.problems);
    // Captions as delivered (SRT/VTT): burned-in ones are measured on screen like any text.
    if (!info.burnCaptions) {
      for (const c of info.captions.filter((c) => c.to - c.from + 1 < c.needs)) {
        problems.push({
          check: "captions",
          severity: "warn",
          frame: c.from,
          text: c.text,
          message: `cue shown ${((c.to - c.from) / info.fps).toFixed(1)} s, needs ${(c.needs / info.fps).toFixed(1)} s to read (the next cue cuts it short, or its until)`,
        });
      }
    }
    const { licenceManifest } = await import("./licences.js");
    const { missing } = licenceManifest(videoId, info);
    for (const file of missing) {
      problems.push({
        check: "licence",
        severity: "warn",
        message: `${file}: no licence recorded (videos/${videoId}/licences.json or ${file.split("/").pop()}.license.json)`,
      });
    }
    // One report per format: check-vertical.json beside check.json.
    const file = join(outDir(videoId), `check${formatSuffix(info)}.json`);
    writeFileSync(file, `${JSON.stringify({ ...result, format: info.format, problems }, null, 2)}\n`);
    console.log(
      `  ${relative(root(), file)} · ${result.text.length} text blocks · sampled every ${result.every} frames\n`,
    );
  }
  print(problems);
  return !problems.some((p) => p.severity === "error");
}
