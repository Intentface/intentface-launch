import { getSkills, readSkillFile } from "@/lib/skills";

// A skill's files as published in the index: SKILL.md and the pages it links to.
export async function GET(_request: Request, { params }: { params: Promise<{ skill: string; file: string }> }) {
  const { skill, file } = await params;
  const body = await readSkillFile(skill, file);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "content-type": "text/markdown; charset=utf-8", "access-control-allow-origin": "*" },
  });
}

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getSkills()).flatMap((skill) => skill.files.map((file) => ({ skill: skill.name, file })));
}
