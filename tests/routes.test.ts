import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GET as getRegistry } from "../src/pages/skills/registry.json.ts";
import { GET as getSkillContent } from "../src/pages/skills/[...slug]/llms.txt.ts";

describe("route boundaries", () => {
  test("returns the registry manifest with machine-readable headers", async () => {
    const response = await getRegistry({} as never);
    const body = (await response.json()) as {
      registry: unknown[];
      topics: unknown[];
    };

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.ok(body.registry.length > 0);
    assert.ok(body.topics.length > 0);
  });

  test("returns 404 for an unknown machine-readable skill path", async () => {
    const response = await getSkillContent({
      params: { slug: "does-not-exist" },
    } as never);

    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Skill not found");
  });

  test("returns upstream skill content for a known path", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("# Test skill", { status: 200 });

    try {
      const response = await getSkillContent({
        params: { slug: "ibelick/ui-skills-root" },
      } as never);

      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("content-type"),
        "text/plain; charset=utf-8",
      );
      assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
      assert.equal(await response.text(), "# Test skill");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
