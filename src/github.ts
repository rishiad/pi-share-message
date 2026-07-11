export interface PublishOptions {
  token: string;
  owner: string;
  repo?: string;
  branch?: string;
}

export async function githubLogin(token: string): Promise<string> {
  const response = await fetch("https://api.github.com/user", { headers: headers(token) });
  if (!response.ok) throw new Error(`GitHub user lookup failed (${response.status})`);
  return ((await response.json()) as { login: string }).login;
}

export async function publishHtml(id: string, html: string, options: PublishOptions): Promise<string> {
  const repo = options.repo ?? "pi-messages";
  const repository = await getRepository(options.token, options.owner, repo);
  const branch = options.branch ?? repository.default_branch;
  const path = `${id}.html`;
  const response = await fetch(`https://api.github.com/repos/${options.owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(options.token), "content-type": "application/json" },
    body: JSON.stringify({ message: `Add shared pi message ${id}`, content: Buffer.from(html).toString("base64"), branch }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    if (response.status === 404) {
      throw new Error(`GitHub branch "${branch}" was not found in ${options.owner}/${repo}`);
    }
    throw new Error(body.message ?? `GitHub upload failed (${response.status})`);
  }
  return `https://${options.owner}.github.io/${repo}/${path}`;
}

async function getRepository(token: string, owner: string, repo: string): Promise<{ default_branch: string }> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitHub repository ${owner}/${repo} was not found. Create it and enable GitHub Pages first.`);
    }
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `GitHub repository lookup failed (${response.status})`);
  }
  return (await response.json()) as { default_branch: string };
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
    "user-agent": "pi-share-message",
  };
}
