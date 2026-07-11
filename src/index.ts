import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nanoid } from "nanoid";
import { githubLogin, publishHtml } from "./github.js";
import { renderPage, type SharedMessage } from "./render.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part ? [String(part.text)] : []).join("\n\n");
}

async function selectMessage(ctx: ExtensionCommandContext): Promise<SharedMessage | undefined> {
  const entries = ctx.sessionManager.getEntries();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const messages = entries.filter((entry): entry is typeof entry & { type: "message" } => entry.type === "message")
    .map((entry) => ({ entry, markdown: "content" in entry.message ? textOf(entry.message.content) : "" }))
    .filter(({ markdown }) => markdown.trim());
  if (!messages.length) {
    ctx.ui.notify("No text messages in this session", "warning");
    return;
  }
  const labels = messages.map(({ entry, markdown }, index) => {
    let depth = 0;
    let parent = entry.parentId ? byId.get(entry.parentId) : undefined;
    while (parent) { depth++; parent = parent.parentId ? byId.get(parent.parentId) : undefined; }
    const preview = markdown.replace(/\s+/g, " ").slice(0, 72);
    return `${String(index + 1).padStart(2, "0")} ${"  ".repeat(Math.min(depth, 6))}${entry.message.role}: ${preview}`;
  });
  const choice = await ctx.ui.select("Select a message from the session tree", labels);
  if (!choice) return;
  const selected = messages[labels.indexOf(choice)]!;
  return { role: selected.entry.message.role, markdown: selected.markdown, timestamp: selected.entry.message.timestamp };
}

async function pageFor(ctx: ExtensionCommandContext): Promise<string | undefined> {
  const message = await selectMessage(ctx);
  if (!message) return;
  const css = await readFile(join(root, "assets/styles.css"), "utf8");
  return renderPage(message, css);
}

async function openBrowser(pi: ExtensionAPI, target: string): Promise<void> {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  const result = await pi.exec(command, args);
  if (result.code !== 0) throw new Error(result.stderr || `Could not open ${target}`);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("view-message", {
    description: "Render a selected message and open it locally",
    handler: async (_args, ctx) => {
      try {
        const html = await pageFor(ctx);
        if (!html) return;
        const path = join(tmpdir(), `pi-message-${nanoid(10)}.html`);
        await writeFile(path, html);
        await openBrowser(pi, pathToFileURL(path).href);
        ctx.ui.notify(`Opened ${path}`, "info");
      } catch (error) { ctx.ui.notify((error as Error).message, "error"); }
    },
  });

  pi.registerCommand("share-message", {
    description: "Publish a selected message to GitHub Pages",
    handler: async (_args, ctx) => {
      try {
        const html = await pageFor(ctx);
        if (!html) return;
        const token = process.env.GITHUB_TOKEN || (await pi.exec("gh", ["auth", "token"])).stdout.trim();
        if (!token) throw new Error("Set GITHUB_TOKEN or authenticate with gh");
        const owner = process.env.PI_MESSAGES_OWNER || await githubLogin(token);
        const url = await publishHtml(nanoid(10), html, {
          token, owner, repo: process.env.PI_MESSAGES_REPO, branch: process.env.PI_MESSAGES_BRANCH,
        });
        await openBrowser(pi, url);
        ctx.ui.notify(`Published ${url}`, "info");
      } catch (error) { ctx.ui.notify((error as Error).message, "error"); }
    },
  });
}
