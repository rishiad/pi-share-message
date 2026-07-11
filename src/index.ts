import {
  DynamicBorder,
  type ExtensionAPI,
  type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Container, SelectList, Text, type SelectItem } from "@earendil-works/pi-tui";
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
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Message selection requires interactive mode", "error");
    return;
  }

  const entries = ctx.sessionManager.getEntries();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const messages = entries.flatMap((entry) => {
    if (entry.type !== "message" || entry.message.role !== "assistant") return [];
    const markdown = textOf(entry.message.content);
    return markdown.trim() ? [{ entry, markdown }] : [];
  });

  if (!messages.length) {
    ctx.ui.notify("No assistant messages in this session", "warning");
    return;
  }

  const items: SelectItem[] = messages.map(({ entry, markdown }, index) => {
    let depth = 0;
    let parent = entry.parentId ? byId.get(entry.parentId) : undefined;
    while (parent) {
      depth++;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return {
      value: entry.id,
      label: `${String(index + 1).padStart(2, "0")} ${markdown.replace(/\s+/g, " ").slice(0, 80)}`,
      description: `${"  ".repeat(Math.min(depth, 6))}assistant · ${new Date(entry.message.timestamp).toLocaleString()}`,
    };
  });

  const choice = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
    const container = new Container();
    const border = () => new DynamicBorder((text: string) => theme.fg("accent", text));
    const selectList = new SelectList(items, Math.min(items.length, 12), {
      selectedPrefix: (text: string) => theme.fg("accent", text),
      selectedText: (text: string) => theme.fg("accent", text),
      description: (text: string) => theme.fg("muted", text),
      scrollInfo: (text: string) => theme.fg("dim", text),
      noMatch: (text: string) => theme.fg("warning", text),
    });

    container.addChild(border());
    container.addChild(new Text(theme.bold(theme.fg("accent", "Select an assistant message")), 1, 0));
    container.addChild(new Text(theme.fg("muted", "Messages from the current pi session tree"), 1, 0));
    container.addChild(selectList);
    container.addChild(new Text(theme.fg("dim", "↑↓ navigate · Enter select · Esc cancel"), 1, 0));
    container.addChild(border());

    selectList.onSelect = (item) => done(item.value);
    selectList.onCancel = () => done(null);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  if (!choice) return;
  const selected = messages.find(({ entry }) => entry.id === choice);
  if (!selected) return;
  return {
    role: selected.entry.message.role,
    markdown: selected.markdown,
    timestamp: selected.entry.message.timestamp,
  };
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
