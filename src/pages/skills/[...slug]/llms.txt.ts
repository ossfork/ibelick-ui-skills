import type { APIRoute } from "astro";
import {
  getCanonicalSkillPaths,
  getRegistryByPath,
  getSkillByPath,
} from "../../../lib/skill-catalog";
import { getRemoteSkill, RemoteSkillError } from "../../../lib/remote-skill";

export function getStaticPaths() {
  return getCanonicalSkillPaths();
}

export const GET: APIRoute = async ({ params }) => {
  const routeSlug = params.slug ?? "";
  const pathSlug = Array.isArray(routeSlug) ? routeSlug.join("/") : routeSlug;
  const skillEntry = getSkillByPath(pathSlug);

  if (!skillEntry) {
    return new Response("Skill not found", { status: 404 });
  }

  const registrySkill = getRegistryByPath(pathSlug);
  if (!registrySkill) {
    return new Response("Skill not found", { status: 404 });
  }

  try {
    const { content } = await getRemoteSkill(registrySkill.rawUrl);
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    const status = error instanceof RemoteSkillError ? error.status : 500;
    return new Response(
      status === 404
        ? "Skill source unavailable"
        : "Error fetching registry skill",
      { status },
    );
  }
};
