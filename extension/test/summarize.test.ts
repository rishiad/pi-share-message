import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../src/summarize.ts", import.meta.url), "utf8");
const prompt = readFileSync(new URL("../src/rewrite-prompt.ts", import.meta.url), "utf8");

test("rewrite mode uses article completion instead of Pi compaction summary", () => {
  assert.match(source, /completeSimple/);
  assert.match(source, /rewriteInstructions/);
  assert.doesNotMatch(source, /generateSummary/);
  assert.match(prompt, /technical article/);
  assert.match(prompt, /Do not use status-report headings/);
  assert.match(prompt, /Goal, Constraints & Preferences, Progress/);
  assert.match(prompt, /Do not use checkbox lists/);
});
