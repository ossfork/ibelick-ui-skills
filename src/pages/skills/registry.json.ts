import type { APIRoute } from "astro";

import { registry } from "../../data/registry";
import { topics } from "../../data/topics";

export const GET: APIRoute = () => {
  return new Response(JSON.stringify({ registry, topics }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
};
