import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GET as getRegistry } from "../src/pages/skills/registry.json.ts";
import { GET as getSkillContent } from "../src/pages/skills/[...slug]/llms.txt.ts";
import { renderSkillMarkdown } from "../src/lib/render-skill-markdown.ts";

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

  test("removes unsafe Markdown content and resolves safe relative links", async () => {
    const html = await renderSkillMarkdown(
      '<script>alert("xss")</script>\n\n[docs](../docs) [unsafe](javascript:alert(1))\n\n![tracking](https://example.com/pixel.gif)',
      "https://github.com/example/repo/blob/main/SKILL.md",
    );

    assert.doesNotMatch(html, /<script|javascript:|<img/);
    assert.match(html, /https:\/\/github.com\/example\/repo\/blob\/docs/);
    assert.match(html, /unsafe<\/p>/);
  });

  test("renders fenced code as styled, escaped code blocks", async () => {
    const html = await renderSkillMarkdown(
      "```markdown\n<script>alert(1)</script>\n```",
      "https://github.com/example/repo/blob/main/SKILL.md",
    );

    assert.match(html, /class="skill-code-block"/);
    assert.match(html, /class="language-markdown"/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });
});
