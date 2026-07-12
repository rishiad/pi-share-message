import assert from "node:assert/strict";
import test from "node:test";
import { documentsFor, rememberDocument, selectionKey } from "../src/document-cache.js";
import type { SharedSelectedMessage } from "../src/render.js";

const message = (id: string): SharedSelectedMessage => ({
  id,
  role: "assistant",
  markdown: `message ${id}`,
  entries: [],
});

test("selection cache key is stable for the same selected messages", () => {
  assert.equal(selectionKey([message("a"), message("b")]), selectionKey([message("b"), message("a")]));
});

test("remembers rewritten documents for the same selected messages", () => {
  const messages = [message("cached-a"), message("cached-b")];
  assert.deepEqual(documentsFor(messages), []);

  rememberDocument(messages, { document: "# Cached Article\n\nBody" });
  const cached = documentsFor([message("cached-b"), message("cached-a")]);

  assert.equal(cached.length, 1);
  assert.equal(cached[0].title, "Cached Article");
  assert.equal(cached[0].document.document, "# Cached Article\n\nBody");
});

test("does not cache transcript output", () => {
  const messages = [message("transcript-only")];
  rememberDocument(messages, { messages });
  assert.deepEqual(documentsFor(messages), []);
});
