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
  assert.match(html, /slugHeading/);
  assert.match(html, /link\.dataset\.level = String\(tocLevel\)/);
  assert.doesNotMatch(html, /link\.dataset\.level = String\(level\)/);
  assert.match(html, /pi-share-base-url/);
  assert.match(html, /pi-url-params/);
  assert.match(html, /Expand all/);
  assert.match(html, /Back to top/);
  assert.match(html, /Go to bottom/);
  assert.match(html, /tailwindScript\.src =\s*"https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4"/);
  assert.doesNotMatch(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4"/);
  assert.doesNotMatch(html, /assistant<script>/);
});

test("renders selected messages as a plain transcript", async () => {
  const html = await renderPage({
    messages: [{ id: "abc123", role: "user", markdown: "Please explain it", timestamp: 1, entries: [] }, { id: "def456", role: "assistant", markdown: "## Answer\n\nDone", timestamp: 2, entries: [] }],
  });
  const encodedData = html.match(/<textarea id="message-data" hidden>([\s\S]*?)<\/textarea>/)?.[1];
  assert.ok(encodedData);

  const data = JSON.parse(encodedData);
  assert.equal(data.role, "2 selected messages");
  assert.equal(data.date, "");
  assert.match(data.body, /class="conversation"/);
  assert.match(data.body, /id="message-abc123"/);
  assert.match(data.body, /id="message-def456"/);
  assert.match(data.body, /message-role">User/);
  assert.match(data.body, /message-role">Assistant/);
  assert.match(data.body, /<h2>Answer<\/h2>/);
  assert.doesNotMatch(data.body, /summary-card/);
  assert.doesNotMatch(data.body, /turn-card/);
  assert.doesNotMatch(data.body, /1970/);
});

test("renders rewritten output as one cohesive document", async () => {
  const html = await renderPage({ document: "# Cohesive Document\n\nSelected work as prose." });
  const encodedData = html.match(/<textarea id="message-data" hidden>([\s\S]*?)<\/textarea>/)?.[1];
  assert.ok(encodedData);

  const data = JSON.parse(encodedData);
  assert.equal(data.role, "document");
  assert.equal(data.date, "");
  assert.match(data.body, /<h1>Cohesive Document<\/h1>/);
  assert.doesNotMatch(data.body, /class="conversation"/);
  assert.doesNotMatch(data.body, /message-role/);
});
