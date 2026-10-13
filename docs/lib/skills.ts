import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Core's skills, published under /.well-known/agent-skills/ (Agent Skills
// Discovery RFC v0.2.0) straight from the package, so they never drift.
const ROOT = path.join(process.cwd(), "..", "packages", "core", "skills");

export const SKILLS_PATH = "/.well-known/agent-skills";

export type Skill = { name: string; description: string; files: string[]; digest: string };

const description = (markdown: string) => markdown.match(/^---\n[\s\S]*?^description:\s*(.+)$/m)?.[1]?.trim() ?? "";

export const getSkills = async (): Promise<Skill[]> => {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  return Promise.all(
    names.sort().map(async (name) => {
      const files = (await readdir(path.join(ROOT, name))).filter((file) => file.endsWith(".md")).sort();
      const skill = await readFile(path.join(ROOT, name, "SKILL.md"));
      return {
        name,
        description: description(skill.toString("utf8")),
        files,
        digest: `sha256:${createHash("sha256").update(skill).digest("hex")}`,
      };
    }),
  );
};

/** One file of a skill (its SKILL.md, or a page it links to such as research.md). */
export const readSkillFile = async (name: string, file: string): Promise<Buffer | null> => {
  const skills = await getSkills();
  if (!skills.some((skill) => skill.name === name && skill.files.includes(file))) return null;
  return readFile(path.join(ROOT, name, file));
};
