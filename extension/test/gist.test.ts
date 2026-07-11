import assert from "node:assert/strict";
import test from "node:test";
import { createSecretGist, previewUrl } from "../src/gist.js";

test("creates a secret gist and returns its ID", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.github.com/gists");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.public, false);
    assert.equal(body.files["message.html"].content, "<html>✓</html>");
    return new Response(JSON.stringify({
      id: "094dae8f192bb7248e98ccf5b10e1ff",
      files: { "message.html": {} },
    }), { status: 201 });
  });

  const gist = await createSecretGist("<html>✓</html>", { token: "token", filename: "message.html" });
  assert.deepEqual(gist, { id: "094dae8f192bb7248e98ccf5b10e1ff", filename: "message.html" });
});

test("builds a preview URL from a Gist ID", () => {
  assert.equal(
    previewUrl("094dae8f192bb7248e98ccf5b10e1ff", "https://preview.example.com"),
    "https://preview.example.com/094dae8f192bb7248e98ccf5b10e1ff",
  );
});

test("reports gist API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }));
  await assert.rejects(
    createSecretGist("<html></html>", { token: "token" }),
    /Bad credentials/,
  );
});
