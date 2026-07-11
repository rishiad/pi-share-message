import assert from "node:assert/strict";
import test from "node:test";
import { renderPage } from "../src/render.js";

test("renders markdown through an HTML template", async () => {
  const html = await renderPage({ role: "assistant<script>", markdown: "# Hello\n\n`code`\n\n```typescript\nconst answer: number = 42;\n```" });
  const encodedData = html.match(/<textarea id="message-data" hidden>([\s\S]*?)<\/textarea>/)?.[1];
  assert.ok(encodedData);

  const data = JSON.parse(encodedData);
  assert.match(data.body, /<h1>Hello<\/h1>/);
  assert.match(data.body, /<code>code<\/code>/);
  assert.match(data.body, /<pre class="shiki github-light"/);
  assert.match(data.body, /style="color:#D73A49">const/);
  assert.doesNotMatch(html, /hljs/);
  assert.equal(data.role, "assistant<script>");
  assert.match(html, /<template id="page-template">/);
  assert.match(html, /cloneNode\(true\)/);
  assert.match(html, /toc a\.active/);
  assert.match(html, /updateActiveHeading/);
  assert.match(html, /session\.html&heading=/);
  assert.match(html, /pi-share-base-url/);
  assert.match(html, /pi-url-params/);
  assert.match(html, /Expand all/);
  assert.match(html, /Back to top/);
  assert.match(html, /Go to bottom/);
  assert.match(html, /tailwindScript\.src =\s*"https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4"/);
  assert.doesNotMatch(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4"/);
  assert.doesNotMatch(html, /assistant<script>/);
});

test("renders selected message pairs as a visual document", async () => {
  const html = await renderPage({
    summary: "## Recap\n\nSelected work.",
    turns: [{
      id: "abc123",
      user: { role: "user", markdown: "Please explain it", timestamp: 1 },
      assistant: { role: "assistant", markdown: "## Answer\n\nDone", timestamp: 2 },
      entries: [],
    }],
  });
  const encodedData = html.match(/<textarea id="message-data" hidden>([\s\S]*?)<\/textarea>/)?.[1];
  assert.ok(encodedData);

  const data = JSON.parse(encodedData);
  assert.equal(data.role, "1 selected message pair");
  assert.match(data.body, /summary-card/);
  assert.match(data.body, /id="summary"/);
  assert.match(data.body, /id="turn-abc123"/);
  assert.match(data.body, /turn-card-user/);
  assert.match(data.body, /turn-card-assistant/);
  assert.match(data.body, /<h2>Answer<\/h2>/);
});
