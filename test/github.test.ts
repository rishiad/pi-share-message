import assert from "node:assert/strict";
import test from "node:test";
import { publishHtml } from "../src/github.js";

test("uploads a standalone page through the contents API", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(Buffer.from(body.content, "base64").toString(), "<html>✓</html>");
    assert.equal(body.branch, "main");
    return new Response("{}", { status: 201 });
  });
  const url = await publishHtml("abc", "<html>✓</html>", { token: "token", owner: "octo" });
  assert.equal(url, "https://octo.github.io/pi-messages/abc.html");
});
