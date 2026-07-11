import assert from "node:assert/strict";
import test from "node:test";
import { createSecretGist } from "../src/gist.js";

test("creates a secret gist and returns the HTML preview URL", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.github.com/gists");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.public, false);
    assert.equal(body.files["message.html"].content, "<html>✓</html>");
    return new Response(JSON.stringify({
      files: { "message.html": { raw_url: "https://gist.githubusercontent.com/octo/abc/raw/message.html" } },
    }), { status: 201 });
  });

  const url = await createSecretGist("<html>✓</html>", { token: "token", filename: "message.html" });
  assert.equal(
    url,
    "https://html-preview.github.io/?url=https%3A%2F%2Fgist.githubusercontent.com%2Focto%2Fabc%2Fraw%2Fmessage.html",
  );
});

test("reports gist API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }));
  await assert.rejects(
    createSecretGist("<html></html>", { token: "token" }),
    /Bad credentials/,
  );
});
