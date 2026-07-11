import assert from "node:assert/strict";
import test from "node:test";
import { createSecretGist, sessionUrl } from "../src/gist.js";

test("creates a secret gist with session.html and returns its ID", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.github.com/gists");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.public, false);
    assert.equal(body.files["session.html"].content, "<html>✓</html>");
    return new Response(JSON.stringify({
      id: "094dae8f192bb7248e98ccf5b10e1ff",
      files: { "session.html": {} },
    }), { status: 201 });
  });

  const gist = await createSecretGist("<html>✓</html>", { token: "token" });
  assert.deepEqual(gist, { id: "094dae8f192bb7248e98ccf5b10e1ff", filename: "session.html" });
});

test("builds a pi.dev session URL from a Gist ID", () => {
  assert.equal(
    sessionUrl("094dae8f192bb7248e98ccf5b10e1ff"),
    "https://pi.dev/session/#094dae8f192bb7248e98ccf5b10e1ff",
  );
});

test("reports gist API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }));
  await assert.rejects(
    createSecretGist("<html></html>", { token: "token" }),
    /Bad credentials/,
  );
});
