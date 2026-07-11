export interface GistOptions {
  token: string;
  filename?: string;
  description?: string;
}

export async function createSecretGist(html: string, options: GistOptions): Promise<string> {
  const filename = options.filename ?? "pi-message.html";
  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: { ...headers(options.token), "content-type": "application/json" },
    body: JSON.stringify({
      description: options.description ?? "Shared pi message",
      public: false,
      files: { [filename]: { content: html } },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `GitHub Gist upload failed (${response.status})`);
  }

  const gist = (await response.json()) as {
    files?: Record<string, { raw_url?: string }>;
  };
  const rawUrl = gist.files?.[filename]?.raw_url;
  if (!rawUrl) throw new Error("GitHub did not return a raw Gist URL");

  const previewUrl = new URL("https://html-preview.github.io/");
  previewUrl.searchParams.set("url", rawUrl);
  return previewUrl.toString();
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
    "user-agent": "pi-share-message",
  };
}
