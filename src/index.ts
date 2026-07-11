import {
  TreeSelectorComponent,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type SessionTreeNode,
} from "@earendil-works/pi-coding-agent";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { nanoid } from "nanoid";
import { createSecretGist } from "./gist.js";
import { renderPage, type SharedMessage } from "./render.js";


function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part ? [String(part.text)] : []).join("\n\n");
}

function assistantText(node: SessionTreeNode): string | undefined {
  const entry = node.entry;
  if (entry.type !== "message" || entry.message.role !== "assistant") return;
  const markdown = textOf(entry.message.content);
  return markdown.trim() ? markdown : undefined;
}

function assistantTree(nodes: SessionTreeNode[], parentId: string | null = null): SessionTreeNode[] {
  return nodes.flatMap((node) => {
    const markdown = assistantText(node);
    const kept = markdown !== undefined;
    const children = assistantTree(node.children, kept ? node.entry.id : parentId);
    if (!kept) return children;
    return [{ ...node, entry: { ...node.entry, parentId }, children }];
  });
}

function latestAssistantId(ctx: ExtensionCommandContext): string | null {
  for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
    if (entry.type === "message" && entry.message.role === "assistant" && textOf(entry.message.content).trim()) {
      return entry.id;
    }
  }
  return null;
}

async function selectMessage(ctx: ExtensionCommandContext): Promise<SharedMessage | undefined> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Message selection requires interactive mode", "error");
    return;
  }

  const tree = assistantTree(ctx.sessionManager.getTree());
  if (!tree.length) {
    ctx.ui.notify("No assistant messages in this session", "warning");
    return;
  }

  const selectedId = latestAssistantId(ctx);
  const choice = await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) =>
    new TreeSelectorComponent(
      tree,
      selectedId,
      tui.terminal.rows,
      (entryId) => done(entryId),
      () => done(null),
      undefined,
      selectedId ?? undefined,
      "all",
    ),
  );

  if (!choice) return;
  const selected = ctx.sessionManager.getEntry(choice);
  if (selected?.type !== "message" || selected.message.role !== "assistant") return;
  const markdown = textOf(selected.message.content);
  if (!markdown.trim()) return;
  return { role: selected.message.role, markdown, timestamp: selected.message.timestamp };
}

async function pageFor(ctx: ExtensionCommandContext): Promise<string | undefined> {
  const message = await selectMessage(ctx);
  if (!message) return;
  return renderPage(message);
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
    description: "Share a selected message through a secret GitHub Gist",
    handler: async (_args, ctx) => {
      try {
        const html = await pageFor(ctx);
        if (!html) return;
        const token = process.env.GITHUB_TOKEN || (await pi.exec("gh", ["auth", "token"])).stdout.trim();
        if (!token) throw new Error("Set GITHUB_TOKEN or authenticate with gh");
        const url = await createSecretGist(html, {
          token,
          filename: `pi-message-${nanoid(10)}.html`,
        });
        await openBrowser(pi, url);
        ctx.ui.notify(`Published ${url}`, "info");
      } catch (error) { ctx.ui.notify((error as Error).message, "error"); }
    },
  });
}
