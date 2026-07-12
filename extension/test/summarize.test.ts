import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../src/summarize.ts", import.meta.url), "utf8");

test("rewrite mode uses article completion instead of Pi compaction summary", () => {
  assert.match(source, /completeSimple/);
  assert.doesNotMatch(source, /generateSummary/);
  assert.match(source, /technical article/);
  assert.match(source, /Do not use status-report headings/);
  assert.match(source, /Goal, Constraints & Preferences, Progress/);
  assert.match(source, /Do not use checkbox lists/);
});
