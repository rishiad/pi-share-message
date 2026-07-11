export interface GistOptions {
  token: string;
  filename?: string;
  description?: string;
}

export interface CreatedGist {
  id: string;
  filename: string;
}

const defaultPreviewBaseUrl = "http://localhost:8080";

export async function createSecretGist(html: string, options: GistOptions): Promise<CreatedGist> {
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
    id?: string;
    files?: Record<string, unknown>;
  };
  if (!gist.id) throw new Error("GitHub did not return a Gist ID");
  if (!gist.files?.[filename]) throw new Error("GitHub did not create the Gist file");

  return { id: gist.id, filename };
}

export function previewUrl(gistId: string, baseUrl = process.env.PI_SHARE_MESSAGE_PREVIEW_URL ?? defaultPreviewBaseUrl): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Preview URL must use HTTP or HTTPS");
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${encodeURIComponent(gistId)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "pi-share-message",
  };
}
