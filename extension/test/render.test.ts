import assert from "node:assert/strict";
import test from "node:test";
import { renderPage } from "../src/render.js";

test("renders markdown through an HTML template", () => {
  const html = renderPage({ role: "assistant<script>", markdown: "# Hello\n\n`code`\n\n```typescript\nconst answer: number = 42;\n```" });
  const encodedData = html.match(/<textarea id="message-data" hidden>([\s\S]*?)<\/textarea>/)?.[1];
  assert.ok(encodedData);

  const data = JSON.parse(encodedData);
  assert.match(data.body, /<h1>Hello<\/h1>/);
  assert.match(data.body, /<code>code<\/code>/);
  assert.match(data.body, /<code class="hljs language-typescript">/);
  assert.match(data.body, /hljs-keyword/);
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
