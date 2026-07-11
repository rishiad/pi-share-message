import assert from "node:assert/strict";
import test from "node:test";
import { publishHtml } from "../src/github.js";

test("uploads a standalone page through the contents API", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("/repos/octo/pi-messages")) {
      return new Response(JSON.stringify({ default_branch: "trunk" }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body));
    assert.equal(Buffer.from(body.content, "base64").toString(), "<html>✓</html>");
    assert.equal(body.branch, "trunk");
    return new Response("{}", { status: 201 });
  });
  const url = await publishHtml("abc", "<html>✓</html>", { token: "token", owner: "octo" });
  assert.equal(url, "https://octo.github.io/pi-messages/abc.html");
});

test("explains when the pages repository is missing", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));
  await assert.rejects(
    publishHtml("abc", "<html>✓</html>", { token: "token", owner: "octo" }),
    /repository octo\/pi-messages was not found.*Create it and enable GitHub Pages/,
  );
});
