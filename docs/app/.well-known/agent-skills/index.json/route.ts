import { getSkills, SKILLS_PATH } from "@/lib/skills";
import { SITE } from "@/lib/source";

// The skills discovery index (Agent Skills Discovery RFC v0.2.0): each skill's
// SKILL.md with its digest. The pages a SKILL.md links to sit beside it.
export async function GET() {
  const skills = (await getSkills()).map((skill) => ({
    name: skill.name,
    type: "skill-md",
    description: skill.description,
    url: `${SITE}${SKILLS_PATH}/${skill.name}/SKILL.md`,
    digest: skill.digest,
  }));
  const index = { $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json", skills };
  return Response.json(index, { headers: { "access-control-allow-origin": "*" } });
}

export const dynamic = "force-static";
