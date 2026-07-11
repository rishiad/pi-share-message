import assert from "node:assert/strict";
import test from "node:test";
import { renderPage } from "../src/render.js";

test("renders markdown and escapes metadata", () => {
  const html = renderPage({ role: "assistant<script>", markdown: "# Hello\n\n`code`" });
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /<code>code<\/code>/);
  assert.doesNotMatch(html, /assistant<script>/);
  assert.match(html, /assistant&lt;script&gt;/);
  assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4/);
  assert.doesNotMatch(html, /body\{\}/);
});
